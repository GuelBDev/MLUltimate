import { app } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { spawn } from "node:child_process";
import type { UpdaterState } from "../../src/types/launcher";

type EmitUpdaterState = (state: UpdaterState) => void;

const UPDATE_OWNER = "GuelBDev";
const UPDATE_REPO = "MLUltimate";
const RELEASES_API_URL = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases`;
const RELEASES_ATOM_URL = `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases.atom`;
const RELEASE_DOWNLOAD_BASE = `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/download`;

type GitHubRelease = {
  draft: boolean;
  prerelease: boolean;
  tag_name: string;
  assets: Array<{ name: string }>;
};

type UpdateRelease = {
  version: string;
  tag: string;
  feedUrl: string;
};

type ReleaseCandidate = {
  version: string;
  tag: string;
  prerelease: boolean;
  hasUpdateManifest?: boolean;
};

export class UpdateService {
  private state: UpdaterState = {
    status: "idle",
    currentVersion: app.getVersion(),
  };
  private expectedUpdateVersion: string | null = null;

  constructor(private readonly emit: EmitUpdaterState) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = app.getVersion().includes("-");
    autoUpdater.channel = "latest";

    autoUpdater.on("checking-for-update", () => {
      this.setState({ status: "checking", message: "Procurando atualização..." });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.expectedUpdateVersion = info.version;
      this.setState({
        status: "available",
        availableVersion: info.version,
        message: `Atualização ${info.version} encontrada. Baixando...`,
      });
    });

    autoUpdater.on("update-not-available", () => {
      if (this.expectedUpdateVersion) {
        this.setState({
          status: "available",
          availableVersion: this.expectedUpdateVersion,
          message: `Atualização ${this.expectedUpdateVersion} encontrada. Preparando download...`,
        });
        return;
      }

      this.setState({
        status: "not-available",
        message: "Você já está na versão mais recente.",
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      this.setState({
        status: "downloading",
        progress: Math.round(progress.percent),
        message: `Baixando atualização ${Math.round(progress.percent)}%`,
      });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      this.expectedUpdateVersion = null;
      this.setState({
        status: "downloaded",
        availableVersion: info.version,
        progress: 100,
        message: "Atualização pronta para instalar.",
      });
    });

    autoUpdater.on("error", (error) => {
      this.setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao procurar atualização.",
      });
    });
  }

  getState() {
    return this.state;
  }

  async checkForUpdates(manual = false) {
    if (!app.isPackaged) {
      this.setState({
        status: manual ? "not-available" : "idle",
        message: manual
          ? "Atualização automática funciona apenas no app instalado."
          : undefined,
      });
      return this.state;
    }

    this.expectedUpdateVersion = null;
    this.setState({ status: "checking", message: "Procurando atualização..." });
    try {
      const release = await this.findLatestUpdateRelease();

      if (!release) {
        this.setState({
          status: "not-available",
          message: "Você já está com o app atualizado.",
        });
        return this.state;
      }

      this.expectedUpdateVersion = release.version;
      autoUpdater.setFeedURL({
        provider: "generic",
        url: release.feedUrl,
      });
      this.setState({
        status: "available",
        availableVersion: release.version,
        message: `Atualização ${release.version} encontrada. Baixando...`,
      });
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao procurar atualização.",
      });
    }
    return this.state;
  }

  installDownloadedUpdate() {
    if (this.state.status !== "downloaded") {
      return;
    }

    schedulePostUpdateRelaunch();
    autoUpdater.quitAndInstall(true, true);
  }

  private async findLatestUpdateRelease(): Promise<UpdateRelease | null> {
    const currentVersion = normalizeVersion(app.getVersion());
    const candidates = await this.fetchReleaseCandidates();
    const sorted = candidates
      .filter((release) => autoUpdater.allowPrerelease || !release.prerelease)
      .filter((release) => compareVersions(release.version, currentVersion) > 0)
      .sort((left, right) => compareVersions(right.version, left.version));

    for (const release of sorted) {
      const hasManifest =
        release.hasUpdateManifest ?? (await updateManifestExists(release.tag));

      if (hasManifest) {
        return {
          version: release.version,
          tag: release.tag,
          feedUrl: `${RELEASE_DOWNLOAD_BASE}/${release.tag}/`,
        };
      }
    }

    return null;
  }

  private async fetchReleaseCandidates(): Promise<ReleaseCandidate[]> {
    const errors: string[] = [];

    try {
      const atomCandidates = await fetchAtomReleaseCandidates();

      if (atomCandidates.length > 0) {
        return atomCandidates;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    try {
      return await fetchApiReleaseCandidates();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    throw new Error(
      errors.length > 0
        ? `Não foi possível consultar atualizações no GitHub. ${errors.join(" | ")}`
        : "Não foi possível consultar atualizações no GitHub.",
    );
  }

  private setState(patch: Partial<UpdaterState>) {
    this.state = {
      ...this.state,
      ...patch,
      currentVersion: app.getVersion(),
      lastCheckedAt:
        patch.status === "checking" || patch.status === "not-available" || patch.status === "error"
          ? new Date().toISOString()
          : this.state.lastCheckedAt,
    };
    this.emit(this.state);
  }
}

const fetchAtomReleaseCandidates = async (): Promise<ReleaseCandidate[]> => {
  const response = await fetch(RELEASES_ATOM_URL, {
    headers: {
      Accept: "application/atom+xml, application/xml, text/xml",
      "User-Agent": "MLUltimate-Launcher-Updater",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed público do GitHub retornou ${response.status}.`);
  }

  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

  return entries
    .map((entry): ReleaseCandidate | null => {
      const entryXml = entry[1];

      if (!entryXml) {
        return null;
      }

      const href = entryXml
        .match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/)?.[1]
        ?.replaceAll("&amp;", "&");

      if (!href) {
        return null;
      }

      const tag = decodeURIComponent(new URL(href).pathname.split("/").at(-1) ?? "");
      const version = normalizeVersion(tag);

      if (!version) {
        return null;
      }

      return {
        version,
        tag,
        prerelease: version.includes("-"),
      };
    })
    .filter((release): release is ReleaseCandidate => Boolean(release));
};

const fetchApiReleaseCandidates = async (): Promise<ReleaseCandidate[]> => {
  const response = await fetch(RELEASES_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "MLUltimate-Launcher-Updater",
    },
  });

  if (!response.ok) {
    throw new Error(`API do GitHub retornou ${response.status}.`);
  }

  const releases = (await response.json()) as GitHubRelease[];

  return releases
    .filter((release) => !release.draft)
    .map((release): ReleaseCandidate | null => {
      const version = normalizeVersion(release.tag_name);
      const hasInstaller = release.assets.some(isDesktopInstallerAsset);
      const hasUpdateManifest = release.assets.some(
        (asset) => asset.name === updateManifestName(),
      );

      if (!version || !hasInstaller) {
        return null;
      }

      return {
        version,
        tag: release.tag_name,
        prerelease: release.prerelease,
        hasUpdateManifest,
      };
    })
    .filter((release): release is ReleaseCandidate => Boolean(release));
};

const updateManifestExists = async (tag: string) => {
  const response = await fetch(
    `${RELEASE_DOWNLOAD_BASE}/${tag}/${updateManifestName()}`,
    {
    headers: {
      Accept: "application/x-yaml, text/yaml, text/plain",
      "User-Agent": "MLUltimate-Launcher-Updater",
    },
    },
  );

  return response.ok;
};

const updateManifestName = () =>
  process.platform === "linux" ? "latest-linux.yml" : "latest.yml";

const isDesktopInstallerAsset = (asset: { name: string }) => {
  const name = asset.name.toLowerCase();

  if (process.platform === "linux") {
    return name.endsWith(".appimage") || name.endsWith(".deb");
  }

  return name.endsWith(".exe") && !name.includes("installer");
};

const normalizeVersion = (version: string) => version.replace(/^v/i, "");

const schedulePostUpdateRelaunch = () => {
  if (process.platform !== "win32" || !app.isPackaged) {
    return;
  }

  const executable = app.getPath("exe").replaceAll("'", "''");
  const script = [
    `$launcherPid = ${process.pid}`,
    `$launcherExe = '${executable}'`,
    "try { Wait-Process -Id $launcherPid -Timeout 120 -ErrorAction SilentlyContinue } catch {}",
    "Start-Sleep -Seconds 20",
    "for ($attempt = 0; $attempt -lt 24; $attempt++) {",
    "  if (Test-Path -LiteralPath $launcherExe) {",
    "    try { Start-Process -FilePath $launcherExe; exit 0 } catch {}",
    "  }",
    "  Start-Sleep -Seconds 5",
    "}",
  ].join("; ");
  const watchdog = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    },
  );

  watchdog.unref();
};

const compareVersions = (left: string, right: string) => {
  const leftParts = toComparableVersion(left);
  const rightParts = toComparableVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
};

const toComparableVersion = (version: string) =>
  version
    .replace(/^v/i, "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number(part));
