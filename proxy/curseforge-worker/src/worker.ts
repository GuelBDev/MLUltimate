export interface Env {
  CURSEFORGE_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

const CURSEFORGE_API = "https://api.curseforge.com/v1";
const ALLOWED_PREFIXES = ["/mods", "/categories", "/minecraft"];

const json = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = env.ALLOWED_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "content-type",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    if (!env.CURSEFORGE_API_KEY) {
      return json({ error: "CurseForge API key is not configured" }, 500, origin);
    }

    const url = new URL(request.url);
    const allowed = ALLOWED_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    );

    if (!allowed) {
      return json({ error: "Route not allowed" }, 404, origin);
    }

    const upstream = await fetch(`${CURSEFORGE_API}${url.pathname}${url.search}`, {
      method: request.method,
      headers: {
        Accept: "application/json",
        "User-Agent": "MLUltimate-CurseForge-Proxy/1.0",
        "x-api-key": env.CURSEFORGE_API_KEY,
      },
    });

    const headers = new Headers(upstream.headers);
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  },
};
