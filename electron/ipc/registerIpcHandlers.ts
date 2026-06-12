import { BrowserWindow, ipcMain } from "electron";
import { z } from "zod";
import { MicrosoftAuthService } from "../auth/microsoftAuthService";
import { AvatarService } from "../avatar/avatarService";
import { ContentService } from "../content/contentService";
import { DownloadManager } from "../downloads/downloadManager";
import { OfflineAuthService } from "../auth/offlineAuthService";
import { InstanceService } from "../instances/instanceService";
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

const createInstanceSchema = z.object({
  name: z.string(),
  minecraftVersion: z.string(),
  loader: z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]),
  ramMb: z.number(),
  javaPath: z.string().optional(),
  iconPath: z.string().optional(),
});

const updateInstanceSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  ramMb: z.number().optional(),
  javaPath: z.string().optional(),
  iconPath: z.string().optional(),
});

const searchContentSchema = z.object({
  provider: z.enum(["all", "modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  query: z.string(),
  minecraftVersion: z.string().optional(),
  loader: z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]).optional(),
  sort: z.enum(["relevance", "downloads", "updated", "newest"]).optional(),
});

const installContentSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string(),
  instanceId: z.string(),
  versionId: z.string().optional(),
});

const contentProjectSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string(),
  minecraftVersion: z.string().optional(),
  loader: z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]).optional(),
});

const importInstanceSchema = z.object({
  source: z.enum(["archive", "code"]),
  code: z.string().optional(),
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
  ipcMain.handle("content:search", async (_, input: unknown) =>
    content.search(searchContentSchema.parse(input)),
  );
  ipcMain.handle("content:get-project", async (_, input: unknown) =>
    content.getProject(contentProjectSchema.parse(input)),
  );
  ipcMain.handle("content:install", async (_, input: unknown) =>
    content.install(installContentSchema.parse(input)),
  );
  ipcMain.handle("content:list-installed", async (_, instanceId: unknown) =>
    content.listInstalled(z.string().min(1).parse(instanceId)),
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
  ipcMain.handle("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
};
