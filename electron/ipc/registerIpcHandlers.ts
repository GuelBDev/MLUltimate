import { totalmem } from "node:os";
import { createHash } from "node:crypto";
import { BrowserWindow, ipcMain, net } from "electron";
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
import type { ServerStatusResult } from "../../src/types/launcher";

const offlineLoginSchema = z.object({
  username: z.string(),
});

const switchAccountSchema = z.object({
  provider: z.enum(["microsoft", "offline"]),
  id: z.string().min(1),
});

const launchRequestSchema = z.object({
  instanceId: z.string().min(1),
  force: z.boolean().optional(),
  server: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      host: z.string().trim().min(1).max(255),
      port: z.number().int().min(1).max(65535).optional(),
      requiresMicrosoft: z.boolean().optional(),
    })
    .optional(),
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
  language: z
    .enum([
      "pt-BR",
      "pt-PT",
      "en",
      "es",
      "fr",
      "de",
      "it",
      "ru",
      "zh-CN",
      "ja",
      "ko",
      "ar",
      "hi",
      "tr",
    ])
    .optional(),
  languageSelected: z.boolean().optional(),
  minecraftOpenAction: z.enum(["none", "minimize", "background"]).optional(),
  appearancePreset: z
    .enum(["night-dark", "light-mode", "blue-sky", "yellow-sun", "emerald-cave", "red-velt"])
    .optional(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  mainColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  sidebarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  rightPanelColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  cardColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  panelColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  inputColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  borderColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  textColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  mutedTextColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  navActiveColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  buttonTextColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  backgroundOpacity: z.number().min(0.35).max(1).optional(),
  mainOpacity: z.number().min(0).max(1).optional(),
  surfaceOpacity: z.number().min(0.25).max(1).optional(),
  panelOpacity: z.number().min(0).max(1).optional(),
  inputOpacity: z.number().min(0).max(1).optional(),
  sidebarOpacity: z.number().min(0.25).max(1).optional(),
  rightPanelOpacity: z.number().min(0.25).max(1).optional(),
  navActiveOpacity: z.number().min(0).max(1).optional(),
  borderOpacity: z.number().min(0).max(1).optional(),
  backgroundImageOpacity: z.number().min(0).max(1).optional(),
  sidebarImageOpacity: z.number().min(0).max(1).optional(),
  backgroundImageDataUrl: z.string().max(7_000_000).nullable().optional(),
  backgroundImageName: z.string().max(160).nullable().optional(),
  sidebarImageDataUrl: z.string().max(7_000_000).nullable().optional(),
  sidebarImageName: z.string().max(160).nullable().optional(),
});

const saveNicknameSkinSchema = z.object({
  nickname: z.string(),
  name: z.string().optional(),
});

const saveNameMcSkinSchema = z.object({
  skinId: z.string().optional(),
  skinUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  name: z.string().optional(),
  variant: z.enum(["classic", "slim"]).optional(),
});

const nameMcLibrarySchema = z.object({
  category: z.enum(["trending", "new", "random", "tag"]),
  tag: z.string().optional(),
  page: z.number().int().min(1).max(20).optional(),
  refresh: z.boolean().optional(),
});

const applyOfficialSkinSchema = z.object({
  variant: z.enum(["classic", "slim"]),
});

const serverStatusSchema = z.object({
  hosts: z.array(z.string().trim().min(1).max(255)).min(1).max(80),
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
  ipcMain.handle("auth:list-accounts", async () => {
    const activeSession = await microsoftAuth.getSession();
    const activeOfflineSession = activeSession.status === "signed-in"
      ? null
      : offlineAuth.getLastOfflineSession();
    const activeAccount = activeSession.status === "signed-in"
      ? activeSession.account
      : activeOfflineSession?.status === "signed-in"
        ? activeOfflineSession.account
        : null;
    const accounts = [
      ...microsoftAuth.listAccounts(),
      ...offlineAuth.listAccounts(),
    ];
    const mergedAccounts = activeAccount
      ? [
          activeAccount,
          ...accounts.filter(
            (account) =>
              account.provider !== activeAccount.provider || account.id !== activeAccount.id,
          ),
        ]
      : accounts;

    return mergedAccounts.map((account) => ({
      ...account,
      active: account.provider === activeAccount?.provider && account.id === activeAccount?.id,
    }));
  });
  ipcMain.handle("auth:login-microsoft", async () =>
    microsoftAuth.login(offlineAuth.countAccounts()),
  );
  ipcMain.handle("auth:login-offline", async (_, input: unknown) => {
    const parsed = offlineLoginSchema.parse(input);
    const existingAccounts = [
      ...microsoftAuth.listAccounts(),
      ...offlineAuth.listAccounts(),
    ];
    const offlineId = `offline-${createHash("sha256")
      .update(parsed.username.trim().toLowerCase())
      .digest("hex")
      .slice(0, 24)}`;
    const replacingExisting = existingAccounts.some(
      (account) => account.provider === "offline" && account.id === offlineId,
    );

    if (!replacingExisting && existingAccounts.length >= 3) {
      throw new Error("Limite de 3 perfis atingido. Remova uma conta antes de adicionar outra.");
    }

    return offlineAuth.login(parsed);
  });
  ipcMain.handle("auth:switch-account", async (_, input: unknown) => {
    const parsed = switchAccountSchema.parse(input);

    if (parsed.provider === "microsoft") {
      return microsoftAuth.switchAccount(parsed.id);
    }

    return offlineAuth.switchAccount(parsed.id);
  });
  ipcMain.handle("auth:logout", async () => {
    const session = await microsoftAuth.getSession();
    const activeSession = session.status === "signed-in"
      ? session
      : offlineAuth.getLastOfflineSession();

    if (activeSession?.status === "signed-in") {
      if (activeSession.account.provider === "microsoft") {
        microsoftAuth.removeAccount(activeSession.account.id);
      } else {
        offlineAuth.removeAccount(activeSession.account.id);
      }
    }

    return microsoftAuth.getSession().then((nextMicrosoftSession) => {
      if (nextMicrosoftSession.status === "signed-in") {
        return nextMicrosoftSession;
      }

      return offlineAuth.getLastOfflineSession() ?? nextMicrosoftSession;
    });
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

    apiKeys.saveAppearanceSettings(parsed);

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
  ipcMain.handle("avatar:browse-namemc-library", async (_, input: unknown) =>
    avatar.browseNameMcLibrary(nameMcLibrarySchema.parse(input)),
  );
  ipcMain.handle("avatar:search-namemc-library", async (_, query: unknown) =>
    avatar.searchNameMcLibrary(z.string().parse(query)),
  );
  ipcMain.handle("avatar:save-namemc-skin", async (_, input: unknown) =>
    avatar.saveNameMcSkin(saveNameMcSkinSchema.parse(input)),
  );
  ipcMain.handle("avatar:refresh-namemc-skins", async () => avatar.refreshNameMcSkins());
  ipcMain.handle("avatar:apply-official-skin", async (_, input: unknown) => {
    const parsed = applyOfficialSkinSchema.parse(input);
    const skin = avatar.getEquippedSkinFile();

    if (!skin) {
      throw new Error("Equipe uma skin na aba Avatar antes de aplicar na conta Microsoft.");
    }

    return microsoftAuth.applyMinecraftSkin(skin.localPath, parsed.variant);
  });
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
  ipcMain.handle("servers:status", async (_, input: unknown) => {
    const parsed = serverStatusSchema.parse(input);
    const hosts = Array.from(new Set(parsed.hosts.map((host) => host.toLowerCase())));
    return Promise.all(hosts.map((host) => fetchJavaServerStatus(host)));
  });
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

const fetchJavaServerStatus = async (host: string): Promise<ServerStatusResult> => {
  const primary = await fetchMcStatusIo(host).catch((error: unknown): ServerStatusResult => ({
    host,
    online: false,
    error: error instanceof Error ? error.message : "Nao foi possivel buscar status.",
  }));

  if (primary.online) {
    return primary;
  }

  const fallback = await fetchMcsrvStat(host).catch(() => null);

  if (!fallback) {
    return primary;
  }

  return {
    ...primary,
    ...fallback,
    host,
    icon: primary.icon ?? fallback.icon,
    motd: primary.motd ?? fallback.motd,
    version: primary.version ?? fallback.version,
    error: fallback.online ? undefined : primary.error ?? fallback.error,
  };
};

const fetchMcStatusIo = async (host: string): Promise<ServerStatusResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await net.fetch(
      `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "MLUltimateLauncher/servers",
        },
      },
    );

    if (!response.ok) {
      return {
        host,
        online: false,
        error: `Status retornou ${response.status}.`,
      };
    }

    const payload = await response.json() as {
      online?: boolean;
      retrieved_at?: number;
      players?: {
        online?: number;
        max?: number;
      };
      version?: {
        name_clean?: string;
        name_raw?: string;
      };
      motd?: {
        clean?: string;
      };
      icon?: string;
    };

    return {
      host,
      online: Boolean(payload.online),
      playersOnline: numberOrUndefined(payload.players?.online),
      playersMax: numberOrUndefined(payload.players?.max),
      version: payload.version?.name_clean ?? payload.version?.name_raw,
      motd: payload.motd?.clean,
      icon: payload.icon,
      retrievedAt: payload.retrieved_at
        ? new Date(payload.retrieved_at).toISOString()
        : new Date().toISOString(),
    };
  } catch (error) {
    return {
      host,
      online: false,
        error: error instanceof Error ? error.message : "Nao foi possivel buscar status.",
    };
  } finally {
    clearTimeout(timeout);
  }
};

const fetchMcsrvStat = async (host: string): Promise<ServerStatusResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await net.fetch(
      `https://api.mcsrvstat.us/3/${encodeURIComponent(host)}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "MLUltimateLauncher/servers",
        },
      },
    );

    if (!response.ok) {
      return {
        host,
        online: false,
        error: `Fallback retornou ${response.status}.`,
      };
    }

    const payload = await response.json() as {
      online?: boolean;
      players?: {
        online?: number;
        max?: number;
      };
      version?: string;
      motd?: {
        clean?: string[] | string;
      };
      icon?: string;
      debug?: {
        cachetime?: number;
      };
    };
    const motd = Array.isArray(payload.motd?.clean)
      ? payload.motd?.clean.join("\n")
      : payload.motd?.clean;

    return {
      host,
      online: Boolean(payload.online),
      playersOnline: numberOrUndefined(payload.players?.online),
      playersMax: numberOrUndefined(payload.players?.max),
      version: payload.version,
      motd,
      icon: payload.icon,
      retrievedAt: payload.debug?.cachetime
        ? new Date(payload.debug.cachetime * 1000).toISOString()
        : new Date().toISOString(),
    };
  } catch (error) {
    return {
      host,
      online: false,
      error: error instanceof Error ? error.message : "Nao foi possivel buscar status.",
    };
  } finally {
    clearTimeout(timeout);
  }
};

const numberOrUndefined = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
