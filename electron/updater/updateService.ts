import { app } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import type { UpdaterState } from "../../src/types/launcher";

type EmitUpdaterState = (state: UpdaterState) => void;

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
