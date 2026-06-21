import { safeStorage } from "electron";
import { LauncherDatabase } from "../database/sqliteDatabase";
import type { AppLanguage, MinecraftOpenAction } from "../../src/types/launcher";

const languageKey = "app.language";
const languageSelectedKey = "app.language.selected";
const minecraftOpenActionKey = "minecraft.open.action";
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

  getPublicSettings() {
    return {
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      language: this.loadLanguage(),
      languageSelected: this.loadLanguageSelected(),
      minecraftOpenAction: this.loadMinecraftOpenAction(),
    };
  }

  loadMinecraftOpenAction() {
    const record = this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [minecraftOpenActionKey],
    );
    const action = record?.value as MinecraftOpenAction | undefined;

    return action && minecraftOpenActions.has(action) ? action : "none";
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
