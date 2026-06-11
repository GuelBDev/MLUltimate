import { app } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import type { UpdaterState } from "../../src/types/launcher";

type EmitUpdaterState = (state: UpdaterState) => void;

const UPDATE_OWNER = "GuelBDev";
const UPDATE_REPO = "MLUltimate";
const RELEASES_API_URL = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases`;

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

export class UpdateService {
  private state: UpdaterState = {
    status: "idle",
    currentVersion: app.getVersion(),
  };

  constructor(private readonly emit: EmitUpdaterState) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = app.getVersion().includes("-");
    autoUpdater.channel = "latest";

    autoUpdater.on("checking-for-update", () => {
      this.setState({ status: "checking", message: "Procurando atualizacao..." });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.setState({
        status: "available",
        availableVersion: info.version,
        message: `Atualizacao ${info.version} encontrada. Baixando...`,
      });
    });

    autoUpdater.on("update-not-available", () => {
      this.setState({
        status: "not-available",
        message: "Voce ja esta na versao mais recente.",
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      this.setState({
        status: "downloading",
        progress: Math.round(progress.percent),
        message: `Baixando atualizacao ${Math.round(progress.percent)}%`,
      });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      this.setState({
        status: "downloaded",
        availableVersion: info.version,
        progress: 100,
        message: "Atualizacao pronta para instalar.",
      });
    });

    autoUpdater.on("error", (error) => {
      this.setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao procurar atualizacao.",
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
          ? "Atualizacao automatica funciona apenas no app instalado."
          : undefined,
      });
      return this.state;
    }

    this.setState({ status: "checking", message: "Procurando atualizacao..." });
    try {
      const release = await this.findLatestUpdateRelease();

      if (!release) {
        this.setState({
          status: "not-available",
          message: "Voce ja esta com o app atualizado.",
        });
        return this.state;
      }

      autoUpdater.setFeedURL({
        provider: "generic",
        url: release.feedUrl,
      });
      this.setState({
        status: "available",
        availableVersion: release.version,
        message: `Atualizacao ${release.version} encontrada. Baixando...`,
      });
      await autoUpdater.checkForUpdates();
    } catch (error) {
      this.setState({
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao procurar atualizacao.",
      });
    }
    return this.state;
  }

  installDownloadedUpdate() {
    if (this.state.status !== "downloaded") {
      return;
    }

    autoUpdater.quitAndInstall(false, true);
  }

  private async findLatestUpdateRelease(): Promise<UpdateRelease | null> {
    const response = await fetch(RELEASES_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "MLUltimate-Launcher-Updater",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Nao foi possivel consultar updates no GitHub (${response.status}).`,
      );
    }

    const releases = (await response.json()) as GitHubRelease[];
    const currentVersion = normalizeVersion(app.getVersion());

    return releases
      .filter((release) => !release.draft)
      .filter((release) => autoUpdater.allowPrerelease || !release.prerelease)
      .map(toUpdateRelease)
      .filter((release): release is UpdateRelease => Boolean(release))
      .filter((release) => compareVersions(release.version, currentVersion) > 0)
      .sort((left, right) => compareVersions(right.version, left.version))[0] ?? null;
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

const toUpdateRelease = (release: GitHubRelease): UpdateRelease | null => {
  const version = normalizeVersion(release.tag_name);
  const hasInstaller = release.assets.some((asset) => asset.name.endsWith(".exe"));
  const hasUpdateManifest = release.assets.some((asset) => asset.name === "latest.yml");

  if (!version || !hasInstaller || !hasUpdateManifest) {
    return null;
  }

  return {
    version,
    tag: release.tag_name,
    feedUrl: `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases/download/${release.tag_name}/`,
  };
};

const normalizeVersion = (version: string) => version.replace(/^v/i, "");

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
