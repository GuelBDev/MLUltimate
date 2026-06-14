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
  InstanceIconSelection,
  LaunchEvent,
  LaunchCancelRequest,
  LaunchRequest,
  LauncherSettings,
  LauncherInstance,
  MinecraftVersionSummary,
  OfflineLoginInput,
  LauncherSkin,
  SaveNicknameSkinInput,
  SkinSearchResult,
  SystemMemoryInfo,
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
        kill: (request: { instanceId: string }) => Promise<void>;
        listRunning: () => Promise<string[]>;
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
        selectIcon: () => Promise<InstanceIconSelection | null>;
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
      avatar: {
        searchNickname: (nickname: string) => Promise<SkinSearchResult>;
        saveNicknameSkin: (input: SaveNicknameSkinInput) => Promise<LauncherSkin>;
        importCustomSkin: () => Promise<LauncherSkin | null>;
        listSkins: () => Promise<LauncherSkin[]>;
        equipSkin: (skinId: string) => Promise<LauncherSkin>;
        removeSkin: (skinId: string) => Promise<void>;
      };
      system: {
        getMemory: () => Promise<SystemMemoryInfo>;
      };
      window: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<boolean>;
        toggleFullScreen: () => Promise<boolean>;
        setHudScale: (scale: number) => Promise<number>;
        close: () => Promise<void>;
      };
    };
  }
}

export {};
