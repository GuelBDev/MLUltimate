import type {
  AuthSession,
  ContentProjectInput,
  ContentSearchInput,
  ContentType,
  CreateInstanceInput,
  InstallContentInput,
  InstallContentAsInstanceInput,
  InstalledContentUpdateInfo,
  ImportInstanceInput,
  ExportInstanceInput,
  InstanceFileActionInput,
  ToggleInstanceFileInput,
  ReadInstanceTextFileInput,
  LaunchEvent,
  LaunchCancelRequest,
  LaunchRequest,
  LauncherSettings,
  OfflineLoginInput,
  SaveNicknameSkinInput,
  UpdaterState,
  UpdateLauncherSettingsInput,
  UpdateInstanceInput,
  SystemMemoryInfo,
} from "../types/launcher";

const desktopOnly = () =>
  new Error("Esta ação precisa ser executada dentro do app desktop Electron.");

const hasBridge = () => typeof window !== "undefined" && Boolean(window.mlultimate);

const signedOut: AuthSession = {
  status: "signed-out",
  encryptionAvailable: false,
};

const defaultSettings: LauncherSettings = {
  encryptionAvailable: false,
  language: "pt-BR",
  languageSelected: false,
  minecraftOpenAction: "none",
};

const defaultUpdaterState: UpdaterState = {
  status: "idle",
  currentVersion: "dev",
};

const defaultSystemMemory: SystemMemoryInfo = {
  totalMb: 16384,
};

const applyCssHudScale = (scale: number) => {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--app-hud-scale", String(scale));
};

export const launcherApi = {
  getSession: async () => {
    if (hasBridge()) {
      return window.mlultimate.auth.getSession();
    }

    return signedOut;
  },

  loginMicrosoft: async () => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.auth.loginMicrosoft();
  },

  loginOffline: async (input: OfflineLoginInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.auth.loginOffline(input);
  },

  logout: async () => {
    if (!hasBridge()) return signedOut;
    return window.mlultimate.auth.logout();
  },

  launch: async (request: LaunchRequest) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.launcher.launch(request);
  },

  cancel: async (request?: LaunchCancelRequest) => {
    if (!hasBridge()) return;
    return window.mlultimate.launcher.cancel(request);
  },

  killInstance: async (instanceId: string) => {
    if (!hasBridge()) return;
    return window.mlultimate.launcher.kill({ instanceId });
  },

  listRunningInstances: async () => {
    if (!hasBridge()) return [];
    return window.mlultimate.launcher.listRunning();
  },

  onLaunchEvent: (callback: (event: LaunchEvent) => void) => {
    if (!hasBridge()) {
      return () => undefined;
    }

    return window.mlultimate.launcher.onEvent(callback);
  },

  listVersions: async () => {
    if (!hasBridge()) return [];
    return window.mlultimate.minecraft.listVersions();
  },

  installVersion: async (versionId: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.minecraft.installVersion(versionId);
  },

  listInstances: async () => {
    if (!hasBridge()) return [];
    return window.mlultimate.instances.list();
  },

  createInstance: async (input: CreateInstanceInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.create(input);
  },

  updateInstance: async (input: UpdateInstanceInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.update(input);
  },

  removeInstance: async (instanceId: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.remove(instanceId);
  },

  openInstanceFolder: async (instanceId: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.openFolder(instanceId);
  },

  selectInstanceIcon: async () => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.selectIcon();
  },

  importInstance: async (input: ImportInstanceInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.importInstance(input);
  },

  exportInstance: async (input: ExportInstanceInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.exportInstance(input);
  },

  inspectInstance: async (instanceId: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.inspect(instanceId);
  },

  toggleInstanceFile: async (input: ToggleInstanceFileInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.toggleFile(input);
  },

  removeInstanceFile: async (input: InstanceFileActionInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.removeFile(input);
  },

  readInstanceTextFile: async (input: ReadInstanceTextFileInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.readTextFile(input);
  },

  openInstanceSubfolder: async (
    instanceId: string,
    folder: "logs" | "screenshots" | "saves" | "mods" | "resourcepacks" | "shaderpacks",
  ) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.instances.openSubfolder({ instanceId, folder });
  },

  searchContent: async (input: ContentSearchInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.search(input);
  },

  getContentProject: async (input: ContentProjectInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.getProject(input);
  },

  installContent: async (input: InstallContentInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.install(input);
  },

  installContentAsInstance: async (input: InstallContentAsInstanceInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.installAsInstance(input);
  },

  listInstalledContent: async (instanceId: string) => {
    if (!hasBridge()) return [];
    return window.mlultimate.content.listInstalled(instanceId);
  },

  checkInstalledContentUpdates: async (instanceId: string): Promise<InstalledContentUpdateInfo[]> => {
    if (!hasBridge()) return [];
    return window.mlultimate.content.checkUpdates(instanceId);
  },

  updateInstalledContent: async (id: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.updateInstalled(id);
  },

  updateAllInstalledContent: async (input: { instanceId: string; type?: ContentType }) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.updateAllInstalled(input);
  },

  toggleInstalledContent: async (input: { id: string; enabled: boolean }) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.toggleInstalled(input);
  },

  removeInstalledContent: async (id: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.content.removeInstalled(id);
  },

  listDownloads: async () => {
    if (!hasBridge()) return [];
    return window.mlultimate.downloads.list();
  },

  cancelDownload: async (downloadId: string) => {
    if (!hasBridge()) return;
    return window.mlultimate.downloads.cancel(downloadId);
  },

  onDownloadsChange: (callback: Parameters<typeof window.mlultimate.downloads.onChange>[0]) => {
    if (!hasBridge()) {
      return () => undefined;
    }

    return window.mlultimate.downloads.onChange(callback);
  },

  getSettings: async () => {
    if (!hasBridge()) return defaultSettings;
    return window.mlultimate.settings.get();
  },

  updateSettings: async (input: UpdateLauncherSettingsInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.settings.update(input);
  },

  getUpdaterState: async () => {
    if (!hasBridge()) return defaultUpdaterState;
    return window.mlultimate.updater.getState();
  },

  checkForUpdates: async () => {
    if (!hasBridge()) {
      return {
        ...defaultUpdaterState,
        status: "not-available" as const,
        message: "Atualização automática funciona apenas no app instalado.",
      };
    }
    return window.mlultimate.updater.check();
  },

  installUpdate: async () => {
    if (!hasBridge()) return;
    return window.mlultimate.updater.install();
  },

  onUpdaterState: (callback: (state: UpdaterState) => void) => {
    if (!hasBridge()) {
      return () => undefined;
    }

    return window.mlultimate.updater.onState(callback);
  },

  searchSkinNickname: async (nickname: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.searchNickname(nickname);
  },

  saveNicknameSkin: async (input: SaveNicknameSkinInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.saveNicknameSkin(input);
  },

  importCustomSkin: async () => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.importCustomSkin();
  },

  listSkins: async () => {
    if (!hasBridge()) return [];
    return window.mlultimate.avatar.listSkins();
  },

  equipSkin: async (skinId: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.equipSkin(skinId);
  },

  removeSkin: async (skinId: string) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.removeSkin(skinId);
  },

  getSystemMemory: async () => {
    if (!hasBridge()) return defaultSystemMemory;
    return window.mlultimate.system.getMemory();
  },

  setHudScale: async (scale: number) => {
    if (!hasBridge()) {
      applyCssHudScale(scale);
      return scale;
    }

    return window.mlultimate.window.setHudScale(scale);
  },

  toggleFullScreen: async () => {
    if (!hasBridge()) {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        return true;
      }

      await document.exitFullscreen();
      return false;
    }

    return window.mlultimate.window.toggleFullScreen();
  },
};
