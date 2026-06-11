import { safeStorage } from "electron";
import { LauncherDatabase } from "../database/sqliteDatabase";
import type { AppLanguage } from "../../src/types/launcher";

type SecureRecord = {
  value: Uint8Array;
};

const curseForgeKey = "api.curseforge.key";
const languageKey = "app.language";
const languageSelectedKey = "app.language.selected";
const defaultLanguage: AppLanguage = "pt-BR";
const appLanguages = new Set<AppLanguage>(["pt-BR", "pt-PT", "en", "fr"]);

export class ApiKeyStore {
  constructor(private readonly database: LauncherDatabase) {}

  saveCurseForgeApiKey(apiKey: string) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Criptografia do sistema indisponivel para salvar a chave.");
    }

    const trimmed = apiKey.trim();

    if (!trimmed) {
      this.clearCurseForgeApiKey();
      return;
    }

    const encrypted = safeStorage.encryptString(trimmed);
    this.database.run(
      `
      INSERT INTO secure_records (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      [curseForgeKey, encrypted, new Date().toISOString()],
    );
  }

  loadCurseForgeApiKey() {
    if (!safeStorage.isEncryptionAvailable()) {
      return "";
    }

    const record = this.database.get<SecureRecord>(
      "SELECT value FROM secure_records WHERE key = ?",
      [curseForgeKey],
    );

    if (!record) {
      return "";
    }

    return safeStorage.decryptString(Buffer.from(record.value));
  }

  clearCurseForgeApiKey() {
    this.database.run("DELETE FROM secure_records WHERE key = ?", [curseForgeKey]);
  }

  saveLanguage(language: AppLanguage, selected = true) {
    if (!appLanguages.has(language)) {
      throw new Error("Idioma invalido.");
    }

    this.saveSetting(languageKey, language);
    this.saveSetting(languageSelectedKey, selected ? "true" : "false");
  }

  getPublicSettings() {
    return {
      curseForgeApiKeyConfigured: Boolean(
        this.loadCurseForgeApiKey() ||
          process.env.MLULTIMATE_CURSEFORGE_API_KEY ||
          process.env.CURSEFORGE_API_KEY,
      ),
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      language: this.loadLanguage(),
      languageSelected: this.loadLanguageSelected(),
    };
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
