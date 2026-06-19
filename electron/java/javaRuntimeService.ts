import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { net } from "electron";
import { z } from "zod";
import { DownloadManager } from "../downloads/downloadManager";
import { getLauncherDataSubpath } from "../utils/launcherPaths";

const ADOPTIUM_API = "https://api.adoptium.net/v3/assets/latest";

const adoptiumAssetSchema = z.array(
  z.object({
    binary: z.object({
      package: z.object({
        checksum: z.string(),
        link: z.string().url(),
        name: z.string(),
      }),
    }),
  }),
);

type ResolveJavaInput = {
  javaPath?: string;
  component?: string;
  majorVersion?: number;
};

export class JavaRuntimeService {
  private rootDir = getLauncherDataSubpath("Java");
  private runtimeDir = path.join(this.rootDir, "runtimes");
  private downloadsDir = path.join(this.rootDir, "downloads");

  constructor(private readonly downloads: DownloadManager) {}

  async resolveJava({ javaPath, component, majorVersion }: ResolveJavaInput) {
    const requiredMajor = normalizeMajorVersion(majorVersion);

    if (javaPath && existsSync(javaPath)) {
      return javaPath;
    }

    const cached = await this.findCachedRuntime(requiredMajor);

    if (cached) {
      return cached;
    }

    const officialLauncherRuntime = await this.findOfficialLauncherRuntime(
      component,
      requiredMajor,
    );

    if (officialLauncherRuntime) {
      return officialLauncherRuntime;
    }

    const systemJava = await this.findCompatibleSystemJava(requiredMajor);

    if (systemJava) {
      return systemJava;
    }

    return this.downloadTemurinRuntime(requiredMajor);
  }

  private async findCachedRuntime(requiredMajor: number) {
    return this.findJavaInDirectory(path.join(this.runtimeDir, `temurin-${requiredMajor}`));
  }

  private async findOfficialLauncherRuntime(component: string | undefined, requiredMajor: number) {
    if (!component || process.platform !== "win32") {
      return null;
    }

    const localAppData = process.env.LOCALAPPDATA;

    if (!localAppData) {
      return null;
    }

    const javaPath = path.join(
      localAppData,
      "Packages",
      "Microsoft.4297127D64EC6_8wekyb3d8bbwe",
      "LocalCache",
      "Local",
      "runtime",
      component,
      "windows-x64",
      component,
      "bin",
      "java.exe",
    );

    if (!existsSync(javaPath)) {
      return null;
    }

    const major = await detectJavaMajor(javaPath);
    return major === requiredMajor ? javaPath : null;
  }

  private async findCompatibleSystemJava(requiredMajor: number) {
    const candidates = [
      process.env.JAVA_HOME
        ? path.join(
            process.env.JAVA_HOME,
            "bin",
            process.platform === "win32" ? "java.exe" : "java",
          )
        : null,
      process.platform === "win32" ? "java.exe" : "java",
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      const major = await detectJavaMajor(candidate);

      if (major === requiredMajor) {
        return candidate;
      }
    }

    return null;
  }

  private async downloadTemurinRuntime(requiredMajor: number) {
    const response = await fetchWithElectronNet(
      `${ADOPTIUM_API}/${requiredMajor}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse`,
      `Buscar Java ${requiredMajor}`,
    );

    if (!response.ok) {
      throw new Error(`Não foi possível encontrar Java ${requiredMajor} (${response.status}).`);
    }

    const asset = adoptiumAssetSchema.parse(await response.json()).at(0);

    if (!asset) {
      throw new Error(`Nenhum runtime Java ${requiredMajor} foi encontrado.`);
    }

    const packageInfo = asset.binary.package;
    const archivePath = path.join(this.downloadsDir, packageInfo.name);
    const extractDir = path.join(this.runtimeDir, `temurin-${requiredMajor}`);

    await mkdir(this.downloadsDir, { recursive: true });
    await this.downloads.download({
      label: `Java ${requiredMajor} runtime`,
      url: packageInfo.link,
      destination: archivePath,
    });

    const actualChecksum = await hashFile(archivePath, "sha256");

    if (actualChecksum.toLowerCase() !== packageInfo.checksum.toLowerCase()) {
      await rm(archivePath, { force: true });
      throw new Error(`Checksum invalido para Java ${requiredMajor}.`);
    }

    await rm(extractDir, { recursive: true, force: true });
    await mkdir(extractDir, { recursive: true });
    new AdmZip(archivePath).extractAllTo(extractDir, true);

    const java = await this.findJavaInDirectory(extractDir);

    if (!java) {
      throw new Error(`Java ${requiredMajor} foi baixado, mas java.exe não foi encontrado.`);
    }

    return java;
  }

  private async findJavaInDirectory(directory: string): Promise<string | null> {
    if (!existsSync(directory)) {
      return null;
    }

    const fileName = process.platform === "win32" ? "java.exe" : "java";
    const queue = [directory];

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      const entries = await readdir(current, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(current, entry.name);

        if (entry.isDirectory()) {
          queue.push(entryPath);
        } else if (entry.name.toLowerCase() === fileName) {
          return entryPath;
        }
      }
    }

    return null;
  }
}

const normalizeMajorVersion = (majorVersion?: number) => {
  if (!majorVersion || majorVersion < 8) {
    return 8;
  }

  return majorVersion;
};

const detectJavaMajor = async (javaPath: string) => {
  try {
    const output = await new Promise<string>((resolve, reject) => {
      execFile(javaPath, ["-version"], { windowsHide: true }, (error, stdout, stderr) => {
        if (error && !stderr && !stdout) {
          reject(error);
          return;
        }

        resolve(`${stdout}\n${stderr}`);
      });
    });
    const match = output.match(/version "([^"]+)"/);
    const version = match?.[1] ?? "";
    const majorText = version.startsWith("1.") ? version.split(".")[1] : version.split(".")[0];
    const major = Number(majorText);

    return Number.isFinite(major) ? major : 0;
  } catch {
    return 0;
  }
};

const hashFile = async (filePath: string, algorithm: "sha256") => {
  const hash = createHash(algorithm);
  const buffer = await readFile(filePath);
  hash.update(buffer);
  return hash.digest("hex");
};

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
