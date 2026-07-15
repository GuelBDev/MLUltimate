import AdmZip from "adm-zip";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { net } from "electron";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { DownloadManager } from "../downloads/downloadManager";
import { JavaRuntimeService } from "../java/javaRuntimeService";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type { LoaderType, MinecraftVersionSummary } from "../../src/types/launcher";

const VERSION_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FABRIC_META_URL = "https://meta.fabricmc.net/v2";
const QUILT_META_URL = "https://meta.quiltmc.org/v3";
const FORGE_MAVEN = "https://maven.minecraftforge.net";
const FORGE_METADATA_URL = `${FORGE_MAVEN}/net/minecraftforge/forge/maven-metadata.xml`;
const NEOFORGE_MAVEN = "https://maven.neoforged.net/releases";
const NEOFORGE_METADATA_URL = `${NEOFORGE_MAVEN}/net/neoforged/neoforge/maven-metadata.xml`;

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

const lightweightLoaderListSchema = z.array(
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
        url: z.string().url().optional(),
        clientreq: z.boolean().optional(),
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

const legacyForgeProfileSchema = z.object({
  install: z.object({
    path: z.string(),
    filePath: z.string(),
  }),
  versionInfo: loaderProfileSchema.passthrough().extend({
    jar: z.string().optional(),
    libraries: z
      .array(
        z.object({
          name: z.string(),
          url: z.string().url().optional(),
          checksums: z.array(z.string()).optional(),
          clientreq: z.boolean().optional(),
          serverreq: z.boolean().optional(),
        }).passthrough(),
      )
      .default([]),
  }),
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

  async ensureJavaRuntime(minecraftVersion: string) {
    await this.installVersion(minecraftVersion);
    const versionJson = await this.readInstalledVersionJson(minecraftVersion);

    return this.javaRuntimes.resolveJava({
      component: versionJson.javaVersion?.component,
      majorVersion: versionJson.javaVersion?.majorVersion,
    });
  }

  async verifyLibrariesForLaunch(input: {
    minecraftVersion: string;
    loader: LoaderType;
    loaderVersion?: string;
  }) {
    await this.installVersion(input.minecraftVersion);
    const taskId = this.downloads.createTask(
      `Minecraft ${input.minecraftVersion} - bibliotecas`,
      path.join(this.rootDir, "libraries"),
      "minecraft://libraries",
      false,
    );

    try {
      const versionJson = await this.readInstalledVersionJson(input.minecraftVersion);

      await this.verifyClientJar(versionJson, taskId);
      await this.installLibraries(versionJson, taskId);

      if (input.loader === "fabric" || input.loader === "iris" || input.loader === "iris-sodium") {
        await this.installFabricLoader(input.minecraftVersion, input.loaderVersion);
        const profile = await this.readInstalledFabricProfile(
          input.minecraftVersion,
          input.loaderVersion,
        );
        await this.installLightweightLoaderLibraries(
          profile,
          "Fabric",
          input.minecraftVersion,
          taskId,
        );
      }

      if (input.loader === "quilt") {
        await this.installQuiltLoader(input.minecraftVersion, input.loaderVersion);
        const profile = await this.readInstalledQuiltProfile(
          input.minecraftVersion,
          input.loaderVersion,
        );
        await this.installLightweightLoaderLibraries(
          profile,
          "Quilt",
          input.minecraftVersion,
          taskId,
        );
      }

      if (input.loader === "forge") {
        await this.installForgeLoader(input.minecraftVersion, input.loaderVersion);
        const profile = await this.readInstalledForgeProfile(
          input.minecraftVersion,
          input.loaderVersion,
        );
        await this.installLoaderProfileLibraries(profile, "Forge", input.minecraftVersion, taskId);
      }

      if (input.loader === "neoforge") {
        await this.installNeoForgeLoader(input.minecraftVersion, input.loaderVersion);
        const profile = await this.readInstalledNeoForgeProfile(
          input.minecraftVersion,
          input.loaderVersion,
        );
        await this.installLoaderProfileLibraries(
          profile,
          "NeoForge",
          input.minecraftVersion,
          taskId,
        );
      }

      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  async verifyAssetsForLaunch(minecraftVersion: string) {
    await this.installVersion(minecraftVersion);
    const taskId = this.downloads.createTask(
      `Minecraft ${minecraftVersion} - assets`,
      path.join(this.rootDir, "assets"),
      "minecraft://assets",
      false,
    );

    try {
      const versionJson = await this.readInstalledVersionJson(minecraftVersion);
      await this.installAssets(versionJson, taskId);
      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  async installFabricLoader(minecraftVersion: string, requestedLoaderVersion?: string) {
    await this.installVersion(minecraftVersion);

    const profilePath = this.getFabricProfilePath(minecraftVersion);

    if (
      existsSync(profilePath) &&
      (await profileMatchesRequestedLoader(profilePath, requestedLoaderVersion))
    ) {
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

      const loaders = lightweightLoaderListSchema.parse(await loadersResponse.json());
      const selectedLoader = chooseRequestedLoader(loaders, requestedLoaderVersion);

      if (!selectedLoader) {
        throw new Error(
          requestedLoaderVersion
            ? `Fabric Loader ${requestedLoaderVersion} não foi encontrado para Minecraft ${minecraftVersion}.`
            : `Nenhum Fabric Loader encontrado para Minecraft ${minecraftVersion}.`,
        );
      }

      const profileResponse = await fetchWithElectronNet(
        `${FABRIC_META_URL}/versions/loader/${minecraftVersion}/${selectedLoader.loader.version}/profile/json`,
        `Buscar perfil Fabric ${selectedLoader.loader.version}`,
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

  async readInstalledFabricProfile(
    minecraftVersion: string,
    _requestedLoaderVersion?: string,
  ) {
    const profilePath = this.getFabricProfilePath(minecraftVersion);

    if (
      !existsSync(profilePath) ||
      !(await profileMatchesRequestedLoader(profilePath, _requestedLoaderVersion))
    ) {
      throw new Error(`Fabric Loader não está instalado para Minecraft ${minecraftVersion}.`);
    }

    return fabricProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));
  }

  getFabricProfilePath(minecraftVersion: string) {
    return path.join(this.rootDir, "loaders", "fabric", minecraftVersion, "profile.json");
  }

  async installQuiltLoader(minecraftVersion: string, requestedLoaderVersion?: string) {
    await this.installVersion(minecraftVersion);

    const profilePath = this.getQuiltProfilePath(minecraftVersion);

    if (
      existsSync(profilePath) &&
      (await profileMatchesRequestedLoader(profilePath, requestedLoaderVersion))
    ) {
      return;
    }

    const taskId = this.downloads.createTask(
      `Quilt ${minecraftVersion}`,
      path.dirname(profilePath),
      QUILT_META_URL,
    );

    try {
      const loadersResponse = await fetchWithElectronNet(
        `${QUILT_META_URL}/versions/loader/${minecraftVersion}`,
        `Buscar Quilt Loader para Minecraft ${minecraftVersion}`,
      );

      if (!loadersResponse.ok) {
        throw new Error(`Quilt Meta retornou erro ${loadersResponse.status}.`);
      }

      const loaders = lightweightLoaderListSchema.parse(await loadersResponse.json());
      const selectedLoader = chooseRequestedLoader(loaders, requestedLoaderVersion);

      if (!selectedLoader) {
        throw new Error(
          requestedLoaderVersion
            ? `Quilt Loader ${requestedLoaderVersion} não foi encontrado para Minecraft ${minecraftVersion}.`
            : `Nenhum Quilt Loader encontrado para Minecraft ${minecraftVersion}.`,
        );
      }

      const profileResponse = await fetchWithElectronNet(
        `${QUILT_META_URL}/versions/loader/${minecraftVersion}/${selectedLoader.loader.version}/profile/json`,
        `Buscar perfil Quilt ${selectedLoader.loader.version}`,
      );
      this.downloads.throwIfCancelled(taskId);

      if (!profileResponse.ok) {
        throw new Error(`Profile Quilt retornou erro ${profileResponse.status}.`);
      }

      const profile = fabricProfileSchema.parse(await profileResponse.json());
      await mkdir(path.dirname(profilePath), { recursive: true });
      await writeFile(profilePath, JSON.stringify(profile, null, 2), "utf8");

      let completed = 0;

      await runPool(profile.libraries, 6, async (library) => {
        this.downloads.throwIfCancelled(taskId);
        const libraryPath = mavenPath(library.name);
        await this.downloads.download({
          label: `Quilt ${library.name}`,
          url: new URL(libraryPath.replaceAll("\\", "/"), library.url).toString(),
          destination: path.join(this.rootDir, "libraries", libraryPath),
          sha1: library.sha1,
          visible: false,
        });
        completed += 1;
        this.downloads.updateTask(taskId, {
          label: `Quilt ${minecraftVersion} - loader ${completed}/${profile.libraries.length}`,
          progress: Math.round((completed / Math.max(1, profile.libraries.length)) * 100),
        });
      });

      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  async readInstalledQuiltProfile(
    minecraftVersion: string,
    _requestedLoaderVersion?: string,
  ) {
    const profilePath = this.getQuiltProfilePath(minecraftVersion);

    if (
      !existsSync(profilePath) ||
      !(await profileMatchesRequestedLoader(profilePath, _requestedLoaderVersion))
    ) {
      throw new Error(`Quilt Loader não está instalado para Minecraft ${minecraftVersion}.`);
    }

    return fabricProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));
  }

  getQuiltProfilePath(minecraftVersion: string) {
    return path.join(this.rootDir, "loaders", "quilt", minecraftVersion, "profile.json");
  }

  async installForgeLoader(minecraftVersion: string, requestedForgeVersion?: string) {
    await this.installVersion(minecraftVersion);

    const forgeVersion = await this.resolveForgeVersion(minecraftVersion, requestedForgeVersion);
    const existingProfilePath = await this.findCompleteForgeProfilePath(
      minecraftVersion,
      forgeVersion,
    );

    if (existingProfilePath) {
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
      const legacyProfile = await readLegacyForgeProfile(installerPath);

      if (legacyProfile) {
        await this.installLegacyForgeClient(installerPath, legacyProfile, taskId);
      } else {
        await runJavaInstaller(javaBin, installerPath, this.rootDir, "Forge");
      }
      this.downloads.throwIfCancelled(taskId);

      const installedProfilePath = legacyProfile
        ? this.getForgeProfilePathById(legacyProfile.versionInfo.id)
        : this.getForgeProfilePathById(forgeProfileId(minecraftVersion, forgeVersion));

      if (!(await this.isLoaderProfileComplete(installedProfilePath))) {
        throw new Error("Forge terminou, mas o profile instalado esta incompleto.");
      }

      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  async readInstalledForgeProfile(minecraftVersion: string, requestedForgeVersion?: string) {
    const forgeVersion = await this.resolveForgeVersion(minecraftVersion, requestedForgeVersion);
    const profilePath = await this.findCompleteForgeProfilePath(minecraftVersion, forgeVersion);

    if (!profilePath) {
      throw new Error(`Forge não está instalado para Minecraft ${minecraftVersion}.`);
    }

    return loaderProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));
  }

  async installNeoForgeLoader(minecraftVersion: string, requestedNeoForgeVersion?: string) {
    await this.installVersion(minecraftVersion);

    const neoForgeVersion = await this.resolveNeoForgeVersion(
      minecraftVersion,
      requestedNeoForgeVersion,
    );
    const profileId = neoForgeProfileId(neoForgeVersion);
    const profilePath = this.getNeoForgeProfilePathById(profileId);

    if (await this.isLoaderProfileComplete(profilePath)) {
      return;
    }

    const installerDir = path.join(this.rootDir, "loaders", "neoforge", minecraftVersion);
    const installerPath = path.join(installerDir, `neoforge-${neoForgeVersion}-installer.jar`);
    const installerUrl = `${NEOFORGE_MAVEN}/net/neoforged/neoforge/${neoForgeVersion}/neoforge-${neoForgeVersion}-installer.jar`;
    const taskId = this.downloads.createTask(
      `NeoForge ${minecraftVersion}`,
      installerDir,
      installerUrl,
    );

    try {
      await mkdir(installerDir, { recursive: true });
      await this.ensureLauncherProfiles();
      this.downloads.throwIfCancelled(taskId);
      this.downloads.updateTask(taskId, {
        label: `NeoForge ${minecraftVersion} - installer`,
        progress: 5,
      });
      await this.downloads.download({
        label: `NeoForge ${neoForgeVersion} installer`,
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
        label: `NeoForge ${minecraftVersion} - instalando loader`,
        progress: 25,
      });
      await runJavaInstaller(javaBin, installerPath, this.rootDir, "NeoForge");
      this.downloads.throwIfCancelled(taskId);

      if (!(await this.isLoaderProfileComplete(profilePath))) {
        throw new Error("NeoForge terminou, mas o profile instalado esta incompleto.");
      }

      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  async readInstalledNeoForgeProfile(minecraftVersion: string, requestedNeoForgeVersion?: string) {
    const neoForgeVersion = await this.resolveNeoForgeVersion(
      minecraftVersion,
      requestedNeoForgeVersion,
    );
    const profilePath = this.getNeoForgeProfilePathById(neoForgeProfileId(neoForgeVersion));

    if (!(await this.isLoaderProfileComplete(profilePath))) {
      throw new Error(`NeoForge não está instalado para Minecraft ${minecraftVersion}.`);
    }

    return loaderProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));
  }

  private async resolveForgeVersion(minecraftVersion: string, requestedForgeVersion?: string) {
    const requested = normalizeForgeVersion(minecraftVersion, requestedForgeVersion);

    if (requested) {
      return requested;
    }

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

  private async resolveNeoForgeVersion(
    minecraftVersion: string,
    requestedNeoForgeVersion?: string,
  ) {
    const requested = normalizeNeoForgeVersion(requestedNeoForgeVersion);

    if (requested) {
      return requested;
    }

    const response = await fetchWithElectronNet(
      NEOFORGE_METADATA_URL,
      "Buscar versoes do NeoForge",
    );

    if (!response.ok) {
      throw new Error(`NeoForge Maven retornou erro ${response.status}.`);
    }

    const metadata = await response.text();
    const prefix = neoForgePrefixForMinecraft(minecraftVersion);
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const versions = [...metadata.matchAll(new RegExp(`<version>(${escaped}[^<]+)</version>`, "g"))]
      .map((match) => match[1])
      .filter((version): version is string => Boolean(version));

    const latest = versions.at(-1);

    if (!latest) {
      throw new Error(`Nenhuma build NeoForge encontrada para Minecraft ${minecraftVersion}.`);
    }

    return latest;
  }

  private getForgeProfilePathById(profileId: string) {
    return path.join(this.rootDir, "versions", profileId, `${profileId}.json`);
  }

  private async findCompleteForgeProfilePath(minecraftVersion: string, forgeVersion: string) {
    for (const profileId of forgeProfileIds(minecraftVersion, forgeVersion)) {
      const profilePath = this.getForgeProfilePathById(profileId);

      if (await this.isLoaderProfileComplete(profilePath)) {
        return profilePath;
      }
    }

    return null;
  }

  private getNeoForgeProfilePathById(profileId: string) {
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

  private async isLoaderProfileComplete(profilePath: string) {
    if (!existsSync(profilePath)) {
      return false;
    }

    try {
      const profile = loaderProfileSchema.parse(JSON.parse(await readFile(profilePath, "utf8")));

      const profileLibrariesComplete = profile.libraries.every((library) => {
        if (library.clientreq === false) {
          return true;
        }

        const artifactPath = library.downloads?.artifact?.path;

        if (artifactPath) {
          return existsSync(path.join(this.rootDir, "libraries", artifactPath));
        }

        const legacyPath = safeMavenPath(library.name);
        return legacyPath ? existsSync(path.join(this.rootDir, "libraries", legacyPath)) : true;
      });

      return profileLibrariesComplete && this.isForgeRuntimeComplete(profile);
    } catch {
      return false;
    }
  }

  private isForgeRuntimeComplete(profile: z.infer<typeof loaderProfileSchema>) {
    const runtime = getForgeRuntimeInfo(profile);

    if (!runtime) {
      return true;
    }

    const { forgeCoordinates, minecraftClientCoordinates } = runtime;
    const librariesRoot = path.join(this.rootDir, "libraries");
    const required = [
      path.join(
        "net",
        "minecraftforge",
        "fmlcore",
        forgeCoordinates,
        `fmlcore-${forgeCoordinates}.jar`,
      ),
      path.join(
        "net",
        "minecraftforge",
        "javafmllanguage",
        forgeCoordinates,
        `javafmllanguage-${forgeCoordinates}.jar`,
      ),
      path.join(
        "net",
        "minecraftforge",
        "lowcodelanguage",
        forgeCoordinates,
        `lowcodelanguage-${forgeCoordinates}.jar`,
      ),
      path.join(
        "net",
        "minecraftforge",
        "mclanguage",
        forgeCoordinates,
        `mclanguage-${forgeCoordinates}.jar`,
      ),
      path.join(
        "net",
        "minecraftforge",
        "forge",
        forgeCoordinates,
        `forge-${forgeCoordinates}-client.jar`,
      ),
      path.join(
        "net",
        "minecraftforge",
        "forge",
        forgeCoordinates,
        `forge-${forgeCoordinates}-universal.jar`,
      ),
      path.join(
        "net",
        "minecraft",
        "client",
        minecraftClientCoordinates,
        `client-${minecraftClientCoordinates}-srg.jar`,
      ),
      path.join(
        "net",
        "minecraft",
        "client",
        minecraftClientCoordinates,
        `client-${minecraftClientCoordinates}-extra.jar`,
      ),
      path.join(
        "net",
        "minecraft",
        "client",
        minecraftClientCoordinates,
        `client-${minecraftClientCoordinates}-slim.jar`,
      ),
    ];

    return required.every((relativePath) => existsSync(path.join(librariesRoot, relativePath)));
  }

  private async installLegacyForgeClient(
    installerPath: string,
    profile: z.infer<typeof legacyForgeProfileSchema>,
    taskId: string,
  ) {
    const versionId = profile.versionInfo.id;
    const versionPath = this.getForgeProfilePathById(versionId);
    const zip = new AdmZip(installerPath);
    const forgeLibraryPath = mavenPath(profile.install.path);
    const forgeJarPath = path.join(this.rootDir, "libraries", forgeLibraryPath);
    const containedForgeJar = zip.getEntry(profile.install.filePath);

    if (!containedForgeJar) {
      throw new Error(`Forge legado nao possui ${profile.install.filePath} dentro do instalador.`);
    }

    await mkdir(path.dirname(versionPath), { recursive: true });
    await writeFile(versionPath, JSON.stringify(profile.versionInfo, null, 2), "utf8");

    await mkdir(path.dirname(forgeJarPath), { recursive: true });

    if (!existsSync(forgeJarPath)) {
      zip.extractEntryTo(containedForgeJar, path.dirname(forgeJarPath), false, true);

      const extractedPath = path.join(
        path.dirname(forgeJarPath),
        path.basename(profile.install.filePath),
      );

      if (path.resolve(extractedPath) !== path.resolve(forgeJarPath)) {
        await rename(extractedPath, forgeJarPath);
      }
    }

    const libraries = profile.versionInfo.libraries.filter(
      (library) => library.clientreq !== false && library.name !== profile.install.path,
    );
    let completed = 0;

    for (const library of libraries) {
      this.downloads.throwIfCancelled(taskId);
      const libraryPath = safeMavenPath(library.name);

      if (!libraryPath) {
        completed += 1;
        continue;
      }

      const destination = path.join(this.rootDir, "libraries", libraryPath);

      if (!existsSync(destination)) {
        await this.downloadLegacyForgeLibrary(library, libraryPath, destination);
      }

      completed += 1;
      this.downloads.updateTask(taskId, {
        label: `Forge legado - bibliotecas ${completed}/${libraries.length}`,
        progress: 30 + Math.round((completed / Math.max(1, libraries.length)) * 65),
      });
    }
  }

  private async downloadLegacyForgeLibrary(
    library: z.infer<typeof legacyForgeProfileSchema>["versionInfo"]["libraries"][number],
    libraryPath: string,
    destination: string,
  ) {
    const urls = legacyForgeLibraryUrls(library, libraryPath);
    const sha1 = library.checksums?.find((checksum) => /^[a-f0-9]{40}$/i.test(checksum));
    const errors: string[] = [];

    for (const url of urls) {
      try {
        await this.downloads.download({
          label: `Forge legacy ${library.name}`,
          url,
          destination,
          sha1,
          visible: false,
        });
        return;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    throw new Error(
      `Nao foi possivel baixar biblioteca Forge legado ${library.name}.\n${errors
        .slice(-3)
        .join("\n")}`,
    );
  }

  private async verifyClientJar(versionJson: z.infer<typeof versionJsonSchema>, taskId: string) {
    const installed = this.getInstalledVersion(versionJson.id);

    if (!installed) {
      throw new Error(`Minecraft ${versionJson.id} nao esta registrado como instalado.`);
    }

    this.downloads.updateTask(taskId, {
      label: `Minecraft ${versionJson.id} - client.jar`,
      progress: 6,
    });
    await this.downloads.download({
      label: `Minecraft ${versionJson.id} client.jar`,
      url: versionJson.downloads.client.url,
      destination: installed.jar_path,
      sha1: versionJson.downloads.client.sha1,
      visible: false,
    });
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

  private async installLightweightLoaderLibraries(
    profile: z.infer<typeof fabricProfileSchema>,
    loaderName: string,
    minecraftVersion: string,
    taskId: string,
  ) {
    let completed = 0;

    await runPool(profile.libraries, 6, async (library) => {
      this.downloads.throwIfCancelled(taskId);
      const libraryPath = mavenPath(library.name);
      await this.downloads.download({
        label: `${loaderName} ${library.name}`,
        url: new URL(libraryPath.replaceAll("\\", "/"), library.url).toString(),
        destination: path.join(this.rootDir, "libraries", libraryPath),
        sha1: library.sha1,
        visible: false,
      });
      completed += 1;
      this.downloads.throwIfCancelled(taskId);
      this.downloads.updateTask(taskId, {
        label: `${loaderName} ${minecraftVersion} - bibliotecas ${completed}/${profile.libraries.length}`,
        progress: 42 + Math.round((completed / Math.max(1, profile.libraries.length)) * 18),
      });
    });
  }

  private async installLoaderProfileLibraries(
    profile: z.infer<typeof loaderProfileSchema>,
    loaderName: string,
    minecraftVersion: string,
    taskId: string,
  ) {
    const libraries = profile.libraries.filter(
      (library) => rulesAllow(library.rules) && library.clientreq !== false,
    );
    let completed = 0;

    await runPool(libraries, 6, async (library) => {
      this.downloads.throwIfCancelled(taskId);
      const artifact = library.downloads?.artifact;
      const libraryPath = artifact?.path ?? safeMavenPath(library.name);

      if (!libraryPath) {
        completed += 1;
        return;
      }

      const destination = path.join(this.rootDir, "libraries", libraryPath);
      const url =
        artifact?.url ??
        (library.url
          ? new URL(
              libraryPath.replaceAll("\\", "/"),
              library.url.endsWith("/") ? library.url : `${library.url}/`,
            ).toString()
          : null);

      if (!url) {
        if (!existsSync(destination)) {
          throw new Error(`${loaderName} nao informa URL para biblioteca ${library.name}.`);
        }

        completed += 1;
        return;
      }

      await this.downloads.download({
        label: `${loaderName} ${library.name}`,
        url,
        destination,
        sha1: artifact?.sha1,
        visible: false,
      });
      completed += 1;
      this.downloads.throwIfCancelled(taskId);
      this.downloads.updateTask(taskId, {
        label: `${loaderName} ${minecraftVersion} - bibliotecas ${completed}/${libraries.length}`,
        progress: 60 + Math.round((completed / Math.max(1, libraries.length)) * 28),
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
    if (existsSync(destination) && !sha1) {
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
    const osMatches = !rule.os?.name || rule.os.name === minecraftOperatingSystem();

    if (osMatches) {
      allowed = rule.action === "allow";
    }
  }

  return allowed;
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

const normalizeLightweightLoaderVersion = (version?: string) =>
  version
    ?.trim()
    .replace(/^(?:fabric|quilt)(?:-loader)?-/i, "")
    .toLowerCase();

const chooseRequestedLoader = (
  loaders: z.infer<typeof lightweightLoaderListSchema>,
  requestedLoaderVersion?: string,
) => {
  const requested = normalizeLightweightLoaderVersion(requestedLoaderVersion);

  if (!requested) {
    return loaders.at(0);
  }

  return loaders.find(
    (candidate) => candidate.loader.version.toLowerCase() === requested,
  );
};

const profileMatchesRequestedLoader = async (
  profilePath: string,
  requestedLoaderVersion?: string,
) => {
  const requested = normalizeLightweightLoaderVersion(requestedLoaderVersion);

  if (!requested) {
    return true;
  }

  try {
    const profile = fabricProfileSchema.parse(
      JSON.parse(await readFile(profilePath, "utf8")),
    );
    return profile.id.toLowerCase().includes(requested);
  } catch {
    return false;
  }
};

const getForgeRuntimeInfo = (profile: z.infer<typeof loaderProfileSchema>) => {
  const gameArgs = flattenProfileArguments(profile.arguments?.game);
  const forgeVersion =
    argumentValueAfter(gameArgs, "--fml.forgeVersion") ??
    profile.id.match(/(?:^|-)forge-(\d+\.\d+\.\d+)$/i)?.[1];
  const minecraftVersion = argumentValueAfter(gameArgs, "--fml.mcVersion") ?? profile.inheritsFrom;
  const mcpVersion = argumentValueAfter(gameArgs, "--fml.mcpVersion");

  if (!forgeVersion || !minecraftVersion || !mcpVersion) {
    return null;
  }

  return {
    forgeCoordinates: `${minecraftVersion}-${forgeVersion}`,
    minecraftClientCoordinates: `${minecraftVersion}-${mcpVersion}`,
  };
};

const flattenProfileArguments = (args?: unknown[]) =>
  (args ?? []).flatMap((argument): string[] => {
    if (typeof argument === "string") {
      return [argument];
    }

    if (!argument || typeof argument !== "object") {
      return [];
    }

    const value = (argument as { value?: unknown }).value;

    if (typeof value === "string") {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string");
    }

    return [];
  });

const argumentValueAfter = (args: string[], key: string) => {
  const index = args.indexOf(key);
  const value = index >= 0 ? args[index + 1] : null;

  return value || null;
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

const safeMavenPath = (coordinate: string) => {
  try {
    return mavenPath(coordinate);
  } catch {
    return null;
  }
};

const readLegacyForgeProfile = async (installerPath: string) => {
  try {
    const zip = new AdmZip(installerPath);
    const profileEntry = zip.getEntry("install_profile.json");

    if (!profileEntry) {
      return null;
    }

    const raw = JSON.parse(profileEntry.getData().toString("utf8"));
    if (!raw.versionInfo) {
      return null;
    }

    return legacyForgeProfileSchema.parse(raw);
  } catch {
    return null;
  }
};

const legacyForgeLibraryUrls = (
  library: z.infer<typeof legacyForgeProfileSchema>["versionInfo"]["libraries"][number],
  libraryPath: string,
) => {
  const normalizedLibraryPath = libraryPath.replaceAll("\\", "/");
  const candidates = [
    library.url,
    "https://libraries.minecraft.net/",
    FORGE_MAVEN,
    "https://repo1.maven.org/maven2/",
  ].filter((url): url is string => Boolean(url));

  return Array.from(
    new Set(
      candidates.map((baseUrl) =>
        new URL(normalizedLibraryPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString(),
      ),
    ),
  );
};

const forgeProfileId = (minecraftVersion: string, forgeVersion: string) =>
  `${minecraftVersion}-forge-${forgeVersion.replace(`${minecraftVersion}-`, "")}`;

const legacyForgeProfileId = (minecraftVersion: string, forgeVersion: string) =>
  `${minecraftVersion}-forge${forgeVersion}`;

const forgeProfileIds = (minecraftVersion: string, forgeVersion: string) =>
  Array.from(
    new Set([
      forgeProfileId(minecraftVersion, forgeVersion),
      legacyForgeProfileId(minecraftVersion, forgeVersion),
    ]),
  );

const neoForgeProfileId = (neoForgeVersion: string) => `neoforge-${neoForgeVersion}`;

const normalizeForgeVersion = (minecraftVersion: string, version?: string) => {
  const trimmed = version?.trim();

  if (!trimmed) {
    return undefined;
  }

  const withoutPrefix = trimmed.toLowerCase().startsWith("forge-")
    ? trimmed.slice("forge-".length)
    : trimmed;

  return withoutPrefix.includes("-")
    ? withoutPrefix
    : `${minecraftVersion}-${withoutPrefix}`;
};

const normalizeNeoForgeVersion = (version?: string) => {
  const trimmed = version?.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.toLowerCase().startsWith("neoforge-")
    ? trimmed.slice("neoforge-".length)
    : trimmed;
};

const neoForgePrefixForMinecraft = (minecraftVersion: string) => {
  const parts = minecraftVersion.split(".");

  if (parts.length >= 3 && parts[0] === "1") {
    return `${parts[1]}.${parts[2]}.`;
  }

  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}.`;
  }

  return `${minecraftVersion}.`;
};

const runJavaInstaller = async (
  javaBin: string,
  installerPath: string,
  minecraftRoot: string,
  loaderName: string,
) =>
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
          `Instalador ${loaderName} fechou com erro ${code ?? "desconhecido"}.\n${output
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
