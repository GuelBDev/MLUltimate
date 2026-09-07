import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type {
  LauncherInstance,
  TrashedInstance,
  TrashedModManifest,
  TrashedWorld,
} from "../../src/types/launcher";

type InstalledContentRow = {
  id: string;
  instance_id: string;
  provider: string;
  type: string;
  project_id: string;
  version_id: string;
  name: string;
  file_name: string;
  file_path: string;
  installed_at: string;
};

export class InstanceTrashService {
  private trashRoot = getLauncherDataSubpath("Trash", "Instances");

  constructor(private readonly database: LauncherDatabase) {
    if (!existsSync(this.trashRoot)) {
      mkdir(this.trashRoot, { recursive: true }).catch(() => undefined);
    }
  }

  async listTrash(): Promise<TrashedInstance[]> {
    if (!existsSync(this.trashRoot)) {
      return [];
    }

    const entries = await readdir(this.trashRoot, { withFileTypes: true }).catch(() => []);
    const trashedList: TrashedInstance[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(this.trashRoot, entry.name, "trash_manifest.json");

      if (!existsSync(manifestPath)) continue;

      try {
        const raw = await readFile(manifestPath, "utf8");
        const parsed = JSON.parse(raw) as TrashedInstance;
        trashedList.push(parsed);
      } catch (err) {
        console.warn(`[Trash] Falha ao ler manifesto da lixeira em ${entry.name}`, err);
      }
    }

    return trashedList.sort(
      (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
    );
  }

  async moveToTrash(instance: LauncherInstance): Promise<TrashedInstance> {
    const trashId = randomUUID();
    const trashItemDir = path.join(this.trashRoot, trashId);
    await mkdir(trashItemDir, { recursive: true });

    // 1. Process Worlds (saves)
    const worlds: TrashedWorld[] = [];
    const savesDir = path.join(instance.gameDir, "saves");
    const trashSavesDir = path.join(trashItemDir, "saves");

    if (existsSync(savesDir)) {
      try {
        const worldEntries = await readdir(savesDir, { withFileTypes: true });
        for (const worldEntry of worldEntries) {
          if (!worldEntry.isDirectory()) continue;
          const worldFolderPath = path.join(savesDir, worldEntry.name);

          let sizeBytes = 0;
          let lastPlayed: string | undefined;
          try {
            const folderStat = await stat(worldFolderPath);
            lastPlayed = folderStat.mtime.toISOString();
            sizeBytes = await calculateDirectorySize(worldFolderPath);
          } catch {
            // ignore size calculation errors
          }

          worlds.push({
            folderName: worldEntry.name,
            name: worldEntry.name,
            sizeBytes,
            lastPlayed,
          });
        }

        // Copy worlds to trash storage to preserve the player's saved worlds!
        await cp(savesDir, trashSavesDir, { recursive: true, force: true });
      } catch (err) {
        console.warn("[Trash] Falha ao copiar mundos para a lixeira", err);
      }
    }

    // 2. Process Installed Mods & Content from database
    const trackedRows = this.database.all<InstalledContentRow>(
      "SELECT * FROM installed_content WHERE instance_id = ?",
      [instance.id],
    );

    const mods: TrashedModManifest[] = trackedRows.map((row) => ({
      name: row.name,
      fileName: row.file_name,
      provider: row.provider,
      projectId: row.project_id,
      versionId: row.version_id,
      type: row.type,
    }));

    // Check if there are unrecorded manual jars in mods folder
    const modsDir = path.join(instance.gameDir, "mods");
    if (existsSync(modsDir)) {
      try {
        const modFiles = await readdir(modsDir, { withFileTypes: true });
        const existingNames = new Set(mods.map((m) => m.fileName.toLowerCase()));

        for (const file of modFiles) {
          if (!file.isFile()) continue;
          const lower = file.name.toLowerCase();
          if ((lower.endsWith(".jar") || lower.endsWith(".zip")) && !existingNames.has(lower)) {
            mods.push({
              name: file.name.replace(/\.jar$|\.zip$/i, ""),
              fileName: file.name,
              type: "mod",
            });
            existingNames.add(lower);
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Create Manifest
    const trashedInstance: TrashedInstance = {
      id: trashId,
      originalInstanceId: instance.id,
      name: instance.name,
      minecraftVersion: instance.minecraftVersion,
      loader: instance.loader,
      loaderVersion: instance.loaderVersion,
      ramMb: instance.ramMb,
      iconDataUrl: instance.iconDataUrl,
      deletedAt: new Date().toISOString(),
      worlds,
      mods,
      worldsCount: worlds.length,
      modsCount: mods.length,
      sourceProvider: instance.sourceProvider,
      sourceProjectId: instance.sourceProjectId,
      sourceVersionId: instance.sourceVersionId,
    };

    await writeFile(
      path.join(trashItemDir, "trash_manifest.json"),
      JSON.stringify(trashedInstance, null, 2),
      "utf8",
    );

    // 4. Remove active records from SQLite
    this.database.run("DELETE FROM installed_content WHERE instance_id = ?", [instance.id]);
    this.database.run("DELETE FROM instances WHERE id = ?", [instance.id]);

    // 5. Delete original instance directory to save space
    if (existsSync(instance.gameDir)) {
      await rm(instance.gameDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }).catch(
        (err) => console.warn("[Trash] Falha ao remover pasta original da instância", err),
      );
    }

    return trashedInstance;
  }

  async deleteFromTrash(trashIds: string[]): Promise<void> {
    for (const rawId of trashIds) {
      const safeId = sanitizeId(rawId);
      if (!safeId) continue;
      const targetDir = path.join(this.trashRoot, safeId);
      if (existsSync(targetDir)) {
        await rm(targetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(
          () => undefined,
        );
      }
    }
  }

  async emptyTrash(): Promise<void> {
    if (!existsSync(this.trashRoot)) return;
    const entries = await readdir(this.trashRoot, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      const targetDir = path.join(this.trashRoot, entry.name);
      await rm(targetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(
        () => undefined,
      );
    }
  }

  async getTrashItem(trashId: string): Promise<TrashedInstance | null> {
    const safeId = sanitizeId(trashId);
    if (!safeId) return null;

    const manifestPath = path.join(this.trashRoot, safeId, "trash_manifest.json");
    if (!existsSync(manifestPath)) return null;

    try {
      const raw = await readFile(manifestPath, "utf8");
      return JSON.parse(raw) as TrashedInstance;
    } catch {
      return null;
    }
  }

  getTrashItemSavesDir(trashId: string): string | null {
    const safeId = sanitizeId(trashId);
    if (!safeId) return null;
    const savesDir = path.join(this.trashRoot, safeId, "saves");
    return existsSync(savesDir) ? savesDir : null;
  }
}

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9-]/g, "");

const calculateDirectorySize = async (dirPath: string): Promise<number> => {
  let total = 0;
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await calculateDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const fileStat = await stat(fullPath).catch(() => null);
        if (fileStat) total += fileStat.size;
      }
    }
  } catch {
    // ignore
  }
  return total;
};
