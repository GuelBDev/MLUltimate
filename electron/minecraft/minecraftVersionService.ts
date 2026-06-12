import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { net } from "electron";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { DownloadManager } from "../downloads/downloadManager";
import { JavaRuntimeService } from "../java/javaRuntimeService";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type { MinecraftVersionSummary } from "../../src/types/launcher";

const VERSION_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FABRIC_META_URL = "https://meta.fabricmc.net/v2";
const FORGE_MAVEN = "https://maven.minecraftforge.net";
const FORGE_METADATA_URL = `${FORGE_MAVEN}/net/minecraftforge/forge/maven-metadata.xml`;

const versionManifestSchema = z.object({
  latest: z.object({
    release: z.string(),
    snapshot: z.string(),
  }),
  versions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["release", "snapshot", "old_beta", "old_alpha"]),
      url: z.string().url(),
      releaseTime: z.string(),
      sha1: z.string().optional(),
    }),
  ),
});

const artifactSchema = z.object({
  path: z.string(),
  sha1: z.string().optional(),
  size: z.number().optional(),
  url: z.string().url(),
});

const ruleSchema = z.object({
  action: z.enum(["allow", "disallow"]),
  os: z
    .object({
      name: z.string().optional(),
      arch: z.string().optional(),
    })
    .optional(),
});

const versionJsonSchema = z.object({
  id: z.string(),
  type: z.string(),
  mainClass: z.string(),
  assets: z.string().optional(),
  minecraftArguments: z.string().optional(),
  arguments: z
    .object({
      game: z.array(z.unknown()).optional(),
      jvm: z.array(z.unknown()).optional(),
    })
    .optional(),
  javaVersion: z
    .object({
      component: z.string().optional(),
      majorVersion: z.number().optional(),
    })
    .optional(),
  assetIndex: z
    .object({
      id: z.string(),
      sha1: z.string().optional(),
      url: z.string().url(),
    })
    .optional(),
  downloads: z.object({
    client: z.object({
      sha1: z.string().optional(),
      url: z.string().url(),
    }),
  }),
  libraries: z
    .array(
      z.object({
        name: z.string(),
        downloads: z
          .object({
            artifact: artifactSchema.optional(),
            classifiers: z.record(z.string(), artifactSchema).optional(),
          })
          .optional(),
        rules: z.array(ruleSchema).optional(),
        natives: z.record(z.string(), z.string()).optional(),
      }),
    )
    .default([]),
});

const assetIndexSchema = z.object({
  objects: z.record(
    z.string(),
    z.object({
      hash: z.string(),
      size: z.number().optional(),
    }),
  ),
});

const fabricLoaderListSchema = z.array(
  z.object({
    loader: z.object({
      version: z.string(),
    }),
  }),
);

const fabricProfileSchema = z.object({
  id: z.string(),
  mainClass: z.string(),
  arguments: z
    .object({
      game: z.array(z.unknown()).optional(),
      jvm: z.array(z.unknown()).optional(),
    })
    .optional(),
  libraries: z.array(
    z.object({
      name: z.string(),
      url: z.string().url(),
      sha1: z.string().optional(),
    }),
  ),
});

const loaderArtifactSchema = z.object({
  path: z.string(),
  sha1: z.string().optional(),
  size: z.number().optional(),
  url: z.string().optional(),
});

const loaderProfileSchema = z.object({
  id: z.string(),
  inheritsFrom: z.string().optional(),
  mainClass: z.string(),
  arguments: z
    .object({
      game: z.array(z.unknown()).optional(),
      jvm: z.array(z.unknown()).optional(),
    })
    .optional(),
  minecraftArguments: z.string().optional(),
  libraries: z
    .array(
      z.object({
        name: z.string(),
        downloads: z
          .object({
            artifact: loaderArtifactSchema.optional(),
            classifiers: z.record(z.string(), loaderArtifactSchema).optional(),
          })
          .optional(),
        rules: z.array(ruleSchema).optional(),
        natives: z.record(z.string(), z.string()).optional(),
      }),
    )
    .default([]),
});

type InstalledVersionRow = {
  id: string;
  type: string;
  release_time: string;
  json_path: string;
  jar_path: string;
  installed_at: string;
};

export class MinecraftVersionService {
  private rootDir = getLauncherDataSubpath("Minecraft");

  constructor(
    private readonly database: LauncherDatabase,
    private readonly downloads: DownloadManager,
    private readonly javaRuntimes: JavaRuntimeService,
  ) {}

  async listVersions(): Promise<MinecraftVersionSummary[]> {
    const manifest = await this.fetchManifest();
    const installedRows = this.database.all<InstalledVersionRow>(
      "SELECT id FROM installed_minecraft_versions",
    );
    const installed = new Set(installedRows.map((row) => row.id));

    const sortedVersions = [...manifest.versions].sort((left, right) => {
      if (left.id === manifest.latest.release) return -1;
      if (right.id === manifest.latest.release) return 1;

      return Date.parse(right.releaseTime) - Date.parse(left.releaseTime);
    });

    return sortedVersions.map((version) => ({
      id: version.id,
      type: version.type,
      releaseTime: version.releaseTime,
      installed: installed.has(version.id),
    }));
  }

  async installVersion(versionId: string) {
    const installedVersion = this.getInstalledVersion(versionId);

    if (
      installedVersion &&
      existsSync(installedVersion.json_path) &&
      existsSync(installedVersion.jar_path)
    ) {
      return;
    }

    const manifest = await this.fetchManifest();
    const summary = manifest.versions.find((version) => version.id === versionId);

    if (!summary) {
      throw new Error(`Versão Minecraft ${versionId} não encontrada no manifesto oficial.`);
    }

    const versionDir = path.join(this.rootDir, "versions", versionId);
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    const clientJarPath = path.join(versionDir, `${versionId}.jar`);
    const taskId = this.downloads.createTask(
      `Minecraft ${versionId}`,
      versionDir,
      summary.url,
    );

    try {
      await mkdir(versionDir, { recursive: true });
      this.downloads.throwIfCancelled(taskId);
      this.downloads.updateTask(taskId, {
        label: `Minecraft ${versionId} - manifesto`,
        progress: 2,
      });
      await this.downloadJson(summary.url, versionJsonPath, summary.sha1, false);
      this.downloads.throwIfCancelled(taskId);

      const versionJson = versionJsonSchema.parse(
        JSON.parse(await readFile(versionJsonPath, "utf8")),
      );

      this.downloads.updateTask(taskId, {
        label: `Minecraft ${versionId} - client.jar`,
        progress: 8,
      });
      await this.downloads.download({
        label: `Minecraft ${versionId} client.jar`,
        url: versionJson.downloads.client.url,
        destination: clientJarPath,
        sha1: versionJson.downloads.client.sha1,
        visible: false,
      });
      this.downloads.throwIfCancelled(taskId);

      await this.installLibraries(versionJson, taskId);
      this.downloads.throwIfCancelled(taskId);
      await this.installAssets(versionJson, taskId);
      this.downloads.throwIfCancelled(taskId);

      const now = new Date().toISOString();

      this.database.run(
        `
        INSERT INTO installed_minecraft_versions (id, type, release_time, json_path, jar_path, installed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          release_time = excluded.release_time,
          json_path = excluded.json_path,
          jar_path = excluded.jar_path,
          installed_at = excluded.installed_at
        `,
        [versionId, summary.type, summary.releaseTime, versionJsonPath, clientJarPath, now],
      );
      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  isVersionInstalled(versionId: string) {
    return Boolean(
      this.database.get<InstalledVersionRow>(
        "SELECT id FROM installed_minecraft_versions WHERE id = ?",
        [versionId],
      ),
    );
  }

  getMinecraftRoot() {
    return this.rootDir;
  }

  getInstalledVersion(versionId: string) {
    return this.database.get<InstalledVersionRow>(
      "SELECT * FROM installed_minecraft_versions WHERE id = ?",
      [versionId],
    );
  }

  async readInstalledVersionJson(versionId: string) {
    const installed = this.getInstalledVersion(versionId);

    if (!installed) {
      throw new Error(`Minecraft ${versionId} não está instalado.`);
    }

    return versionJsonSchema.parse(JSON.parse(await readFile(installed.json_path, "utf8")));
  }

  async installFabricLoader(minecraftVersion: string) {
    await this.installVersion(minecraftVersion);

    const profilePath = this.getFabricProfilePath(minecraftVersion);

    if (existsSync(profilePath)) {
      return;
    }

    const taskId = this.downloads.createTask(
      `Fabric ${minecraftVersion}`,
      path.dirname(profilePath),
      FABRIC_META_URL,
    );

    try {
      const loadersResponse = await fetchWithElectronNet(
        `${FABRIC_META_URL}/versions/loader/${minecraftVersion}`,
        `Buscar Fabric Loader para Minecraft ${minecraftVersion}`,
      );

      if (!loadersResponse.ok) {
        throw new Error(`Fabric Meta retornou erro ${loadersResponse.status}.`);
      }

      const latestLoader = fabricLoaderListSchema.parse(await loadersResponse.json()).at(0);

      if (!latestLoader) {
        throw new Error(`Nenhum Fabric Loader encontrado para Minecraft ${minecraftVersion}.`);
      }

      const profileResponse = await fetchWithElectronNet(
        `${FABRIC_META_URL}/versions/loader/${minecraftVersion}/${latestLoader.loader.version}/profile/json`,
        `Buscar perfil Fabric ${latestLoader.loader.version}`,
      );
      this.downloads.throwIfCancelled(taskId);

      if (!profileResponse.ok) {
        throw new Error(`Profile Fabric retornou erro ${profileResponse.status}.`);
      }

      const profile = fabricProfileSchema.parse(await profileResponse.json());
      await mkdir(path.dirname(profilePath), { recursive: true });
      await writeFile(profilePath, JSON.stringify(profile, null, 2), "utf8");

      let completed = 0;

      await runPool(profile.libraries, 6, async (library) => {
        this.downloads.throwIfCancelled(taskId);
        const libraryPath = mavenPath(library.name);
        await this.downloads.download({
          label: `Fabric ${library.name}`,
          url: new URL(libraryPath.replaceAll("\\", "/"), library.url).toString(),
          destination: path.join(this.rootDir, "libraries", libraryPath),
          sha1: library.sha1,
          visible: false,
        });
        completed += 1;
        this.downloads.throwIfCancelled(taskId);
        this.downloads.updateTask(taskId, {
          label: `Fabric ${minecraftVersion} - loader ${completed}/${profile.libraries.length}`,
          progress: Math.round((completed / Math.max(1, profile.libraries.length)) * 100),
        });
      });

      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  async readInstalledFabricProfile(minecraftVersion: string) {
    const profilePath = this.getFabricProfilePath(minecraftVersion);

    if (!existsSync(profilePath)) {
      throw new Error(`Fabric Loader não está instalado para Minecraft ${minecraftVersion}.`);
    }

    return fabricProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));
  }

  getFabricProfilePath(minecraftVersion: string) {
    return path.join(this.rootDir, "loaders", "fabric", minecraftVersion, "profile.json");
  }

  async installForgeLoader(minecraftVersion: string) {
    await this.installVersion(minecraftVersion);

    const forgeVersion = await this.resolveLatestForgeVersion(minecraftVersion);
    const profileId = forgeProfileId(minecraftVersion, forgeVersion);
    const profilePath = this.getForgeProfilePathById(profileId);

    if (await this.isForgeProfileComplete(profilePath)) {
      return;
    }

    const installerDir = path.join(this.rootDir, "loaders", "forge", minecraftVersion);
    const installerPath = path.join(installerDir, `forge-${forgeVersion}-installer.jar`);
    const installerUrl = `${FORGE_MAVEN}/net/minecraftforge/forge/${forgeVersion}/forge-${forgeVersion}-installer.jar`;
    const taskId = this.downloads.createTask(
      `Forge ${minecraftVersion}`,
      installerDir,
      installerUrl,
    );

    try {
      await mkdir(installerDir, { recursive: true });
      await this.ensureLauncherProfiles();
      this.downloads.throwIfCancelled(taskId);
      this.downloads.updateTask(taskId, {
        label: `Forge ${minecraftVersion} - installer`,
        progress: 5,
      });
      await this.downloads.download({
        label: `Forge ${forgeVersion} installer`,
        url: installerUrl,
        destination: installerPath,
        visible: false,
      });
      this.downloads.throwIfCancelled(taskId);

      const versionJson = await this.readInstalledVersionJson(minecraftVersion);
      const javaBin = await this.javaRuntimes.resolveJava({
        component: versionJson.javaVersion?.component,
        majorVersion: versionJson.javaVersion?.majorVersion,
      });

      this.downloads.updateTask(taskId, {
        label: `Forge ${minecraftVersion} - instalando loader`,
        progress: 25,
      });
      await runJavaInstaller(javaBin, installerPath, this.rootDir);
      this.downloads.throwIfCancelled(taskId);

      if (!(await this.isForgeProfileComplete(profilePath))) {
        throw new Error("Forge terminou, mas o profile instalado esta incompleto.");
      }

      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  async readInstalledForgeProfile(minecraftVersion: string) {
    const forgeVersion = await this.resolveLatestForgeVersion(minecraftVersion);
    const profilePath = this.getForgeProfilePathById(
      forgeProfileId(minecraftVersion, forgeVersion),
    );

    if (!(await this.isForgeProfileComplete(profilePath))) {
      throw new Error(`Forge não está instalado para Minecraft ${minecraftVersion}.`);
    }

    return loaderProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));
  }

  private async resolveLatestForgeVersion(minecraftVersion: string) {
    const response = await fetchWithElectronNet(
      FORGE_METADATA_URL,
      "Buscar versoes do Forge",
    );

    if (!response.ok) {
      throw new Error(`Forge Maven retornou erro ${response.status}.`);
    }

    const metadata = await response.text();
    const escaped = minecraftVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const versions = [...metadata.matchAll(new RegExp(`<version>(${escaped}-[^<]+)</version>`, "g"))]
      .map((match) => match[1])
      .filter((version): version is string => Boolean(version));

    const latest = versions.at(-1);

    if (!latest) {
      throw new Error(`Nenhuma build Forge encontrada para Minecraft ${minecraftVersion}.`);
    }

    return latest;
  }

  private getForgeProfilePathById(profileId: string) {
    return path.join(this.rootDir, "versions", profileId, `${profileId}.json`);
  }

  private async ensureLauncherProfiles() {
    const profilesPath = path.join(this.rootDir, "launcher_profiles.json");

    if (existsSync(profilesPath)) {
      return;
    }

    await mkdir(this.rootDir, { recursive: true });
    await writeFile(
      profilesPath,
      JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2),
      "utf8",
    );
  }

  private async isForgeProfileComplete(profilePath: string) {
    if (!existsSync(profilePath)) {
      return false;
    }

    try {
      const profile = loaderProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));

      return profile.libraries.every((library) => {
        const artifactPath = library.downloads?.artifact?.path;

        if (!artifactPath) {
          return true;
        }

        return existsSync(path.join(this.rootDir, "libraries", artifactPath));
      });
    } catch {
      return false;
    }
  }

  private async installLibraries(versionJson: z.infer<typeof versionJsonSchema>, taskId: string) {
    const artifacts = versionJson.libraries
      .filter((library) => rulesAllow(library.rules))
      .flatMap((library) => {
        const downloads = library.downloads;
        const files = [];

        if (downloads?.artifact) {
          files.push(downloads.artifact);
        }

        const nativeKey = library.natives?.windows?.replace("${arch}", "64");
        const nativeArtifact = nativeKey ? downloads?.classifiers?.[nativeKey] : null;

        if (nativeArtifact) {
          files.push(nativeArtifact);
        }

        return files;
      });

    let completed = 0;
    await runPool(artifacts, 6, async (artifact) => {
      this.downloads.throwIfCancelled(taskId);
      await this.downloads.download({
        label: `Biblioteca ${artifact.path}`,
        url: artifact.url,
        destination: path.join(this.rootDir, "libraries", artifact.path),
        sha1: artifact.sha1,
        visible: false,
      });
      completed += 1;
      this.downloads.throwIfCancelled(taskId);
      this.downloads.updateTask(taskId, {
        label: `Minecraft ${versionJson.id} - bibliotecas ${completed}/${artifacts.length}`,
        progress: 15 + Math.round((completed / Math.max(1, artifacts.length)) * 25),
      });
    });
  }

  private async installAssets(versionJson: z.infer<typeof versionJsonSchema>, taskId: string) {
    if (!versionJson.assetIndex) {
      return;
    }

    const assetIndexPath = path.join(
      this.rootDir,
      "assets",
      "indexes",
      `${versionJson.assetIndex.id}.json`,
    );

    await this.downloadJson(
      versionJson.assetIndex.url,
      assetIndexPath,
      versionJson.assetIndex.sha1,
      false,
    );

    const assetIndex = assetIndexSchema.parse(
      JSON.parse(await readFile(assetIndexPath, "utf8")),
    );
    const assets = Object.entries(assetIndex.objects);

    let completed = 0;
    await runPool(assets, 10, async ([name, asset]) => {
      this.downloads.throwIfCancelled(taskId);
      const prefix = asset.hash.slice(0, 2);
      await this.downloads.download({
        label: `Asset ${name}`,
        url: `https://resources.download.minecraft.net/${prefix}/${asset.hash}`,
        destination: path.join(this.rootDir, "assets", "objects", prefix, asset.hash),
        sha1: asset.hash,
        visible: false,
      });
      completed += 1;
      this.downloads.throwIfCancelled(taskId);
      this.downloads.updateTask(taskId, {
        label: `Minecraft ${versionJson.id} - assets ${completed}/${assets.length}`,
        progress: 40 + Math.round((completed / Math.max(1, assets.length)) * 58),
      });
    });
  }

  private async fetchManifest() {
    const response = await fetchWithElectronNet(
      VERSION_MANIFEST_URL,
      "Buscar manifesto oficial do Minecraft",
    );

    if (!response.ok) {
      throw new Error(`Não foi possível obter o manifesto oficial (${response.status}).`);
    }

    return versionManifestSchema.parse(await response.json());
  }

  private async downloadJson(
    url: string,
    destination: string,
    sha1?: string,
    visible = true,
  ) {
    if (existsSync(destination)) {
      return;
    }

    await this.downloads.download({
      label: path.basename(destination),
      url,
      destination,
      sha1,
      visible,
    });
  }
}

const rulesAllow = (rules?: z.infer<typeof ruleSchema>[]) => {
  if (!rules || rules.length === 0) {
    return true;
  }

  let allowed = false;

  for (const rule of rules) {
    const osMatches =
      !rule.os?.name || rule.os.name === "windows" || rule.os.name === process.platform;

    if (osMatches) {
      allowed = rule.action === "allow";
    }
  }

  return allowed;
};

const runPool = async <T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) => {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();

      if (item) {
        await task(item);
      }
    }
  });

  await Promise.all(workers);
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

const forgeProfileId = (minecraftVersion: string, forgeVersion: string) =>
  `${minecraftVersion}-forge-${forgeVersion.replace(`${minecraftVersion}-`, "")}`;

const runJavaInstaller = async (javaBin: string, installerPath: string, minecraftRoot: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(javaBin, ["-jar", installerPath, "--installClient", minecraftRoot], {
      cwd: minecraftRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output: string[] = [];
    const remember = (chunk: Buffer) => {
      const text = chunk.toString("utf8").trim();

      if (!text) {
        return;
      }

      output.push(text);
      if (output.length > 80) {
        output.shift();
      }
    };

    child.stdout?.on("data", remember);
    child.stderr?.on("data", remember);
    child.once("error", (error) => reject(error));
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Instalador Forge fechou com erro ${code ?? "desconhecido"}.\n${output
            .slice(-12)
            .join("\n")
            .slice(-2200)}`,
        ),
      );
    });
  });

const fetchWithElectronNet = async (url: string, context: string) => {
  try {
    return await net.fetch(url, {
      headers: {
        "User-Agent": "MLUltimateLauncher/0.1 (+https://local)",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} falhou: ${message}`, { cause: error });
  }
};
