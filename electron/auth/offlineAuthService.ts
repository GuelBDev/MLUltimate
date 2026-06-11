import { createHash } from "node:crypto";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import type { AuthSession, OfflineLoginInput, PublicAccount } from "../../src/types/launcher";

const offlineLoginSchema = z.object({
  username: z.string().trim().min(3).max(16).regex(/^[A-Za-z0-9_]+$/),
});

type OfflineProfileRow = {
  id: string;
  username: string;
};

export class OfflineAuthService {
  constructor(private readonly database: LauncherDatabase) {}

  async login(input: OfflineLoginInput): Promise<AuthSession> {
    const parsed = offlineLoginSchema.parse(input);
    const now = new Date().toISOString();
    const id = `offline-${createHash("sha256")
      .update(parsed.username.toLowerCase())
      .digest("hex")
      .slice(0, 24)}`;

    this.database.run(
      `
      INSERT INTO offline_profiles (id, username, created_at, last_used_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET username = excluded.username, last_used_at = excluded.last_used_at
      `,
      [id, parsed.username, now, now],
    );

    return {
      status: "signed-in",
      account: this.toPublicAccount({ id, username: parsed.username }),
      encryptionAvailable: true,
    };
  }

  getLastOfflineSession(): AuthSession | null {
    const row = this.database.get<OfflineProfileRow>(
      "SELECT id, username FROM offline_profiles ORDER BY last_used_at DESC LIMIT 1",
    );

    if (!row) {
      return null;
    }

    return {
      status: "signed-in",
      account: this.toPublicAccount(row),
      encryptionAvailable: true,
    };
  }

  clear() {
    this.database.run("DELETE FROM offline_profiles");
  }

  private toPublicAccount(profile: OfflineProfileRow): PublicAccount {
    return {
      id: profile.id,
      provider: "offline",
      displayName: profile.username,
      avatarLabel: profile.username.slice(0, 2).toUpperCase(),
      license: { status: "offline-not-required" },
      serverAccess: "offline-only",
    };
  }
}
