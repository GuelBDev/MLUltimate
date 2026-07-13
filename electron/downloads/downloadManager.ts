import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { net } from "electron";
import type { DownloadItem } from "../../src/types/launcher";

type DownloadOptions = {
  label: string;
  url: string;
  destination: string;
  sha1?: string;
  visible?: boolean;
  onProgress?: (progress: { deltaBytes: number; bytesReceived: number; totalBytes?: number }) => void;
};

type EmitDownloads = (items: DownloadItem[]) => void;

export class DownloadManager {
  private downloads = new Map<string, DownloadItem>();
  private inFlightByDestination = new Map<string, Promise<string>>();
  private controllers = new Map<string, AbortController>();

  constructor(private readonly emit: EmitDownloads) {}

  list() {
    return [...this.downloads.values()].sort(
      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    );
  }

  async download({ label, url, destination, sha1, visible = true, onProgress }: DownloadOptions) {
    const normalizedDestination = path.resolve(destination).toLowerCase();
    const running = this.inFlightByDestination.get(normalizedDestination);

    if (running) {
      return running;
    }

    const downloadPromise = this.downloadOnce({
      label,
      url,
      destination,
      sha1,
      visible,
      onProgress,
    }).finally(() => {
      this.inFlightByDestination.delete(normalizedDestination);
    });

    this.inFlightByDestination.set(normalizedDestination, downloadPromise);
    return downloadPromise;
  }

  cancel(downloadId: string) {
    const item = this.downloads.get(downloadId);

    if (!item || !["queued", "running"].includes(item.status)) {
      return;
    }

    item.status = "cancelled";
    item.completedAt = new Date().toISOString();
    item.speedBytesPerSecond = 0;
    this.controllers.get(downloadId)?.abort();
    this.flush();
  }

  throwIfCancelled(taskId: string) {
    if (this.downloads.get(taskId)?.status === "cancelled") {
      throw new DownloadCancelledError();
    }
  }

  private async downloadOnce({ label, url, destination, sha1, visible = true, onProgress }: DownloadOptions) {
    if (existsSync(destination) && sha1) {
      const currentSha1 = await hashFile(destination);

      if (currentSha1 === sha1) {
        return destination;
      }
    }

    if (existsSync(destination) && !sha1) {
      return destination;
    }

    const id = randomUUID();
    const controller = new AbortController();
    const startedAt = new Date().toISOString();
    const item: DownloadItem = {
      id,
      label,
      sourceUrl: url,
      destination,
      status: "running",
      progress: 0,
      bytesReceived: 0,
      speedBytesPerSecond: 0,
      startedAt,
    };

    if (visible) {
      this.downloads.set(id, item);
      this.controllers.set(id, controller);
      this.flush();
    }

    const tempDestination = `${destination}.${id}.part`;

    try {
      await mkdir(path.dirname(destination), { recursive: true });
      await rm(tempDestination, { force: true });

      const response = await fetchWithElectronNet(url, `Download ${label}`, controller.signal);

      if (!response.ok || !response.body) {
        throw new Error(`Download falhou (${response.status}) para ${label}`);
      }

      const totalBytes = Number(response.headers.get("content-length") ?? 0) || undefined;
      const reader = response.body.getReader();
      const file = createWriteStream(tempDestination);
      const hash = createHash("sha1");
      const startTime = Date.now();

      item.totalBytes = totalBytes;
      if (visible) this.flush();

      while (true) {
        if (item.status === "cancelled") {
          throw new DownloadCancelledError();
        }

        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = Buffer.from(value);
        hash.update(chunk);
        item.bytesReceived += chunk.byteLength;
        item.progress = totalBytes
          ? Math.min(100, Math.round((item.bytesReceived / totalBytes) * 100))
          : 0;
        item.speedBytesPerSecond =
          item.bytesReceived / Math.max(1, (Date.now() - startTime) / 1000);
        onProgress?.({
          deltaBytes: chunk.byteLength,
          bytesReceived: item.bytesReceived,
          totalBytes,
        });

        if (!file.write(chunk)) {
          await new Promise<void>((resolve) => file.once("drain", resolve));
        }

        if (visible) this.flush();
      }

      await new Promise<void>((resolve, reject) => {
        file.end((error?: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });

      const actualSha1 = hash.digest("hex");

      if (sha1 && actualSha1 !== sha1) {
        throw new Error(`SHA-1 invalido para ${label}. Esperado ${sha1}, obtido ${actualSha1}.`);
      }

      if (existsSync(destination)) {
        if (!sha1 || (await hashFile(destination)) === sha1) {
          await rm(tempDestination, { force: true });
        } else {
          await rm(destination, { force: true });
          await rename(tempDestination, destination);
        }
      } else {
        await rename(tempDestination, destination);
      }

      item.status = "completed";
      item.progress = 100;
      item.completedAt = new Date().toISOString();
      item.speedBytesPerSecond = 0;
      if (visible) this.flush();

      return destination;
    } catch (error) {
      await rm(tempDestination, { force: true });
      if (item.status === "cancelled" || error instanceof DownloadCancelledError) {
        item.status = "cancelled";
        item.error = undefined;
      } else {
        item.status = "failed";
        item.error = error instanceof Error ? error.message : "Download falhou.";
      }
      item.completedAt = new Date().toISOString();
      if (visible) this.flush();
      throw error;
    } finally {
      this.controllers.delete(id);
    }
  }

  createTask(label: string, destination: string, sourceUrl = "internal://task") {
    const id = randomUUID();
    const item: DownloadItem = {
      id,
      label,
      sourceUrl,
      destination,
      status: "running",
      progress: 0,
      bytesReceived: 0,
      speedBytesPerSecond: 0,
      startedAt: new Date().toISOString(),
    };

    this.downloads.set(id, item);
    this.flush();
    return id;
  }

  updateTask(id: string, patch: Partial<Pick<DownloadItem, "label" | "progress" | "bytesReceived" | "totalBytes" | "speedBytesPerSecond">>) {
    const item = this.downloads.get(id);

    if (!item || item.status === "cancelled") {
      return;
    }

    Object.assign(item, patch);
    if (typeof patch.bytesReceived === "number" && typeof patch.speedBytesPerSecond !== "number") {
      const elapsedSeconds = Math.max(1, (Date.now() - Date.parse(item.startedAt)) / 1000);
      item.speedBytesPerSecond = item.bytesReceived / elapsedSeconds;
    }
    this.flush();
  }

  completeTask(id: string) {
    const item = this.downloads.get(id);

    if (!item || item.status === "cancelled") {
      return;
    }

    item.status = "completed";
    item.progress = 100;
    item.speedBytesPerSecond = 0;
    item.completedAt = new Date().toISOString();
    this.flush();
  }

  failTask(id: string, error: unknown) {
    const item = this.downloads.get(id);

    if (!item || item.status === "cancelled") {
      return;
    }

    item.status = "failed";
    item.error = error instanceof Error ? error.message : "Download falhou.";
    item.completedAt = new Date().toISOString();
    this.flush();
  }

  private flush() {
    this.emit(this.list());
  }
}

const hashFile = async (filePath: string) => {
  const { createReadStream } = await import("node:fs");
  const hash = createHash("sha1");
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
};

export class DownloadCancelledError extends Error {
  constructor() {
    super("Download cancelado.");
    this.name = "DownloadCancelledError";
  }
}

const fetchWithElectronNet = async (url: string, context: string, signal?: AbortSignal) => {
  try {
    return await net.fetch(url, {
      signal,
      headers: {
        "User-Agent": "MLUltimateLauncher/0.1 (+https://local)",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} falhou: ${message}`, { cause: error });
  }
};
