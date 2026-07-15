import { createHash } from "node:crypto";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import type { AuthSession, OfflineLoginInput, PublicAccount } from "../../src/types/launcher";
import { AuthAccountStore } from "./authAccountStore";

const offlineLoginSchema = z.object({
  username: z.string().trim().min(3).max(16).regex(/^[A-Za-z0-9_]+$/),
});

type OfflineProfileRow = {
  id: string;
  username: string;
};

export class OfflineAuthService {
  constructor(
    private readonly database: LauncherDatabase,
    private readonly accountStore: AuthAccountStore,
  ) {}

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
    this.accountStore.setActiveAccount("offline", id);

    return {
      status: "signed-in",
      account: this.toPublicAccount({ id, username: parsed.username }),
      encryptionAvailable: true,
    };
  }

  getLastOfflineSession(): AuthSession | null {
    const active = this.accountStore.getActiveAccount();
    const row = active?.provider === "offline"
      ? this.database.get<OfflineProfileRow>(
          "SELECT id, username FROM offline_profiles WHERE id = ?",
          [active.id],
        )
      : active
        ? null
        : this.database.get<OfflineProfileRow>(
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

  listAccounts() {
    return this.database
      .all<OfflineProfileRow>("SELECT id, username FROM offline_profiles ORDER BY last_used_at DESC")
      .map((row) => this.toPublicAccount(row));
  }

  countAccounts() {
    return this.database.get<{ total: number }>("SELECT COUNT(*) AS total FROM offline_profiles")?.total ?? 0;
  }

  switchAccount(id: string): AuthSession {
    const row = this.database.get<OfflineProfileRow>(
      "SELECT id, username FROM offline_profiles WHERE id = ?",
      [id],
    );

    if (!row) {
      throw new Error("Conta offline nao encontrada.");
    }

    this.database.run("UPDATE offline_profiles SET last_used_at = ? WHERE id = ?", [
      new Date().toISOString(),
      id,
    ]);
    this.accountStore.setActiveAccount("offline", id);

    return {
      status: "signed-in",
      account: this.toPublicAccount(row),
      encryptionAvailable: true,
    };
  }

  removeAccount(id: string) {
    this.database.run("DELETE FROM offline_profiles WHERE id = ?", [id]);
    this.accountStore.clearActiveAccountIfMatches("offline", id);
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
