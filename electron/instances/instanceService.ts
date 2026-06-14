import AdmZip from "adm-zip";
import { dialog, net, shell } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { DownloadManager } from "../downloads/downloadManager";
import { MinecraftVersionService } from "../minecraft/minecraftVersionService";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type {
  CreateInstanceInput,
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
    fileName: z.string(),
    downloadUrl: z.string().nullable().optional(),
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
  created_at: string;
  updated_at: string;
};

export class InstanceService {
  private instancesRoot = getLauncherDataSubpath("Instances");

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
        { name: "Pacotes Minecraft", extensions: ["zip", "mrpack", "mlultimate", "rar"] },
      ],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    return this.importArchive(result.filePaths[0]);
  }

  async importArchiveFile(archivePath: string): Promise<LauncherInstance> {
    return this.importArchive(archivePath);
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
          contentManagementEnabled: false,
        });
        const overridesPath = path.join(tempDir, "overrides");

        if (existsSync(overridesPath)) {
          await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
        }

        for (const file of index.files) {
          const downloadUrl = file.downloads.at(0);

          if (!downloadUrl) {
            continue;
          }

          await this.downloads.download({
            label: `Import ${path.basename(file.path)}`,
            url: downloadUrl,
            destination: path.join(instance.gameDir, file.path),
            sha1: file.hashes?.sha1,
          });
        }

        return instance;
      }

      if (existsSync(curseForgeManifestPath)) {
        const manifest = curseForgeManifestSchema.parse(
          JSON.parse(await readFile(curseForgeManifestPath, "utf8")),
        );
        const instance = await this.create({
          name: manifest.name,
          minecraftVersion: manifest.minecraft.version,
          loader: loaderFromCurseForgeManifest(manifest.minecraft.modLoaders),
          loaderVersion: loaderVersionFromCurseForgeManifest(manifest.minecraft.modLoaders),
          ramMb: 4096,
          contentManagementEnabled: false,
        });
        const overridesPath = path.join(tempDir, manifest.overrides);

        if (existsSync(overridesPath)) {
          await cp(overridesPath, instance.gameDir, { recursive: true, force: true });
        }

        await this.downloadCurseForgeManifestFiles(manifest, instance.gameDir);

        return instance;
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
      return this.importArchive(trimmed);
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
    gameDir: string,
  ) {
    if (manifest.files.length === 0) {
      return;
    }

    const taskId = this.downloads.createTask(
      `Modpack ${manifest.name}`,
      path.join(gameDir, "mods"),
      "curseforge://manifest",
    );
    let completed = 0;

    try {
      await runPool(manifest.files, 8, async (fileRef) => {
        this.downloads.throwIfCancelled(taskId);
        const file = await this.getCurseForgeFile(fileRef.projectID, fileRef.fileID);
        const downloadUrl =
          file.downloadUrl ??
          (await this.getCurseForgeDownloadUrl(fileRef.projectID, fileRef.fileID));

        this.downloads.throwIfCancelled(taskId);
        await this.downloads.download({
          label: `CurseForge ${file.fileName}`,
          url: downloadUrl,
          destination: path.join(gameDir, "mods", sanitizeFileName(file.fileName)),
          sha1: curseForgeSha1(file),
          visible: false,
        });

        completed += 1;
        this.downloads.throwIfCancelled(taskId);
        this.downloads.updateTask(taskId, {
          label: `Modpack ${manifest.name} - mods ${completed}/${manifest.files.length}`,
          progress: Math.round((completed / manifest.files.length) * 100),
        });
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
    const [modsCount, resourcepacksCount, shaderpacksCount] = await Promise.all([
      countFiles(path.join(row.game_dir, "mods"), [".jar"]),
      countFiles(path.join(row.game_dir, "resourcepacks"), [".zip"]),
      countFiles(path.join(row.game_dir, "shaderpacks"), [".zip"]),
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
      contentManagementEnabled: row.content_management_enabled !== 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

const countFiles = async (directory: string, extensions: string[]) => {
  try {
    const files = await readdir(directory, { withFileTypes: true });

    return files.filter(
      (file) =>
        file.isFile() &&
        extensions.some((extension) => file.name.toLowerCase().endsWith(extension)),
    ).length;
  } catch {
    return 0;
  }
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
