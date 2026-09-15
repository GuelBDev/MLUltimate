import { randomUUID } from "node:crypto";
import { net } from "electron";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import type { AuthSession, MlultimateLoginInput, PublicAccount } from "../../src/types/launcher";
import { AuthAccountStore } from "./authAccountStore";

const mlultimateLoginSchema = z.object({
  login: z.string().trim().min(2, "Informe seu Nickname ou e-mail"),
  password: z.string().min(1, "Informe sua senha"),
});

export type MlultimateProfileRow = {
  id: string;
  username: string;
  uuid: string;
  access_token: string;
};

const DEFAULT_YGGDRASIL_URL = "https://mlultimate-omega.vercel.app/api/yggdrasil";

export class MlultimateAuthService {
  private readonly baseUrl: string;

  constructor(
    private readonly database: LauncherDatabase,
    private readonly accountStore: AuthAccountStore,
  ) {
    this.baseUrl = (process.env.MLULTIMATE_YGGDRASIL_URL ?? DEFAULT_YGGDRASIL_URL).replace(/\/+$/, "");
  }

  getYggdrasilUrl(): string {
    return this.baseUrl;
  }

  async login(input: MlultimateLoginInput): Promise<AuthSession> {
    const parsed = mlultimateLoginSchema.parse(input);
    const authenticateUrl = `${this.baseUrl}/authserver/authenticate`;

    const fetchFn = typeof net !== "undefined" && net.fetch ? net.fetch.bind(net) : globalThis.fetch;

    let response: Response;
    try {
      response = await fetchFn(authenticateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: parsed.login,
          password: parsed.password,
          clientToken: randomUUID(),
          requestUser: true,
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Não foi possível conectar ao servidor MLUltimate (${msg}).`, { cause: err });
    }

    if (!response.ok) {
      let errorMsg = `Erro ${response.status}: Falha ao autenticar na Conta MLUltimate.`;
      try {
        const errorJson = (await response.json()) as Record<string, unknown>;
        const rawErr =
          errorJson.errorMessage ||
          errorJson.message ||
          (typeof errorJson.error === "string"
            ? errorJson.error
            : typeof (errorJson.error as Record<string, unknown>)?.message === "string"
              ? (errorJson.error as Record<string, unknown>).message
              : null);
        if (rawErr) {
          errorMsg = String(rawErr);
        }
      } catch {
        errorMsg = `Erro ${response.status}: ${response.statusText || "Servidor indisponível"}`;
      }
      throw new Error(errorMsg);
    }

    const data = (await response.json()) as {
      accessToken: string;
      clientToken?: string;
      selectedProfile?: { id: string; name: string };
      availableProfiles?: Array<{ id: string; name: string }>;
    };

    const profile = data.selectedProfile || data.availableProfiles?.[0];
    if (!profile || !profile.name || !profile.id) {
      throw new Error("Nenhum perfil de jogador encontrado nesta conta MLUltimate.");
    }

    const cleanUuid = String(profile.id).replace(/-/g, "").toLowerCase();
    const id = `mlu-${cleanUuid}`;
    const now = new Date().toISOString();
    const username = profile.name.trim();
    const accessToken = data.accessToken;

    this.database.run(
      `
      INSERT INTO mlultimate_profiles (id, username, uuid, access_token, created_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        uuid = excluded.uuid,
        access_token = excluded.access_token,
        last_used_at = excluded.last_used_at
      `,
      [id, username, cleanUuid, accessToken, now, now],
    );

    this.accountStore.setActiveAccount("mlultimate", id);

    return {
      status: "signed-in",
      account: this.toPublicAccount({
        id,
        username,
        uuid: cleanUuid,
        access_token: accessToken,
      }),
      encryptionAvailable: true,
    };
  }

  getLastSession(): AuthSession | null {
    const active = this.accountStore.getActiveAccount();
    const row =
      active?.provider === "mlultimate"
        ? this.database.get<MlultimateProfileRow>(
            "SELECT id, username, uuid, access_token FROM mlultimate_profiles WHERE id = ?",
            [active.id],
          )
        : active
          ? null
          : this.database.get<MlultimateProfileRow>(
              "SELECT id, username, uuid, access_token FROM mlultimate_profiles ORDER BY last_used_at DESC LIMIT 1",
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

  getProfile(id: string): { id: string; username: string; uuid: string; accessToken: string } | null {
    const row = this.database.get<MlultimateProfileRow>(
      "SELECT id, username, uuid, access_token FROM mlultimate_profiles WHERE id = ?",
      [id],
    );
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      uuid: row.uuid,
      accessToken: row.access_token,
    };
  }

  getActiveProfile(): { id: string; username: string; uuid: string; accessToken: string } | null {
    const active = this.accountStore.getActiveAccount();
    if (active?.provider === "mlultimate") {
      return this.getProfile(active.id);
    }
    if (active) {
      return null;
    }
    const row = this.database.get<MlultimateProfileRow>(
      "SELECT id, username, uuid, access_token FROM mlultimate_profiles ORDER BY last_used_at DESC LIMIT 1",
    );
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      uuid: row.uuid,
      accessToken: row.access_token,
    };
  }

  listAccounts(): PublicAccount[] {
    return this.database
      .all<MlultimateProfileRow>(
        "SELECT id, username, uuid, access_token FROM mlultimate_profiles ORDER BY last_used_at DESC",
      )
      .map((row) => this.toPublicAccount(row));
  }

  countAccounts(): number {
    return (
      this.database.get<{ total: number }>(
        "SELECT COUNT(*) AS total FROM mlultimate_profiles",
      )?.total ?? 0
    );
  }

  switchAccount(id: string): AuthSession {
    const row = this.database.get<MlultimateProfileRow>(
      "SELECT id, username, uuid, access_token FROM mlultimate_profiles WHERE id = ?",
      [id],
    );

    if (!row) {
      throw new Error("Conta MLUltimate não encontrada.");
    }

    this.database.run("UPDATE mlultimate_profiles SET last_used_at = ? WHERE id = ?", [
      new Date().toISOString(),
      id,
    ]);
    this.accountStore.setActiveAccount("mlultimate", id);

    return {
      status: "signed-in",
      account: this.toPublicAccount(row),
      encryptionAvailable: true,
    };
  }

  removeAccount(id: string) {
    this.database.run("DELETE FROM mlultimate_profiles WHERE id = ?", [id]);
    this.accountStore.clearActiveAccountIfMatches("mlultimate", id);
  }

  private toPublicAccount(profile: MlultimateProfileRow): PublicAccount {
    return {
      id: profile.id,
      provider: "mlultimate",
      displayName: profile.username,
      avatarLabel: profile.username.slice(0, 2).toUpperCase(),
      license: { status: "verified" },
      serverAccess: "online-mode",
    };
  }
}
