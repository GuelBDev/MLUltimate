import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { LauncherDatabase } from "./database/sqliteDatabase";
import { AvatarService } from "./avatar/avatarService";
import { SecureTokenStore } from "./auth/secureTokenStore";
import { MicrosoftAuthService } from "./auth/microsoftAuthService";
import { OfflineAuthService } from "./auth/offlineAuthService";
import { ContentService } from "./content/contentService";
import { LauncherService } from "./launcher/launcherService";
import { DownloadManager } from "./downloads/downloadManager";
import { InstanceService } from "./instances/instanceService";
import { JavaRuntimeService } from "./java/javaRuntimeService";
import { MinecraftVersionService } from "./minecraft/minecraftVersionService";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { getLauncherDataPath, launcherAppName } from "./utils/launcherPaths";
import { ApiKeyStore } from "./settings/apiKeyStore";
import { UpdateService } from "./updater/updateService";

let mainWindow: BrowserWindow | null = null;

app.setName(launcherAppName);
app.setPath("userData", getLauncherDataPath());
Menu.setApplicationMenu(null);

const createWindow = async () => {
  const preload = path.join(__dirname, "preload.cjs");
  const iconPath = process.env.VITE_DEV_SERVER_URL
    ? path.join(process.cwd(), "public", "icon.png")
    : path.join(__dirname, "../dist/icon.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#00000000",
    transparent: true,
    title: "MLUltimate Launcher",
    icon: iconPath,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

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
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
};

const bootstrap = async () => {
  const database = new LauncherDatabase();
  await database.initialize();

  const tokenStore = new SecureTokenStore(database);
  const avatar = new AvatarService(database);
  const apiKeys = new ApiKeyStore(database);
  const microsoftAuth = new MicrosoftAuthService(tokenStore);
  const offlineAuth = new OfflineAuthService(database);
  const downloads = new DownloadManager((items) => {
    mainWindow?.webContents.send("downloads:changed", items);
  });
  const updater = new UpdateService((state) => {
    mainWindow?.webContents.send("updater:state", state);
  });
  const javaRuntimes = new JavaRuntimeService(downloads);
  const minecraftVersions = new MinecraftVersionService(database, downloads, javaRuntimes);
  const instances = new InstanceService(database, minecraftVersions, downloads, apiKeys);
  const content = new ContentService(database, downloads, instances, apiKeys);
  const launcher = new LauncherService(
    microsoftAuth,
    offlineAuth,
    instances,
    javaRuntimes,
    minecraftVersions,
    (event) => {
      mainWindow?.webContents.send("launcher:event", event);
    },
  );

  registerIpcHandlers({
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
  });
  await createWindow();
};

app.whenReady().then(bootstrap).catch((error: unknown) => {
  console.error("Failed to start MLUltimate Launcher", error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
