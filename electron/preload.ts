import { contextBridge, ipcRenderer } from "electron";
import type {
  AuthSession,
  ContentProjectDetails,
  ContentProjectInput,
  ContentSearchInput,
  ContentSearchResult,
  CreateInstanceInput,
  DownloadItem,
  InstallContentInput,
  InstalledContent,
  ImportInstanceInput,
  LaunchEvent,
  LaunchCancelRequest,
  LaunchRequest,
  LauncherSettings,
  LauncherInstance,
  MinecraftVersionSummary,
  OfflineLoginInput,
  UpdaterState,
  UpdateLauncherSettingsInput,
  UpdateInstanceInput,
} from "../src/types/launcher";

const api = {
  auth: {
    getSession: () => ipcRenderer.invoke("auth:get-session") as Promise<AuthSession>,
    loginMicrosoft: () =>
      ipcRenderer.invoke("auth:login-microsoft") as Promise<AuthSession>,
    loginOffline: (input: OfflineLoginInput) =>
      ipcRenderer.invoke("auth:login-offline", input) as Promise<AuthSession>,
    logout: () => ipcRenderer.invoke("auth:logout") as Promise<AuthSession>,
  },
  launcher: {
    launch: (request: LaunchRequest) =>
      ipcRenderer.invoke("launcher:launch", request) as Promise<void>,
    cancel: (request?: LaunchCancelRequest) =>
      ipcRenderer.invoke("launcher:cancel", request) as Promise<void>,
    onEvent: (callback: (event: LaunchEvent) => void) => {
      const listener = (_: Electron.IpcRendererEvent, event: LaunchEvent) => {
        callback(event);
      };

      ipcRenderer.on("launcher:event", listener);

      return () => ipcRenderer.removeListener("launcher:event", listener);
    },
  },
  minecraft: {
    listVersions: () =>
      ipcRenderer.invoke("minecraft:list-versions") as Promise<
        MinecraftVersionSummary[]
      >,
    installVersion: (versionId: string) =>
      ipcRenderer.invoke("minecraft:install-version", versionId) as Promise<void>,
  },
  instances: {
    list: () =>
      ipcRenderer.invoke("instances:list") as Promise<LauncherInstance[]>,
    create: (input: CreateInstanceInput) =>
      ipcRenderer.invoke("instances:create", input) as Promise<LauncherInstance>,
    update: (input: UpdateInstanceInput) =>
      ipcRenderer.invoke("instances:update", input) as Promise<LauncherInstance>,
    remove: (instanceId: string) =>
      ipcRenderer.invoke("instances:remove", instanceId) as Promise<void>,
    openFolder: (instanceId: string) =>
      ipcRenderer.invoke("instances:open-folder", instanceId) as Promise<void>,
    importInstance: (input: ImportInstanceInput) =>
      ipcRenderer.invoke("instances:import", input) as Promise<LauncherInstance | null>,
  },
  content: {
    search: (input: ContentSearchInput) =>
      ipcRenderer.invoke("content:search", input) as Promise<ContentSearchResult[]>,
    getProject: (input: ContentProjectInput) =>
      ipcRenderer.invoke("content:get-project", input) as Promise<ContentProjectDetails>,
    install: (input: InstallContentInput) =>
      ipcRenderer.invoke("content:install", input) as Promise<InstalledContent[]>,
    listInstalled: (instanceId: string) =>
      ipcRenderer.invoke("content:list-installed", instanceId) as Promise<InstalledContent[]>,
  },
  downloads: {
    list: () => ipcRenderer.invoke("downloads:list") as Promise<DownloadItem[]>,
    cancel: (downloadId: string) =>
      ipcRenderer.invoke("downloads:cancel", downloadId) as Promise<void>,
    onChange: (callback: (items: DownloadItem[]) => void) => {
      const listener = (_: Electron.IpcRendererEvent, items: DownloadItem[]) => {
        callback(items);
      };

      ipcRenderer.on("downloads:changed", listener);

      return () => ipcRenderer.removeListener("downloads:changed", listener);
    },
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get") as Promise<LauncherSettings>,
    update: (input: UpdateLauncherSettingsInput) =>
      ipcRenderer.invoke("settings:update", input) as Promise<LauncherSettings>,
  },
  updater: {
    getState: () => ipcRenderer.invoke("updater:get-state") as Promise<UpdaterState>,
    check: () => ipcRenderer.invoke("updater:check") as Promise<UpdaterState>,
    install: () => ipcRenderer.invoke("updater:install") as Promise<void>,
    onState: (callback: (state: UpdaterState) => void) => {
      const listener = (_: Electron.IpcRendererEvent, state: UpdaterState) => {
        callback(state);
      };

      ipcRenderer.on("updater:state", listener);

      return () => ipcRenderer.removeListener("updater:state", listener);
    },
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize") as Promise<void>,
    toggleMaximize: () =>
      ipcRenderer.invoke("window:toggle-maximize") as Promise<boolean>,
    close: () => ipcRenderer.invoke("window:close") as Promise<void>,
  },
};

contextBridge.exposeInMainWorld("mlultimate", api);
