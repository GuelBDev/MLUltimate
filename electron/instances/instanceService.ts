import AdmZip from "adm-zip";
import { app, dialog, net, shell } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { DownloadManager } from "../downloads/downloadManager";
import { MinecraftVersionService } from "../minecraft/minecraftVersionService";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type {
  ContentProvider,
  CreateInstanceInput,
  ExportInstanceFolder,
  ExportInstanceInput,
  ExportInstanceResult,
  ImportInstanceInput,
  InstanceIconSelection,
  LauncherInstance,
  LoaderType,
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
const MODPACK_LOCK_FILE = "mlultimate-modpack-lock.json";

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
});

const updateInstanceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(64).optional(),
  ramMb: z.number().int().min(1024).max(65536).optional(),
  javaPath: z.string().optional(),
  iconPath: z.string().optional(),
  loaderVersion: z.string().trim().min(1).optional(),
  contentManagementEnabled: z.boolean().optional(),
});

const importInstanceSchema = z.object({
  source: z.enum(["archive", "code"]),
  code: z.string().trim().optional(),
});

const exportInstanceSchema = z.object({
  instanceId: z.string().min(1),
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

const curseForgeProjectClassSchema = z.object({
  data: z.object({
    id: z.number(),
    name: z.string(),
    classId: z.number().optional(),
  }),
});

const modrinthVersionSchema = z.object({
  files: z.array(
    z.object({
      url: z.string().url(),
      filename: z.string(),
      primary: z.boolean().optional(),
    }),
  ),
});

const modrinthInstallVersionSchema = z.object({
  id: z.string(),
  name: z.string(),
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

export class InstanceService {
  private instancesRoot = getLauncherDataSubpath("Instances");
  private readonly curseForgeProjectTypeCache = new Map<
    number,
    "mod" | "datapack" | "resourcepack" | "shader"
  >();

  constructor(
    private readonly database: LauncherDatabase,
    private readonly minecraftVersions: MinecraftVersionService,
    private readonly downloads: DownloadManager,
  ) {}

  async create(input: CreateInstanceInput): Promise<LauncherInstance> {
    const parsed = createInstanceSchema.parse(input);
    const id = randomUUID();
    const now = new Date().toISOString();
    const safeName = parsed.name
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    const gameDir = path.join(this.instancesRoot, `${safeName || "instance"}-${id.slice(0, 8)}`);

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

    this.database.run(
      `
      INSERT INTO instances
        (id, name, minecraft_version, loader, loader_version, ram_mb, java_path, game_dir, icon_path, content_management_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        parsed.name,
        parsed.minecraftVersion,
        parsed.loader,
        normalizeLoaderVersion(parsed.loader, parsed.loaderVersion) ?? null,
        parsed.ramMb,
        parsed.javaPath ?? null,
        gameDir,
        iconPath,
        parsed.contentManagementEnabled ? 1 : 0,
        now,
        now,
      ],
    );

    void this.prepareInstance(parsed, gameDir).catch(() => undefined);

    return this.getById(id);
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
    const resolvedGameDir = path.resolve(instance.gameDir);
    const resolvedRoot = path.resolve(this.instancesRoot);

    const relativePath = path.relative(resolvedRoot, resolvedGameDir);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Caminho da instância fora da pasta segura do launcher.");
    }

    await rm(resolvedGameDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    }).catch((error) => {
      throw new Error(
        "Não foi possível excluir a pasta da instância. Feche o Minecraft e qualquer pasta aberta dessa instância e tente novamente.",
        { cause: error },
      );
    });
    this.database.run("DELETE FROM installed_content WHERE instance_id = ?", [id]);
    this.database.run("DELETE FROM instances WHERE id = ?", [id]);
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
      SET name = ?, ram_mb = ?, java_path = ?, icon_path = ?, loader_version = ?, content_management_enabled = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        parsed.name ?? current.name,
        parsed.ramMb ?? current.ramMb,
        parsed.javaPath ?? current.javaPath ?? null,
        iconPath,
        normalizeLoaderVersion(current.loader, parsed.loaderVersion ?? current.loaderVersion) ?? null,
        (parsed.contentManagementEnabled ?? current.contentManagementEnabled) ? 1 : 0,
        new Date().toISOString(),
        parsed.id,
      ],
    );

    return this.getById(parsed.id);
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

  private async prepareInstance(parsed: z.infer<typeof createInstanceSchema>, gameDir: string) {
    if (isFabricBasedLoader(parsed.loader)) {
      await this.minecraftVersions.installFabricLoader(parsed.minecraftVersion);
      if (parsed.loader === "iris" || parsed.loader === "iris-sodium") {
        await this.installModrinthMod(
          IRIS_PROJECT_ID,
          parsed.minecraftVersion,
          gameDir,
          "Iris Shaders",
        );
      }
      if (parsed.loader === "iris-sodium") {
        await this.installModrinthMod(
          SODIUM_PROJECT_ID,
          parsed.minecraftVersion,
          gameDir,
          "Sodium",
        );
      }
      return;
    }

    if (parsed.loader === "forge") {
      await this.minecraftVersions.installForgeLoader(parsed.minecraftVersion, parsed.loaderVersion);
      return;
    }

    if (parsed.loader === "neoforge") {
      await this.minecraftVersions.installNeoForgeLoader(parsed.minecraftVersion, parsed.loaderVersion);
      return;
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
      throw new Error(`${label} nÃ£o possui versÃ£o compatÃ­vel com Minecraft ${minecraftVersion}.`);
    }

    const version = z.array(modrinthInstallVersionSchema).parse(await response.json()).at(0);
    const file = version?.files.find((candidate) => candidate.primary) ?? version?.files.at(0);

    if (!version || !file) {
      throw new Error(`${label} nÃ£o possui arquivo para baixar.`);
    }

    await mkdir(path.join(gameDir, "mods"), { recursive: true });
    await this.downloads.download({
      label: `${label} ${minecraftVersion}`,
      url: file.url,
      destination: path.join(gameDir, "mods", sanitizeFileName(file.filename)),
      sha1: file.hashes?.sha1,
    });
  }

  async importInstance(input: ImportInstanceInput): Promise<LauncherInstance | null> {
    const parsed = importInstanceSchema.parse(input);

    if (parsed.source === "code") {
      return this.importFromCode(parsed.code ?? "");
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

  async importArchiveFile(archivePath: string): Promise<LauncherInstance> {
    return this.importFile(archivePath);
  }

  async exportInstance(input: ExportInstanceInput): Promise<ExportInstanceResult | null> {
    const parsed = exportInstanceSchema.parse(input);
    const instance = await this.getById(parsed.instanceId);
    const suggestedName = `${sanitizeFileName(instance.name)}-${sanitizeFileName(instance.minecraftVersion)}.zip`;
    const result = await dialog.showSaveDialog({
      title: "Compartilhar modpack",
      defaultPath: path.join(app.getPath("downloads"), suggestedName),
      filters: [{ name: "Pacote CurseForge", extensions: ["zip"] }],
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
    const trackedPaths = new Set(
      trackedFiles.map((row) => path.resolve(row.file_path).toLowerCase()),
    );
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
      overrideFiles += await addFolderToZip(zip, source, `overrides/${folder}`, trackedPaths);
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

  private async importFile(filePath: string) {
    if (path.extname(filePath).toLowerCase() === ".json") {
      return this.importCurseForgeManifestFile(filePath);
    }

    return this.importArchive(filePath);
  }

  private async importCurseForgeManifestFile(manifestPath: string) {
    const manifest = curseForgeManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8")),
    );
    return this.createFromCurseForgeManifest(manifest, path.dirname(manifestPath));
  }

  private async createFromCurseForgeManifest(
    manifest: z.infer<typeof curseForgeManifestSchema>,
    packageRoot?: string,
  ) {
    const instance = await this.create({
      name: manifest.name,
      minecraftVersion: manifest.minecraft.version,
      loader: loaderFromCurseForgeManifest(manifest.minecraft.modLoaders),
      loaderVersion: loaderVersionFromCurseForgeManifest(manifest.minecraft.modLoaders),
      ramMb: 4096,
      contentManagementEnabled: true,
    });

    try {
      if (packageRoot) {
        const overridesPath = path.join(packageRoot, manifest.overrides);

        if (existsSync(overridesPath)) {
          await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
        }
      }

      await this.downloadCurseForgeManifestFiles(manifest, instance);
      return instance;
    } catch (error) {
      await this.remove(instance.id).catch(() => undefined);
      throw error;
    }
  }

  private async importArchive(archivePath: string) {
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
        const instance = await this.create(manifest);
        await copyArchiveContents(tempDir, instance.gameDir, [
          "mlultimate-instance.json",
          "modrinth.index.json",
          "manifest.json",
        ]);
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

        const instance = await this.create({
          name: index.name,
          minecraftVersion,
          loader: loaderFromModrinthDependencies(index.dependencies),
          loaderVersion: loaderVersionFromModrinthDependencies(index.dependencies),
          ramMb: 4096,
          contentManagementEnabled: true,
        });

        try {
          const overridesPath = path.join(tempDir, "overrides");

          if (existsSync(overridesPath)) {
            await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
          }

          await this.downloadModrinthManifestFiles(index, instance);

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
        return await this.createFromCurseForgeManifest(manifest, tempDir);
      }

      throw new Error(
        "Arquivo importado sem manifesto reconhecido. Use .mrpack, zip CurseForge ou pacote MLUltimate.",
      );
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

    if (trimmed.includes("modrinth.com") || trimmed.startsWith("modrinth:")) {
      return this.importModrinthCode(trimmed);
    }

    if (trimmed.includes("curseforge.com") || /^\d+$/.test(trimmed)) {
      return this.importCurseForgeCode(trimmed);
    }

    throw new Error("Código não reconhecido. Use URL Modrinth, URL/ID CurseForge, MLU: ou caminho local.");
  }

  private async importModrinthCode(code: string) {
    const slug = extractModrinthSlug(code);

    if (!slug) {
      throw new Error("Não consegui identificar o modpack Modrinth nessa URL/código.");
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

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-code-"));
    const archivePath = path.join(tempDir, file.filename);

    try {
      await this.downloads.download({
        label: `Import ${file.filename}`,
        url: file.url,
        destination: archivePath,
      });

      return await this.importArchive(archivePath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async importCurseForgeCode(code: string) {
    const projectRef = extractCurseForgeProjectRef(code);

    if (!projectRef) {
      throw new Error("Não consegui identificar o projeto CurseForge nesse código/URL.");
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

    const downloadUrl =
      file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(numericProjectId, file.id));
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-cf-"));
    const archivePath = path.join(tempDir, file.fileName);

    try {
      await this.downloads.download({
        label: `Import CurseForge ${file.fileName}`,
        url: downloadUrl,
        destination: archivePath,
      });

      return await this.importArchive(archivePath);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async downloadCurseForgeManifestFiles(
    manifest: z.infer<typeof curseForgeManifestSchema>,
    instance: LauncherInstance,
  ) {
    if (manifest.files.length === 0) {
      return;
    }

    const taskId = this.downloads.createTask(
      `Modpack ${manifest.name}`,
      path.join(instance.gameDir, "mods"),
      "curseforge://manifest",
    );
    let completed = 0;
    const lockedFiles: z.infer<typeof modpackLockSchema>["files"] = [];

    try {
      await runPool(manifest.files, 8, async (fileRef) => {
        this.downloads.throwIfCancelled(taskId);
        const [file, importedType] = await Promise.all([
          this.getCurseForgeFile(fileRef.projectID, fileRef.fileID),
          this.getCurseForgeProjectType(fileRef.projectID),
        ]);
        const downloadUrl =
          file.downloadUrl ??
          (await this.getCurseForgeDownloadUrl(fileRef.projectID, fileRef.fileID).catch(() =>
            curseForgeCdnDownloadUrl(file),
          ));
        const folder = folderForImportedType(importedType);
        const destination = path.join(
          instance.gameDir,
          folder,
          sanitizeFileName(file.fileName),
        );
        const relativePath = path.posix.join(folder, sanitizeFileName(file.fileName));

        this.downloads.throwIfCancelled(taskId);
        await this.downloads.download({
          label: `CurseForge ${file.fileName}`,
          url: downloadUrl,
          destination,
          sha1: curseForgeSha1(file),
          visible: false,
        });
        if (importedType !== "datapack") {
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
          label: `Modpack ${manifest.name} - mods ${completed}/${manifest.files.length}`,
          progress: Math.round((completed / manifest.files.length) * 100),
        });
      });

      await this.writeModpackLock(instance.gameDir, {
        schemaVersion: 1,
        provider: "curseforge",
        name: manifest.name,
        files: lockedFiles,
      });
      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
      throw error;
    }
  }

  private async downloadModrinthManifestFiles(
    index: z.infer<typeof modrinthIndexSchema>,
    instance: LauncherInstance,
  ) {
    const files = index.files.filter((file) => file.downloads.at(0));

    if (files.length === 0) {
      return;
    }

    const taskId = this.downloads.createTask(
      `Modpack ${index.name}`,
      instance.gameDir,
      "modrinth://manifest",
    );
    let completed = 0;
    const lockedFiles: z.infer<typeof modpackLockSchema>["files"] = [];

    try {
      await runPool(files, 8, async (file) => {
        this.downloads.throwIfCancelled(taskId);
        const downloadUrl = file.downloads.at(0);

        if (!downloadUrl) {
          return;
        }

        const destination = path.join(instance.gameDir, file.path);
        const importedType = importedContentTypeFromPath(file.path);

        await this.downloads.download({
          label: `Modrinth ${path.basename(file.path)}`,
          url: downloadUrl,
          destination,
          sha1: file.hashes?.sha1,
          visible: false,
        });

        if (importedType) {
          this.recordImportedContent({
            instanceId: instance.id,
            provider: "modrinth",
            type: importedType,
            projectId: file.hashes?.sha1 ?? file.path,
            versionId: file.hashes?.sha1 ?? file.path,
            name: path.basename(file.path),
            fileName: path.basename(file.path),
            filePath: destination,
          });
          lockedFiles.push({
            provider: "modrinth",
            type: importedType,
            projectId: file.hashes?.sha1 ?? file.path,
            versionId: file.hashes?.sha1 ?? file.path,
            name: path.basename(file.path),
            fileName: path.basename(file.path),
            relativePath: normalizeArchivePath(file.path),
          });
        }

        completed += 1;
        this.downloads.throwIfCancelled(taskId);
        this.downloads.updateTask(taskId, {
          label: `Modpack ${index.name} - arquivos ${completed}/${files.length}`,
          progress: Math.round((completed / files.length) * 100),
        });
      });

      await this.writeModpackLock(instance.gameDir, {
        schemaVersion: 1,
        provider: "modrinth",
        name: index.name,
        files: lockedFiles,
      });
      this.downloads.completeTask(taskId);
    } catch (error) {
      this.downloads.failTask(taskId, error);
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

  private async getCurseForgeProjectType(projectId: number) {
    const cached = this.curseForgeProjectTypeCache.get(projectId);

    if (cached) {
      return cached;
    }

    const response = await this.fetchCurseForge(
      `/mods/${projectId}`,
      "Buscar categoria do projeto CurseForge",
    );

    if (!response.ok) {
      return "mod" as const;
    }

    const project = curseForgeProjectClassSchema.parse(await response.json()).data;
    const type = importedTypeFromCurseForgeClassId(project.classId);
    this.curseForgeProjectTypeCache.set(projectId, type);
    return type;
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
    const [modsCount, resourcepacksCount, shaderpacksCount, dataPacksCount, worldsCount, shaderSupport] =
      await Promise.all([
      countContentEntries(path.join(row.game_dir, "mods"), [".jar", ".zip"]),
      countContentEntries(path.join(row.game_dir, "resourcepacks"), [".zip"], "pack.mcmeta"),
      countContentEntries(path.join(row.game_dir, "shaderpacks"), [".zip"], "shaders"),
      countDataPacks(row.game_dir),
      countWorlds(row.game_dir),
      detectShaderSupport(row),
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
      worldsCount,
      shaderSupport,
      contentManagementEnabled: row.content_management_enabled !== 0,
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
    new AdmZip(archivePath).extractAllTo(destination, true);
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

const importedTypeFromCurseForgeClassId = (
  classId?: number,
): "mod" | "datapack" | "resourcepack" | "shader" => {
  if (classId === 12) return "resourcepack";
  if (classId === 6552) return "shader";
  if (classId === 6945) return "datapack";
  return "mod";
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
) => {
  const loader = modLoaders.find((item) => item.primary) ?? modLoaders.at(0);

  return normalizeLoaderVersion(loaderFromCurseForgeManifest(modLoaders), loader?.id);
};

const curseForgeModLoadersForInstance = (instance: LauncherInstance) => {
  const loader = isFabricBasedLoader(instance.loader) ? "fabric" : instance.loader;

  if (loader === "vanilla") return [];

  const id = instance.loaderVersion
    ? `${loader}-${instance.loaderVersion}`
    : `${loader}-${instance.minecraftVersion}`;

  return [{ id, primary: true }];
};

const normalizeLoaderVersion = (loader: LoaderType, version?: string) => {
  const trimmed = version?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (loader === "forge" && trimmed.toLowerCase().startsWith("forge-")) {
    return trimmed.slice("forge-".length);
  }

  if (loader === "neoforge" && trimmed.toLowerCase().startsWith("neoforge-")) {
    return trimmed.slice("neoforge-".length);
  }

  if (loader === "fabric" && trimmed.toLowerCase().startsWith("fabric-")) {
    return trimmed.slice("fabric-".length);
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
