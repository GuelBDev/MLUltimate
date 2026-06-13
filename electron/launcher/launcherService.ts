import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { app } from "electron";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { MicrosoftAuthService } from "../auth/microsoftAuthService";
import { OfflineAuthService } from "../auth/offlineAuthService";
import { InstanceService } from "../instances/instanceService";
import { JavaRuntimeService } from "../java/javaRuntimeService";
import { MinecraftVersionService } from "../minecraft/minecraftVersionService";
import type { LaunchEvent, LaunchRequest } from "../../src/types/launcher";

type EmitLaunchEvent = (event: LaunchEvent) => void;
type LaunchState = {
  cancelled: boolean;
  child?: ChildProcess;
  running: boolean;
};

export class LauncherService {
  private activeLaunches = new Map<string, LaunchState>();

  constructor(
    private readonly microsoftAuth: MicrosoftAuthService,
    private readonly offlineAuth: OfflineAuthService,
    private readonly instances: InstanceService,
    private readonly javaRuntimes: JavaRuntimeService,
    private readonly minecraftVersions: MinecraftVersionService,
    private readonly emit: EmitLaunchEvent,
  ) {}

  async launch(request: LaunchRequest) {
    const activeLaunch = this.activeLaunches.get(request.instanceId);

    if (activeLaunch && !request.force) {
      throw new Error("INSTANCE_ALREADY_RUNNING: Esta instância já está aberta ou iniciando.");
    }

    const launchState: LaunchState = {
      cancelled: false,
      child: undefined,
      running: false,
    };
    this.activeLaunches.set(request.instanceId, launchState);
    this.emit({
      id: request.instanceId,
      type: "step",
      message: "Preparando inicializacao...",
      progress: 5,
      createdAt: new Date().toISOString(),
    });

    try {
      const instance = await this.instances.getById(request.instanceId);

      if (!["vanilla", "fabric", "iris", "iris-sodium", "forge"].includes(instance.loader)) {
        throw new Error(
          `A execucao real de ${instance.loader} ainda precisa de instalador proprio. Vanilla, Fabric e Forge ja estao conectados.`,
        );
      }

      const session = await this.getLaunchSession();
      const installed = this.minecraftVersions.getInstalledVersion(instance.minecraftVersion);

      this.assertLaunchNotCancelled(request.instanceId, launchState);

      if (!installed) {
        this.emit({
          id: request.instanceId,
          type: "step",
          message: "Baixando versão do Minecraft...",
          progress: 18,
          createdAt: new Date().toISOString(),
        });
        await this.minecraftVersions.installVersion(instance.minecraftVersion);
      }

      this.assertLaunchNotCancelled(request.instanceId, launchState);

      const installedAfterDownload = this.minecraftVersions.getInstalledVersion(
        instance.minecraftVersion,
      );

      if (!installedAfterDownload) {
        throw new Error("A versão do Minecraft não foi instalada corretamente.");
      }

      this.emit({
        id: request.instanceId,
        type: "step",
        message: "Preparando arquivos...",
        progress: 38,
        createdAt: new Date().toISOString(),
      });

      const versionJson = await this.minecraftVersions.readInstalledVersionJson(
        instance.minecraftVersion,
      );
      if (isFabricBasedLoader(instance.loader)) {
        await this.minecraftVersions.installFabricLoader(instance.minecraftVersion);
      }
      if (instance.loader === "forge") {
        await this.minecraftVersions.installForgeLoader(instance.minecraftVersion);
      }
      this.assertLaunchNotCancelled(request.instanceId, launchState);
      const minecraftRoot = this.minecraftVersions.getMinecraftRoot();
      const nativesDir = path.join(instance.gameDir, ".natives", instance.minecraftVersion);

      mkdirSync(nativesDir, { recursive: true });
      extractNatives(versionJson.libraries, minecraftRoot, nativesDir);

    const fabricProfile =
      isFabricBasedLoader(instance.loader)
        ? await this.minecraftVersions.readInstalledFabricProfile(instance.minecraftVersion)
        : null;
    const forgeProfile =
      instance.loader === "forge"
        ? await this.minecraftVersions.readInstalledForgeProfile(instance.minecraftVersion)
        : null;
    const vanillaLibraries = versionJson.libraries
        .filter((library) => rulesAllow(library.rules))
        .map((library) => library.downloads?.artifact?.path)
        .filter((libraryPath): libraryPath is string => Boolean(libraryPath))
        .map((libraryPath) => path.join(minecraftRoot, "libraries", libraryPath))
        .filter((libraryPath) => existsSync(libraryPath));
    const fabricLibraries = fabricProfile
      ? fabricProfile.libraries
          .map((library) => path.join(minecraftRoot, "libraries", mavenPath(library.name)))
          .filter((libraryPath) => existsSync(libraryPath))
      : [];
    const forgeLibraries = forgeProfile
      ? forgeProfile.libraries
          .filter((library) => rulesAllow(library.rules))
          .map((library) => library.downloads?.artifact?.path)
          .filter((libraryPath): libraryPath is string => Boolean(libraryPath))
          .map((libraryPath) => path.join(minecraftRoot, "libraries", libraryPath))
          .filter((libraryPath) => existsSync(libraryPath))
      : [];
    const classpath = [
      ...vanillaLibraries,
      ...fabricLibraries,
      ...forgeLibraries,
      installedAfterDownload.jar_path,
    ].join(path.delimiter);

    const replacements = {
      auth_player_name: session.name,
      version_name: instance.minecraftVersion,
      game_directory: instance.gameDir,
      assets_root: path.join(minecraftRoot, "assets"),
      assets_index_name:
        versionJson.assetIndex?.id ?? versionJson.assets ?? instance.minecraftVersion,
      auth_uuid: session.uuid,
      auth_access_token: session.accessToken,
      clientid: session.clientId,
      auth_xuid: session.xuid,
      user_type: session.userType,
      user_properties: "{}",
      version_type: versionJson.type,
      natives_directory: nativesDir,
      launcher_name: "MLUltimateLauncher",
      launcher_version: app.getVersion(),
      classpath,
    };

    const vanillaJvmArgs = versionJson.arguments?.jvm
      ? resolveArguments(versionJson.arguments.jvm, replacements)
      : [`-Djava.library.path=${nativesDir}`, "-cp", classpath];
    const fabricJvmArgs = fabricProfile?.arguments?.jvm
      ? resolveArguments(fabricProfile.arguments.jvm, replacements)
      : [];
    const forgeJvmArgs = forgeProfile?.arguments?.jvm
      ? resolveArguments(forgeProfile.arguments.jvm, replacements)
      : [];
    const jvmArgs = [...vanillaJvmArgs, ...fabricJvmArgs, ...forgeJvmArgs];
    const vanillaGameArgs = versionJson.arguments?.game
      ? resolveArguments(versionJson.arguments.game, replacements)
      : splitMinecraftArguments(versionJson.minecraftArguments ?? "").map((argument) =>
          replacePlaceholders(argument, replacements),
        );
    const fabricGameArgs = fabricProfile?.arguments?.game
      ? resolveArguments(fabricProfile.arguments.game, replacements)
      : [];
    const forgeGameArgs = forgeProfile?.arguments?.game
      ? resolveArguments(forgeProfile.arguments.game, replacements)
      : [];
    const gameArgs = [...vanillaGameArgs, ...fabricGameArgs, ...forgeGameArgs];
    this.emit({
      id: request.instanceId,
      type: "step",
      message: "Verificando Java...",
      progress: 72,
      createdAt: new Date().toISOString(),
    });

    const javaBin = await this.javaRuntimes.resolveJava({
      javaPath: instance.javaPath,
      component: versionJson.javaVersion?.component,
      majorVersion: versionJson.javaVersion?.majorVersion,
    });
    const mainClass = forgeProfile?.mainClass ?? fabricProfile?.mainClass ?? versionJson.mainClass;

    this.emit({
      id: request.instanceId,
      type: "step",
      message: `Abrindo Minecraft ${instance.minecraftVersion}...`,
      progress: 100,
      createdAt: new Date().toISOString(),
    });

    await new Promise<void>((resolve, reject) => {
      let handedOff = false;
      let settled = false;
      const child = spawn(javaBin, [...jvmArgs, mainClass, ...gameArgs], {
        cwd: instance.gameDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false,
      });
      launchState.child = child;
      const output: string[] = [];
      const rememberOutput = (chunk: Buffer) => {
        if (handedOff) {
          return;
        }

        const text = chunk.toString("utf8").trim();

        if (!text) {
          return;
        }

        output.push(text);
        if (output.length > 20) {
          output.shift();
        }

        this.emit({
          id: request.instanceId,
          type: "console",
          message: text,
          progress: 100,
          createdAt: new Date().toISOString(),
        });
      };

      const finishLaunch = () => {
        if (settled) {
          return;
        }

        settled = true;
        resolve();
      };

      const failLaunch = (error: Error) => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      };

      let handoffTimer: ReturnType<typeof setTimeout> | null = null;

      child.once("error", (error) => {
        if (handoffTimer) {
          clearTimeout(handoffTimer);
        }
        this.activeLaunches.delete(request.instanceId);
        failLaunch(error);
      });
      child.stdout?.on("data", rememberOutput);
      child.stderr?.on("data", rememberOutput);
      child.once("exit", (code) => {
        if (handoffTimer) {
          clearTimeout(handoffTimer);
        }
        this.activeLaunches.delete(request.instanceId);
        if (handedOff) {
          this.emit({
            id: request.instanceId,
            type: "closed",
            message: "Minecraft fechado.",
            progress: 0,
            createdAt: new Date().toISOString(),
          });
          return;
        }

        if (launchState.cancelled) {
          finishLaunch();
          return;
        }

        if (code !== null && code !== 0) {
          const details = output.slice(-8).join("\n").slice(-2200);
          failLaunch(
            new Error(
              details
                ? `Minecraft fechou com erro ${code}.\n${details}`
                : `Minecraft fechou com erro ${code}.`,
            ),
          );
          return;
        }

        finishLaunch();
      });
      handoffTimer = setTimeout(() => {
        handedOff = true;
        launchState.running = true;
        child.stdout?.off("data", rememberOutput);
        child.stderr?.off("data", rememberOutput);
        child.unref();
        this.emit({
          id: request.instanceId,
          type: "running",
          message: "Minecraft aberto.",
          progress: 100,
          createdAt: new Date().toISOString(),
        });
        finishLaunch();
      }, 3500);
    });

    this.emit({
      id: request.instanceId,
      type: "complete",
      message: "Minecraft iniciado.",
      progress: 100,
      createdAt: new Date().toISOString(),
    });
    } catch (error) {
      if (!launchState.child || launchState.cancelled) {
        this.activeLaunches.delete(request.instanceId);
      }

      this.emit({
        id: request.instanceId,
        type: launchState.cancelled ? "cancelled" : "error",
        message: error instanceof Error ? error.message : "Não foi possível iniciar.",
        progress: launchState.cancelled ? 0 : undefined,
        createdAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  cancel(request?: { instanceId?: string }) {
    const entries = request?.instanceId
      ? ([[
          request.instanceId,
          this.activeLaunches.get(request.instanceId),
        ]] as Array<[string, { cancelled: boolean; child?: ChildProcess } | undefined]>)
      : [...this.activeLaunches.entries()];

    for (const [instanceId, state] of entries) {
      if (!state) {
        continue;
      }

      state.cancelled = true;
      if (state.child && !state.child.killed) {
        void killProcessTree(state.child);
      }

      this.activeLaunches.delete(instanceId);

      this.emit({
        id: instanceId,
        type: "cancelled",
        message: "Inicializacao cancelada.",
        progress: 0,
        createdAt: new Date().toISOString(),
      });
    }
  }

  async kill(request: { instanceId: string }) {
    const state = this.activeLaunches.get(request.instanceId);

    if (!state?.child || state.child.killed) {
      throw new Error("Essa instância não está aberta pelo launcher.");
    }

    state.cancelled = true;
    await killProcessTree(state.child);
    this.activeLaunches.delete(request.instanceId);
    this.emit({
      id: request.instanceId,
      type: "killed",
      message: "Minecraft encerrado pelo launcher.",
      progress: 0,
      createdAt: new Date().toISOString(),
    });
  }

  listRunningInstances() {
    return [...this.activeLaunches.entries()]
      .filter(([, state]) => state.running && state.child && !state.child.killed)
      .map(([instanceId]) => instanceId);
  }

  private assertLaunchNotCancelled(
    instanceId: string,
    state: LaunchState,
  ) {
    if (!state.cancelled) {
      return;
    }

    this.activeLaunches.delete(instanceId);
    this.emit({
      id: instanceId,
      type: "cancelled",
      message: "Inicializacao cancelada.",
      progress: 0,
      createdAt: new Date().toISOString(),
    });
    throw new Error("Inicializacao cancelada.");
  }

  private async getLaunchSession() {
    const microsoftSession = await this.microsoftAuth.getSession();

    if (microsoftSession.status === "signed-in") {
      const secure = await this.microsoftAuth.requireLicensedSession();
      return {
        name: secure.minecraftName ?? secure.displayName,
        uuid: secure.minecraftUuid ?? secure.xuid,
        accessToken: secure.minecraftAccessToken,
        userType: "msa",
        clientId: secure.accountId,
        xuid: secure.xuid,
      };
    }

    const offlineSession = this.offlineAuth.getLastOfflineSession();

    if (!offlineSession || offlineSession.status !== "signed-in") {
      throw new Error(
        "Escolha um nick offline ou entre com Microsoft antes de iniciar uma instância.",
      );
    }

    return {
      name: offlineSession.account.displayName,
      uuid: createHash("md5")
        .update(`OfflinePlayer:${offlineSession.account.displayName}`)
        .digest("hex"),
      accessToken: "0",
      userType: "legacy",
      clientId: "offline",
      xuid: "offline",
    };
  }
}

type Library = Awaited<
  ReturnType<MinecraftVersionService["readInstalledVersionJson"]>
>["libraries"][number];

const extractNatives = (libraries: Library[], minecraftRoot: string, nativesDir: string) => {
  for (const library of libraries) {
    if (!rulesAllow(library.rules)) {
      continue;
    }

    const nativeKey = library.natives?.windows?.replace("${arch}", "64");
    const nativePath = nativeKey ? library.downloads?.classifiers?.[nativeKey]?.path : null;

    if (!nativePath) {
      continue;
    }

    const nativeJar = path.join(minecraftRoot, "libraries", nativePath);

    if (!existsSync(nativeJar)) {
      continue;
    }

    const zip = new AdmZip(nativeJar);

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || entry.entryName.startsWith("META-INF/")) {
        continue;
      }

      zip.extractEntryTo(entry, nativesDir, false, true);
    }
  }
};

const resolveArguments = (
  args: unknown[],
  replacements: Record<string, string>,
): string[] =>
  args.flatMap((argument) => {
    if (typeof argument === "string") {
      return [replacePlaceholders(argument, replacements)];
    }

    if (!argument || typeof argument !== "object") {
      return [];
    }

    const candidate = argument as {
      rules?: Array<{
        action: "allow" | "disallow";
        os?: { name?: string };
        features?: Record<string, boolean>;
      }>;
      value?: string | string[];
    };

    if (!rulesAllow(candidate.rules) || !candidate.value) {
      return [];
    }

    const values = Array.isArray(candidate.value) ? candidate.value : [candidate.value];
    return values.map((value) => replacePlaceholders(value, replacements));
  });

const replacePlaceholders = (value: string, replacements: Record<string, string>) =>
  value.replace(/\$\{([^}]+)\}/g, (_, key: string) => replacements[key] ?? "");

const splitMinecraftArguments = (input: string) =>
  input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];

const isFabricBasedLoader = (loader: string) =>
  loader === "fabric" || loader === "iris" || loader === "iris-sodium";

const killProcessTree = (child: ChildProcess) =>
  new Promise<void>((resolve) => {
    if (!child.pid || child.killed) {
      resolve();
      return;
    }

    if (process.platform !== "win32") {
      child.kill("SIGTERM");
      resolve();
      return;
    }

    const taskkill = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });

    taskkill.once("exit", () => resolve());
    taskkill.once("error", () => {
      child.kill();
      resolve();
    });
  });

const rulesAllow = (
  rules?: Array<{
    action: "allow" | "disallow";
    os?: { name?: string };
    features?: Record<string, boolean>;
  }>,
) => {
  if (!rules || rules.length === 0) {
    return true;
  }

  let allowed = false;

  for (const rule of rules) {
    const osMatches =
      !rule.os?.name || rule.os.name === "windows" || rule.os.name === process.platform;
    const featureMatches = !rule.features;

    if (osMatches && featureMatches) {
      allowed = rule.action === "allow";
    }
  }

  return allowed;
};

const mavenPath = (coordinate: string) => {
  const [group, artifact, version, classifier] = coordinate.split(":");

  if (!group || !artifact || !version) {
    throw new Error(`Coordenada Maven invalida: ${coordinate}`);
  }

  const fileName = classifier
    ? `${artifact}-${version}-${classifier}.jar`
    : `${artifact}-${version}.jar`;

  return path.join(...group.split("."), artifact, version, fileName);
};
