import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { AvatarService } from "../avatar/avatarService";
import { MicrosoftAuthService } from "../auth/microsoftAuthService";
import { OfflineAuthService } from "../auth/offlineAuthService";
import { InstanceService } from "../instances/instanceService";
import { JavaRuntimeService } from "../java/javaRuntimeService";
import { MinecraftVersionService } from "../minecraft/minecraftVersionService";
import { repairLaunchCompatibility } from "./launchCompatibility";
import type { LauncherInstance, LaunchEvent, LaunchRequest } from "../../src/types/launcher";

type EmitLaunchEvent = (event: LaunchEvent) => void;
type LaunchState = {
  cancelled: boolean;
  child?: ChildProcess;
  running: boolean;
  playStartedAt?: number;
  playRecordedAt?: number;
  playTimer?: ReturnType<typeof setInterval>;
};

export class LauncherService {
  private activeLaunches = new Map<string, LaunchState>();

  constructor(
    private readonly microsoftAuth: MicrosoftAuthService,
    private readonly offlineAuth: OfflineAuthService,
    private readonly instances: InstanceService,
    private readonly javaRuntimes: JavaRuntimeService,
    private readonly minecraftVersions: MinecraftVersionService,
    private readonly avatar: AvatarService,
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
      const instance = await this.instances.applyModpackRuntimeRecommendations(
        request.instanceId,
      );
      const removedPvpArtifacts = cleanupLegacyPvpKitArtifacts(instance);

      if (removedPvpArtifacts.length > 0) {
        this.emit({
          id: request.instanceId,
          type: "step",
          message: `Reparando Kit PvP: removendo ${removedPvpArtifacts.join(", ")}...`,
          progress: 12,
          createdAt: new Date().toISOString(),
        });
      }

      const lockedFileRepairs = await this.instances.repairLockedModpackFiles(instance);

      if (lockedFileRepairs.length > 0) {
        this.emit({
          id: request.instanceId,
          type: "step",
          message: `Arquivos do modpack reparados:\n${lockedFileRepairs.slice(0, 6).join("\n")}`,
          progress: 14,
          createdAt: new Date().toISOString(),
        });
      }

      if (
        !["vanilla", "fabric", "iris", "iris-sodium", "quilt", "forge", "neoforge"].includes(
          instance.loader,
        )
      ) {
        throw new Error(
          `A execução real de ${instance.loader} ainda precisa de instalador próprio.`,
        );
      }

      const session = await this.getLaunchSession();

      if (session.provider === "offline") {
        const syncedSkin = this.avatar.syncEquippedSkinForPlayer(instance.gameDir, session.name);

        if (syncedSkin) {
          this.emit({
            id: request.instanceId,
            type: "step",
            message: `Skin offline aplicada: ${syncedSkin.skinName}.`,
            progress: 15,
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (request.server?.requiresMicrosoft && session.provider !== "microsoft") {
        throw new Error(
          `${request.server.name ?? request.server.host} exige uma conta Microsoft licenciada. Entre com Microsoft para acessar servidores premium como Hypixel.`,
        );
      }
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

      this.emit({
        id: request.instanceId,
        type: "step",
        message: "Baixando bibliotecas...",
        progress: 42,
        createdAt: new Date().toISOString(),
      });
      await this.minecraftVersions.verifyLibrariesForLaunch({
        minecraftVersion: instance.minecraftVersion,
        loader: instance.loader,
        loaderVersion: instance.loaderVersion,
      });
      this.assertLaunchNotCancelled(request.instanceId, launchState);

      this.emit({
        id: request.instanceId,
        type: "step",
        message: "Verificando assets do jogo...",
        progress: 56,
        createdAt: new Date().toISOString(),
      });
      await this.minecraftVersions.verifyAssetsForLaunch(instance.minecraftVersion);
      this.assertLaunchNotCancelled(request.instanceId, launchState);

      this.emit({
        id: request.instanceId,
        type: "step",
        message: "Preparando loader...",
        progress: 68,
        createdAt: new Date().toISOString(),
      });

      if (isFabricBasedLoader(instance.loader)) {
        await this.minecraftVersions.installFabricLoader(
          instance.minecraftVersion,
          instance.loaderVersion,
        );
      }
      if (instance.loader === "quilt") {
        await this.minecraftVersions.installQuiltLoader(
          instance.minecraftVersion,
          instance.loaderVersion,
        );
      }
      if (instance.loader === "forge") {
        await this.minecraftVersions.installForgeLoader(
          instance.minecraftVersion,
          instance.loaderVersion,
        );
      }
      if (instance.loader === "neoforge") {
        await this.minecraftVersions.installNeoForgeLoader(
          instance.minecraftVersion,
          instance.loaderVersion,
        );
      }
      this.assertLaunchNotCancelled(request.instanceId, launchState);
      const minecraftRoot = this.minecraftVersions.getMinecraftRoot();
      const nativesDir = path.join(instance.gameDir, ".natives", instance.minecraftVersion);

      mkdirSync(nativesDir, { recursive: true });
      extractNatives(versionJson.libraries, minecraftRoot, nativesDir);

    const fabricProfile =
      isFabricBasedLoader(instance.loader)
        ? await this.minecraftVersions.readInstalledFabricProfile(
            instance.minecraftVersion,
            instance.loaderVersion,
          )
        : null;
    const quiltProfile =
      instance.loader === "quilt"
        ? await this.minecraftVersions.readInstalledQuiltProfile(
            instance.minecraftVersion,
            instance.loaderVersion,
          )
        : null;
    const lightweightProfile = fabricProfile ?? quiltProfile;
    const forgeProfile =
      instance.loader === "forge"
        ? await this.minecraftVersions.readInstalledForgeProfile(
            instance.minecraftVersion,
            instance.loaderVersion,
          )
        : null;
    const neoForgeProfile =
      instance.loader === "neoforge"
        ? await this.minecraftVersions.readInstalledNeoForgeProfile(
            instance.minecraftVersion,
            instance.loaderVersion,
          )
        : null;
    const runtimeRepairs = repairLaunchCompatibility({
      instance,
      loaderVersion: instance.loaderVersion ?? forgeProfile?.id ?? neoForgeProfile?.id,
    });

    if (runtimeRepairs.length > 0) {
      this.emit({
        id: request.instanceId,
        type: "step",
        message: `Compatibilidade reparada antes do Play:\n${runtimeRepairs.slice(0, 6).join("\n")}`,
        progress: 55,
        createdAt: new Date().toISOString(),
      });
    }

    const vanillaLibraries = versionJson.libraries
        .filter((library) => rulesAllow(library.rules))
        .map((library) => library.downloads?.artifact?.path)
        .filter((libraryPath): libraryPath is string => Boolean(libraryPath))
        .map((libraryPath) => path.join(minecraftRoot, "libraries", libraryPath))
        .filter((libraryPath) => existsSync(libraryPath));
    const lightweightLibraries = lightweightProfile
      ? lightweightProfile.libraries
          .map((library) => path.join(minecraftRoot, "libraries", mavenPath(library.name)))
          .filter((libraryPath) => existsSync(libraryPath))
      : [];
    const loaderProfile = forgeProfile ?? neoForgeProfile;
    const loaderLibraries = loaderProfile
      ? loaderProfile.libraries
          .filter((library) => rulesAllow(library.rules))
          .filter((library) => library.clientreq !== false)
          .map((library) => library.downloads?.artifact?.path ?? safeMavenPath(library.name))
          .filter((libraryPath): libraryPath is string => Boolean(libraryPath))
          .map((libraryPath) => path.join(minecraftRoot, "libraries", libraryPath))
          .filter((libraryPath) => existsSync(libraryPath))
      : [];
    const classpath = uniquePaths([
      ...vanillaLibraries,
      ...lightweightLibraries,
      ...loaderLibraries,
      installedAfterDownload.jar_path,
    ]).join(path.delimiter);

    const selectedVersionName = getLaunchVersionName(
      instance,
      loaderProfile?.id ?? lightweightProfile?.id ?? versionJson.id ?? instance.minecraftVersion,
    );
    const libraryDirectory = path.join(minecraftRoot, "libraries");
    const replacements = {
      auth_player_name: session.name,
      version_name: selectedVersionName,
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
      library_directory: libraryDirectory,
      classpath_separator: path.delimiter,
      launcher_name: "MLUltimateLauncher",
      launcher_version: app.getVersion(),
      classpath,
    };

    const vanillaJvmArgs = versionJson.arguments?.jvm
      ? resolveArguments(versionJson.arguments.jvm, replacements)
      : [`-Djava.library.path=${nativesDir}`, "-cp", classpath];
    const lightweightJvmArgs = lightweightProfile?.arguments?.jvm
      ? resolveArguments(lightweightProfile.arguments.jvm, replacements)
      : [];
    const loaderProfileJvmArgs = loaderProfile?.arguments?.jvm
      ? ensureMinecraftJarIsIgnored(
          resolveArguments(loaderProfile.arguments.jvm, replacements),
          [selectedVersionName, `${selectedVersionName}.jar`, path.basename(installedAfterDownload.jar_path)],
        )
      : [];
    const loaderJvmArgs = stripMemoryJvmArgs([
      ...vanillaJvmArgs,
      ...lightweightJvmArgs,
      ...loaderProfileJvmArgs,
    ]);
    const customJvmArgs = readInstanceJvmArgs(instance.gameDir);
    const jvmArgs = [...buildMemoryJvmArgs(instance.ramMb), ...customJvmArgs, ...loaderJvmArgs];
    const vanillaGameArgs = versionJson.arguments?.game
      ? resolveArguments(versionJson.arguments.game, replacements)
      : splitMinecraftArguments(versionJson.minecraftArguments ?? "").map((argument) =>
          replacePlaceholders(argument, replacements),
        );
    const lightweightGameArgs = lightweightProfile?.arguments?.game
      ? resolveArguments(lightweightProfile.arguments.game, replacements)
      : [];
    const loaderProfileGameArgs = loaderProfile?.arguments?.game
      ? resolveArguments(loaderProfile.arguments.game, replacements)
      : [];
    const legacyLoaderGameArgs = loaderProfile?.minecraftArguments
      ? splitMinecraftArguments(loaderProfile.minecraftArguments).map((argument) =>
          replacePlaceholders(argument, replacements),
        )
      : null;
    const serverArgs = request.server
      ? ["--server", request.server.host, "--port", String(request.server.port ?? 25565)]
      : [];
    const gameArgs = [
      ...(legacyLoaderGameArgs ?? [
        ...vanillaGameArgs,
        ...lightweightGameArgs,
        ...loaderProfileGameArgs,
      ]),
      ...serverArgs,
    ];
    this.emit({
      id: request.instanceId,
      type: "step",
      message: `Validando Java ${versionJson.javaVersion?.majorVersion ?? 8}...`,
      progress: 72,
      createdAt: new Date().toISOString(),
    });

    const javaBin = await this.javaRuntimes.resolveJava({
      javaPath: instance.javaPath,
      component: versionJson.javaVersion?.component,
      majorVersion: versionJson.javaVersion?.majorVersion,
    });
    this.emit({
      id: request.instanceId,
      type: "step",
      message: `Java selecionado: ${javaBin}`,
      progress: 74,
      createdAt: new Date().toISOString(),
    });
    const mainClass =
      loaderProfile?.mainClass ?? lightweightProfile?.mainClass ?? versionJson.mainClass;
    const launchArgs = [...jvmArgs, mainClass, ...gameArgs];
    writeLaunchDiagnostics(instance.gameDir, javaBin, launchArgs);

    this.emit({
      id: request.instanceId,
      type: "step",
      message: request.server
        ? `Abrindo ${request.server.name ?? request.server.host} no Minecraft ${instance.minecraftVersion}...`
        : `Abrindo Minecraft ${instance.minecraftVersion}...`,
      progress: 100,
      createdAt: new Date().toISOString(),
    });

    await new Promise<void>((resolve, reject) => {
      let handedOff = false;
      let settled = false;
      const launchProcessStartedAt = Date.now();
      const child = spawn(javaBin, launchArgs, {
        cwd: instance.gameDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false,
      });
      launchState.child = child;
      const output: string[] = [];
      const rememberOutput = (chunk: Buffer) => {
        const text = chunk.toString("utf8").trim();

        if (!text) {
          return;
        }

        output.push(text);
        if (output.length > 80) {
          output.shift();
        }

        if (!handedOff && isMinecraftStartupComplete(output)) {
          handoffLaunch("Minecraft carregado.");
        }

        if (!handedOff) {
          this.emit({
            id: request.instanceId,
            type: "console",
            message: text,
            progress: 100,
            createdAt: new Date().toISOString(),
          });
        }
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
      const handoffLaunch = (message: string) => {
        if (handedOff || settled) {
          return;
        }

        if (handoffTimer) {
          clearTimeout(handoffTimer);
          handoffTimer = null;
        }

        handedOff = true;
        launchState.running = true;
        launchState.playStartedAt = Date.now();
        launchState.playRecordedAt = launchState.playStartedAt;
        void this.instances.markLaunchStarted(
          request.instanceId,
          new Date(launchState.playStartedAt).toISOString(),
        );
        launchState.playTimer = setInterval(
          () => this.flushPlayTime(request.instanceId, launchState),
          60_000,
        );
        child.unref();
        this.emit({
          id: request.instanceId,
          type: "running",
          message,
          progress: 100,
          createdAt: new Date().toISOString(),
        });
        finishLaunch();
      };

      child.once("error", (error) => {
        if (handoffTimer) {
          clearTimeout(handoffTimer);
        }
        if (launchState.playTimer) {
          clearInterval(launchState.playTimer);
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
        if (launchState.playTimer) {
          clearInterval(launchState.playTimer);
        }
        this.flushPlayTime(request.instanceId, launchState);
        this.activeLaunches.delete(request.instanceId);
        if (handedOff) {
          const details = summarizeLaunchFailure(output, instance.gameDir, launchProcessStartedAt);
          this.emit({
            id: request.instanceId,
            type: code === 0 ? "closed" : "error",
            message:
              code === 0
                ? "Minecraft fechado."
                : details
                  ? `Minecraft fechou com erro ${code}.\n${details}`
                  : `Minecraft fechou com erro ${code}.`,
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
          const details = summarizeLaunchFailure(output, instance.gameDir, launchProcessStartedAt);
          failLaunch(
            new Error(
              details
                ? `Minecraft fechou com erro ${code}.\n${details}`
                : `Minecraft fechou com erro ${code}.`,
            ),
          );
          return;
        }

        const details = summarizeLaunchFailure(output, instance.gameDir, launchProcessStartedAt);
        failLaunch(
          new Error(
            details
              ? `Minecraft fechou antes de confirmar que abriu.\n${details}`
              : "Minecraft fechou antes de confirmar que abriu.",
          ),
        );
      });
      handoffTimer = setTimeout(() => {
        handoffLaunch("Minecraft ainda carregando em segundo plano.");
      }, 180_000);
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

  private flushPlayTime(instanceId: string, state: LaunchState) {
    if (!state.playStartedAt || !state.playRecordedAt) {
      return;
    }

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - state.playRecordedAt) / 1000);

    if (elapsedSeconds <= 0) {
      return;
    }

    state.playRecordedAt += elapsedSeconds * 1000;
    void this.instances.recordPlaySession(
      instanceId,
      elapsedSeconds,
      new Date(now).toISOString(),
    );
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
        provider: "microsoft" as const,
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
      provider: "offline" as const,
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

const stripMemoryJvmArgs = (args: string[]) =>
  args.filter((argument) => !/^-Xm[sx]/i.test(argument));

const uniquePaths = (paths: string[]) => {
  const seen = new Set<string>();

  return paths.filter((candidate) => {
    const key = path.resolve(candidate).toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const summarizeLaunchFailure = (output: string[], gameDir?: string, startedAt?: number) => {
  const lines = [
    ...output.flatMap((entry) => entry.split(/\r?\n/)),
    ...(gameDir ? readInstanceLaunchLogLines(gameDir, startedAt) : []),
  ].filter(Boolean);
  const rootCause = lines.find((line) =>
    /exception in thread|caused by:|\[(?:fatal|error)\]|java\.[\w.]+(?:exception|error):/i.test(
      line,
    ),
  );
  const tail = lines.slice(-28);
  const selected = rootCause && !tail.includes(rootCause) ? [rootCause, ...tail] : tail;
  const silentForgeExit = !rootCause && looksLikeSilentForgeBootstrapExit(tail);

  if (silentForgeExit) {
    selected.unshift(
      "Forge fechou durante o bootstrap sem registrar uma causa clara. O launcher anexou o fim do debug.log para identificar o ultimo ponto antes da queda.",
    );
  }

  return selected.join("\n").slice(-3000);
};

const readInstanceLaunchLogLines = (gameDir: string, startedAt?: number) => {
  const logsDir = path.join(gameDir, "logs");
  const candidates = ["debug.log", "latest.log"]
    .map((name) => path.join(logsDir, name))
    .filter((filePath) => existsSync(filePath))
    .filter((filePath) => {
      if (!startedAt) {
        return true;
      }

      try {
        return statSync(filePath).mtimeMs >= startedAt - 5_000;
      } catch {
        return false;
      }
    });

  return uniqueLineList(
    candidates.flatMap((filePath) => {
      try {
        return readFileSync(filePath, "utf8").split(/\r?\n/).slice(-80);
      } catch {
        return [];
      }
    }),
  );
};

const uniqueLineList = (lines: string[]) => Array.from(new Set(lines.filter(Boolean)));

const isMinecraftStartupComplete = (output: string[]) => {
  const text = output.join("\n");

  return /Game took \d+(?:\.\d+)? seconds to start/i.test(text) ||
    /Created: .+textures\/atlas\/.+-atlas/i.test(text) ||
    /Loaded \d+ shader sources/i.test(text) ||
    /Connecting to .+, \d+/i.test(text) ||
    /Sound engine started/i.test(text) ||
    /OpenAL initialized/i.test(text);
};

const looksLikeSilentForgeBootstrapExit = (lines: string[]) => {
  if (lines.length === 0) {
    return false;
  }

  const joined = lines.join("\n");
  const lastMeaningful = [...lines].reverse().find((line) => line.trim());

  return Boolean(
    lastMeaningful &&
      /moddiscovery|ModFileParser|ModFileInfo|EARLYDISPLAY|MODLAUNCHER/i.test(joined) &&
      !/loading complete|minecraft client initialized|Stopping!/i.test(joined),
  );
};

const ensureMinecraftJarIsIgnored = (args: string[], ignoredNames: string | string[]) => {
  const requiredIgnored = (Array.isArray(ignoredNames) ? ignoredNames : [ignoredNames])
    .map((entry) => entry.trim())
    .filter(Boolean);

  return args.map((argument) => {
    if (!argument.startsWith("-DignoreList=")) {
      return argument;
    }

    const ignored = argument
      .slice("-DignoreList=".length)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    for (const required of requiredIgnored) {
      if (!ignored.some((entry) => entry.toLowerCase() === required.toLowerCase())) {
        ignored.push(required);
      }
    }

    return `-DignoreList=${ignored.join(",")}`;
  });
};

const buildMemoryJvmArgs = (ramMb: number) => {
  const maxMemory = Math.min(65536, Math.max(1024, Math.round(ramMb)));
  const initialMemory = Math.min(512, maxMemory);

  return [`-Xms${initialMemory}M`, `-Xmx${maxMemory}M`];
};

const getLaunchVersionName = (instance: LauncherInstance, fallback: string) => {
  if (instance.loader === "forge" && instance.loaderVersion) {
    return `forge-${instance.loaderVersion}`;
  }

  if (instance.loader === "neoforge" && instance.loaderVersion) {
    return `neoforge-${instance.loaderVersion}`;
  }

  return fallback;
};

const readInstanceJvmArgs = (gameDir: string) => {
  const argsPath = path.join(gameDir, "config", "mlultimate-jvm.args");

  if (!existsSync(argsPath)) {
    return [];
  }

  try {
    return readFileSync(argsPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .filter((line) => !/^-Xm[sx]/i.test(line));
  } catch {
    return [];
  }
};

const isFabricBasedLoader = (loader: string) =>
  loader === "fabric" || loader === "iris" || loader === "iris-sodium";

const legacyPvpModPattern = /(basichud|oneconfig|togglesneak).*\.jar$/i;
const legacyPvpFolders = ["OneConfig", ".mixin.out"];

const cleanupLegacyPvpKitArtifacts = (instance: LauncherInstance) => {
  if (
    instance.minecraftVersion !== "1.8.9" ||
    instance.loader !== "forge" ||
    !instance.name.toLowerCase().includes("pvp")
  ) {
    return [];
  }

  const removed: string[] = [];

  for (const folder of legacyPvpFolders) {
    if (removePathInsideGameDir(instance.gameDir, folder)) {
      removed.push(folder);
    }
  }

  const modsDir = path.join(instance.gameDir, "mods");

  if (!existsSync(modsDir)) {
    return removed;
  }

  for (const entry of readdirSync(modsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !legacyPvpModPattern.test(entry.name)) {
      continue;
    }

    if (removePathInsideGameDir(instance.gameDir, path.join("mods", entry.name))) {
      removed.push(entry.name);
    }
  }

  return removed;
};

const removePathInsideGameDir = (gameDir: string, relativePath: string) => {
  const root = path.resolve(gameDir);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }

  if (!existsSync(target)) {
    return false;
  }

  rmSync(target, { recursive: true, force: true });
  return true;
};

const minecraftOperatingSystem = () => {
  if (process.platform === "win32") {
    return "windows";
  }

  if (process.platform === "darwin") {
    return "osx";
  }

  return "linux";
};

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
    const osMatches = !rule.os?.name || rule.os.name === minecraftOperatingSystem();
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

const safeMavenPath = (coordinate: string) => {
  try {
    return mavenPath(coordinate);
  } catch {
    return null;
  }
};

const writeLaunchDiagnostics = (gameDir: string, javaBin: string, args: string[]) => {
  try {
    const logsDir = path.join(gameDir, "logs");
    mkdirSync(logsDir, { recursive: true });
    const redactedArgs = args.map((argument, index) => {
      const previous = args[index - 1];

      if (previous === "--accessToken" || previous === "--clientId" || previous === "--xuid") {
        return "********";
      }

      return argument;
    });

    writeFileSync(
      path.join(logsDir, "mlultimate-launch-command.json"),
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          cwd: gameDir,
          javaBin,
          args: redactedArgs,
          commandLine: [javaBin, ...redactedArgs].join(" "),
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch {
    // Diagnostics should never block the game launch.
  }
};
