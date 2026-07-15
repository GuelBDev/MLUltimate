import { LauncherDatabase } from "../database/sqliteDatabase";

export type ActiveAccountRef = {
  provider: "microsoft" | "offline";
  id: string;
};

const activeAccountKey = "auth.active_account";

export class AuthAccountStore {
  constructor(private readonly database: LauncherDatabase) {}

  getActiveAccount(): ActiveAccountRef | null {
    const row = this.database.get<{ value: string }>(
      "SELECT value FROM settings WHERE key = ?",
      [activeAccountKey],
    );

    if (!row?.value) {
      return null;
    }

    const [provider, id] = row.value.split(":");

    if ((provider !== "microsoft" && provider !== "offline") || !id) {
      return null;
    }

    return { provider, id };
  }

  setActiveAccount(provider: ActiveAccountRef["provider"], id: string) {
    this.database.run(
      `
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `,
      [activeAccountKey, `${provider}:${id}`, new Date().toISOString()],
    );
  }

  clearActiveAccount() {
    this.database.run("DELETE FROM settings WHERE key = ?", [activeAccountKey]);
  }

  clearActiveAccountIfMatches(provider: ActiveAccountRef["provider"], id: string) {
    const active = this.getActiveAccount();

    if (active?.provider === provider && active.id === id) {
      this.clearActiveAccount();
    }
  }
}
