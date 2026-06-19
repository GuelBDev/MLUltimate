import { safeStorage } from "electron";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";

const secureSessionSchema = z.object({
  provider: z.literal("microsoft"),
  accountId: z.string(),
  displayName: z.string(),
  email: z.string().optional(),
  microsoftAccessToken: z.string(),
  microsoftRefreshToken: z.string(),
  microsoftExpiresAt: z.number(),
  minecraftAccessToken: z.string(),
  minecraftExpiresAt: z.number(),
  xuid: z.string(),
  uhs: z.string(),
  minecraftName: z.string().optional(),
  minecraftUuid: z.string().optional(),
  minecraftSkinUrl: z.string().optional(),
  minecraftSkinDataUrl: z.string().optional(),
  licenseVerified: z.boolean(),
  licenseCheckedAt: z.string().optional(),
});

export type SecureMicrosoftSession = z.infer<typeof secureSessionSchema>;

type SecureRecord = {
  value: Uint8Array;
};

export class SecureTokenStore {
  private static sessionKey = "auth.microsoft.session";

  constructor(private readonly database: LauncherDatabase) {}

  saveSession(session: SecureMicrosoftSession) {
    this.assertEncryptionAvailable();

    const encrypted = safeStorage.encryptString(JSON.stringify(session));
    this.database.run(
      `
      INSERT INTO secure_records (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      [SecureTokenStore.sessionKey, encrypted, new Date().toISOString()],
    );
  }

  loadSession() {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    const record = this.database.get<SecureRecord>(
      "SELECT value FROM secure_records WHERE key = ?",
      [SecureTokenStore.sessionKey],
    );

    if (!record) {
      return null;
    }

    const decrypted = safeStorage.decryptString(Buffer.from(record.value));
    return secureSessionSchema.parse(JSON.parse(decrypted));
  }

  clearSession() {
    this.database.run("DELETE FROM secure_records WHERE key = ?", [
      SecureTokenStore.sessionKey,
    ]);
  }

  isEncryptionAvailable() {
    return safeStorage.isEncryptionAvailable();
  }

  private assertEncryptionAvailable() {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "Criptografia do sistema indisponível. Tokens não serão salvos sem proteção.",
      );
    }
  }
}
