import { app, BrowserWindow, Menu, Tray, nativeImage, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import v8 from "node:v8";
import { LauncherDatabase } from "./database/sqliteDatabase";
import { AvatarService } from "./avatar/avatarService";
import { SecureTokenStore } from "./auth/secureTokenStore";
import { MicrosoftAuthService } from "./auth/microsoftAuthService";
import { OfflineAuthService } from "./auth/offlineAuthService";
import { AuthAccountStore } from "./auth/authAccountStore";
import { ContentService } from "./content/contentService";
import { LauncherService } from "./launcher/launcherService";
import { DownloadManager } from "./downloads/downloadManager";
import { InstanceService } from "./instances/instanceService";
import { InstanceInspectionService } from "./instances/instanceInspectionService";
import { JavaRuntimeService } from "./java/javaRuntimeService";
import { MinecraftVersionService } from "./minecraft/minecraftVersionService";
import { repairLaunchCompatibility } from "./launcher/launchCompatibility";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { getLauncherDataPath, launcherAppName } from "./utils/launcherPaths";
import { ApiKeyStore } from "./settings/apiKeyStore";
import { UpdateService } from "./updater/updateService";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const purgeLauncherMemory = () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.session.clearCache().catch(() => {});
      mainWindow.webContents
        .executeJavaScript("if (typeof window !== 'undefined' && window.gc) { window.gc(); }", true)
        .catch(() => {});
    }
  } catch {
    // Ignore cache clear failures
  }

  try {
    v8.setFlagsFromString("--expose_gc");
    if (typeof global.gc === "function") {
      global.gc();
    }
  } catch {
    // Ignore GC flag failures
  }
};

app.setName(launcherAppName);
app.setPath("userData", getLauncherDataPath());
Menu.setApplicationMenu(null);

const getIconPath = () => {
  const devIcon = path.join(process.cwd(), "public", "icon.png");
  if (process.env.VITE_DEV_SERVER_URL && fs.existsSync(devIcon)) {
    return devIcon;
  }

  const distIcon = path.join(__dirname, "../dist/icon.png");
  if (fs.existsSync(distIcon)) {
    return distIcon;
  }

  const buildIcon = path.join(__dirname, "../build/icon.png");
  if (fs.existsSync(buildIcon)) {
    return buildIcon;
  }

  return devIcon;
};

const createTray = () => {
  if (tray && !tray.isDestroyed()) {
    return tray;
  }

  const iconPath = getIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip("MLUltimate Launcher");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Abrir MLUltimate",
      click: () => {
        showMainWindow();
      },
    },
    {
      type: "separator",
    },
    {
      label: "Sair",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    showMainWindow();
  });

  tray.on("double-click", () => {
    showMainWindow();
  });

  return tray;
};

const gotSingleInstanceLock =
  process.env.MLULTIMATE_QA_ALLOW_SECOND_INSTANCE === "1" || app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

const showMainWindow = () => {
  if (process.env.MLULTIMATE_QA_HIDDEN === "1") {
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
    mainWindow.maximize();
  }

  mainWindow.focus();
};

app.on("second-instance", () => {
  showMainWindow();
});

const createWindow = async () => {
  const preload = path.join(__dirname, "preload.cjs");
  const iconPath = getIconPath();

  const isWindows = process.platform === "win32";

  createTray();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 360,
    minHeight: 520,
    backgroundColor: "#0a0e17",
    title: "MLUltimate Launcher",
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: isWindows
      ? {
          color: "#111820",
          symbolColor: "#94a3b8",
          height: 32,
        }
      : false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: true,
    },
  });

  mainWindow.on("minimize", () => {
    purgeLauncherMemory();
  });

  mainWindow.on("hide", () => {
    purgeLauncherMemory();
  });

  mainWindow.on("blur", () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
        purgeLauncherMemory();
      }
    }, 1500);
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      event.preventDefault();
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  mainWindow.once("ready-to-show", showMainWindow);
  const windowShowFallback = setTimeout(showMainWindow, 3500);
  mainWindow.once("show", () => clearTimeout(windowShowFallback));
  mainWindow.webContents.once("did-finish-load", () => {
    if (process.env.MLULTIMATE_QA_EXIT_AFTER_READY === "1") {
      setTimeout(() => app.quit(), 1000);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith("file://");

    if (!allowed) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) {
        void shell.openExternal(url);
      }
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};

const bootstrap = async (database: LauncherDatabase, apiKeys: ApiKeyStore) => {
  const tokenStore = new SecureTokenStore(database);
  const authAccounts = new AuthAccountStore(database);
  const avatar = new AvatarService(database);
  const microsoftAuth = new MicrosoftAuthService(tokenStore, authAccounts);
  const offlineAuth = new OfflineAuthService(database, authAccounts);
  const downloads = new DownloadManager((items) => {
    mainWindow?.webContents.send("downloads:changed", items);
  });
  const updater = new UpdateService((state) => {
    mainWindow?.webContents.send("updater:state", state);
  });
  const javaRuntimes = new JavaRuntimeService(downloads);
  const minecraftVersions = new MinecraftVersionService(database, downloads, javaRuntimes);
  const instances = new InstanceService(database, minecraftVersions, downloads);
  const content = new ContentService(database, downloads, instances);
  const instanceInspection = new InstanceInspectionService(
    database,
    instances,
    (instanceId) => content.hydrateInstanceContentImages(instanceId),
  );
  const launcher = new LauncherService(
    microsoftAuth,
    offlineAuth,
    instances,
    javaRuntimes,
    minecraftVersions,
    avatar,
    (event) => {
      mainWindow?.webContents.send("launcher:event", event);

      if (event.type === "running") {
        const action = apiKeys.loadMinecraftOpenAction();

        if (action === "minimize") {
          mainWindow?.minimize();
        }

        if (action === "background") {
          mainWindow?.hide();
        }

        purgeLauncherMemory();
      }

      if (event.type === "closed" || event.type === "error" || event.type === "cancelled") {
        const action = apiKeys.loadMinecraftOpenAction();
        if (action === "background" || action === "minimize") {
          showMainWindow();
        }
      }
    },
    () => apiKeys.loadMinecraftWindowMode(),
  );

  registerIpcHandlers({
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
  });

  if (process.env.MLULTIMATE_QA_CREATE_INSTANCE_JSON) {
    const instance = await instances.create(
      JSON.parse(process.env.MLULTIMATE_QA_CREATE_INSTANCE_JSON),
    );
    console.log(`MLULTIMATE_QA_CREATE_INSTANCE_OK ${instance.id} ${instance.name}`);
    app.quit();
    return;
  }

  if (process.env.MLULTIMATE_QA_IMPORT_ARCHIVE) {
    const instance = await instances.importArchiveFile(process.env.MLULTIMATE_QA_IMPORT_ARCHIVE);
    console.log(`MLULTIMATE_QA_IMPORT_ARCHIVE_OK ${instance.id} ${instance.name}`);
    app.quit();
    return;
  }

  if (process.env.MLULTIMATE_QA_REMOVE_INSTANCE_ID) {
    await instances.remove(process.env.MLULTIMATE_QA_REMOVE_INSTANCE_ID);
    console.log(`MLULTIMATE_QA_REMOVE_INSTANCE_OK ${process.env.MLULTIMATE_QA_REMOVE_INSTANCE_ID}`);
    app.quit();
    return;
  }

  if (process.env.MLULTIMATE_QA_REPAIR_INSTANCE_ID) {
    const instance = await instances.getById(process.env.MLULTIMATE_QA_REPAIR_INSTANCE_ID);
    const repairs = repairLaunchCompatibility({
      instance,
      loaderVersion: instance.loaderVersion,
    });
    console.log(`MLULTIMATE_QA_REPAIR_INSTANCE_OK ${repairs.length}`);
    for (const repair of repairs) {
      console.log(repair);
    }
    app.quit();
    return;
  }

  await createWindow();
};

if (gotSingleInstanceLock) {
  const start = async () => {
    const database = new LauncherDatabase();
    await database.initialize();
    const apiKeys = new ApiKeyStore(database);

    const isGpuEnabled = apiKeys.loadGpuAcceleration();
    if (!isGpuEnabled) {
      app.disableHardwareAcceleration();
      app.commandLine.appendSwitch("disable-gpu");
    }

    // Limit memory footprint and enable aggressive background cleanup
    app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256 --optimize_for_size --expose-gc");
    app.commandLine.appendSwitch("renderer-process-limit", "2");
    app.commandLine.appendSwitch("enable-features", "MemorySaverMode,ResourcePrioritizer");
    app.commandLine.appendSwitch("disable-renderer-backgrounding", "false");

    await app.whenReady();
    await bootstrap(database, apiKeys);

    setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
        purgeLauncherMemory();
      }
    }, 5 * 60 * 1000);
  };

  start().catch((error: unknown) => {
    console.error("Failed to start MLUltimate Launcher", error);
    app.quit();
  });

  app.on("before-quit", () => {
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
      return;
    }

    showMainWindow();
  });
}
