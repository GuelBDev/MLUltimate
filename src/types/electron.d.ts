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
} from "./launcher";

declare global {
  interface Window {
    mlultimate: {
      auth: {
        getSession: () => Promise<AuthSession>;
        loginMicrosoft: () => Promise<AuthSession>;
        loginOffline: (input: OfflineLoginInput) => Promise<AuthSession>;
        logout: () => Promise<AuthSession>;
      };
      launcher: {
        launch: (request: LaunchRequest) => Promise<void>;
        cancel: (request?: LaunchCancelRequest) => Promise<void>;
        onEvent: (callback: (event: LaunchEvent) => void) => () => void;
      };
      minecraft: {
        listVersions: () => Promise<MinecraftVersionSummary[]>;
        installVersion: (versionId: string) => Promise<void>;
      };
      instances: {
        list: () => Promise<LauncherInstance[]>;
        create: (input: CreateInstanceInput) => Promise<LauncherInstance>;
        update: (input: UpdateInstanceInput) => Promise<LauncherInstance>;
        remove: (instanceId: string) => Promise<void>;
        openFolder: (instanceId: string) => Promise<void>;
        importInstance: (input: ImportInstanceInput) => Promise<LauncherInstance | null>;
      };
      content: {
        search: (input: ContentSearchInput) => Promise<ContentSearchResult[]>;
        getProject: (input: ContentProjectInput) => Promise<ContentProjectDetails>;
        install: (input: InstallContentInput) => Promise<InstalledContent[]>;
        listInstalled: (instanceId: string) => Promise<InstalledContent[]>;
      };
      downloads: {
        list: () => Promise<DownloadItem[]>;
        cancel: (downloadId: string) => Promise<void>;
        onChange: (callback: (items: DownloadItem[]) => void) => () => void;
      };
      settings: {
        get: () => Promise<LauncherSettings>;
        update: (input: UpdateLauncherSettingsInput) => Promise<LauncherSettings>;
      };
      updater: {
        getState: () => Promise<UpdaterState>;
        check: () => Promise<UpdaterState>;
        install: () => Promise<void>;
        onState: (callback: (state: UpdaterState) => void) => () => void;
      };
    };
  }
}

export {};
