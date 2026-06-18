import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { shell } from "electron";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { InstanceService } from "./instanceService";
import type {
  ContentProvider,
  InstanceContentCategory,
  InstanceContentEntry,
  InstanceInspection,
  ReadInstanceTextFileInput,
  ToggleInstanceFileInput,
  InstanceFileActionInput,
} from "../../src/types/launcher";

type InstalledContentRow = {
  id: string;
  provider: ContentProvider;
  project_id: string;
  version_id: string;
  file_path: string;
  icon_url?: string | null;
  enabled?: number;
};

type ScannedEntry = {
  category: InstanceContentCategory;
  absolutePath: string;
  relativePath: string;
  name: string;
  fileName: string;
  enabled: boolean;
  sizeBytes: number;
  modifiedAt: string;
};

export class InstanceInspectionService {
  constructor(
    private readonly database: LauncherDatabase,
    private readonly instances: InstanceService,
  ) {}

  async inspect(instanceId: string): Promise<InstanceInspection> {
    const instance = await this.instances.getById(instanceId);
    await this.instances.restoreLockedContent(instanceId);

    const [content, logs, screenshots, configFilesCount] = await Promise.all([
      this.scanContent(instance.id, instance.gameDir),
      scanLogs(instance.gameDir),
      scanScreenshots(instance.gameDir),
      countFilesRecursively(path.join(instance.gameDir, "config")),
    ]);

    return {
      content,
      logs,
      screenshots,
      configFilesCount,
      totalContentSizeBytes: content.reduce((total, item) => total + item.sizeBytes, 0),
    };
  }

  async toggleFile(input: ToggleInstanceFileInput) {
    const instance = await this.instances.getById(input.instanceId);
    const currentPath = resolveSafeRelativePath(instance.gameDir, input.relativePath);
    assertManageableContentPath(instance.gameDir, currentPath);

    if (!existsSync(currentPath)) {
      throw new Error("O arquivo de conteudo nao existe mais nesta instancia.");
    }

    const currentlyEnabled = !currentPath.toLowerCase().endsWith(".disabled");

    if (currentlyEnabled === input.enabled) {
      return this.inspect(input.instanceId);
    }

    const targetPath = input.enabled
      ? currentPath.replace(/\.disabled$/i, "")
      : `${currentPath}.disabled`;

    await rename(currentPath, targetPath);
    this.database.run(
      "UPDATE installed_content SET file_path = ?, enabled = ? WHERE instance_id = ? AND file_path = ?",
      [targetPath, input.enabled ? 1 : 0, input.instanceId, currentPath],
    );

    return this.inspect(input.instanceId);
  }

  async removeFile(input: InstanceFileActionInput) {
    const instance = await this.instances.getById(input.instanceId);
    const targetPath = resolveSafeRelativePath(instance.gameDir, input.relativePath);
    assertManageableContentPath(instance.gameDir, targetPath);

    await rm(targetPath, { recursive: true, force: true });
    this.database.run(
      "DELETE FROM installed_content WHERE instance_id = ? AND file_path = ?",
      [input.instanceId, targetPath],
    );

    return this.inspect(input.instanceId);
  }

  async readTextFile(input: ReadInstanceTextFileInput) {
    const instance = await this.instances.getById(input.instanceId);
    const targetPath = resolveSafeRelativePath(instance.gameDir, input.relativePath);
    assertReadableLogPath(instance.gameDir, targetPath);
    const maxBytes = Math.min(2_000_000, Math.max(16_384, input.maxBytes ?? 750_000));
    const file = await readFile(targetPath);
    const content = targetPath.toLowerCase().endsWith(".gz") ? gunzipSync(file) : file;
    const clipped =
      content.byteLength > maxBytes ? content.subarray(content.byteLength - maxBytes) : content;

    return clipped.toString("utf8");
  }

  async openSubfolder(input: {
    instanceId: string;
    folder: "logs" | "screenshots" | "saves" | "mods" | "resourcepacks" | "shaderpacks";
  }) {
    const instance = await this.instances.getById(input.instanceId);
    const targetPath = resolveSafeRelativePath(instance.gameDir, input.folder);
    await mkdir(targetPath, { recursive: true });
    await shell.openPath(targetPath);
  }

  private async scanContent(instanceId: string, gameDir: string) {
    const installedRows = this.database.all<InstalledContentRow>(
      "SELECT id, provider, project_id, version_id, file_path, icon_url, enabled FROM installed_content WHERE instance_id = ?",
      [instanceId],
    );
    const installedByPath = new Map(
      installedRows.map((row) => [normalizePath(row.file_path), row]),
    );

    const groups = await Promise.all([
      scanTopLevel(gameDir, "mods", "mod"),
      scanDataPacks(gameDir),
      scanTopLevel(gameDir, "resourcepacks", "resourcepack"),
      scanTopLevel(gameDir, "shaderpacks", "shader"),
      scanWorlds(gameDir),
    ]);

    return groups
      .flat()
      .map((entry): InstanceContentEntry => {
        const installed = installedByPath.get(normalizePath(entry.absolutePath));

        return {
          id: `${entry.category}:${entry.relativePath}`,
          category: entry.category,
          name: displayName(entry.name),
          fileName: entry.fileName,
          relativePath: entry.relativePath,
          enabled: installed ? installed.enabled !== 0 : entry.enabled,
          sizeBytes: entry.sizeBytes,
          modifiedAt: entry.modifiedAt,
          provider: installed?.provider,
          projectId: installed?.project_id,
          versionId: installed?.version_id,
          iconUrl: installed?.icon_url ?? undefined,
          installedContentId: installed?.id,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }
}

const scanTopLevel = async (
  gameDir: string,
  directoryName: string,
  category: InstanceContentCategory,
) => {
  const directory = path.join(gameDir, directoryName);

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const scanned = await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.startsWith(".")) {
          return null;
        }

        const absolutePath = path.join(directory, entry.name);

        if (!(await isContentEntry(absolutePath, entry.name, entry.isDirectory(), category))) {
          return null;
        }

        return describeEntry(gameDir, absolutePath, category);
      }),
    );
    return scanned.filter((entry): entry is ScannedEntry => Boolean(entry));
  } catch {
    return [];
  }
};

const scanDataPacks = async (gameDir: string) => {
  const root = await scanTopLevel(gameDir, "datapacks", "datapack");

  try {
    const worlds = await readdir(path.join(gameDir, "saves"), { withFileTypes: true });
    const nested = await Promise.all(
      worlds
        .filter((world) => world.isDirectory())
        .map(async (world) => {
          const directory = path.join(gameDir, "saves", world.name, "datapacks");

          try {
            const entries = await readdir(directory, { withFileTypes: true });
            const scanned = await Promise.all(
              entries.map(async (entry) => {
                if (entry.name.startsWith(".")) return null;
                const absolutePath = path.join(directory, entry.name);
                if (
                  !(await isContentEntry(
                    absolutePath,
                    entry.name,
                    entry.isDirectory(),
                    "datapack",
                  ))
                ) {
                  return null;
                }
                return describeEntry(gameDir, absolutePath, "datapack");
              }),
            );
            return scanned.filter((entry): entry is ScannedEntry => Boolean(entry));
          } catch {
            return [];
          }
        }),
    );

    return [...root, ...nested.flat()];
  } catch {
    return root;
  }
};

const scanWorlds = async (gameDir: string) => {
  const directory = path.join(gameDir, "saves");

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => describeEntry(gameDir, path.join(directory, entry.name), "world")),
    );
  } catch {
    return [];
  }
};

const describeEntry = async (
  gameDir: string,
  absolutePath: string,
  category: InstanceContentCategory,
): Promise<ScannedEntry> => {
  const metadata = await stat(absolutePath);
  const fileName = path.basename(absolutePath);
  const enabled = !fileName.toLowerCase().endsWith(".disabled");
  const cleanName = fileName.replace(/\.disabled$/i, "");

  return {
    category,
    absolutePath,
    relativePath: path.relative(gameDir, absolutePath),
    name: cleanName,
    fileName,
    enabled,
    sizeBytes: metadata.isDirectory()
      ? await directorySize(absolutePath)
      : metadata.size,
    modifiedAt: metadata.mtime.toISOString(),
  };
};

const scanLogs = async (gameDir: string) => {
  const directory = path.join(gameDir, "logs");

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const logs = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() && /\.(log|txt|gz)$/i.test(entry.name),
        )
        .map(async (entry) => {
          const absolutePath = path.join(directory, entry.name);
          const metadata = await stat(absolutePath);
          return {
            name: entry.name,
            relativePath: path.relative(gameDir, absolutePath),
            sizeBytes: metadata.size,
            modifiedAt: metadata.mtime.toISOString(),
          };
        }),
    );

    return logs.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
  } catch {
    return [];
  }
};

const scanScreenshots = async (gameDir: string) => {
  const directory = path.join(gameDir, "screenshots");

  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const metadata = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name),
        )
        .map(async (entry) => {
          const absolutePath = path.join(directory, entry.name);
          const fileMetadata = await stat(absolutePath);
          return {
            name: entry.name,
            absolutePath,
            relativePath: path.relative(gameDir, absolutePath),
            sizeBytes: fileMetadata.size,
            createdAt: fileMetadata.birthtime.toISOString(),
          };
        }),
    );

    const visible = metadata
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 40);

    return Promise.all(
      visible.map(async ({ absolutePath, ...screenshot }) => ({
        ...screenshot,
        imageDataUrl:
          screenshot.sizeBytes <= 12 * 1024 * 1024
            ? await imageDataUrl(absolutePath)
            : undefined,
      })),
    );
  } catch {
    return [];
  }
};

const countFilesRecursively = async (directory: string): Promise<number> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const counts = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? countFilesRecursively(path.join(directory, entry.name))
          : Promise.resolve(1),
      ),
    );
    return counts.reduce((total, count) => total + count, 0);
  } catch {
    return 0;
  }
};

const directorySize = async (directory: string): Promise<number> => {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? directorySize(target) : (await stat(target)).size;
      }),
    );
    return sizes.reduce((total, size) => total + size, 0);
  } catch {
    return 0;
  }
};

const imageDataUrl = async (filePath: string) => {
  const extension = path.extname(filePath).toLowerCase();
  const mime =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : "image/jpeg";
  return `data:${mime};base64,${(await readFile(filePath)).toString("base64")}`;
};

const resolveSafeRelativePath = (gameDir: string, relativePath: string) => {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error("Caminho da instancia invalido.");
  }

  const root = path.resolve(gameDir);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Caminho fora da pasta segura da instancia.");
  }

  return target;
};

const assertManageableContentPath = (gameDir: string, targetPath: string) => {
  const relative = normalizeRelativePath(path.relative(gameDir, targetPath));
  const allowed = [
    "mods/",
    "datapacks/",
    "resourcepacks/",
    "shaderpacks/",
    "saves/",
  ].some(
    (prefix) => relative.startsWith(prefix) && relative.length > prefix.length,
  );

  if (!allowed) {
    throw new Error("Esse arquivo nao pertence a uma categoria gerenciavel.");
  }
};

const assertReadableLogPath = (gameDir: string, targetPath: string) => {
  const relative = normalizeRelativePath(path.relative(gameDir, targetPath));

  if (!relative.startsWith("logs/") || !/\.(log|txt|gz)$/i.test(targetPath)) {
    throw new Error("Somente arquivos de log da instancia podem ser lidos.");
  }
};

const displayName = (fileName: string) =>
  fileName
    .replace(/\.(disabled|jar|zip|mrpack)$/gi, "")
    .replace(/[-_]+/g, " ")
    .trim();

const normalizePath = (value: string) => path.resolve(value).toLowerCase();
const normalizeRelativePath = (value: string) => value.replaceAll("\\", "/").toLowerCase();

const isContentEntry = async (
  absolutePath: string,
  fileName: string,
  isDirectory: boolean,
  category: InstanceContentCategory,
) => {
  if (isDirectory) {
    if (category === "resourcepack" || category === "datapack") {
      return existsSync(path.join(absolutePath, "pack.mcmeta"));
    }

    if (category === "shader") {
      return existsSync(path.join(absolutePath, "shaders"));
    }

    return false;
  }

  const normalized = fileName.toLowerCase().replace(/\.disabled$/, "");

  if (category === "mod") return /\.(jar|zip)$/i.test(normalized);
  if (category === "datapack") return /\.zip$/i.test(normalized);
  if (category === "resourcepack" || category === "shader") {
    return /\.zip$/i.test(normalized);
  }
  return false;
};
