import { BrowserWindow } from "electron";
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { URLSearchParams } from "node:url";
import { z } from "zod";
import { SecureTokenStore, type SecureMicrosoftSession } from "./secureTokenStore";
import type { AuthSession, PublicAccount } from "../../src/types/launcher";

const MICROSOFT_AUTH_URL = "https://login.live.com/oauth20_authorize.srf";
const MICROSOFT_TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const XBL_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_LOGIN_URL =
  "https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_ENTITLEMENTS_URL =
  "https://api.minecraftservices.com/entitlements/mcstore";
const MINECRAFT_PROFILE_URL =
  "https://api.minecraftservices.com/minecraft/profile";
const MICROSOFT_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me";
const SESSION_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_MICROSOFT_CLIENT_ID = "fd9f6eb4-bfa8-4985-85e9-18c5db6cf6ad";
const MICROSOFT_MINECRAFT_SCOPE = "XboxLive.signin offline_access";

const microsoftTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

const xboxAuthSchema = z.object({
  Token: z.string(),
  DisplayClaims: z.object({
    xui: z.array(z.object({ uhs: z.string() })).min(1),
  }),
});

const minecraftLoginSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

const minecraftProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  skins: z
    .array(
      z.object({
        id: z.string().optional(),
        state: z.string().optional(),
        url: z.string().url(),
        variant: z.string().optional(),
      }),
    )
    .default([]),
});

const graphMeSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable().optional(),
  mail: z.string().nullable().optional(),
  userPrincipalName: z.string().nullable().optional(),
});

export class MicrosoftAuthService {
  private clientId =
    process.env.MLULTIMATE_MICROSOFT_CLIENT_ID ?? DEFAULT_MICROSOFT_CLIENT_ID;
  private cancelPendingOAuth: ((error?: Error) => void) | null = null;

  constructor(private readonly tokenStore: SecureTokenStore) {}

  async getSession(): Promise<AuthSession> {
    const secureSession = this.tokenStore.loadSession();

    if (!secureSession) {
      return { status: "signed-out", encryptionAvailable: this.tokenStore.isEncryptionAvailable() };
    }

    const refreshed = await this.ensureProfileAppearance(
      await this.refreshIfNeeded(secureSession),
    );

    return {
      status: "signed-in",
      account: this.toPublicAccount(refreshed),
      encryptionAvailable: this.tokenStore.isEncryptionAvailable(),
    };
  }

  async login(): Promise<AuthSession> {
    this.assertConfigured();

    const pkce = createPkcePair();
    const callback = await this.waitForOAuthCallback();
    const authUrl = new URL(MICROSOFT_AUTH_URL);

    authUrl.search = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: callback.redirectUri,
      scope: MICROSOFT_MINECRAFT_SCOPE,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state: callback.state,
      prompt: "select_account",
    }).toString();

    const loginPopup = this.openMicrosoftLoginWindow(
      authUrl.toString(),
      callback.cancel,
    );

    const code = await callback.codePromise.finally(() => {
      loginPopup.close();
    });
    const microsoftTokens = await this.exchangeCodeForMicrosoftTokens(
      code,
      callback.redirectUri,
      pkce.verifier,
    );
    const hydrated = await this.hydrateMicrosoftSession(microsoftTokens);

    this.tokenStore.saveSession(hydrated);

    return {
      status: "signed-in",
      account: this.toPublicAccount(hydrated),
      encryptionAvailable: this.tokenStore.isEncryptionAvailable(),
    };
  }

  async logout(): Promise<AuthSession> {
    this.tokenStore.clearSession();
    return { status: "signed-out", encryptionAvailable: this.tokenStore.isEncryptionAvailable() };
  }

  async requireLicensedSession() {
    const secureSession = this.tokenStore.loadSession();

    if (!secureSession) {
      throw new Error("Entre com uma conta Microsoft antes de iniciar esta instância.");
    }

    const refreshed = await this.ensureProfileAppearance(
      await this.refreshIfNeeded(secureSession),
    );
    const licenseVerified = await this.verifyMinecraftLicense(
      refreshed.minecraftAccessToken,
    );

    const checkedSession = {
      ...refreshed,
      licenseVerified,
      licenseCheckedAt: new Date().toISOString(),
    };

    this.tokenStore.saveSession(checkedSession);

    if (!licenseVerified) {
      throw new Error(
        "Licença do Minecraft não encontrada nesta conta Microsoft. O jogo autenticado foi bloqueado.",
      );
    }

    return checkedSession;
  }

  private async refreshIfNeeded(session: SecureMicrosoftSession) {
    const shouldRefresh =
      Date.now() + SESSION_REFRESH_MARGIN_MS >= session.minecraftExpiresAt ||
      Date.now() + SESSION_REFRESH_MARGIN_MS >= session.microsoftExpiresAt;

    if (!shouldRefresh) {
      return session;
    }

    const microsoftTokens = await this.refreshMicrosoftTokens(
      session.microsoftRefreshToken,
    );
    const refreshed = await this.hydrateMicrosoftSession(microsoftTokens, session);

    this.tokenStore.saveSession(refreshed);
    return refreshed;
  }

  private async exchangeCodeForMicrosoftTokens(
    code: string,
    redirectUri: string,
    verifier: string,
  ) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    return microsoftTokenSchema.parse(await parseJsonResponse(response, "Microsoft OAuth"));
  }

  private async refreshMicrosoftTokens(refreshToken: string) {
    const body = new URLSearchParams({
      client_id: this.clientId,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: MICROSOFT_MINECRAFT_SCOPE,
    });

    const response = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    return microsoftTokenSchema.parse(await parseJsonResponse(response, "Microsoft OAuth refresh"));
  }

  private async hydrateMicrosoftSession(
    microsoftTokens: z.infer<typeof microsoftTokenSchema>,
    previous?: SecureMicrosoftSession,
  ): Promise<SecureMicrosoftSession> {
    const identity = await this.fetchMicrosoftIdentity(microsoftTokens.access_token);
    const xbox = await this.authenticateXboxLive(microsoftTokens.access_token);
    const xsts = await this.authorizeXsts(xbox.Token);
    const minecraft = await this.loginMinecraft(xsts.token, xsts.uhs);
    const licenseVerified = await this.verifyMinecraftLicense(
      minecraft.access_token,
    );
    const profile = licenseVerified
      ? await this.fetchMinecraftProfile(minecraft.access_token)
      : null;
    const skin = profile?.skins.find((candidate) => candidate.state === "ACTIVE") ??
      profile?.skins.at(0);
    const minecraftSkinUrl = skin?.url ?? previous?.minecraftSkinUrl;
    const minecraftSkinDataUrl = minecraftSkinUrl
      ? await downloadImageDataUrl(minecraftSkinUrl).catch(
          () => previous?.minecraftSkinDataUrl,
        )
      : previous?.minecraftSkinDataUrl;

    return {
      provider: "microsoft",
      accountId: identity?.id ?? previous?.accountId ?? xsts.xuid,
      displayName:
        profile?.name ??
        identity?.displayName ??
        previous?.displayName ??
        "Conta Microsoft",
      email:
        identity?.mail ??
        identity?.userPrincipalName ??
        previous?.email ??
        undefined,
      microsoftAccessToken: microsoftTokens.access_token,
      microsoftRefreshToken: microsoftTokens.refresh_token,
      microsoftExpiresAt: Date.now() + microsoftTokens.expires_in * 1000,
      minecraftAccessToken: minecraft.access_token,
      minecraftExpiresAt: Date.now() + minecraft.expires_in * 1000,
      xuid: xsts.xuid,
      uhs: xsts.uhs,
      minecraftName: profile?.name ?? previous?.minecraftName,
      minecraftUuid: profile?.id ?? previous?.minecraftUuid,
      minecraftSkinUrl,
      minecraftSkinDataUrl,
      licenseVerified,
      licenseCheckedAt: new Date().toISOString(),
    };
  }

  private async fetchMicrosoftIdentity(accessToken: string) {
    const response = await fetch(MICROSOFT_GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    return graphMeSchema.parse(await response.json());
  }

  private async authenticateXboxLive(accessToken: string) {
    const response = await fetch(XBL_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: "RPS",
          SiteName: "user.auth.xboxlive.com",
          RpsTicket: `d=${accessToken}`,
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT",
      }),
    });

    return xboxAuthSchema.parse(await parseJsonResponse(response, "Xbox Live"));
  }

  private async authorizeXsts(xblToken: string) {
    const response = await fetch(XSTS_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: "RETAIL",
          UserTokens: [xblToken],
        },
        RelyingParty: "rp://api.minecraftservices.com/",
        TokenType: "JWT",
      }),
    });

    const json = xboxAuthSchema
      .extend({
        NotAfter: z.string(),
        DisplayClaims: z.object({
          xui: z.array(z.object({ uhs: z.string(), xid: z.string().optional() })).min(1),
        }),
      })
      .parse(await parseJsonResponse(response, "Xbox XSTS"));

    const xui = json.DisplayClaims.xui.at(0);

    if (!xui) {
      throw new Error("Xbox XSTS não retornou identidade do usuário.");
    }

    return {
      token: json.Token,
      uhs: xui.uhs,
      xuid: xui.xid ?? xui.uhs,
    };
  }

  private async loginMinecraft(xstsToken: string, uhs: string) {
    const response = await fetch(MINECRAFT_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
      }),
    });

    return minecraftLoginSchema.parse(
      await parseJsonResponse(response, "Minecraft services"),
    );
  }

  private async verifyMinecraftLicense(accessToken: string) {
    const response = await fetch(MINECRAFT_ENTITLEMENTS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const json = z
      .object({
        items: z.array(z.object({ name: z.string().optional() })).default([]),
      })
      .parse(await parseJsonResponse(response, "Minecraft entitlements"));

    return json.items.some((item) =>
      ["game_minecraft", "product_minecraft"].includes(item.name ?? ""),
    );
  }

  private async fetchMinecraftProfile(accessToken: string) {
    const response = await fetch(MINECRAFT_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    return minecraftProfileSchema.parse(await response.json());
  }

  private async ensureProfileAppearance(session: SecureMicrosoftSession) {
    if (!session.licenseVerified || session.minecraftSkinDataUrl) {
      return session;
    }

    try {
      const profile = await this.fetchMinecraftProfile(session.minecraftAccessToken);
      const skin = profile?.skins.find((candidate) => candidate.state === "ACTIVE") ??
        profile?.skins.at(0);

      if (!profile || !skin) {
        return session;
      }

      const hydrated = {
        ...session,
        minecraftName: profile.name,
        minecraftUuid: profile.id,
        minecraftSkinUrl: skin.url,
        minecraftSkinDataUrl: await downloadImageDataUrl(skin.url).catch(() => undefined),
      };

      this.tokenStore.saveSession(hydrated);
      return hydrated;
    } catch {
      return session;
    }
  }

  private async waitForOAuthCallback() {
    this.cancelPendingOAuth?.();

    const state = randomBytes(24).toString("base64url");
    const liveCallback = await createLiveOAuthServer(state);
    this.cancelPendingOAuth = liveCallback.cancel;

    return {
      state,
      redirectUri: `http://localhost:${liveCallback.port}/`,
      cancel: liveCallback.cancel,
      codePromise: liveCallback.codePromise.finally(() => {
        if (this.cancelPendingOAuth === liveCallback.cancel) {
          this.cancelPendingOAuth = null;
        }
      }),
    };
  }

  private openMicrosoftLoginWindow(
    authUrl: string,
    cancel: (error?: Error) => void,
  ) {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined;
    const popup = new BrowserWindow({
      width: 540,
      height: 720,
      minWidth: 420,
      minHeight: 560,
      title: "Entrar com Microsoft",
      autoHideMenuBar: true,
      backgroundColor: "#0D1117",
      parent,
      modal: false,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    let completedByLauncher = false;

    popup.removeMenu();
    popup.once("ready-to-show", () => popup.show());
    popup.once("closed", () => {
      if (!completedByLauncher) {
        cancel(
          new Error(
            "Login Microsoft cancelado. Clique em Entrar com Microsoft para tentar novamente.",
          ),
        );
      }
    });
    popup.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https://")) {
        void popup.loadURL(url);
      }

      return { action: "deny" };
    });

    void popup.loadURL(authUrl);

    return {
      close: () => {
        completedByLauncher = true;
        if (!popup.isDestroyed()) {
          popup.close();
        }
      },
    };
  }

  private toPublicAccount(session: SecureMicrosoftSession): PublicAccount {
    return {
      id: session.accountId,
      provider: "microsoft",
      displayName: session.displayName,
      email: session.email,
      avatarLabel: (session.minecraftName ?? session.displayName).slice(0, 2).toUpperCase(),
      skinDataUrl: session.minecraftSkinDataUrl,
      license: {
        status: session.licenseVerified ? "verified" : "unverified",
        checkedAt: session.licenseCheckedAt,
      },
      serverAccess: "online-mode",
      expiresAt: new Date(session.minecraftExpiresAt).toISOString(),
    };
  }

  private assertConfigured() {
    if (!this.clientId) {
      throw new Error(
        "Configure MLULTIMATE_MICROSOFT_CLIENT_ID com o app OAuth oficial antes de entrar com Microsoft.",
      );
    }
  }
}

const createPkcePair = () => {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
};

const parseJsonResponse = async (response: Response, context: string) => {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`${context} falhou (${response.status}): ${text.slice(0, 300)}`);
  }

  return json;
};

const downloadImageDataUrl = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Skin do Minecraft retornou ${response.status}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024) {
    throw new Error("Skin do Minecraft vazia ou grande demais.");
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
  return `data:${contentType};base64,${bytes.toString("base64")}`;
};

const addressPort = (server: ReturnType<typeof createServer>) => {
  const address = server.address();
  return typeof address === "object" && address ? address.port : 0;
};

const createLiveOAuthServer = (state: string) => {
  let resolveCode: (code: string) => void = () => undefined;
  let rejectCode: (error: Error) => void = () => undefined;

  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = createServer((request, response) => {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://localhost:${addressPort(server)}`,
    );

    if (!["/", "/callback"].includes(requestUrl.pathname)) {
      response.writeHead(404);
      response.end();
      return;
    }

    const receivedState = requestUrl.searchParams.get("state");
    const code = requestUrl.searchParams.get("code");
    const error = requestUrl.searchParams.get("error");

    if (receivedState !== state) {
      response.writeHead(400);
      response.end("Estado OAuth invalido.");
      rejectCode(new Error("Estado OAuth invalido."));
      server.close();
      return;
    }

    if (error || !code) {
      response.writeHead(400);
      response.end("Login cancelado ou recusado.");
      rejectCode(new Error(error ?? "Login cancelado ou recusado."));
      server.close();
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<h1>MLUltimate conectado</h1><p>Você pode voltar ao launcher.</p>");
    resolveCode(code);
    server.close();
  });

  return new Promise<{ port: number; codePromise: Promise<string>; cancel: (error?: Error) => void }>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, () => {
      const port = addressPort(server);
      const timeout = setTimeout(() => {
        rejectCode(
          new Error("Login Microsoft expirou. Clique em Entrar com Microsoft para tentar novamente."),
        );
        server.close();
      }, 90_000);

      resolve({
        port,
        codePromise,
        cancel: (error?: Error) => {
          clearTimeout(timeout);
          rejectCode(error ?? new Error("Tentativa de login anterior cancelada. Uma nova janela foi aberta."));
          server.close();
        },
      });
    });
  });
};
