import { app } from "electron";
import path from "node:path";

export const launcherAppName = "MLUltimate Launcher";

export const getLauncherDataPath = () =>
  process.env.MLULTIMATE_DATA_PATH ||
  path.join(app.getPath("appData"), launcherAppName);

export const getLauncherDataSubpath = (...parts: string[]) =>
  path.join(getLauncherDataPath(), ...parts);
