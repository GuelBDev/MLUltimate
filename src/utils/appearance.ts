import type { LauncherSettings, UpdateLauncherSettingsInput } from "../types/launcher";

export const fallbackAppearance = {
  primaryColor: "#3B82F6",
  secondaryColor: "#60A5FA",
  backgroundColor: "#0D1117",
  mainColor: "#0D1117",
  sidebarColor: "#0A0E14",
  rightPanelColor: "#0B0F15",
  cardColor: "#161B22",
  panelColor: "#0D1117",
  inputColor: "#0B0F15",
  borderColor: "#FFFFFF",
  textColor: "#FFFFFF",
  mutedTextColor: "#94A3B8",
  navActiveColor: "#3B82F6",
  buttonTextColor: "#FFFFFF",
  backgroundOpacity: 1,
  mainOpacity: 0.38,
  surfaceOpacity: 0.82,
  panelOpacity: 0.7,
  inputOpacity: 0.92,
  sidebarOpacity: 0.96,
  rightPanelOpacity: 0.88,
  navActiveOpacity: 0.16,
  borderOpacity: 0.1,
  backgroundImageOpacity: 0.28,
  sidebarImageOpacity: 0.22,
};

export const readAppearanceColor = (value: string | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value ?? "") ? (value as string) : fallback;

export const hexToRgb = (hex: string | undefined, fallback = "#3B82F6") => {
  const normalized = readAppearanceColor(hex, fallback);
  const value = Number.parseInt(normalized.slice(1), 16);

  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

export const clampAppearanceNumber = (
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Number((value as number).toFixed(2))));
};

const cssUrl = (value?: string) => (value ? `url("${value.replace(/"/g, '\\"')}")` : "none");

export const applyAppearanceSettings = (
  settings: Partial<LauncherSettings> | Partial<UpdateLauncherSettingsInput>,
) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const primary = readAppearanceColor(settings.primaryColor, fallbackAppearance.primaryColor);
  const secondary = readAppearanceColor(settings.secondaryColor, fallbackAppearance.secondaryColor);
  const background = readAppearanceColor(settings.backgroundColor, fallbackAppearance.backgroundColor);
  const main = readAppearanceColor(settings.mainColor, fallbackAppearance.mainColor);
  const sidebar = readAppearanceColor(settings.sidebarColor, fallbackAppearance.sidebarColor);
  const rightPanel = readAppearanceColor(settings.rightPanelColor, fallbackAppearance.rightPanelColor);
  const card = readAppearanceColor(settings.cardColor, fallbackAppearance.cardColor);
  const panel = readAppearanceColor(settings.panelColor, fallbackAppearance.panelColor);
  const input = readAppearanceColor(settings.inputColor, fallbackAppearance.inputColor);
  const border = readAppearanceColor(settings.borderColor, fallbackAppearance.borderColor);
  const text = readAppearanceColor(settings.textColor, fallbackAppearance.textColor);
  const mutedText = readAppearanceColor(settings.mutedTextColor, fallbackAppearance.mutedTextColor);
  const navActive = readAppearanceColor(settings.navActiveColor, fallbackAppearance.navActiveColor);
  const buttonText = readAppearanceColor(settings.buttonTextColor, fallbackAppearance.buttonTextColor);
  const backgroundOpacity = clampAppearanceNumber(
    settings.backgroundOpacity,
    fallbackAppearance.backgroundOpacity,
    0.35,
    1,
  );
  const mainOpacity = clampAppearanceNumber(settings.mainOpacity, fallbackAppearance.mainOpacity, 0, 1);
  const surfaceOpacity = clampAppearanceNumber(
    settings.surfaceOpacity,
    fallbackAppearance.surfaceOpacity,
    0.25,
    1,
  );
  const panelOpacity = clampAppearanceNumber(settings.panelOpacity, fallbackAppearance.panelOpacity, 0, 1);
  const inputOpacity = clampAppearanceNumber(settings.inputOpacity, fallbackAppearance.inputOpacity, 0, 1);
  const sidebarOpacity = clampAppearanceNumber(
    settings.sidebarOpacity,
    fallbackAppearance.sidebarOpacity,
    0.25,
    1,
  );
  const rightPanelOpacity = clampAppearanceNumber(
    settings.rightPanelOpacity,
    fallbackAppearance.rightPanelOpacity,
    0.25,
    1,
  );
  const navActiveOpacity = clampAppearanceNumber(
    settings.navActiveOpacity,
    fallbackAppearance.navActiveOpacity,
    0,
    1,
  );
  const borderOpacity = clampAppearanceNumber(settings.borderOpacity, fallbackAppearance.borderOpacity, 0, 1);

  if (settings.appearancePreset) {
    root.dataset.appearancePreset = settings.appearancePreset;
  }
  root.style.setProperty("--app-primary", primary);
  root.style.setProperty("--app-secondary", secondary);
  root.style.setProperty("--app-primary-rgb", hexToRgb(primary));
  root.style.setProperty("--app-secondary-rgb", hexToRgb(secondary));
  root.style.setProperty("--app-bg-rgb", hexToRgb(background, fallbackAppearance.backgroundColor));
  root.style.setProperty("--app-main-rgb", hexToRgb(main, fallbackAppearance.mainColor));
  root.style.setProperty("--app-sidebar-rgb", hexToRgb(sidebar, fallbackAppearance.sidebarColor));
  root.style.setProperty("--app-right-panel-rgb", hexToRgb(rightPanel, fallbackAppearance.rightPanelColor));
  root.style.setProperty("--app-card-rgb", hexToRgb(card, fallbackAppearance.cardColor));
  root.style.setProperty("--app-panel-rgb", hexToRgb(panel, fallbackAppearance.panelColor));
  root.style.setProperty("--app-input-rgb", hexToRgb(input, fallbackAppearance.inputColor));
  root.style.setProperty("--app-border-rgb", hexToRgb(border, fallbackAppearance.borderColor));
  root.style.setProperty("--app-nav-active-rgb", hexToRgb(navActive, fallbackAppearance.navActiveColor));
  root.style.setProperty("--app-bg-base", `rgb(var(--app-bg-rgb) / ${backgroundOpacity})`);
  root.style.setProperty("--app-main-overlay", `rgb(var(--app-main-rgb) / ${mainOpacity})`);
  root.style.setProperty("--app-card-bg", `rgb(var(--app-card-rgb) / ${surfaceOpacity})`);
  root.style.setProperty("--app-panel-bg", `rgb(var(--app-panel-rgb) / ${panelOpacity})`);
  root.style.setProperty("--app-input-bg", `rgb(var(--app-input-rgb) / ${inputOpacity})`);
  root.style.setProperty("--app-sidebar-bg", `rgb(var(--app-sidebar-rgb) / ${sidebarOpacity})`);
  root.style.setProperty("--app-account-bg", `rgb(var(--app-right-panel-rgb) / ${rightPanelOpacity})`);
  root.style.setProperty("--app-nav-active-bg", `rgb(var(--app-nav-active-rgb) / ${navActiveOpacity})`);
  root.style.setProperty("--app-border-color", `rgb(var(--app-border-rgb) / ${borderOpacity})`);
  root.style.setProperty("--app-text-primary", text);
  root.style.setProperty("--app-text-muted", mutedText);
  root.style.setProperty("--app-button-text", buttonText);
  root.style.setProperty(
    "--app-bg-image-opacity",
    String(clampAppearanceNumber(settings.backgroundImageOpacity, fallbackAppearance.backgroundImageOpacity, 0, 1)),
  );
  root.style.setProperty(
    "--app-sidebar-image-opacity",
    String(clampAppearanceNumber(settings.sidebarImageOpacity, fallbackAppearance.sidebarImageOpacity, 0, 1)),
  );
  if (settings.backgroundImageDataUrl !== undefined) {
    root.style.setProperty("--app-bg-image", cssUrl(settings.backgroundImageDataUrl || undefined));
  }
  if (settings.sidebarImageDataUrl !== undefined) {
    root.style.setProperty("--app-sidebar-image", cssUrl(settings.sidebarImageDataUrl || undefined));
  }
};
