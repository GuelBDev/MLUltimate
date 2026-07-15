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
  key?: string;
  value: Uint8Array;
  updated_at?: string;
};

export class SecureTokenStore {
  private static legacySessionKey = "auth.microsoft.session";
  private static sessionKeyPrefix = "auth.microsoft.session.";

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
      [this.sessionKey(session.accountId), encrypted, new Date().toISOString()],
    );
  }

  loadSession(accountId?: string) {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    if (!accountId) {
      return this.listSessions().at(0) ?? null;
    }

    const record = this.database.get<SecureRecord>(
      "SELECT value FROM secure_records WHERE key = ?",
      [this.sessionKey(accountId)],
    );

    if (!record) {
      return null;
    }

    return this.decryptSession(record);
  }

  listSessions() {
    if (!safeStorage.isEncryptionAvailable()) {
      return [];
    }

    const rows = this.database.all<SecureRecord>(
      `
      SELECT key, value, updated_at FROM secure_records
      WHERE key = ? OR key LIKE ?
      ORDER BY updated_at DESC
      `,
      [SecureTokenStore.legacySessionKey, `${SecureTokenStore.sessionKeyPrefix}%`],
    );

    const sessions = rows.flatMap((row) => {
      try {
        const session = this.decryptSession(row);

        if (row.key === SecureTokenStore.legacySessionKey) {
          this.saveSession(session);
        }

        return [session];
      } catch {
        return [];
      }
    });
    const seen = new Set<string>();

    return sessions.filter((session) => {
      if (seen.has(session.accountId)) {
        return false;
      }

      seen.add(session.accountId);
      return true;
    });
  }

  clearSession(accountId?: string) {
    if (accountId) {
      this.database.run("DELETE FROM secure_records WHERE key = ?", [
        this.sessionKey(accountId),
      ]);
      return;
    }

    this.database.run("DELETE FROM secure_records WHERE key = ?", [
      SecureTokenStore.legacySessionKey,
    ]);
    this.database.run("DELETE FROM secure_records WHERE key LIKE ?", [
      `${SecureTokenStore.sessionKeyPrefix}%`,
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

  private sessionKey(accountId: string) {
    return `${SecureTokenStore.sessionKeyPrefix}${accountId}`;
  }

  private decryptSession(record: SecureRecord) {
    const decrypted = safeStorage.decryptString(Buffer.from(record.value));
    return secureSessionSchema.parse(JSON.parse(decrypted));
  }
}
