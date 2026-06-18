import { totalmem } from "node:os";
import { BrowserWindow, ipcMain } from "electron";
import { z } from "zod";
import { MicrosoftAuthService } from "../auth/microsoftAuthService";
import { AvatarService } from "../avatar/avatarService";
import { ContentService } from "../content/contentService";
import { DownloadManager } from "../downloads/downloadManager";
import { OfflineAuthService } from "../auth/offlineAuthService";
import { InstanceService } from "../instances/instanceService";
import { InstanceInspectionService } from "../instances/instanceInspectionService";
import { LauncherService } from "../launcher/launcherService";
import { MinecraftVersionService } from "../minecraft/minecraftVersionService";
import { ApiKeyStore } from "../settings/apiKeyStore";
import { UpdateService } from "../updater/updateService";

const offlineLoginSchema = z.object({
  username: z.string(),
});

const launchRequestSchema = z.object({
  instanceId: z.string().min(1),
  force: z.boolean().optional(),
});

const launchCancelSchema = z
  .object({
    instanceId: z.string().min(1).optional(),
  })
  .optional();

const killInstanceSchema = z.object({
  instanceId: z.string().min(1),
});

const downloadIdSchema = z.string().min(1);
const hudScaleSchema = z.number().min(0.75).max(1.35);

const createInstanceSchema = z.object({
  name: z.string(),
  minecraftVersion: z.string(),
  loader: z.enum(["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"]),
  ramMb: z.number(),
  javaPath: z.string().optional(),
  iconPath: z.string().optional(),
  contentManagementEnabled: z.boolean().optional(),
});

const updateInstanceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  ramMb: z.number().optional(),
  javaPath: z.string().optional(),
  iconPath: z.string().optional(),
  contentManagementEnabled: z.boolean().optional(),
});

const searchContentSchema = z.object({
  provider: z.enum(["all", "modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  query: z.string(),
  minecraftVersion: z.string().optional(),
  loader: z.enum(["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"]).optional(),
  sort: z.enum(["relevance", "downloads", "updated", "newest"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

const installContentSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string(),
  instanceId: z.string(),
  versionId: z.string().optional(),
});

const installContentAsInstanceSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack"]),
  projectId: z.string(),
  versionId: z.string().optional(),
});

const installedContentIdSchema = z.string().min(1);

const updateAllInstalledContentSchema = z.object({
  instanceId: z.string().min(1),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]).optional(),
});

const toggleInstalledContentSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

const contentProjectSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string(),
  minecraftVersion: z.string().optional(),
  loader: z.enum(["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"]).optional(),
  includeModpackContent: z.boolean().optional(),
});

const importInstanceSchema = z.object({
  source: z.enum(["archive", "code"]),
  code: z.string().optional(),
});

const exportInstanceSchema = z.object({
  instanceId: z.string().min(1),
  folders: z
    .array(z.enum(["config", "datapacks", "mods", "resourcepacks", "shaderpacks"]))
    .min(1),
});

const instanceFileActionSchema = z.object({
  instanceId: z.string().min(1),
  relativePath: z.string().min(1),
});

const toggleInstanceFileSchema = instanceFileActionSchema.extend({
  enabled: z.boolean(),
});

const readInstanceTextFileSchema = instanceFileActionSchema.extend({
  maxBytes: z.number().int().min(16_384).max(2_000_000).optional(),
});

const openInstanceSubfolderSchema = z.object({
  instanceId: z.string().min(1),
  folder: z.enum(["logs", "screenshots", "saves", "mods", "resourcepacks", "shaderpacks"]),
});

const updateSettingsSchema = z.object({
  language: z.enum(["pt-BR", "pt-PT", "en", "fr"]).optional(),
  languageSelected: z.boolean().optional(),
  minecraftOpenAction: z.enum(["none", "minimize", "background"]).optional(),
});

const saveNicknameSkinSchema = z.object({
  nickname: z.string(),
  name: z.string().optional(),
});

type IpcDeps = {
  microsoftAuth: MicrosoftAuthService;
  offlineAuth: OfflineAuthService;
  launcher: LauncherService;
  downloads: DownloadManager;
  minecraftVersions: MinecraftVersionService;
  instances: InstanceService;
  instanceInspection: InstanceInspectionService;
  content: ContentService;
  apiKeys: ApiKeyStore;
  avatar: AvatarService;
  updater: UpdateService;
};

export const registerIpcHandlers = ({
  microsoftAuth,
  offlineAuth,
  launcher,
  downloads,
  minecraftVersions,
  instances,
  instanceInspection,
  content,
  apiKeys,
  avatar,
  updater,
}: IpcDeps) => {
  ipcMain.handle("auth:get-session", async () => {
    const microsoftSession = await microsoftAuth.getSession();

    if (microsoftSession.status === "signed-in") {
      return microsoftSession;
    }

    return offlineAuth.getLastOfflineSession() ?? microsoftSession;
  });
  ipcMain.handle("auth:login-microsoft", async () => microsoftAuth.login());
  ipcMain.handle("auth:login-offline", async (_, input: unknown) =>
    offlineAuth.login(offlineLoginSchema.parse(input)),
  );
  ipcMain.handle("auth:logout", async () => {
    const session = await microsoftAuth.logout();
    offlineAuth.clear();
    return session;
  });
  ipcMain.handle("launcher:launch", async (_, input: unknown) =>
    launcher.launch(launchRequestSchema.parse(input)),
  );
  ipcMain.handle("launcher:cancel", async (_, input: unknown) =>
    launcher.cancel(launchCancelSchema.parse(input)),
  );
  ipcMain.handle("launcher:kill", async (_, input: unknown) =>
    launcher.kill(killInstanceSchema.parse(input)),
  );
  ipcMain.handle("launcher:list-running", async () => launcher.listRunningInstances());
  ipcMain.handle("minecraft:list-versions", async () => minecraftVersions.listVersions());
  ipcMain.handle("minecraft:install-version", async (_, versionId: unknown) =>
    minecraftVersions.installVersion(z.string().min(1).parse(versionId)),
  );
  ipcMain.handle("instances:list", async () => instances.list());
  ipcMain.handle("instances:create", async (_, input: unknown) =>
    instances.create(createInstanceSchema.parse(input)),
  );
  ipcMain.handle("instances:update", async (_, input: unknown) =>
    instances.update(updateInstanceSchema.parse(input)),
  );
  ipcMain.handle("instances:remove", async (_, instanceId: unknown) =>
    instances.remove(z.string().min(1).parse(instanceId)),
  );
  ipcMain.handle("instances:open-folder", async (_, instanceId: unknown) =>
    instances.openFolder(z.string().min(1).parse(instanceId)),
  );
  ipcMain.handle("instances:select-icon", async () => instances.selectIcon());
  ipcMain.handle("instances:import", async (_, input: unknown) =>
    instances.importInstance(importInstanceSchema.parse(input)),
  );
  ipcMain.handle("instances:export", async (_, input: unknown) =>
    instances.exportInstance(exportInstanceSchema.parse(input)),
  );
  ipcMain.handle("instances:inspect", async (_, instanceId: unknown) =>
    instanceInspection.inspect(z.string().min(1).parse(instanceId)),
  );
  ipcMain.handle("instances:toggle-file", async (_, input: unknown) =>
    instanceInspection.toggleFile(toggleInstanceFileSchema.parse(input)),
  );
  ipcMain.handle("instances:remove-file", async (_, input: unknown) =>
    instanceInspection.removeFile(instanceFileActionSchema.parse(input)),
  );
  ipcMain.handle("instances:read-text-file", async (_, input: unknown) =>
    instanceInspection.readTextFile(readInstanceTextFileSchema.parse(input)),
  );
  ipcMain.handle("instances:open-subfolder", async (_, input: unknown) =>
    instanceInspection.openSubfolder(openInstanceSubfolderSchema.parse(input)),
  );
  ipcMain.handle("content:search", async (_, input: unknown) =>
    content.search(searchContentSchema.parse(input)),
  );
  ipcMain.handle("content:get-project", async (_, input: unknown) =>
    content.getProject(contentProjectSchema.parse(input)),
  );
  ipcMain.handle("content:install", async (_, input: unknown) =>
    content.install(installContentSchema.parse(input)),
  );
  ipcMain.handle("content:install-as-instance", async (_, input: unknown) =>
    content.installAsInstance(installContentAsInstanceSchema.parse(input)),
  );
  ipcMain.handle("content:list-installed", async (_, instanceId: unknown) =>
    content.listInstalled(z.string().min(1).parse(instanceId)),
  );
  ipcMain.handle("content:check-updates", async (_, instanceId: unknown) =>
    content.checkInstalledUpdates(z.string().min(1).parse(instanceId)),
  );
  ipcMain.handle("content:update-installed", async (_, id: unknown) =>
    content.updateInstalledContent(installedContentIdSchema.parse(id)),
  );
  ipcMain.handle("content:update-all-installed", async (_, input: unknown) =>
    content.updateAllInstalledContent(updateAllInstalledContentSchema.parse(input)),
  );
  ipcMain.handle("content:toggle-installed", async (_, input: unknown) =>
    content.toggleInstalledContent(toggleInstalledContentSchema.parse(input)),
  );
  ipcMain.handle("content:remove-installed", async (_, id: unknown) =>
    content.removeInstalledContent(installedContentIdSchema.parse(id)),
  );
  ipcMain.handle("downloads:list", async () => downloads.list());
  ipcMain.handle("downloads:cancel", async (_, downloadId: unknown) =>
    downloads.cancel(downloadIdSchema.parse(downloadId)),
  );
  ipcMain.handle("settings:get", async () => apiKeys.getPublicSettings());
  ipcMain.handle("settings:update", async (_, input: unknown) => {
    const parsed = updateSettingsSchema.parse(input);

    if (parsed.language) {
      apiKeys.saveLanguage(parsed.language, parsed.languageSelected ?? true);
    }

    if (parsed.minecraftOpenAction) {
      apiKeys.saveMinecraftOpenAction(parsed.minecraftOpenAction);
    }

    return apiKeys.getPublicSettings();
  });
  ipcMain.handle("updater:get-state", async () => updater.getState());
  ipcMain.handle("updater:check", async () => updater.checkForUpdates(true));
  ipcMain.handle("updater:install", async () => updater.installDownloadedUpdate());
  ipcMain.handle("avatar:search-nickname", async (_, nickname: unknown) =>
    avatar.searchNickname(z.string().parse(nickname)),
  );
  ipcMain.handle("avatar:save-nickname-skin", async (_, input: unknown) =>
    avatar.saveNicknameSkin(saveNicknameSkinSchema.parse(input)),
  );
  ipcMain.handle("avatar:import-custom-skin", async () => avatar.importCustomSkin());
  ipcMain.handle("avatar:list-skins", async () => avatar.list());
  ipcMain.handle("avatar:equip-skin", async (_, skinId: unknown) =>
    avatar.equip(z.string().min(1).parse(skinId)),
  );
  ipcMain.handle("avatar:remove-skin", async (_, skinId: unknown) =>
    avatar.remove(z.string().min(1).parse(skinId)),
  );
  ipcMain.handle("system:get-memory", async () => ({
    totalMb: Math.max(1024, Math.floor(totalmem() / 1024 / 1024)),
  }));
  ipcMain.handle("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("window:toggle-maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return false;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }

    window.maximize();
    return true;
  });
  ipcMain.handle("window:toggle-full-screen", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return false;
    }

    window.setFullScreen(!window.isFullScreen());
    return window.isFullScreen();
  });
  ipcMain.handle("window:set-hud-scale", (event, input: unknown) => {
    const scale = hudScaleSchema.parse(input);
    const window = BrowserWindow.fromWebContents(event.sender);

    window?.webContents.setZoomFactor(scale);

    return scale;
  });
  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
};
