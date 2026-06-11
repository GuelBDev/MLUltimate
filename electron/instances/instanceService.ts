import AdmZip from "adm-zip";
import { dialog, net, shell } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { DownloadManager } from "../downloads/downloadManager";
import { MinecraftVersionService } from "../minecraft/minecraftVersionService";
import { ApiKeyStore } from "../settings/apiKeyStore";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type {
  CreateInstanceInput,
  ImportInstanceInput,
  LauncherInstance,
  LoaderType,
  UpdateInstanceInput,
} from "../../src/types/launcher";

const createInstanceSchema = z.object({
  name: z.string().trim().min(2).max(64),
  minecraftVersion: z.string().trim().min(1),
  loader: z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]),
  ramMb: z.number().int().min(1024).max(65536),
  javaPath: z.string().optional(),
});

const updateInstanceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(64).optional(),
  ramMb: z.number().int().min(1024).max(65536).optional(),
  javaPath: z.string().optional(),
});

const importInstanceSchema = z.object({
  source: z.enum(["archive", "code"]),
  code: z.string().trim().optional(),
});

const mlultimateManifestSchema = z.object({
  name: z.string().min(2),
  minecraftVersion: z.string().min(1),
  loader: z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]).default("vanilla"),
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

type InstanceRow = {
  id: string;
  name: string;
  minecraft_version: string;
  loader: LoaderType;
  ram_mb: number;
  java_path?: string;
  game_dir: string;
  created_at: string;
  updated_at: string;
};

export class InstanceService {
  private instancesRoot = getLauncherDataSubpath("Instances");

  constructor(
    private readonly database: LauncherDatabase,
    private readonly minecraftVersions: MinecraftVersionService,
    private readonly downloads: DownloadManager,
    private readonly apiKeys: ApiKeyStore,
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

    this.database.run(
      `
      INSERT INTO instances
        (id, name, minecraft_version, loader, ram_mb, java_path, game_dir, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        parsed.name,
        parsed.minecraftVersion,
        parsed.loader,
        parsed.ramMb,
        parsed.javaPath ?? null,
        gameDir,
        now,
        now,
      ],
    );

    void this.prepareInstance(parsed).catch(() => undefined);

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
      throw new Error("Instancia nao encontrada.");
    }

    return this.rowToInstance(row);
  }

  async remove(id: string) {
    const instance = await this.getById(id);
    const resolvedGameDir = path.resolve(instance.gameDir);
    const resolvedRoot = path.resolve(this.instancesRoot);

    if (!resolvedGameDir.startsWith(resolvedRoot)) {
      throw new Error("Caminho da instancia fora da pasta segura do launcher.");
    }

    await rm(resolvedGameDir, { recursive: true, force: true });
    this.database.run("DELETE FROM installed_content WHERE instance_id = ?", [id]);
    this.database.run("DELETE FROM instances WHERE id = ?", [id]);
  }

  async update(input: UpdateInstanceInput): Promise<LauncherInstance> {
    const parsed = updateInstanceSchema.parse(input);
    const current = await this.getById(parsed.id);

    this.database.run(
      `
      UPDATE instances
      SET name = ?, ram_mb = ?, java_path = ?, updated_at = ?
      WHERE id = ?
      `,
      [
        parsed.name ?? current.name,
        parsed.ramMb ?? current.ramMb,
        parsed.javaPath ?? current.javaPath ?? null,
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

  private async prepareInstance(parsed: z.infer<typeof createInstanceSchema>) {
    if (parsed.loader === "fabric") {
      await this.minecraftVersions.installFabricLoader(parsed.minecraftVersion);
      return;
    }

    if (parsed.loader === "forge") {
      await this.minecraftVersions.installForgeLoader(parsed.minecraftVersion);
      return;
    }

    await this.minecraftVersions.installVersion(parsed.minecraftVersion);
  }

  async importInstance(input: ImportInstanceInput): Promise<LauncherInstance | null> {
    const parsed = importInstanceSchema.parse(input);

    if (parsed.source === "code") {
      return this.importFromCode(parsed.code ?? "");
    }

    const result = await dialog.showOpenDialog({
      title: "Importar instancia",
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
          throw new Error("O .mrpack nao informa a versao do Minecraft.");
        }

        const instance = await this.create({
          name: index.name,
          minecraftVersion,
          loader: loaderFromModrinthDependencies(index.dependencies),
          ramMb: 4096,
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
          ramMb: 4096,
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
      throw new Error("Informe um codigo, URL ou caminho de arquivo para importar.");
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

    throw new Error("Codigo nao reconhecido. Use URL Modrinth, URL/ID CurseForge, MLU: ou caminho local.");
  }

  private async importModrinthCode(code: string) {
    const slug = extractModrinthSlug(code);

    if (!slug) {
      throw new Error("Nao consegui identificar o modpack Modrinth nessa URL/codigo.");
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
      throw new Error("O modpack Modrinth nao possui arquivo .mrpack disponivel.");
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
    const apiKey = this.getCurseForgeApiKey();

    if (!apiKey) {
      throw new Error(
        "Importar codigo CurseForge exige a API oficial. Configure CURSEFORGE_API_KEY ou MLULTIMATE_CURSEFORGE_API_KEY e reinicie.",
      );
    }

    const projectRef = extractCurseForgeProjectRef(code);

    if (!projectRef) {
      throw new Error("Nao consegui identificar o projeto CurseForge nesse codigo/URL.");
    }
    const numericProjectId = /^\d+$/.test(projectRef)
      ? Number(projectRef)
      : await resolveCurseForgeProjectId(projectRef, apiKey);

    const filesResponse = await fetchWithElectronNet(
      `https://api.curseforge.com/v1/mods/${numericProjectId}/files?pageSize=20`,
      "Buscar arquivos CurseForge",
      { "x-api-key": apiKey, Accept: "application/json" },
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
      file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(numericProjectId, file.id, apiKey));
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

    const apiKey = this.getCurseForgeApiKey();

    if (!apiKey) {
      throw new Error(
        "Este zip CurseForge lista arquivos externos. Configure CURSEFORGE_API_KEY para baixar os mods do manifesto.",
      );
    }

    for (const fileRef of manifest.files) {
      const file = await this.getCurseForgeFile(fileRef.projectID, fileRef.fileID, apiKey);
      const downloadUrl =
        file.downloadUrl ??
        (await this.getCurseForgeDownloadUrl(fileRef.projectID, fileRef.fileID, apiKey));

      await this.downloads.download({
        label: `CurseForge ${file.fileName}`,
        url: downloadUrl,
        destination: path.join(gameDir, "mods", sanitizeFileName(file.fileName)),
      });
    }
  }

  private async getCurseForgeFile(projectId: number, fileId: number, apiKey: string) {
    const response = await fetchWithElectronNet(
      `https://api.curseforge.com/v1/mods/${projectId}/files/${fileId}`,
      "Buscar arquivo CurseForge",
      { "x-api-key": apiKey, Accept: "application/json" },
    );

    if (!response.ok) {
      throw new Error(`CurseForge retornou erro ${response.status} ao buscar arquivo.`);
    }

    return curseForgeFileSchema.parse(await response.json()).data;
  }

  private async getCurseForgeDownloadUrl(projectId: number, fileId: number, apiKey: string) {
    const response = await fetchWithElectronNet(
      `https://api.curseforge.com/v1/mods/${projectId}/files/${fileId}/download-url`,
      "Buscar download CurseForge",
      { "x-api-key": apiKey, Accept: "application/json" },
    );

    if (!response.ok) {
      throw new Error(`CurseForge nao liberou URL de download (${response.status}).`);
    }

    return z.object({ data: z.string().url() }).parse(await response.json()).data;
  }

  private getCurseForgeApiKey() {
    return (
      this.apiKeys.loadCurseForgeApiKey() ||
      process.env.MLULTIMATE_CURSEFORGE_API_KEY ||
      process.env.CURSEFORGE_API_KEY ||
      ""
    );
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
      ramMb: Number(row.ram_mb),
      javaPath: row.java_path,
      gameDir: row.game_dir,
      modsCount,
      resourcepacksCount,
      shaderpacksCount,
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

  throw new Error("Formato de importacao nao suportado.");
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
          `Nao foi possivel extrair o .rar. Instale 7-Zip ou envie como .zip/.mrpack. ${errorOutput}`.trim(),
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

const loaderFromModrinthDependencies = (dependencies: Record<string, string>): LoaderType => {
  if (dependencies.forge) return "forge";
  if (dependencies["fabric-loader"]) return "fabric";
  if (dependencies.quilt) return "quilt";
  if (dependencies.neoforge) return "neoforge";
  return "vanilla";
};

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

const resolveCurseForgeProjectId = async (slugOrName: string, apiKey: string) => {
  const params = new URLSearchParams({
    gameId: "432",
    pageSize: "1",
    searchFilter: slugOrName.replaceAll("-", " "),
  });
  const response = await fetchWithElectronNet(
    `https://api.curseforge.com/v1/mods/search?${params}`,
    "Resolver projeto CurseForge",
    { "x-api-key": apiKey, Accept: "application/json" },
  );

  if (!response.ok) {
    throw new Error(`CurseForge retornou erro ${response.status} ao resolver o projeto.`);
  }

  const project = z
    .object({ data: z.array(z.object({ id: z.number(), slug: z.string().optional() })) })
    .parse(await response.json()).data.at(0);

  if (!project) {
    throw new Error("Nenhum projeto CurseForge foi encontrado para esse codigo.");
  }

  return project.id;
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
