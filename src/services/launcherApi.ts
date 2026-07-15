import type {
  ApplyOfficialSkinInput,
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
  NameMCSkinLibraryInput,
  NameMCSkinSearchResult,
  OfflineLoginInput,
  SavedAuthAccount,
  SaveNicknameSkinInput,
  SaveNameMCSkinInput,
  ServerStatusLookupInput,
  ServerStatusResult,
  UpdaterState,
  UpdateLauncherSettingsInput,
  UpdateInstanceInput,
  SystemMemoryInfo,
  SwitchAccountInput,
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
  appearancePreset: "night-dark",
  primaryColor: "#3B82F6",
  secondaryColor: "#60A5FA",
  backgroundColor: "#0D1117",
  mainColor: "#0D1117",
  sidebarColor: "#0A0E14",
  rightPanelColor: "#0B0F15",
  cardColor: "#161B22",
  panelColor: "#0D1117",
  inputColor: "#0B0F15",
  borderColor: "#FFFFFF",
  textColor: "#FFFFFF",
  mutedTextColor: "#94A3B8",
  navActiveColor: "#3B82F6",
  buttonTextColor: "#FFFFFF",
  backgroundOpacity: 1,
  mainOpacity: 0.38,
  surfaceOpacity: 0.82,
  panelOpacity: 0.7,
  inputOpacity: 0.92,
  sidebarOpacity: 0.96,
  rightPanelOpacity: 0.88,
  navActiveOpacity: 0.16,
  borderOpacity: 0.1,
  backgroundImageOpacity: 0.28,
  sidebarImageOpacity: 0.22,
};
const browserSettingsKey = "mlultimate:browser-settings";

const readBrowserSettings = (): LauncherSettings => {
  if (typeof localStorage === "undefined") return defaultSettings;

  try {
    const stored = JSON.parse(localStorage.getItem(browserSettingsKey) ?? "{}") as Partial<LauncherSettings>;
    return { ...defaultSettings, ...stored };
  } catch {
    return defaultSettings;
  }
};

const saveBrowserSettings = (settings: LauncherSettings) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(browserSettingsKey, JSON.stringify(settings));
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

  listAccounts: async (): Promise<SavedAuthAccount[]> => {
    if (!hasBridge()) return [];
    return window.mlultimate.auth.listAccounts();
  },

  loginMicrosoft: async () => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.auth.loginMicrosoft();
  },

  loginOffline: async (input: OfflineLoginInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.auth.loginOffline(input);
  },

  switchAccount: async (input: SwitchAccountInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.auth.switchAccount(input);
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
    if (!hasBridge()) return readBrowserSettings();
    return window.mlultimate.settings.get();
  },

  updateSettings: async (input: UpdateLauncherSettingsInput) => {
    if (!hasBridge()) {
      const sanitizedInput = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== null),
      ) as Partial<LauncherSettings>;
      const settings: LauncherSettings = { ...readBrowserSettings(), ...sanitizedInput };

      if (input.backgroundImageDataUrl === null) {
        delete settings.backgroundImageDataUrl;
      }

      if (input.backgroundImageName === null) {
        delete settings.backgroundImageName;
      }

      if (input.sidebarImageDataUrl === null) {
        delete settings.sidebarImageDataUrl;
      }

      if (input.sidebarImageName === null) {
        delete settings.sidebarImageName;
      }

      saveBrowserSettings(settings);
      return settings;
    }
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

  browseNameMcLibrary: async (input: NameMCSkinLibraryInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.browseNameMcLibrary(input);
  },

  searchNameMcLibrary: async (query: string): Promise<NameMCSkinSearchResult> => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.searchNameMcLibrary(query);
  },

  saveNameMcSkin: async (input: SaveNameMCSkinInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.saveNameMcSkin(input);
  },

  refreshNameMcSkins: async () => {
    if (!hasBridge()) return { checked: 0, updated: 0, refreshedAt: new Date().toISOString() };
    return window.mlultimate.avatar.refreshNameMcSkins();
  },

  applyOfficialSkin: async (input: ApplyOfficialSkinInput) => {
    if (!hasBridge()) throw desktopOnly();
    return window.mlultimate.avatar.applyOfficialSkin(input);
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

  getServerStatuses: async (input: ServerStatusLookupInput): Promise<ServerStatusResult[]> => {
    if (!hasBridge()) {
      return input.hosts.map((host) => ({
        host,
        online: false,
        error: "Status disponivel apenas no app desktop.",
      }));
    }

    return window.mlultimate.servers.status(input);
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
