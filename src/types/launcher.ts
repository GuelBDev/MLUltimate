export type AuthProvider = "microsoft" | "offline";

export type LicenseStatus = "verified" | "unverified" | "offline-not-required";

export type PublicAccount = {
  id: string;
  provider: AuthProvider;
  displayName: string;
  email?: string;
  avatarLabel: string;
  license: {
    status: LicenseStatus;
    checkedAt?: string;
  };
  serverAccess: "online-mode" | "offline-only";
  expiresAt?: string;
};

export type AuthSession =
  | {
      status: "signed-in";
      account: PublicAccount;
      encryptionAvailable: boolean;
    }
  | {
      status: "signed-out";
      encryptionAvailable: boolean;
    };

export type OfflineLoginInput = {
  username: string;
};

export type LaunchRequest = {
  instanceId: string;
  force?: boolean;
};

export type LaunchCancelRequest = {
  instanceId?: string;
};

export type LaunchEventType =
  | "step"
  | "console"
  | "security"
  | "running"
  | "closed"
  | "killed"
  | "cancelled"
  | "complete"
  | "error";

export type LaunchEvent = {
  id: string;
  type: LaunchEventType;
  message: string;
  progress?: number;
  createdAt: string;
};

export type LoaderType =
  | "vanilla"
  | "fabric"
  | "iris"
  | "iris-sodium"
  | "forge"
  | "neoforge"
  | "quilt";

export type ContentProvider = "modrinth" | "curseforge";
export type ContentProviderFilter = ContentProvider | "all";

export type ContentType = "mod" | "modpack" | "shader" | "resourcepack";

export type MinecraftVersionSummary = {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  releaseTime: string;
  installed: boolean;
};

export type CreateInstanceInput = {
  name: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
  ramMb: number;
  javaPath?: string;
  iconPath?: string;
  contentManagementEnabled?: boolean;
};

export type UpdateInstanceInput = {
  id: string;
  name?: string;
  ramMb?: number;
  javaPath?: string;
  iconPath?: string;
  loaderVersion?: string;
  contentManagementEnabled?: boolean;
};

export type LauncherInstance = {
  id: string;
  name: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
  ramMb: number;
  javaPath?: string;
  gameDir: string;
  iconPath?: string;
  iconDataUrl?: string;
  modsCount: number;
  resourcepacksCount: number;
  shaderpacksCount: number;
  contentManagementEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DownloadStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type DownloadItem = {
  id: string;
  label: string;
  sourceUrl: string;
  destination: string;
  status: DownloadStatus;
  progress: number;
  bytesReceived: number;
  totalBytes?: number;
  speedBytesPerSecond: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
};

export type ContentSearchInput = {
  provider: ContentProviderFilter;
  type: ContentType;
  query: string;
  minecraftVersion?: string;
  loader?: LoaderType;
  sort?: "relevance" | "downloads" | "updated" | "newest";
  limit?: number;
  offset?: number;
};

export type ContentSearchResult = {
  provider: ContentProvider;
  providers?: ContentProvider[];
  type: ContentType;
  projectId: string;
  slug?: string;
  title: string;
  author?: string;
  description: string;
  downloads?: number;
  iconUrl?: string;
  projectUrl?: string;
  updatedAt?: string;
  latestGameVersion?: string;
  compatibleGameVersions?: string[];
  compatibleLoaders?: LoaderType[];
};

export type ContentVersion = {
  provider: ContentProvider;
  id: string;
  name: string;
  fileName: string;
  datePublished?: string;
  gameVersions: string[];
  loaders: LoaderType[];
  downloads?: number;
  changelog?: string;
};

export type ContentGalleryImage = {
  url: string;
  title?: string;
  description?: string;
};

export type ContentProjectDetails = ContentSearchResult & {
  body?: string;
  sourceUrl?: string;
  versions: ContentVersion[];
  gallery: ContentGalleryImage[];
  commentsNote?: string;
  contentNote?: string;
};

export type InstallContentInput = {
  provider: ContentProvider;
  type: ContentType;
  projectId: string;
  instanceId: string;
  versionId?: string;
};

export type InstallContentAsInstanceInput = {
  provider: ContentProvider;
  type: "mod" | "modpack";
  projectId: string;
  versionId?: string;
};

export type ContentProjectInput = {
  provider: ContentProvider;
  type: ContentType;
  projectId: string;
  minecraftVersion?: string;
  loader?: LoaderType;
};

export type ImportInstanceInput = {
  source: "archive" | "code";
  code?: string;
};

export type InstanceIconSelection = {
  iconPath: string;
  iconDataUrl: string;
};

export type SkinSource = "namemc" | "custom";

export type SkinSearchResult = {
  nickname: string;
  uuid: string;
  skinUrl: string;
  avatarUrl: string;
  namemcUrl: string;
};

export type LauncherSkin = {
  id: string;
  name: string;
  source: SkinSource;
  nickname?: string;
  uuid?: string;
  skinUrl?: string;
  previewUrl?: string;
  imageDataUrl?: string;
  createdAt: string;
  equippedAt?: string;
};

export type SaveNicknameSkinInput = {
  nickname: string;
  name?: string;
};

export type AppLanguage = "pt-BR" | "pt-PT" | "en" | "fr";
export type MinecraftOpenAction = "none" | "minimize" | "background";

export type LauncherSettings = {
  encryptionAvailable: boolean;
  language: AppLanguage;
  languageSelected: boolean;
  minecraftOpenAction: MinecraftOpenAction;
};

export type SystemMemoryInfo = {
  totalMb: number;
};

export type UpdateLauncherSettingsInput = {
  language?: AppLanguage;
  languageSelected?: boolean;
  minecraftOpenAction?: MinecraftOpenAction;
};

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export type UpdaterState = {
  status: UpdaterStatus;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  message?: string;
  lastCheckedAt?: string;
};

export type InstalledContent = {
  id: string;
  instanceId: string;
  provider: ContentProvider;
  type: ContentType;
  projectId: string;
  versionId: string;
  name: string;
  fileName: string;
  filePath: string;
  enabled: boolean;
  installedAt: string;
};

export type InstalledContentUpdateInfo = {
  id: string;
  updateAvailable: boolean;
  latestVersionId?: string;
  latestVersionName?: string;
  latestFileName?: string;
};
