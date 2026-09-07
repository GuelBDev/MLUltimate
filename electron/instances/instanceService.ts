import AdmZip from "adm-zip";
import { app, dialog, net, shell } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { DownloadManager } from "../downloads/downloadManager";
import { MinecraftVersionService } from "../minecraft/minecraftVersionService";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import { InstanceTrashService } from "./instanceTrashService";
import type {
  AddCustomServerInput,
  ContentProvider,
  ContentType,
  CreateInstanceInput,
  CustomServer,
  ExportInstanceFolder,
  ExportInstanceInput,
  ExportInstanceResult,
  ImportInstanceInput,
  InstanceIconSelection,
  LauncherInstance,
  LoaderType,
  UpdateCustomServerInput,
  UpdateInstanceInput,
} from "../../src/types/launcher";

const CURSEFORGE_API = "https://api.curseforge.com/v1";
const DEFAULT_CURSEFORGE_PROXY_URL =
  "https://mlultimate-curseforge-proxy.miguelgossani068.workers.dev";
const CURSEFORGE_PROXY_URL =
  process.env.MLULTIMATE_CURSEFORGE_PROXY_URL || DEFAULT_CURSEFORGE_PROXY_URL;
const MODRINTH_API = "https://api.modrinth.com/v2";
const IRIS_PROJECT_ID = "YL57xq9U";
const SODIUM_PROJECT_ID = "AANobbMI";
const FABRIC_API_PROJECT_ID = "P7dR8mSH";
const MODPACK_LOCK_FILE = "mlultimate-modpack-lock.json";
const DELETED_INSTANCES_DIR = ".mlultimate-trash";

type InstalledContentRow = {
  provider: ContentProvider;
  project_id: string;
  version_id: string;
  file_path: string;
  enabled?: number;
  installed_at: string;
};

const createInstanceSchema = z.object({
  name: z.string().trim().min(2).max(64),
  minecraftVersion: z.string().trim().min(1),
  loader: z.enum(["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"]),
  loaderVersion: z.string().trim().min(1).optional(),
  ramMb: z.number().int().min(1024).max(65536),
  javaPath: z.string().optional(),
  iconPath: z.string().optional(),
  contentManagementEnabled: z.boolean().optional().default(true),
  autoUpdateModpack: z.boolean().optional().default(true),
});

const updateInstanceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(64).optional(),
  ramMb: z.number().int().min(1024).max(65536).optional(),
  javaPath: z.string().optional(),
  iconPath: z.string().optional(),
  loaderVersion: z.string().trim().min(1).optional(),
  contentManagementEnabled: z.boolean().optional(),
  autoUpdateModpack: z.boolean().optional(),
});

const importInstanceSchema = z.object({
  source: z.enum(["archive", "code"]),
  archivePath: z.string().trim().optional(),
  code: z.string().trim().optional(),
});

const exportInstanceSchema = z.object({
  instanceId: z.string().min(1),
  format: z.enum(["zip", "mrpack", "mlultimate"]).optional().default("zip"),
  folders: z
    .array(z.enum(["config", "datapacks", "mods", "resourcepacks", "shaderpacks"]))
    .min(1),
});

const mlultimateManifestSchema = z.object({
  name: z.string().min(2),
  minecraftVersion: z.string().min(1),
  loader: z.enum(["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"]).default("vanilla"),
  loaderVersion: z.string().optional(),
  ramMb: z.number().int().min(1024).max(65536).default(4096),
});

const modrinthIndexSchema = z.object({
  name: z.string().min(1),
  dependencies: z.record(z.string(), z.string()).default({}),
  files: z
    .array(
      z.object({
        path: z.string(),
        downloads: z.array(z.string().url()).default([]),
        hashes: z.object({ sha1: z.string().optional() }).optional(),
        fileSize: z.number().optional(),
      }),
    )
    .default([]),
});

const curseForgeManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional().default("1.0.0"),
  author: z.string().optional().default("MLUltimate"),
  manifestType: z.string().optional().default("minecraftModpack"),
  manifestVersion: z.number().optional().default(1),
  minecraft: z.object({
    version: z.string(),
    modLoaders: z
      .array(
        z.object({
          id: z.string(),
          primary: z.boolean().optional(),
        }),
      )
      .default([]),
  }),
  files: z
    .array(
      z.object({
        projectID: z.number(),
        fileID: z.number(),
        required: z.boolean().optional(),
      }),
    )
    .default([]),
  overrides: z.string().optional().default("overrides"),
});

const curseForgeFileSchema = z.object({
  data: z.object({
    id: z.number(),
    displayName: z.string().optional(),
    fileName: z.string(),
    fileLength: z.number().optional(),
    downloadUrl: z.string().nullable().optional(),
    isAvailable: z.boolean().optional().default(true),
    hashes: z
      .array(
        z.object({
          algo: z.number(),
          value: z.string(),
        }),
      )
      .optional()
      .default([]),
  }),
});



const modrinthVersionSchema = z.object({
  name: z.string().optional(),
  files: z.array(
    z.object({
      url: z.string().url(),
      filename: z.string(),
      primary: z.boolean().optional(),
    }),
  ),
});

const modrinthInstallVersionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version_number: z.string().optional(),
  game_versions: z.array(z.string()).default([]),
  loaders: z.array(z.string()).default([]),
  dependencies: z.array(
    z.object({
      version_id: z.string().nullable().optional(),
      project_id: z.string().nullable().optional(),
      dependency_type: z.string().optional(),
    }),
  ).optional(),
  files: z.array(
    z.object({
      url: z.string().url(),
      filename: z.string(),
      primary: z.boolean().optional(),
      hashes: z.object({ sha1: z.string().optional() }).optional(),
    }),
  ),
});

const modpackLockSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  provider: z.enum(["curseforge", "modrinth"]),
  name: z.string(),
  files: z.array(
    z.object({
      provider: z.enum(["curseforge", "modrinth"]),
      type: z.enum(["mod", "datapack", "resourcepack", "shader"]),
      projectId: z.string(),
      versionId: z.string(),
      name: z.string(),
      fileName: z.string(),
      relativePath: z.string(),
      required: z.boolean().optional(),
    }),
  ),
});

type InstanceRow = {
  id: string;
  name: string;
  minecraft_version: string;
  loader: LoaderType;
  loader_version?: string | null;
  ram_mb: number;
  java_path?: string;
  game_dir: string;
  icon_path?: string | null;
  content_management_enabled?: number;
  auto_update_modpack?: number;
  source_provider?: ContentProvider | null;
  source_project_id?: string | null;
  source_version_id?: string | null;
  source_project_slug?: string | null;
  play_time_seconds?: number | null;
  last_played_at?: string | null;
  last_launched_at?: string | null;
  created_at: string;
  updated_at: string;
};

type CustomServerRow = {
  id: string;
  name: string;
  host: string;
  port: number;
  requires_microsoft: number;
  preferred_instance_id?: string | null;
  created_at: string;
  updated_at: string;
};

const rowToCustomServer = (row: CustomServerRow): CustomServer => ({
  id: row.id,
  name: row.name,
  host: row.host,
  port: row.port,
  requiresMicrosoft: Boolean(row.requires_microsoft),
  preferredInstanceId: row.preferred_instance_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class InstanceService {
  private instancesRoot = getLauncherDataSubpath("Instances");
  private trashService: InstanceTrashService;

  constructor(
    private readonly database: LauncherDatabase,
    private readonly minecraftVersions: MinecraftVersionService,
    private readonly downloads: DownloadManager,
  ) {
    this.trashService = new InstanceTrashService(this.database);
  }

  async listCustomServers(): Promise<CustomServer[]> {
    const rows = this.database.all<CustomServerRow>(
      "SELECT * FROM custom_servers ORDER BY created_at DESC",
    );
    return rows.map(rowToCustomServer);
  }

  async addCustomServer(input: AddCustomServerInput): Promise<CustomServer> {
    let cleanHost = input.host.trim();
    let port = input.port ?? 25565;

    if (cleanHost.includes(":")) {
      const parts = cleanHost.split(":");
      cleanHost = parts[0]?.trim() || cleanHost;
      const parsedPort = parts[1] ? parseInt(parts[1], 10) : NaN;
      if (!isNaN(parsedPort)) {
        port = parsedPort;
      }
    }

    const existing = this.database.get<CustomServerRow>(
      "SELECT * FROM custom_servers WHERE LOWER(host) = LOWER(?) AND port = ?",
      [cleanHost, port],
    );
    if (existing) {
      return rowToCustomServer(existing);
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const serverName = input.name.trim() || cleanHost;

    this.database.run(
      `INSERT INTO custom_servers (id, name, host, port, requires_microsoft, preferred_instance_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        serverName,
        cleanHost,
        port,
        input.requiresMicrosoft ? 1 : 0,
        input.preferredInstanceId ?? null,
        now,
        now,
      ],
    );

    const row = this.database.get<CustomServerRow>(
      "SELECT * FROM custom_servers WHERE id = ?",
      [id],
    );
    if (!row) throw new Error("Falha ao salvar servidor customizado.");
    return rowToCustomServer(row);
  }

  async updateCustomServer(input: UpdateCustomServerInput): Promise<CustomServer> {
    const current = this.database.get<CustomServerRow>(
      "SELECT * FROM custom_servers WHERE id = ?",
      [input.id],
    );
    if (!current) throw new Error("Servidor não encontrado.");

    const now = new Date().toISOString();
    const name = input.name !== undefined ? input.name.trim() : current.name;
    const host = input.host !== undefined ? input.host.trim() : current.host;
    const port = input.port !== undefined ? input.port : current.port;
    const requiresMicrosoft =
      input.requiresMicrosoft !== undefined
        ? input.requiresMicrosoft ? 1 : 0
        : current.requires_microsoft;
    const preferredInstanceId =
      (input.preferredInstanceId !== undefined
        ? input.preferredInstanceId
        : current.preferred_instance_id) ?? null;

    this.database.run(
      `UPDATE custom_servers
       SET name = ?, host = ?, port = ?, requires_microsoft = ?, preferred_instance_id = ?, updated_at = ?
       WHERE id = ?`,
      [name, host, port, requiresMicrosoft, preferredInstanceId, now, input.id],
    );

    const updated = this.database.get<CustomServerRow>(
      "SELECT * FROM custom_servers WHERE id = ?",
      [input.id],
    );
    return rowToCustomServer(updated!);
  }

  async removeCustomServer(id: string): Promise<void> {
    this.database.run("DELETE FROM custom_servers WHERE id = ?", [id]);
  }

  async create(
    input: CreateInstanceInput,
    options?: { parentTaskId?: string },
  ): Promise<LauncherInstance> {
    const parsed = createInstanceSchema.parse(input);
    const id = randomUUID();
    const now = new Date().toISOString();
    const gameDir = await this.nextInstanceGameDir(parsed.name);

    await Promise.all([
      mkdir(path.join(gameDir, "mods"), { recursive: true }),
      mkdir(path.join(gameDir, "resourcepacks"), { recursive: true }),
      mkdir(path.join(gameDir, "shaderpacks"), { recursive: true }),
      mkdir(path.join(gameDir, "modpacks"), { recursive: true }),
      mkdir(path.join(gameDir, "config"), { recursive: true }),
    ]);

    const iconPath = parsed.iconPath
      ? await copyInstanceIcon(parsed.iconPath, gameDir)
      : null;

    const loaderVersion = normalizeLoaderVersion(
      parsed.loader,
      parsed.loaderVersion,
      parsed.minecraftVersion,
    );

    this.database.run(
      `INSERT INTO instances 
        (id, name, minecraft_version, loader, loader_version, ram_mb, java_path, game_dir, icon_path, content_management_enabled, auto_update_modpack, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        parsed.name,
        parsed.minecraftVersion,
        parsed.loader,
        loaderVersion ?? null,
        parsed.ramMb,
        parsed.javaPath ?? null,
        gameDir,
        iconPath,
        parsed.contentManagementEnabled ? 1 : 0,
        parsed.autoUpdateModpack ? 1 : 0,
        now,
        now,
      ],
    );

    try {
      await this.prepareInstance({ ...parsed, loaderVersion }, gameDir, options?.parentTaskId);
      return this.getById(id);
    } catch (error) {
      this.database.run("DELETE FROM installed_content WHERE instance_id = ?", [id]);
      this.database.run("DELETE FROM instances WHERE id = ?", [id]);
      await rm(gameDir, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  async list(): Promise<LauncherInstance[]> {
    const rows = this.database.all<InstanceRow>(
      "SELECT * FROM instances ORDER BY updated_at DESC",
    );

    return Promise.all(rows.map((row) => this.rowToInstance(row)));
  }

  async getById(id: string): Promise<LauncherInstance> {
    const row = this.database.get<InstanceRow>("SELECT * FROM instances WHERE id = ?", [id]);

    if (!row) {
      throw new Error("Instância não encontrada.");
    }

    return this.rowToInstance(row);
  }

  async remove(id: string) {
    const instance = await this.getById(id);
    await this.trashService.moveToTrash(instance);
  }

  async listTrash() {
    return this.trashService.listTrash();
  }

  async deleteTrash(trashIds: string[]) {
    return this.trashService.deleteFromTrash(trashIds);
  }

  async emptyTrash() {
    return this.trashService.emptyTrash();
  }

  async restoreTrash(trashId: string): Promise<LauncherInstance> {
    const trashItem = await this.trashService.getTrashItem(trashId);
    if (!trashItem) {
      throw new Error("Item não encontrado na lixeira.");
    }

    const restored = await this.create({
      name: trashItem.name,
      minecraftVersion: trashItem.minecraftVersion,
      loader: trashItem.loader,
      ramMb: trashItem.ramMb,
      contentManagementEnabled: true,
    });

    const savesDirInTrash = this.trashService.getTrashItemSavesDir(trashId);
    if (savesDirInTrash) {
      const destinationSavesDir = path.join(restored.gameDir, "saves");
      await cp(savesDirInTrash, destinationSavesDir, { recursive: true, force: true }).catch((err) =>
        console.warn("[Trash] Falha ao restaurar pasta de saves da instância", err),
      );
    }

    if (trashItem.mods && trashItem.mods.length > 0) {
      const now = new Date().toISOString();
      for (const mod of trashItem.mods) {
        if (mod.provider && mod.projectId && mod.versionId) {
          try {
            this.database.run(
              `INSERT OR IGNORE INTO installed_content (id, instance_id, provider, type, project_id, version_id, name, file_name, file_path, installed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                randomUUID(),
                restored.id,
                mod.provider,
                mod.type || "mod",
                mod.projectId,
                mod.versionId,
                mod.name,
                mod.fileName,
                path.join(restored.gameDir, "mods", mod.fileName),
                now,
              ],
            );
          } catch {
            // ignore
          }
        }
      }
    }

    await this.trashService.deleteFromTrash([trashId]);
    return this.getById(restored.id);
  }

  private async nextInstanceGameDir(name: string) {
    await mkdir(this.instancesRoot, { recursive: true });
    const baseName = sanitizeInstanceFolderName(name);

    for (let index = 1; index < 1000; index += 1) {
      const folderName = index === 1 ? baseName : `${baseName}-${index}`;
      const candidate = path.join(this.instancesRoot, folderName);

      if (!existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error("Nao foi possivel encontrar um nome livre para a pasta da instancia.");
  }

  private async deletePathWithRetries(targetPath: string) {
    await rm(targetPath, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 500,
    });
  }

  async update(input: UpdateInstanceInput): Promise<LauncherInstance> {
    const parsed = updateInstanceSchema.parse(input);
    const current = await this.getById(parsed.id);

    const iconPath = parsed.iconPath
      ? await copyInstanceIcon(parsed.iconPath, current.gameDir)
      : current.iconPath ?? null;
    this.database.run(
      `
      UPDATE instances
      SET name = ?, ram_mb = ?, java_path = ?, icon_path = ?, loader_version = ?, content_management_enabled = ?, auto_update_modpack = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        parsed.name ?? current.name,
        parsed.ramMb ?? current.ramMb,
        parsed.javaPath ?? current.javaPath ?? null,
        iconPath,
        normalizeLoaderVersion(
          current.loader,
          parsed.loaderVersion ?? current.loaderVersion,
          current.minecraftVersion,
        ) ?? null,
        (parsed.contentManagementEnabled ?? current.contentManagementEnabled) ? 1 : 0,
        (parsed.autoUpdateModpack ?? current.autoUpdateModpack) ? 1 : 0,
        new Date().toISOString(),
        parsed.id,
      ],
    );

    return this.getById(parsed.id);
  }

  async checkModpackUpdate(id: string) {
    const instance = await this.getById(id);
    if (!instance.sourceProjectId || !instance.sourceVersionId) {
      return { hasUpdate: false };
    }

    if (instance.sourceProvider === "curseforge") {
      const response = await this.fetchCurseForge(
        `/mods/${instance.sourceProjectId}/files?pageSize=50`,
        "Verificar atualizações do modpack CurseForge",
      );

      if (!response.ok) return { hasUpdate: false };

      const files = z
        .object({
          data: z.array(
            z.object({
              id: z.number(),
              fileName: z.string(),
              gameVersions: z.array(z.string()).default([]),
            }),
          ),
        })
        .parse(await response.json()).data;

      let compatibleFiles = files.filter(
        (f) =>
          f.gameVersions.includes(instance.minecraftVersion) &&
          f.gameVersions.some((v) => {
            const normalized = v.toLowerCase();
            if (instance.loader === "iris" || instance.loader === "iris-sodium") {
              return normalized === "fabric" || normalized === "quilt";
            }
            return normalized === instance.loader.toLowerCase();
          }),
      );

      if (compatibleFiles.length === 0) {
        compatibleFiles = files.filter((f) => f.gameVersions.includes(instance.minecraftVersion));
      }

      const latest = compatibleFiles.find((f) => f.fileName.endsWith(".zip")) || compatibleFiles[0];
      if (!latest) return { hasUpdate: false };

      if (latest.id.toString() !== instance.sourceVersionId) {
        return {
          hasUpdate: true,
          newVersionId: latest.id.toString(),
          newVersionNumber: latest.fileName,
        };
      }

      return { hasUpdate: false };
    }

    if (instance.sourceProvider === "modrinth") {

    const response = await fetchWithElectronNet(
      `${MODRINTH_API}/project/${instance.sourceProjectId}/version`,
      "Verificar atualizações do modpack",
    );

    if (!response.ok) {
      return { hasUpdate: false };
    }

    const versions = z.array(modrinthInstallVersionSchema).parse(await response.json());
    
    const compatibleVersions = versions.filter(
      (v) =>
        v.game_versions.includes(instance.minecraftVersion) &&
        v.loaders.includes(
          instance.loader === "iris" || instance.loader === "iris-sodium"
            ? "fabric"
            : instance.loader,
        ),
    );

    const latest = compatibleVersions[0] || versions[0];
    if (!latest) return { hasUpdate: false };

    if (latest.id !== instance.sourceVersionId) {
      return {
        hasUpdate: true,
        newVersionId: latest.id,
        newVersionNumber: latest.version_number,
      };
    }
    
    }
    
    return { hasUpdate: false };
  }

  async updateModpack(id: string, mode: "in-place" | "new-instance", newVersionId: string) {
    const instance = await this.getById(id);
    if (!instance.sourceProjectId) {
      throw new Error("Esta instância não possui projeto Modrinth ou CurseForge atrelado.");
    }

    if (mode === "in-place") {
      const modsDir = path.join(instance.gameDir, "mods");
      await this.deletePathWithRetries(modsDir).catch(() => undefined);
      
      if (instance.sourceProvider === "curseforge") {
        const taskId = this.downloads.createTask(
          `Atualizando Modpack ${instance.name}`,
          instance.gameDir,
          "curseforge://update",
          true,
        );
        this.downloads.updateTask(taskId, {
          label: `Atualizando Modpack ${instance.name}`,
          currentStep: "Iniciando download da atualização...",
          progress: 0,
        });

        try {
          const fileResponse = await this.fetchCurseForge(
            `/mods/${instance.sourceProjectId}/files/${newVersionId}`,
            "Buscar arquivo de atualização CurseForge",
          );
          if (!fileResponse.ok) {
            throw new Error("Não foi possível buscar os dados da atualização no CurseForge.");
          }

          const file = z
            .object({ data: z.object({ downloadUrl: z.string().nullable(), fileName: z.string() }) })
            .parse(await fileResponse.json()).data;

          if (!file.downloadUrl) {
            throw new Error("CurseForge não liberou a URL de download da atualização.");
          }

          const zipPath = path.join(instance.gameDir, file.fileName);
          this.downloads.updateTask(taskId, {
            currentStep: `Baixando pacote ${file.fileName}...`,
          });
          await this.downloads.download({
            url: file.downloadUrl,
            destination: zipPath,
            label: `Atualizando Modpack ${instance.name}`,
            visible: false,
          });

          const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-update-"));
          try {
            this.downloads.updateTask(taskId, {
              currentStep: "Extraindo arquivos do pacote...",
            });
            await extractArchive(zipPath, tempDir);
            const curseForgeManifestPath = path.join(tempDir, "manifest.json");

            if (existsSync(curseForgeManifestPath)) {
              const manifest = JSON.parse(await readFile(curseForgeManifestPath, "utf8"));
              const overridesDir = manifest.overrides || "overrides";
              const overridesPath = path.join(tempDir, overridesDir);

              if (existsSync(overridesPath)) {
                await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
              }

              await this.downloadCurseForgeManifestFiles(manifest, instance, taskId);
            } else {
              throw new Error("manifest.json não encontrado na raiz da atualização CurseForge.");
            }
          } finally {
            await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
          }

          await rm(zipPath, { force: true }).catch(() => undefined);

          await this.setSourceMetadata(instance.id, {
            provider: "curseforge",
            projectId: instance.sourceProjectId,
            versionId: newVersionId,
            projectSlug: instance.sourceProjectSlug,
          });

          this.downloads.completeTask(taskId);
          return this.getById(instance.id);
        } catch (error) {
          this.downloads.failTask(taskId, error);
          throw error;
        }
      }

      if (instance.sourceProvider === "modrinth") {
        const taskId = this.downloads.createTask(
          `Atualizando Modpack ${instance.name}`,
          instance.gameDir,
          "modrinth://update",
          true,
        );
        this.downloads.updateTask(taskId, {
          label: `Atualizando Modpack ${instance.name}`,
          currentStep: "Iniciando download da atualização...",
          progress: 0,
        });

        try {
          const response = await fetchWithElectronNet(
            `${MODRINTH_API}/version/${newVersionId}`,
            "Buscar Modpack",
          );
          if (!response.ok) {
            throw new Error("Não foi possível buscar os dados da atualização no Modrinth.");
          }

          const version = modrinthInstallVersionSchema.parse(await response.json());
          const file = version.files.find((f) => f.primary) || version.files[0];

          if (!file || !file.filename.endsWith(".mrpack")) {
            throw new Error("Arquivo .mrpack não encontrado na atualização.");
          }

          const mrpackPath = path.join(instance.gameDir, file.filename);
          this.downloads.updateTask(taskId, {
            currentStep: `Baixando pacote ${file.filename}...`,
          });
          await this.downloads.download({
            url: file.url,
            destination: mrpackPath,
            label: `Atualizando Modpack ${instance.name}`,
            sha1: file.hashes?.sha1,
            visible: false,
          });

          const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-update-"));

          try {
            this.downloads.updateTask(taskId, {
              currentStep: "Extraindo arquivos do pacote...",
            });
            await extractArchive(mrpackPath, tempDir);
            const modrinthIndexPath = path.join(tempDir, "modrinth.index.json");

            if (existsSync(modrinthIndexPath)) {
              const index = modrinthIndexSchema.parse(
                JSON.parse(await readFile(modrinthIndexPath, "utf8")),
              );

              const overridesPath = path.join(tempDir, "overrides");
              if (existsSync(overridesPath)) {
                await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
              }

              await this.downloadModrinthManifestFiles(index, instance, taskId);
            } else {
              throw new Error("Arquivo modrinth.index.json não encontrado no .mrpack da atualização.");
            }
          } finally {
            await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
          }

          await rm(mrpackPath, { force: true }).catch(() => undefined);

          await this.setSourceMetadata(instance.id, {
            provider: "modrinth",
            projectId: instance.sourceProjectId,
            versionId: newVersionId,
            projectSlug: instance.sourceProjectSlug,
          });

          this.downloads.completeTask(taskId);
          return this.getById(instance.id);
        } catch (error) {
          this.downloads.failTask(taskId, error);
          throw error;
        }
      }

      return this.getById(instance.id);
    } else {
      throw new Error("Para nova instância, use a rota de importação.");
    }
  }

  async openFolder(id: string) {
    const instance = await this.getById(id);
    await shell.openPath(instance.gameDir);
  }

  async setSourceMetadata(
    id: string,
    source: {
      provider: ContentProvider;
      projectId: string;
      versionId: string;
      projectSlug?: string;
    },
  ) {
    this.database.run(
      `
      UPDATE instances
      SET source_provider = ?, source_project_id = ?, source_version_id = ?,
          source_project_slug = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        source.provider,
        source.projectId,
        source.versionId,
        source.projectSlug ?? null,
        new Date().toISOString(),
        id,
      ],
    );

    return this.getById(id);
  }

  async markLaunchStarted(id: string, startedAt = new Date().toISOString()) {
    this.database.run(
      "UPDATE instances SET last_launched_at = ?, updated_at = ? WHERE id = ?",
      [startedAt, startedAt, id],
    );
  }

  async recordPlaySession(id: string, seconds: number, endedAt = new Date().toISOString()) {
    const safeSeconds = Math.max(0, Math.round(seconds));

    if (safeSeconds === 0) {
      return;
    }

    this.database.run(
      `
      UPDATE instances
      SET play_time_seconds = COALESCE(play_time_seconds, 0) + ?,
          last_played_at = ?,
          updated_at = ?
      WHERE id = ?
      `,
      [safeSeconds, endedAt, endedAt, id],
    );
  }

  async applyModpackRuntimeRecommendations(id: string) {
    const instance = await this.getById(id);
    const lock = await this.readModpackLock(instance.gameDir);

    if (!lock) {
      return instance;
    }

    const recommendedRam = recommendedModpackRam(lock.files.length);

    if (instance.ramMb >= recommendedRam) {
      return instance;
    }

    this.database.run(
      "UPDATE instances SET ram_mb = ?, updated_at = ? WHERE id = ?",
      [recommendedRam, new Date().toISOString(), id],
    );
    return this.getById(id);
  }

  async repairLockedModpackFiles(instance: LauncherInstance) {
    const lock = await this.readModpackLock(instance.gameDir);

    if (!lock) {
      return [];
    }

    const repaired: string[] = [];

    for (const file of lock.files.filter((lockedFile) => lockedFile.required !== false)) {
      const targetPath = resolveLockedRelativePath(instance.gameDir, file.relativePath);
      const userDisabledPath = `${targetPath}.disabled`;
      const targetExists = existsSync(targetPath) && statSync(targetPath).size > 0;
      const userDisabledExists =
        existsSync(userDisabledPath) && statSync(userDisabledPath).size > 0;

      if (targetExists || userDisabledExists) {
        continue;
      }

      if (existsSync(targetPath)) {
        await rm(targetPath, { force: true });
      }

      const restoredPath = await restoreDisabledLockedFile(instance.gameDir, targetPath);

      if (restoredPath) {
        repaired.push(`Restaurei ${file.fileName} do reparo anterior.`);
        continue;
      }

      if (file.provider !== "curseforge") {
        throw new Error(
          `Arquivo obrigatorio ausente no modpack ${lock.name}: ${file.fileName}. Reimporte o modpack para recuperar esse arquivo.`,
        );
      }

      const projectId = Number(file.projectId);
      const versionId = Number(file.versionId);

      if (!Number.isInteger(projectId) || !Number.isInteger(versionId)) {
        throw new Error(
          `Arquivo obrigatorio sem referencia valida no CurseForge: ${file.fileName}.`,
        );
      }

      const curseForgeFile = await this.getCurseForgeFile(projectId, versionId);
      const downloadUrl =
        curseForgeFile.downloadUrl ??
        (await this.getCurseForgeDownloadUrl(projectId, versionId).catch(() =>
          curseForgeCdnDownloadUrl(curseForgeFile),
        ));

      await this.downloads.download({
        label: `Reparando ${file.fileName}`,
        url: downloadUrl,
        destination: targetPath,
        sha1: curseForgeSha1(curseForgeFile),
        visible: false,
      });

      if (file.type !== "datapack") {
        this.recordImportedContent({
          instanceId: instance.id,
          provider: "curseforge",
          type: file.type,
          projectId: file.projectId,
          versionId: file.versionId,
          name: file.name,
          fileName: file.fileName,
          filePath: targetPath,
        });
      }

      repaired.push(`Baixei novamente ${file.fileName}.`);
    }

    return repaired;
  }

  async selectIcon(): Promise<InstanceIconSelection | null> {
    const result = await dialog.showOpenDialog({
      title: "Selecionar imagem da instância",
      properties: ["openFile"],
      filters: [{ name: "Imagem", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const sourcePath = result.filePaths[0];
    const stagedDir = getLauncherDataSubpath("Temp", "InstanceIcons");
    const extension = normalizeImageExtension(path.extname(sourcePath));
    const stagedPath = path.join(stagedDir, `${randomUUID()}${extension}`);

    await mkdir(stagedDir, { recursive: true });
    await copyFile(sourcePath, stagedPath);

    return {
      iconPath: stagedPath,
      iconDataUrl: imageDataUrl(stagedPath),
    };
  }

  async selectArchiveFile(): Promise<{ filePath: string; fileName: string } | null> {
    const result = await dialog.showOpenDialog({
      title: "Selecionar arquivo de perfil para importar",
      properties: ["openFile"],
      filters: [
        {
          name: "Pacotes Minecraft e manifestos (*.zip, *.mrpack, *.mlultimate, *.rar, *.json)",
          extensions: ["zip", "mrpack", "mlultimate", "rar", "json"],
        },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    return {
      filePath: result.filePaths[0],
      fileName: path.basename(result.filePaths[0]),
    };
  }

  private async prepareInstance(
    parsed: z.infer<typeof createInstanceSchema>,
    gameDir: string,
    parentTaskId?: string,
  ) {
    if (parentTaskId) {
      this.downloads.updateTask(parentTaskId, {
        currentStep: `Verificando Java para Minecraft ${parsed.minecraftVersion}...`,
      });
    }
    await this.minecraftVersions.ensureJavaRuntime(parsed.minecraftVersion);

    if (isFabricBasedLoader(parsed.loader)) {
      if (parentTaskId) {
        this.downloads.updateTask(parentTaskId, {
          currentStep: `Instalando Fabric Loader para Minecraft ${parsed.minecraftVersion}...`,
        });
      }
      await this.minecraftVersions.installFabricLoader(
        parsed.minecraftVersion,
        parsed.loaderVersion,
      );

      try {
        if (parentTaskId) {
          this.downloads.updateTask(parentTaskId, {
            currentStep: "Instalando Fabric API...",
          });
        }
        await this.installModrinthMod(
          FABRIC_API_PROJECT_ID,
          parsed.minecraftVersion,
          gameDir,
          "Fabric API",
        );
      } catch (error) {
        console.warn("Failed to install Fabric API automatically:", error);
      }

      if (parsed.loader === "iris" || parsed.loader === "iris-sodium") {
        if (parentTaskId) {
          this.downloads.updateTask(parentTaskId, {
            currentStep: "Instalando Iris Shaders...",
          });
        }
        const irisVersion = await this.installModrinthMod(
          IRIS_PROJECT_ID,
          parsed.minecraftVersion,
          gameDir,
          "Iris Shaders",
        );

        if (parsed.loader === "iris-sodium") {
          const sodiumDep = irisVersion.dependencies?.find(
            (dep) => dep.project_id === SODIUM_PROJECT_ID && dep.dependency_type === "required",
          );

          if (sodiumDep && sodiumDep.version_id) {
            const response = await fetchWithElectronNet(
              `${MODRINTH_API}/version/${sodiumDep.version_id}`,
              `Buscar Sodium no Modrinth`,
            );

            if (response.ok) {
              const version = modrinthInstallVersionSchema.parse(await response.json());
              const file = version.files.find((candidate) => candidate.primary) ?? version.files.at(0);

              if (file) {
                if (parentTaskId) {
                  this.downloads.updateTask(parentTaskId, {
                    currentStep: "Instalando Sodium...",
                  });
                }
                await this.downloads.download({
                  label: `Sodium (Compatível com Iris) ${parsed.minecraftVersion}`,
                  url: file.url,
                  destination: path.join(gameDir, "mods", sanitizeFileName(file.filename)),
                  sha1: file.hashes?.sha1,
                  visible: false,
                });
              }
            } else {
              throw new Error(`Não foi possível buscar a versão obrigatória do Sodium.`);
            }
          } else {
            if (parentTaskId) {
              this.downloads.updateTask(parentTaskId, {
                currentStep: "Instalando Sodium...",
              });
            }
            await this.installModrinthMod(
              SODIUM_PROJECT_ID,
              parsed.minecraftVersion,
              gameDir,
              "Sodium",
            );
          }
        }
      }
      return;
    }

    if (parsed.loader === "quilt") {
      if (parentTaskId) {
        this.downloads.updateTask(parentTaskId, {
          currentStep: `Instalando Quilt Loader para Minecraft ${parsed.minecraftVersion}...`,
        });
      }
      await this.minecraftVersions.installQuiltLoader(
        parsed.minecraftVersion,
        parsed.loaderVersion,
      );
      return;
    }

    if (parsed.loader === "forge") {
      if (parentTaskId) {
        this.downloads.updateTask(parentTaskId, {
          currentStep: `Instalando Forge Loader para Minecraft ${parsed.minecraftVersion}...`,
        });
      }
      await this.minecraftVersions.installForgeLoader(parsed.minecraftVersion, parsed.loaderVersion);
      return;
    }

    if (parsed.loader === "neoforge") {
      if (parentTaskId) {
        this.downloads.updateTask(parentTaskId, {
          currentStep: `Instalando NeoForge Loader para Minecraft ${parsed.minecraftVersion}...`,
        });
      }
      await this.minecraftVersions.installNeoForgeLoader(parsed.minecraftVersion, parsed.loaderVersion);
      return;
    }

    if (parentTaskId) {
      this.downloads.updateTask(parentTaskId, {
        currentStep: `Instalando Minecraft ${parsed.minecraftVersion}...`,
      });
    }
    await this.minecraftVersions.installVersion(parsed.minecraftVersion);
  }

  private async installModrinthMod(
    projectId: string,
    minecraftVersion: string,
    gameDir: string,
    label: string,
  ) {
    const params = new URLSearchParams({
      game_versions: JSON.stringify([minecraftVersion]),
      loaders: JSON.stringify(["fabric"]),
    });
    const response = await fetchWithElectronNet(
      `${MODRINTH_API}/project/${projectId}/version?${params}`,
      `Buscar ${label} no Modrinth`,
    );

    if (!response.ok) {
      throw new Error(`${label} não possui versão compatível com Minecraft ${minecraftVersion}.`);
    }

    const version = z.array(modrinthInstallVersionSchema).parse(await response.json()).at(0);
    const file = version?.files.find((candidate) => candidate.primary) ?? version?.files.at(0);

    if (!version || !file) {
      throw new Error(`${label} não possui arquivo para baixar.`);
    }

    await mkdir(path.join(gameDir, "mods"), { recursive: true });
    await this.downloads.download({
      label: `${label} ${minecraftVersion}`,
      url: file.url,
      destination: path.join(gameDir, "mods", sanitizeFileName(file.filename)),
      sha1: file.hashes?.sha1,
      visible: false,
    });

    return version;
  }

  async importInstance(input: ImportInstanceInput): Promise<LauncherInstance | null> {
    const parsed = importInstanceSchema.parse(input);

    if (parsed.source === "code") {
      return this.importFromCode(parsed.code ?? "");
    }

    if (parsed.archivePath) {
      return this.importFile(parsed.archivePath);
    }

    const result = await dialog.showOpenDialog({
      title: "Importar instância",
      properties: ["openFile"],
      filters: [
        {
          name: "Pacotes Minecraft e manifestos",
          extensions: ["zip", "mrpack", "mlultimate", "rar", "json"],
        },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    return this.importFile(result.filePaths[0]);
  }

  async importArchiveFile(
    archivePath: string,
    options?: { parentTaskId?: string; name?: string },
  ): Promise<LauncherInstance> {
    return this.importFile(archivePath, options);
  }

  async exportInstance(input: ExportInstanceInput): Promise<ExportInstanceResult | null> {
    const parsed = exportInstanceSchema.parse(input);
    const instance = await this.getById(parsed.instanceId);
    const format = parsed.format ?? "zip";
    const extension = format === "mrpack" ? "mrpack" : format === "mlultimate" ? "mlultimate" : "zip";
    const formatName =
      format === "mrpack"
        ? "Modpack Modrinth (*.mrpack)"
        : format === "mlultimate"
          ? "Pacote MLUltimate (*.mlultimate)"
          : "Pacote CurseForge (*.zip)";
    const suggestedName = `${sanitizeFileName(instance.name)}-${sanitizeFileName(instance.minecraftVersion)}.${extension}`;
    const result = await dialog.showSaveDialog({
      title: "Compartilhar modpack",
      defaultPath: path.join(app.getPath("downloads"), suggestedName),
      filters: [
        { name: formatName, extensions: [extension] },
        { name: "Todos os arquivos", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return this.exportInstanceFile(parsed, result.filePath);
  }

  async exportInstanceFile(
    input: ExportInstanceInput,
    destination: string,
  ): Promise<ExportInstanceResult> {
    const parsed = exportInstanceSchema.parse(input);
    const instance = await this.getById(parsed.instanceId);
    const format = parsed.format ?? "zip";

    if (format === "mrpack") {
      const modrinthIndex = {
        formatVersion: 1,
        game: "minecraft",
        versionId: "1.0.0",
        name: instance.name,
        summary: `Modpack exportado de ${instance.name} via MLUltimate Launcher`,
        files: [],
        dependencies: {
          minecraft: instance.minecraftVersion,
          ...(instance.loader && instance.loader !== "vanilla"
            ? { [`${instance.loader}-loader`]: instance.loaderVersion || "latest" }
            : {}),
        },
      };

      const zip = new AdmZip();
      zip.addFile(
        "modrinth.index.json",
        Buffer.from(JSON.stringify(modrinthIndex, null, 2), "utf8"),
      );

      let overrideFiles = 0;
      for (const folder of parsed.folders) {
        const source = path.join(instance.gameDir, folder);
        overrideFiles += await addFolderToZip(zip, source, `overrides/${folder}`, new Set());
      }

      const normalizedDestination = destination.toLowerCase().endsWith(".mrpack")
        ? destination
        : `${destination}.mrpack`;
      await mkdir(path.dirname(normalizedDestination), { recursive: true });
      zip.writeZip(normalizedDestination);

      return {
        filePath: normalizedDestination,
        manifestFiles: 0,
        overrideFiles,
      };
    }

    if (format === "mlultimate") {
      const manifest = {
        name: instance.name,
        minecraftVersion: instance.minecraftVersion,
        loader: instance.loader,
        loaderVersion: instance.loaderVersion,
        ramMb: instance.ramMb,
        contentManagementEnabled: instance.contentManagementEnabled,
      };

      const zip = new AdmZip();
      zip.addFile(
        "mlultimate-instance.json",
        Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      );

      let overrideFiles = 0;
      for (const folder of parsed.folders) {
        const source = path.join(instance.gameDir, folder);
        overrideFiles += await addFolderToZip(zip, source, folder, new Set());
      }

      const normalizedDestination = destination.toLowerCase().endsWith(".mlultimate")
        ? destination
        : `${destination}.mlultimate`;
      await mkdir(path.dirname(normalizedDestination), { recursive: true });
      zip.writeZip(normalizedDestination);

      return {
        filePath: normalizedDestination,
        manifestFiles: 0,
        overrideFiles,
      };
    }

    // Default format: "zip" (CurseForge package)
    const selectedFolders = new Set<ExportInstanceFolder>(parsed.folders);
    const installedRows = this.database.all<InstalledContentRow>(
      "SELECT * FROM installed_content WHERE instance_id = ? ORDER BY installed_at ASC",
      [instance.id],
    );
    const trackedFiles = installedRows.filter((row) => {
      if (row.provider !== "curseforge" || row.enabled === 0) return false;
      const relativePath = normalizeArchivePath(path.relative(instance.gameDir, row.file_path));
      const folder = relativePath.split("/")[0] as ExportInstanceFolder;
      return selectedFolders.has(folder) && existsSync(row.file_path);
    });
    const manifestFiles = Array.from(
      new Map(
        trackedFiles.map((row) => [
          `${row.project_id}:${row.version_id}`,
          {
            projectID: Number(row.project_id),
            fileID: Number(row.version_id),
            required: true,
          },
        ]),
      ).values(),
    ).filter((file) => Number.isInteger(file.projectID) && Number.isInteger(file.fileID));
    const manifest = {
      minecraft: {
        version: instance.minecraftVersion,
        modLoaders: curseForgeModLoadersForInstance(instance),
      },
      manifestType: "minecraftModpack",
      manifestVersion: 1,
      name: instance.name,
      version: "1.0.0",
      author: "MLUltimate",
      files: manifestFiles,
      overrides: "overrides",
    };
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"));
    let overrideFiles = 0;

    for (const folder of parsed.folders) {
      const source = path.join(instance.gameDir, folder);
      overrideFiles += await addFolderToZip(zip, source, `overrides/${folder}`, new Set());
    }

    const normalizedDestination = destination.toLowerCase().endsWith(".zip")
      ? destination
      : `${destination}.zip`;
    await mkdir(path.dirname(normalizedDestination), { recursive: true });
    zip.writeZip(normalizedDestination);

    return {
      filePath: normalizedDestination,
      manifestFiles: manifestFiles.length,
      overrideFiles,
    };
  }

  async restoreLockedContent(instanceId: string) {
    const instance = await this.getById(instanceId);
    const lock = await this.readModpackLock(instance.gameDir);

    if (!lock) {
      return;
    }

    for (const file of lock.files) {
      if (file.type === "datapack") {
        continue;
      }

      this.recordImportedContent({
        instanceId,
        provider: file.provider,
        type: file.type,
        projectId: file.projectId,
        versionId: file.versionId,
        name: file.name,
        fileName: file.fileName,
        filePath: path.join(instance.gameDir, file.relativePath),
      });
    }
  }

  private async importFile(
    filePath: string,
    options?: { parentTaskId?: string; name?: string },
  ) {
    if (path.extname(filePath).toLowerCase() === ".json") {
      return this.importCurseForgeManifestFile(filePath, options);
    }

    return this.importArchive(filePath, options);
  }

  private async importCurseForgeManifestFile(
    manifestPath: string,
    options?: { parentTaskId?: string; name?: string },
  ) {
    const manifest = curseForgeManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8")),
    );
    return this.createFromCurseForgeManifest(manifest, path.dirname(manifestPath), options);
  }

  private async createFromCurseForgeManifest(
    manifest: z.infer<typeof curseForgeManifestSchema>,
    packageRoot?: string,
    options?: { parentTaskId?: string; name?: string },
  ) {
    const instance = await this.create(
      {
        name: options?.name ?? manifest.name,
        minecraftVersion: manifest.minecraft.version,
        loader: loaderFromCurseForgeManifest(manifest.minecraft.modLoaders),
        loaderVersion: loaderVersionFromCurseForgeManifest(
          manifest.minecraft.modLoaders,
          manifest.minecraft.version,
        ),
        ramMb: recommendedModpackRam(manifest.files.length),
        contentManagementEnabled: true,
      },
      { parentTaskId: options?.parentTaskId },
    );

    try {
      if (packageRoot) {
        const overridesPath = path.join(packageRoot, manifest.overrides);

        if (existsSync(overridesPath)) {
          await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
        }
      }

      await this.downloadCurseForgeManifestFiles(manifest, instance, options?.parentTaskId);
      return instance;
    } catch (error) {
      await this.remove(instance.id).catch(() => undefined);
      throw error;
    }
  }

  private async importArchive(
    archivePath: string,
    options?: { parentTaskId?: string; name?: string },
  ) {
    const isOwnTask = !options?.parentTaskId;
    const initialName = options?.name ?? path.basename(archivePath);
    const taskId =
      options?.parentTaskId ??
      this.downloads.createTask(
        `Modpack ${initialName}`,
        "Preparando...",
        "import://archive",
        true,
      );

    if (isOwnTask) {
      this.downloads.updateTask(taskId, {
        label: `Modpack ${initialName}`,
        currentStep: "Extraindo arquivos do pacote...",
        progress: 0,
      });
    } else {
      this.downloads.updateTask(taskId, {
        currentStep: "Extraindo arquivos do pacote...",
      });
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-import-"));

    try {
      await extractArchive(archivePath, tempDir);

      const mlultimateManifestPath = path.join(tempDir, "mlultimate-instance.json");
      const modrinthIndexPath = path.join(tempDir, "modrinth.index.json");
      const curseForgeManifestPath = path.join(tempDir, "manifest.json");

      if (existsSync(mlultimateManifestPath)) {
        const manifest = mlultimateManifestSchema.parse(
          JSON.parse(await readFile(mlultimateManifestPath, "utf8")),
        );
        const instance = await this.create(manifest, { parentTaskId: taskId });
        await copyArchiveContents(tempDir, instance.gameDir, [
          "mlultimate-instance.json",
          "modrinth.index.json",
          "manifest.json",
        ]);
        if (isOwnTask) {
          this.downloads.completeTask(taskId);
        }
        return instance;
      }

      if (existsSync(modrinthIndexPath)) {
        const index = modrinthIndexSchema.parse(
          JSON.parse(await readFile(modrinthIndexPath, "utf8")),
        );
        const minecraftVersion = index.dependencies.minecraft;

        if (!minecraftVersion) {
          throw new Error("O .mrpack não informa a versão do Minecraft.");
        }

        const instance = await this.create(
          {
            name: options?.name ?? index.name,
            minecraftVersion,
            loader: loaderFromModrinthDependencies(index.dependencies),
            loaderVersion: loaderVersionFromModrinthDependencies(index.dependencies),
            ramMb: recommendedModpackRam(index.files.length),
            contentManagementEnabled: true,
          },
          { parentTaskId: taskId },
        );

        try {
          const overridesPath = path.join(tempDir, "overrides");

          if (existsSync(overridesPath)) {
            await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
          }

          await this.downloadModrinthManifestFiles(index, instance, taskId);

          if (isOwnTask) {
            this.downloads.completeTask(taskId);
          }
          return instance;
        } catch (error) {
          await this.remove(instance.id).catch(() => undefined);
          throw error;
        }
      }

      if (existsSync(curseForgeManifestPath)) {
        const manifest = curseForgeManifestSchema.parse(
          JSON.parse(await readFile(curseForgeManifestPath, "utf8")),
        );
        const instance = await this.createFromCurseForgeManifest(manifest, tempDir, {
          parentTaskId: taskId,
          name: options?.name,
        });
        if (isOwnTask) {
          this.downloads.completeTask(taskId);
        }
        return instance;
      }

      throw new Error(
        "Arquivo importado sem manifesto reconhecido. Use .mrpack, zip CurseForge ou pacote MLUltimate.",
      );
    } catch (error) {
      if (isOwnTask) {
        this.downloads.failTask(taskId, error);
      }
      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async importFromCode(code: string): Promise<LauncherInstance | null> {
    const trimmed = code.trim();

    if (!trimmed) {
      throw new Error("Informe um código, URL ou caminho de arquivo para importar.");
    }

    if (existsSync(trimmed)) {
      return this.importFile(trimmed);
    }

    if (trimmed.startsWith("{")) {
      const manifest = curseForgeManifestSchema.parse(JSON.parse(trimmed));
      return this.createFromCurseForgeManifest(manifest);
    }

    if (trimmed.startsWith("MLU:")) {
      const manifest = mlultimateManifestSchema.parse(
        JSON.parse(Buffer.from(trimmed.slice(4), "base64url").toString("utf8")),
      );

      return this.create(manifest);
    }

    const taskId = this.downloads.createTask(
      "Importando modpack...",
      "Preparando...",
      "import://code",
      true,
    );
    this.downloads.updateTask(taskId, {
      label: "Importando modpack",
      currentStep: "Iniciando download...",
      progress: 0,
    });

    try {
      let instance: LauncherInstance | null = null;

      if (trimmed.includes("modrinth.com") || trimmed.startsWith("modrinth:")) {
        instance = await this.importModrinthCode(trimmed, taskId);
      } else if (trimmed.includes("curseforge.com") || /^\d+$/.test(trimmed)) {
        instance = await this.importCurseForgeCode(trimmed, taskId);
      } else {
        throw new Error("Código não reconhecido. Use URL Modrinth, URL/ID CurseForge, MLU: ou caminho local.");
      }

      this.downloads.completeTask(taskId);
      return instance;
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  private async importModrinthCode(code: string, parentTaskId?: string) {
    const slug = extractModrinthSlug(code);

    if (!slug) {
      throw new Error("Não consegui identificar o modpack Modrinth nessa URL/código.");
    }

    if (parentTaskId) {
      this.downloads.updateTask(parentTaskId, {
        currentStep: `Consultando Modrinth (${slug})...`,
      });
    }

    const response = await fetchWithElectronNet(
      `https://api.modrinth.com/v2/project/${slug}/version`,
      "Buscar modpack Modrinth",
    );

    if (!response.ok) {
      throw new Error(`Modrinth retornou erro ${response.status} ao importar.`);
    }

    const version = z.array(modrinthVersionSchema).parse(await response.json()).at(0);
    const file = version?.files.find((candidate) => candidate.primary) ?? version?.files.at(0);

    if (!file) {
      throw new Error("O modpack Modrinth não possui arquivo .mrpack disponível.");
    }

    if (parentTaskId && version?.name) {
      this.downloads.updateTask(parentTaskId, {
        label: `Modpack ${version.name}`,
        currentStep: `Baixando ${file.filename}...`,
      });
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-code-"));
    const archivePath = path.join(tempDir, file.filename);

    try {
      await this.downloads.download({
        label: `Import ${file.filename}`,
        url: file.url,
        destination: archivePath,
        visible: false,
        onProgress: ({ bytesReceived, totalBytes }) => {
          if (parentTaskId) {
            this.downloads.updateTask(parentTaskId, {
              bytesReceived,
              totalBytes,
              progress: totalBytes ? Math.round((bytesReceived / totalBytes) * 100) : 0,
            });
          }
        },
      });

      return await this.importArchive(archivePath, {
        parentTaskId,
        name: version?.name,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async importCurseForgeCode(code: string, parentTaskId?: string) {
    const projectRef = extractCurseForgeProjectRef(code);

    if (!projectRef) {
      throw new Error("Não consegui identificar o projeto CurseForge nesse código/URL.");
    }

    if (parentTaskId) {
      this.downloads.updateTask(parentTaskId, {
        currentStep: `Consultando CurseForge (${projectRef})...`,
      });
    }

    const numericProjectId = /^\d+$/.test(projectRef)
      ? Number(projectRef)
      : await this.resolveCurseForgeProjectId(projectRef);

    const filesResponse = await this.fetchCurseForge(
      `/mods/${numericProjectId}/files?pageSize=20`,
      "Buscar arquivos CurseForge",
    );

    if (!filesResponse.ok) {
      throw new Error(`CurseForge retornou erro ${filesResponse.status} ao importar.`);
    }

    const files = z
      .object({
        data: z.array(
          z.object({
            id: z.number(),
            fileName: z.string(),
            downloadUrl: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(await filesResponse.json()).data;
    const file = files.find((candidate) => candidate.fileName.endsWith(".zip")) ?? files.at(0);

    if (!file) {
      throw new Error("Nenhum arquivo CurseForge foi encontrado para importar.");
    }

    if (parentTaskId) {
      this.downloads.updateTask(parentTaskId, {
        label: `Modpack ${file.fileName}`,
        currentStep: `Baixando ${file.fileName}...`,
      });
    }

    const downloadUrl =
      file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(numericProjectId, file.id));
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-cf-"));
    const archivePath = path.join(tempDir, file.fileName);

    try {
      await this.downloads.download({
        label: `Import CurseForge ${file.fileName}`,
        url: downloadUrl,
        destination: archivePath,
        visible: false,
        onProgress: ({ bytesReceived, totalBytes }) => {
          if (parentTaskId) {
            this.downloads.updateTask(parentTaskId, {
              bytesReceived,
              totalBytes,
              progress: totalBytes ? Math.round((bytesReceived / totalBytes) * 100) : 0,
            });
          }
        },
      });

      return await this.importArchive(archivePath, {
        parentTaskId,
        name: file.fileName,
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async downloadCurseForgeManifestFiles(
    manifest: z.infer<typeof curseForgeManifestSchema>,
    instance: LauncherInstance,
    existingTaskId?: string,
  ) {
    if (manifest.files.length === 0) {
      return;
    }

    const isOwnTask = !existingTaskId;
    const taskId =
      existingTaskId ??
      this.downloads.createTask(
        `Modpack ${manifest.name}`,
        path.join(instance.gameDir, "mods"),
        "curseforge://manifest",
        true,
      );
    let completed = 0;
    let aggregateBytesReceived = 0;
    let aggregateTotalBytes = 0;
    const lockedFiles: z.infer<typeof modpackLockSchema>["files"] = [];

    this.downloads.updateTask(taskId, {
      destination: instance.gameDir,
      label: `Modpack ${manifest.name}`,
      currentStep: `Baixando mods (0/${manifest.files.length})...`,
    });

    try {
      await runPool(manifest.files, 16, async (fileRef) => {
        this.downloads.throwIfCancelled(taskId);
        const file = await this.getCurseForgeFile(fileRef.projectID, fileRef.fileID);
        const importedType: ContentType = "mod";
        const downloadUrl = file.downloadUrl ?? curseForgeCdnDownloadUrl(file);
        const folder = folderForImportedType(importedType);
        const destination = path.join(
          instance.gameDir,
          folder,
          sanitizeFileName(file.fileName),
        );
        const relativePath = path.posix.join(folder, sanitizeFileName(file.fileName));
        let fileTotalBytes = file.fileLength ?? 0;
        aggregateTotalBytes += fileTotalBytes;
        this.downloads.updateTask(taskId, {
          totalBytes: aggregateTotalBytes || undefined,
          currentStep: `Baixando mods (${completed + 1}/${manifest.files.length}): ${file.fileName}`,
        });

        this.downloads.throwIfCancelled(taskId);
        await this.downloads.download({
          label: `CurseForge ${file.fileName}`,
          url: downloadUrl,
          destination,
          sha1: curseForgeSha1(file),
          visible: false,
          onProgress: ({ deltaBytes, totalBytes }) => {
            if (!fileTotalBytes && totalBytes) {
              fileTotalBytes = totalBytes;
              aggregateTotalBytes += totalBytes;
            }
            aggregateBytesReceived += deltaBytes;
            this.downloads.updateTask(taskId, {
              bytesReceived: aggregateBytesReceived,
              totalBytes: aggregateTotalBytes || undefined,
            });
          },
        });
        if ((importedType as string) !== "datapack") {
          this.recordImportedContent({
            instanceId: instance.id,
            provider: "curseforge",
            type: importedType,
            projectId: String(fileRef.projectID),
            versionId: String(fileRef.fileID),
            name: file.displayName ?? file.fileName,
            fileName: file.fileName,
            filePath: destination,
          });
        }
        lockedFiles.push({
          provider: "curseforge",
          type: importedType,
          projectId: String(fileRef.projectID),
          versionId: String(fileRef.fileID),
          name: file.displayName ?? file.fileName,
          fileName: file.fileName,
          relativePath,
          required: fileRef.required,
        });

        completed += 1;
        this.downloads.throwIfCancelled(taskId);
        this.downloads.updateTask(taskId, {
          currentStep: `Baixando mods (${completed}/${manifest.files.length}): ${file.fileName}`,
          progress: Math.round((completed / manifest.files.length) * 100),
        });
      });

      assertCompleteModpackDownload(
        manifest.files.length,
        lockedFiles,
        instance.gameDir,
        manifest.name,
      );
      await this.writeModpackLock(instance.gameDir, {
        schemaVersion: 1,
        provider: "curseforge",
        name: manifest.name,
        files: lockedFiles,
      });
      if (isOwnTask) {
        this.downloads.completeTask(taskId);
      }
    } catch (error) {
      if (isOwnTask) {
        this.downloads.failTask(taskId, error);
      }
      throw error;
    }
  }

  private async downloadModrinthManifestFiles(
    index: z.infer<typeof modrinthIndexSchema>,
    instance: LauncherInstance,
    existingTaskId?: string,
  ) {
    const files = index.files.filter((file) => file.downloads.at(0));

    if (files.length === 0) {
      return;
    }

    const isOwnTask = !existingTaskId;
    const taskId =
      existingTaskId ??
      this.downloads.createTask(
        `Modpack ${index.name}`,
        instance.gameDir,
        "modrinth://manifest",
        true,
      );
    let completed = 0;
    let aggregateBytesReceived = 0;
    let aggregateTotalBytes = files.reduce((total, file) => total + (file.fileSize ?? 0), 0);
    const lockedFiles: z.infer<typeof modpackLockSchema>["files"] = [];

    this.downloads.updateTask(taskId, {
      destination: instance.gameDir,
      label: `Modpack ${index.name}`,
      currentStep: `Baixando arquivos (0/${files.length})...`,
      totalBytes: aggregateTotalBytes || undefined,
    });

    try {
      await runPool(files, 8, async (file) => {
        this.downloads.throwIfCancelled(taskId);
        const downloadUrl = file.downloads.at(0);

        if (!downloadUrl) {
          return;
        }

        const destination = path.join(instance.gameDir, file.path);
        const importedType = importedContentTypeFromPath(file.path);
        const currentFileName = path.basename(file.path);

        let fileTotalBytes = file.fileSize ?? 0;

        this.downloads.updateTask(taskId, {
          currentStep: `Baixando arquivos (${completed + 1}/${files.length}): ${currentFileName}`,
        });

        await this.downloads.download({
          label: `Modrinth ${currentFileName}`,
          url: downloadUrl,
          destination,
          sha1: file.hashes?.sha1,
          visible: false,
          onProgress: ({ deltaBytes, totalBytes }) => {
            if (!fileTotalBytes && totalBytes) {
              fileTotalBytes = totalBytes;
              aggregateTotalBytes += totalBytes;
            }
            aggregateBytesReceived += deltaBytes;
            this.downloads.updateTask(taskId, {
              bytesReceived: aggregateBytesReceived,
              totalBytes: aggregateTotalBytes || undefined,
            });
          },
        });

        if (importedType) {
          this.recordImportedContent({
            instanceId: instance.id,
            provider: "modrinth",
            type: importedType,
            projectId: file.hashes?.sha1 ?? file.path,
            versionId: file.hashes?.sha1 ?? file.path,
            name: currentFileName,
            fileName: currentFileName,
            filePath: destination,
          });
          lockedFiles.push({
            provider: "modrinth",
            type: importedType,
            projectId: file.hashes?.sha1 ?? file.path,
            versionId: file.hashes?.sha1 ?? file.path,
            name: currentFileName,
            fileName: currentFileName,
            relativePath: normalizeArchivePath(file.path),
          });
        }

        completed += 1;
        this.downloads.throwIfCancelled(taskId);
        this.downloads.updateTask(taskId, {
          currentStep: `Baixando arquivos (${completed}/${files.length}): ${currentFileName}`,
          progress: Math.round((completed / files.length) * 100),
        });
      });

      await this.writeModpackLock(instance.gameDir, {
        schemaVersion: 1,
        provider: "modrinth",
        name: index.name,
        files: lockedFiles,
      });
      if (isOwnTask) {
        this.downloads.completeTask(taskId);
      }
    } catch (error) {
      if (isOwnTask) {
        this.downloads.failTask(taskId, error);
      }
      throw error;
    }
  }

  private async getCurseForgeFile(projectId: number, fileId: number) {
    const response = await this.fetchCurseForge(
      `/mods/${projectId}/files/${fileId}`,
      "Buscar arquivo CurseForge",
    );

    if (!response.ok) {
      throw new Error(`CurseForge retornou erro ${response.status} ao buscar arquivo.`);
    }

    return curseForgeFileSchema.parse(await response.json()).data;
  }



  private async writeModpackLock(
    gameDir: string,
    lock: z.infer<typeof modpackLockSchema>,
  ) {
    const lockPath = path.join(gameDir, "modpacks", MODPACK_LOCK_FILE);
    const normalized = modpackLockSchema.parse(lock);

    await mkdir(path.dirname(lockPath), { recursive: true });
    await writeFile(lockPath, JSON.stringify(normalized, null, 2), "utf8");
  }

  private async readModpackLock(gameDir: string) {
    const lockPath = path.join(gameDir, "modpacks", MODPACK_LOCK_FILE);

    if (!existsSync(lockPath)) {
      return null;
    }

    try {
      return modpackLockSchema.parse(JSON.parse(await readFile(lockPath, "utf8")));
    } catch {
      return null;
    }
  }

  private recordImportedContent(input: {
    instanceId: string;
    provider: "curseforge" | "modrinth";
    type: "mod" | "resourcepack" | "shader";
    projectId: string;
    versionId: string;
    name: string;
    fileName: string;
    filePath: string;
  }) {
    this.database.run(
      `
      INSERT OR IGNORE INTO installed_content
        (id, instance_id, provider, type, project_id, version_id, name, file_name, file_path, enabled, installed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        input.instanceId,
        input.provider,
        input.type,
        input.projectId,
        input.versionId,
        input.name,
        sanitizeFileName(input.fileName),
        input.filePath,
        1,
        new Date().toISOString(),
      ],
    );
  }

  private async getCurseForgeDownloadUrl(projectId: number, fileId: number) {
    const response = await this.fetchCurseForge(
      `/mods/${projectId}/files/${fileId}/download-url`,
      "Buscar download CurseForge",
    );

    if (!response.ok) {
      throw new Error(`CurseForge não liberou URL de download (${response.status}).`);
    }

    return z.object({ data: z.string().url() }).parse(await response.json()).data;
  }

  private async resolveCurseForgeProjectId(slugOrName: string) {
    const params = new URLSearchParams({
      gameId: "432",
      pageSize: "1",
      searchFilter: slugOrName.replaceAll("-", " "),
    });
    const response = await this.fetchCurseForge(
      `/mods/search?${params}`,
      "Resolver projeto CurseForge",
    );

    if (!response.ok) {
      throw new Error(`CurseForge retornou erro ${response.status} ao resolver o projeto.`);
    }

    const project = z
      .object({ data: z.array(z.object({ id: z.number(), slug: z.string().optional() })) })
      .parse(await response.json()).data.at(0);

    if (!project) {
      throw new Error("Nenhum projeto CurseForge foi encontrado para esse código.");
    }

    return project.id;
  }

  private fetchCurseForge(pathAndQuery: string, context: string) {
    const proxyBase = CURSEFORGE_PROXY_URL.trim().replace(/\/$/, "");

    if (proxyBase) {
      return fetchWithElectronNet(`${proxyBase}${pathAndQuery}`, context, {
        Accept: "application/json",
      });
    }

    return fetchWithElectronNet(`${CURSEFORGE_API}${pathAndQuery}`, context, {
      "x-api-key": this.getCurseForgeApiKey(),
      Accept: "application/json",
    });
  }

  private getCurseForgeApiKey() {
    const apiKey =
      process.env.MLULTIMATE_CURSEFORGE_API_KEY ||
      process.env.CURSEFORGE_API_KEY ||
      "";

    if (!apiKey) {
      throw new Error(
        "CurseForge exige a API central do MLUltimate. Configure MLULTIMATE_CURSEFORGE_PROXY_URL no app distribuido ou MLULTIMATE_CURSEFORGE_API_KEY no ambiente seguro.",
      );
    }

    return apiKey;
  }

  private async rowToInstance(row: InstanceRow): Promise<LauncherInstance> {
    const [
      modsCount,
      resourcepacksCount,
      shaderpacksCount,
      dataPacksCount,
      worldsCount,
      shaderSupport,
      modpackLock,
    ] =
      await Promise.all([
      countContentEntries(path.join(row.game_dir, "mods"), [".jar", ".zip"]),
      countContentEntries(path.join(row.game_dir, "resourcepacks"), [".zip"], "pack.mcmeta"),
      countContentEntries(path.join(row.game_dir, "shaderpacks"), [".zip"], "shaders"),
      countDataPacks(row.game_dir),
      countWorlds(row.game_dir),
      detectShaderSupport(row),
      this.readModpackLock(row.game_dir),
    ]);

    return {
      id: row.id,
      name: row.name,
      minecraftVersion: row.minecraft_version,
      loader: row.loader,
      loaderVersion: row.loader_version ?? undefined,
      ramMb: Number(row.ram_mb),
      javaPath: row.java_path,
      gameDir: row.game_dir,
      iconPath: row.icon_path ?? undefined,
      iconDataUrl: row.icon_path && existsSync(row.icon_path) ? imageDataUrl(row.icon_path) : undefined,
      modsCount,
      resourcepacksCount,
      shaderpacksCount,
      dataPacksCount,
      modpackFilesCount: modpackLock?.files.length,
      worldsCount,
      shaderSupport,
      contentManagementEnabled: row.content_management_enabled !== 0,
      autoUpdateModpack: row.auto_update_modpack !== 0,
      sourceProvider: row.source_provider ?? undefined,
      sourceProjectId: row.source_project_id ?? undefined,
      sourceVersionId: row.source_version_id ?? undefined,
      sourceProjectSlug: row.source_project_slug ?? undefined,
      playTimeSeconds: Number(row.play_time_seconds ?? 0),
      lastPlayedAt: row.last_played_at ?? undefined,
      lastLaunchedAt: row.last_launched_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

const countContentEntries = async (
  directory: string,
  extensions: string[],
  directoryMarker?: string,
) => {
  try {
    const files = await readdir(directory, { withFileTypes: true });

    return files.filter((file) => {
      if (file.name.startsWith(".")) {
        return false;
      }

      if (file.isDirectory()) {
        return Boolean(
          directoryMarker && existsSync(path.join(directory, file.name, directoryMarker)),
        );
      }

      const normalized = file.name.toLowerCase().replace(/\.disabled$/, "");
      return extensions.some((extension) => normalized.endsWith(extension));
    }).length;
  } catch {
    return 0;
  }
};

const countDirectories = async (directory: string) => {
  try {
    const files = await readdir(directory, { withFileTypes: true });
    return files.filter((file) => file.isDirectory()).length;
  } catch {
    return 0;
  }
};

const countWorlds = (gameDir: string) => countDirectories(path.join(gameDir, "saves"));

const sanitizeInstanceFolderName = (name: string) => {
  const safeName = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (!safeName || safeName === "." || safeName === ".." || safeName === DELETED_INSTANCES_DIR) {
    return "instance";
  }

  return safeName;
};

const countDataPacks = async (gameDir: string) => {
  const rootCount = await countContentEntries(
    path.join(gameDir, "datapacks"),
    [".zip"],
    "pack.mcmeta",
  );

  try {
    const worlds = await readdir(path.join(gameDir, "saves"), { withFileTypes: true });
    const counts = await Promise.all(
      worlds
        .filter((world) => world.isDirectory())
        .map((world) =>
          countContentEntries(
            path.join(gameDir, "saves", world.name, "datapacks"),
            [".zip"],
            "pack.mcmeta",
          ),
        ),
    );

    return rootCount + counts.reduce((total, count) => total + count, 0);
  } catch {
    return rootCount;
  }
};

const detectShaderSupport = async (row: InstanceRow) => {
  const engines = new Set<string>();
  const declaredProfile = [
    row.loader,
    row.loader_version ?? "",
    row.minecraft_version,
  ]
    .join(" ")
    .toLowerCase();

  if (row.loader === "iris" || row.loader === "iris-sodium") {
    engines.add(row.loader === "iris-sodium" ? "Iris + Sodium" : "Iris");
  }

  if (declaredProfile.includes("optifine")) {
    engines.add("OptiFine");
  }

  try {
    const files = await readdir(path.join(row.game_dir, "mods"), { withFileTypes: true });
    const names = files
      .filter(
        (entry) =>
          entry.isFile() &&
          /\.(jar|zip)$/i.test(entry.name) &&
          !entry.name.toLowerCase().endsWith(".disabled"),
      )
      .map((entry) => entry.name.toLowerCase());
    const has = (pattern: RegExp) => names.some((name) => pattern.test(name));
    const hasSodium = has(/^sodium(?:[-_.+](?:fabric|neoforge|forge))?[-_.+]?\d/i);
    const hasEmbeddium = has(
      /^embeddium(?:[-_.+](?:fabric|neoforge|forge))?[-_.+]?\d/i,
    );

    if (has(/^iris(?:[-_.+](?:fabric|neoforge|forge))?[-_.+]?\d/i)) {
      engines.add(hasSodium ? "Iris + Sodium" : "Iris");
    }

    if (has(/^oculus(?:[-_.+](?:mc|neoforge|forge))?[-_.+]?\d/i)) {
      engines.add(hasEmbeddium ? "Oculus + Embeddium" : "Oculus");
    }

    if (has(/^optifine(?:[-_.+]|\d|$)/i)) {
      engines.add("OptiFine");
    }

    if (has(/^angelica(?:[-_.+]|\d|$)/i)) {
      engines.add("Angelica");
    }

    if (has(/^shadersmod(?:[-_.+]|\d|$)/i)) {
      engines.add("ShadersMod");
    }
  } catch {
    // Instancias sem pasta de mods continuam validas, mas nao suportam shader packs.
  }

  return {
    supported: engines.size > 0,
    engines: Array.from(engines),
  };
};

const normalizeImageExtension = (extension: string) => {
  const lower = extension.toLowerCase();

  if ([".png", ".jpg", ".jpeg", ".webp"].includes(lower)) {
    return lower;
  }

  return ".png";
};

const copyInstanceIcon = async (sourcePath: string, gameDir: string) => {
  const extension = normalizeImageExtension(path.extname(sourcePath));
  const destination = path.join(gameDir, `instance-icon${extension}`);

  if (path.resolve(sourcePath) === path.resolve(destination)) {
    return destination;
  }

  await copyFile(sourcePath, destination);

  return destination;
};

const imageDataUrl = (imagePath: string) => {
  const extension = normalizeImageExtension(path.extname(imagePath));
  const mimeType =
    extension === ".webp" ? "image/webp" : extension === ".png" ? "image/png" : "image/jpeg";

  return `data:${mimeType};base64,${readFileSync(imagePath).toString("base64")}`;
};

const extractArchive = async (archivePath: string, destination: string) => {
  const extension = path.extname(archivePath).toLowerCase();

  if ([".zip", ".mrpack", ".mlultimate"].includes(extension)) {
    await new AdmZip(archivePath).extractAllToAsync(destination, true, false);
    return;
  }

  if (extension === ".rar") {
    await runArchiveExtractor(archivePath, destination);
    return;
  }

  throw new Error("Formato de importação não suportado.");
};

const runArchiveExtractor = (archivePath: string, destination: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn("tar", ["-xf", archivePath, "-C", destination], {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errorOutput = "";

    child.stderr?.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString("utf8");
    });
    child.once("error", (error) => reject(error));
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Não foi possível extrair o .rar. Instale 7-Zip ou envie como .zip/.mrpack. ${errorOutput}`.trim(),
        ),
      );
    });
  });

const copyArchiveContents = async (
  source: string,
  destination: string,
  ignoredFiles: string[],
) => {
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoredFiles.includes(entry.name)) {
      continue;
    }

    await cp(path.join(source, entry.name), path.join(destination, entry.name), {
      recursive: true,
      force: true,
    });
  }
};

const addFolderToZip = async (
  zip: AdmZip,
  source: string,
  archivePath: string,
  excludedPaths: Set<string>,
): Promise<number> => {
  if (!existsSync(source)) return 0;

  const entries = await readdir(source, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolutePath = path.join(source, entry.name);
    const entryArchivePath = path.posix.join(archivePath, entry.name);

    if (entry.isDirectory()) {
      count += await addFolderToZip(zip, absolutePath, entryArchivePath, excludedPaths);
      continue;
    }

    if (!entry.isFile() || excludedPaths.has(path.resolve(absolutePath).toLowerCase())) {
      continue;
    }

    zip.addLocalFile(absolutePath, path.posix.dirname(entryArchivePath));
    count += 1;
  }

  return count;
};

const normalizeArchivePath = (value: string) => value.replaceAll("\\", "/");

const recommendedModpackRam = (fileCount: number) => {
  const target = fileCount >= 350 ? 8192 : fileCount >= 180 ? 6144 : 4096;
  const systemMemoryMb = Math.floor(os.totalmem() / 1024 / 1024);
  const safeMaximum = Math.max(4096, systemMemoryMb - 2048);

  return Math.min(target, safeMaximum);
};

const assertCompleteModpackDownload = (
  expectedFiles: number,
  files: z.infer<typeof modpackLockSchema>["files"],
  gameDir: string,
  modpackName: string,
) => {
  const missing = files.filter((file) => {
    const absolutePath = path.join(gameDir, file.relativePath);
    return !existsSync(absolutePath) || statSync(absolutePath).size === 0;
  });

  if (files.length !== expectedFiles || missing.length > 0) {
    throw new Error(
      `O modpack ${modpackName} ficou incompleto: ${files.length}/${expectedFiles} arquivos registrados e ${missing.length} ausente(s).`,
    );
  }
};

const resolveLockedRelativePath = (gameDir: string, relativePath: string) => {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`Caminho invalido no lock do modpack: ${relativePath}`);
  }

  const root = path.resolve(gameDir);
  const target = path.resolve(root, relativePath);
  const safeRelative = path.relative(root, target);

  if (!safeRelative || safeRelative.startsWith("..") || path.isAbsolute(safeRelative)) {
    throw new Error(`Caminho fora da instancia no lock do modpack: ${relativePath}`);
  }

  return target;
};

const restoreDisabledLockedFile = async (gameDir: string, targetPath: string) => {
  const targetName = path.basename(targetPath);
  const disabledDirs = getDisabledFileDirectories(gameDir, targetPath);

  for (const disabledDir of disabledDirs) {
    if (!existsSync(disabledDir)) {
      continue;
    }

    const entries = await readdir(disabledDir, { withFileTypes: true }).catch(() => []);
    const disabledEntry = entries.find((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      const restoredName = entry.name
        .replace(/-\d+(?=\.disabled-by-mlultimate$)/i, "")
        .replace(/\.disabled-by-mlultimate$/i, "");

      return restoredName === targetName;
    });

    if (!disabledEntry) {
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    const disabledPath = path.join(disabledDir, disabledEntry.name);
    await rename(disabledPath, targetPath);
    return targetPath;
  }

  return null;
};

const getDisabledFileDirectories = (gameDir: string, targetPath: string) => {
  const root = path.resolve(gameDir);
  const relativeDirectory = path.relative(root, path.dirname(targetPath));
  const directories = [path.join(path.dirname(targetPath), ".mlultimate-disabled")];

  if (relativeDirectory && !relativeDirectory.startsWith("..") && !path.isAbsolute(relativeDirectory)) {
    directories.unshift(
      path.join(gameDir, "modpacks", ".mlultimate-disabled", relativeDirectory),
    );
  }

  return directories;
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

const curseForgeSha1 = (file: z.infer<typeof curseForgeFileSchema>["data"]) =>
  file.hashes.find((hash) => hash.algo === 1)?.value;

const curseForgeCdnDownloadUrl = (file: z.infer<typeof curseForgeFileSchema>["data"]) => {
  if (!file.isAvailable) {
    throw new Error(`Arquivo CurseForge indisponivel: ${file.fileName}.`);
  }

  const folder = Math.floor(file.id / 1000);
  const fileSlot = String(file.id % 1000).padStart(3, "0");

  return `https://edge.forgecdn.net/files/${folder}/${fileSlot}/${encodeURIComponent(file.fileName)}`;
};

const importedContentTypeFromPath = (filePath: string) => {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();

  if (normalized.startsWith("mods/") && normalized.endsWith(".jar")) {
    return "mod";
  }

  if (normalized.startsWith("resourcepacks/") && normalized.endsWith(".zip")) {
    return "resourcepack";
  }

  if (normalized.startsWith("shaderpacks/") && normalized.endsWith(".zip")) {
    return "shader";
  }

  return null;
};

const folderForImportedType = (
  type: "mod" | "datapack" | "resourcepack" | "shader",
) => {
  if (type === "resourcepack") return "resourcepacks";
  if (type === "shader") return "shaderpacks";
  if (type === "datapack") return "datapacks";
  return "mods";
};

const loaderFromModrinthDependencies = (dependencies: Record<string, string>): LoaderType => {
  if (dependencies.forge) return "forge";
  if (dependencies["fabric-loader"]) return "fabric";
  if (dependencies.quilt) return "quilt";
  if (dependencies.neoforge) return "neoforge";
  return "vanilla";
};

const loaderVersionFromModrinthDependencies = (dependencies: Record<string, string>) =>
  dependencies.forge ??
  dependencies.neoforge ??
  dependencies["fabric-loader"] ??
  dependencies.quilt;

const loaderFromCurseForgeManifest = (
  modLoaders: Array<{ id: string; primary?: boolean }>,
): LoaderType => {
  const loader = modLoaders.find((item) => item.primary) ?? modLoaders.at(0);
  const id = loader?.id.toLowerCase() ?? "";

  if (id.startsWith("forge")) return "forge";
  if (id.startsWith("fabric")) return "fabric";
  if (id.startsWith("quilt")) return "quilt";
  if (id.startsWith("neoforge")) return "neoforge";
  return "vanilla";
};

const loaderVersionFromCurseForgeManifest = (
  modLoaders: Array<{ id: string; primary?: boolean }>,
  minecraftVersion?: string,
) => {
  const loader = modLoaders.find((item) => item.primary) ?? modLoaders.at(0);

  return normalizeLoaderVersion(
    loaderFromCurseForgeManifest(modLoaders),
    loader?.id,
    minecraftVersion,
  );
};

const curseForgeModLoadersForInstance = (instance: LauncherInstance) => {
  const loader = isFabricBasedLoader(instance.loader) ? "fabric" : instance.loader;

  if (loader === "vanilla") return [];

  const id = instance.loaderVersion ? `${loader}-${instance.loaderVersion}` : loader;

  return [{ id, primary: true }];
};

const normalizeLoaderVersion = (loader: LoaderType, version?: string, minecraftVersion?: string) => {
  const trimmed = version?.trim();

  if (!trimmed) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();

  if (lower === loader || lower === minecraftVersion?.toLowerCase()) {
    return undefined;
  }

  if (loader === "forge" && lower.startsWith("forge-")) {
    const normalized = trimmed.slice("forge-".length);
    return normalized === minecraftVersion ? undefined : normalized;
  }

  if (loader === "neoforge" && lower.startsWith("neoforge-")) {
    const normalized = trimmed.slice("neoforge-".length);
    return normalized === minecraftVersion ? undefined : normalized;
  }

  if (loader === "fabric" && lower.startsWith("fabric-")) {
    const normalized = trimmed.slice("fabric-".length);
    return normalized === minecraftVersion ? undefined : normalized;
  }

  return trimmed;
};

const isFabricBasedLoader = (loader: LoaderType) =>
  loader === "fabric" || loader === "iris" || loader === "iris-sodium";

const extractModrinthSlug = (code: string) => {
  if (code.startsWith("modrinth:")) {
    return code.slice("modrinth:".length).trim();
  }

  try {
    const url = new URL(code);
    const parts = url.pathname.split("/").filter(Boolean);
    const typeIndex = parts.findIndex((part) => part === "modpack");

    return typeIndex >= 0 ? parts[typeIndex + 1] : parts.at(-1);
  } catch {
    return null;
  }
};

const extractCurseForgeProjectRef = (code: string) => {
  if (/^\d+$/.test(code)) {
    return code;
  }

  const match = code.match(
    /\/minecraft\/(?:mc-mods|modpacks|texture-packs|shaders)\/([^/?#]+)/,
  );

  if (match?.[1]) {
    return match[1];
  }

  const idMatch = code.match(/(?:projectId|projectID|id)=([0-9]+)/i) ?? code.match(/\/projects\/([0-9]+)/i);
  return idMatch?.[1] ?? null;
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .split("")
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "_" : character,
    )
    .join("");

const fetchWithElectronNet = async (
  url: string,
  context: string,
  headers: Record<string, string> = {},
) => {
  try {
    return await net.fetch(url, {
      headers: {
        "User-Agent": "MLUltimateLauncher/0.1 (+https://local)",
        ...headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} falhou: ${message}`, { cause: error });
  }
};
