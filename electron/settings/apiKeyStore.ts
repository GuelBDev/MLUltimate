import { safeStorage } from "electron";
import { LauncherDatabase } from "../database/sqliteDatabase";

type SecureRecord = {
  value: Uint8Array;
};

const curseForgeKey = "api.curseforge.key";

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

  getPublicSettings() {
    return {
      curseForgeApiKeyConfigured: Boolean(
        this.loadCurseForgeApiKey() ||
          process.env.MLULTIMATE_CURSEFORGE_API_KEY ||
          process.env.CURSEFORGE_API_KEY,
      ),
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
    };
  }
}
