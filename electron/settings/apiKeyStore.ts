import { safeStorage } from "electron";
import { LauncherDatabase } from "../database/sqliteDatabase";
import type {
  AppLanguage,
  LauncherAppearancePreset,
  LauncherSettings,
  MinecraftOpenAction,
  MinecraftWindowMode,
  UpdateLauncherSettingsInput,
} from "../../src/types/launcher";

const languageKey = "app.language";
const languageSelectedKey = "app.language.selected";
const gpuAccelerationKey = "app.gpuAcceleration";
const minecraftOpenActionKey = "minecraft.open.action";
const appearancePresetKey = "appearance.preset";
const primaryColorKey = "appearance.primaryColor";
const secondaryColorKey = "appearance.secondaryColor";
const backgroundColorKey = "appearance.backgroundColor";
const mainColorKey = "appearance.mainColor";
const sidebarColorKey = "appearance.sidebarColor";
const rightPanelColorKey = "appearance.rightPanelColor";
const cardColorKey = "appearance.cardColor";
const panelColorKey = "appearance.panelColor";
const inputColorKey = "appearance.inputColor";
const borderColorKey = "appearance.borderColor";
const textColorKey = "appearance.textColor";
const mutedTextColorKey = "appearance.mutedTextColor";
const navActiveColorKey = "appearance.navActiveColor";
const buttonTextColorKey = "appearance.buttonTextColor";
const backgroundOpacityKey = "appearance.backgroundOpacity";
const mainOpacityKey = "appearance.mainOpacity";
const surfaceOpacityKey = "appearance.surfaceOpacity";
const panelOpacityKey = "appearance.panelOpacity";
const inputOpacityKey = "appearance.inputOpacity";
const sidebarOpacityKey = "appearance.sidebarOpacity";
const rightPanelOpacityKey = "appearance.rightPanelOpacity";
const navActiveOpacityKey = "appearance.navActiveOpacity";
const borderOpacityKey = "appearance.borderOpacity";
const backgroundImageOpacityKey = "appearance.backgroundImageOpacity";
const sidebarImageOpacityKey = "appearance.sidebarImageOpacity";
const backgroundImageDataUrlKey = "appearance.backgroundImageDataUrl";
const backgroundImageNameKey = "appearance.backgroundImageName";
const sidebarImageDataUrlKey = "appearance.sidebarImageDataUrl";
const sidebarImageNameKey = "appearance.sidebarImageName";
const sidebarNavOrderKey = "appearance.sidebarNavOrder";
const favoritePresetsKey = "appearance.favoritePresets";
const defaultFavoritePresets = ["night-dark", "blue-sky", "yellow-sun", "light-mode", "emerald-cave"];
const defaultLanguage: AppLanguage = "pt-BR";
const appLanguages = new Set<AppLanguage>([
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
]);
const minecraftOpenActions = new Set<MinecraftOpenAction>(["none", "minimize", "background"]);
const minecraftWindowModeKey = "minecraft.windowMode";
const minecraftWindowModes = new Set<MinecraftWindowMode>(["fullscreen", "windowed", "borderless"]);
const appearancePresetPattern = /^[a-z0-9-_]{1,64}$/i;
const appearancePresets = new Set<LauncherAppearancePreset>([
  "night-dark",
  "light-mode",
  "blue-sky",
  "yellow-sun",
  "emerald-cave",
  "red-velt",
]);
const defaultAppearanceSettings = {
  appearancePreset: "night-dark" as LauncherAppearancePreset,
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
const colorPattern = /^#[0-9a-f]{6}$/i;
const imageDataUrlPattern = /^data:image\/(?:png|jpeg|jpg|webp);base64,/i;
const appearanceColorSettings = [
  ["primaryColor", primaryColorKey],
  ["secondaryColor", secondaryColorKey],
  ["backgroundColor", backgroundColorKey],
  ["mainColor", mainColorKey],
  ["sidebarColor", sidebarColorKey],
  ["rightPanelColor", rightPanelColorKey],
  ["cardColor", cardColorKey],
  ["panelColor", panelColorKey],
  ["inputColor", inputColorKey],
  ["borderColor", borderColorKey],
  ["textColor", textColorKey],
  ["mutedTextColor", mutedTextColorKey],
  ["navActiveColor", navActiveColorKey],
  ["buttonTextColor", buttonTextColorKey],
] as const;
const appearanceNumberSettings = [
  ["backgroundOpacity", backgroundOpacityKey, 0.35, 1],
  ["mainOpacity", mainOpacityKey, 0, 1],
  ["surfaceOpacity", surfaceOpacityKey, 0.25, 1],
  ["panelOpacity", panelOpacityKey, 0, 1],
  ["inputOpacity", inputOpacityKey, 0, 1],
  ["sidebarOpacity", sidebarOpacityKey, 0.25, 1],
  ["rightPanelOpacity", rightPanelOpacityKey, 0.25, 1],
  ["navActiveOpacity", navActiveOpacityKey, 0, 1],
  ["borderOpacity", borderOpacityKey, 0, 1],
  ["backgroundImageOpacity", backgroundImageOpacityKey, 0, 1],
  ["sidebarImageOpacity", sidebarImageOpacityKey, 0, 1],
] as const;

export class ApiKeyStore {
  constructor(private readonly database: LauncherDatabase) {}

  saveLanguage(language: AppLanguage, selected = true) {
    if (!appLanguages.has(language)) {
      throw new Error("Idioma invalido.");
    }

    this.saveSetting(languageKey, language);
    this.saveSetting(languageSelectedKey, selected ? "true" : "false");
  }

  saveMinecraftOpenAction(action: MinecraftOpenAction) {
    if (!minecraftOpenActions.has(action)) {
      throw new Error("Acao de abertura do Minecraft invalida.");
    }

    this.saveSetting(minecraftOpenActionKey, action);
  }

  saveMinecraftWindowMode(mode: MinecraftWindowMode) {
    if (!minecraftWindowModes.has(mode)) {
      throw new Error("Modo de janela do Minecraft invalido.");
    }

    this.saveSetting(minecraftWindowModeKey, mode);
  }

  saveAppearanceSettings(input: UpdateLauncherSettingsInput) {
    if (input.appearancePreset !== undefined) {
      if (!appearancePresets.has(input.appearancePreset) && !appearancePresetPattern.test(input.appearancePreset)) {
        throw new Error("Tema visual invalido.");
      }

      this.saveSetting(appearancePresetKey, input.appearancePreset);
    }

    for (const [field, key] of appearanceColorSettings) {
      const value = input[field];

      if (typeof value === "string") {
        this.saveColor(key, value);
      }
    }

    for (const [field, key, min, max] of appearanceNumberSettings) {
      const value = input[field];

      if (typeof value === "number") {
        this.saveNumber(key, value, min, max);
      }
    }

    if (input.backgroundImageDataUrl !== undefined) {
      this.saveImageDataUrl(backgroundImageDataUrlKey, input.backgroundImageDataUrl);
    }

    if (input.backgroundImageName !== undefined) {
      this.saveSetting(backgroundImageNameKey, input.backgroundImageName ?? "");
    }

    if (input.sidebarImageDataUrl !== undefined) {
      this.saveImageDataUrl(sidebarImageDataUrlKey, input.sidebarImageDataUrl);
    }

    if (input.sidebarImageName !== undefined) {
      this.saveSetting(sidebarImageNameKey, input.sidebarImageName ?? "");
    }

    if (input.sidebarNavOrder !== undefined) {
      this.saveSetting(sidebarNavOrderKey, JSON.stringify(input.sidebarNavOrder));
    }

    if (input.favoritePresets !== undefined) {
      this.saveSetting(favoritePresetsKey, JSON.stringify(input.favoritePresets.slice(0, 5)));
    }

    if (input.gpuAcceleration !== undefined) {
      this.saveSetting(gpuAccelerationKey, input.gpuAcceleration ? "true" : "false");
    }
  }

  getPublicSettings(): LauncherSettings {
    return {
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      language: this.loadLanguage(),
      languageSelected: this.loadLanguageSelected(),
      gpuAcceleration: this.loadGpuAcceleration(),
      minecraftOpenAction: this.loadMinecraftOpenAction(),
      minecraftWindowMode: this.loadMinecraftWindowMode(),
      ...this.loadAppearanceSettings(),
    };
  }

  loadGpuAcceleration(): boolean {
    const record = this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [gpuAccelerationKey],
    );

    return record ? record.value !== "false" : true;
  }

  loadMinecraftOpenAction() {
    const record = this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [minecraftOpenActionKey],
    );
    const action = record?.value as MinecraftOpenAction | undefined;

    return action && minecraftOpenActions.has(action) ? action : "none";
  }

  loadMinecraftWindowMode(): MinecraftWindowMode {
    const record = this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [minecraftWindowModeKey],
    );
    const mode = record?.value as MinecraftWindowMode | undefined;

    return mode && minecraftWindowModes.has(mode) ? mode : "windowed";
  }

  private loadLanguage() {
    const record = this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [languageKey],
    );
    const language = record?.value as AppLanguage | undefined;

    return language && appLanguages.has(language) ? language : defaultLanguage;
  }

  private loadLanguageSelected() {
    const record = this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [languageSelectedKey],
    );

    return record?.value === "true";
  }

  private loadAppearanceSettings() {
    const preset = this.readSetting(appearancePresetKey) as LauncherAppearancePreset | undefined;
    const colors = Object.fromEntries(
      appearanceColorSettings.map(([field, key]) => [
        field,
        this.loadColor(key, defaultAppearanceSettings[field]),
      ]),
    );
    const numbers = Object.fromEntries(
      appearanceNumberSettings.map(([field, key, min, max]) => [
        field,
        this.loadNumber(key, defaultAppearanceSettings[field], min, max),
      ]),
    );

    return {
      appearancePreset:
        preset && (appearancePresets.has(preset) || appearancePresetPattern.test(preset))
          ? preset
          : defaultAppearanceSettings.appearancePreset,
      ...colors,
      ...numbers,
      backgroundImageDataUrl: this.loadOptionalString(backgroundImageDataUrlKey),
      backgroundImageName: this.loadOptionalString(backgroundImageNameKey),
      sidebarImageDataUrl: this.loadOptionalString(sidebarImageDataUrlKey),
      sidebarImageName: this.loadOptionalString(sidebarImageNameKey),
      sidebarNavOrder: this.loadSidebarNavOrder(),
      favoritePresets: this.loadFavoritePresets(),
    } as Omit<
      LauncherSettings,
      "encryptionAvailable" | "language" | "languageSelected" | "gpuAcceleration" | "minecraftOpenAction" | "minecraftWindowMode"
    >;
  }

  private loadFavoritePresets(): string[] {
    const raw = this.readSetting(favoritePresetsKey);
    if (!raw) {
      return defaultFavoritePresets;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter(
          (id) => typeof id === "string" && id.length > 0 && id.length <= 64,
        ).slice(0, 5);
        return filtered.length > 0 ? filtered : defaultFavoritePresets;
      }
    } catch {
      // fallback
    }
    return defaultFavoritePresets;
  }

  private loadSidebarNavOrder(): string[] {
    const raw = this.readSetting(sidebarNavOrderKey);
    const validNonHome = ["avatar", "servers", "library", "explore", "downloads", "settings"];
    if (!raw) {
      return ["home", ...validNonHome];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (id) => typeof id === "string" && validNonHome.includes(id) && id !== "home",
        );
        for (const id of validNonHome) {
          if (!filtered.includes(id)) {
            filtered.push(id);
          }
        }
        return ["home", ...filtered];
      }
    } catch {
      // fallback
    }
    return ["home", ...validNonHome];
  }

  private loadColor(key: string, fallback: string) {
    const value = this.readSetting(key);
    return value && colorPattern.test(value) ? value : fallback;
  }

  private loadNumber(key: string, fallback: number, min: number, max: number) {
    const value = Number(this.readSetting(key));

    if (!Number.isFinite(value)) {
      return fallback;
    }

    return Math.min(max, Math.max(min, Number(value.toFixed(2))));
  }

  private loadOptionalString(key: string) {
    const value = this.readSetting(key);
    return value ? value : undefined;
  }

  private saveColor(key: string, value: string) {
    if (!colorPattern.test(value)) {
      throw new Error("Cor invalida.");
    }

    this.saveSetting(key, value.toUpperCase());
  }

  private saveNumber(key: string, value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
      throw new Error("Valor visual invalido.");
    }

    this.saveSetting(key, String(Math.min(max, Math.max(min, Number(value.toFixed(2))))));
  }

  private saveImageDataUrl(key: string, value: string | null) {
    if (!value) {
      this.saveSetting(key, "");
      return;
    }

    if (value.length > 7_000_000 || !imageDataUrlPattern.test(value)) {
      throw new Error("Imagem invalida. Use PNG, JPG ou WebP com ate 5 MB.");
    }

    this.saveSetting(key, value);
  }

  private readSetting(key: string) {
    return this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [key],
    )?.value;
  }

  private saveSetting(key: string, value: string) {
    this.database.run(
      `
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      [key, value, new Date().toISOString()],
    );
  }
}
