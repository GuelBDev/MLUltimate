export type OnlineLibraryServer = {
  id: string;
  name: string;
  host: string;
  port: number;
  version: string;
  category: "pvp" | "survival" | "minigames" | "anarchy" | "rpg" | "modded";
  requiresMicrosoft: boolean;
  hasMods: boolean;
  allowPirate: boolean;
  description: string;
  tags: string[];
  playersOnline?: number;
  playersMax?: number;
  bannerUrl?: string;
  source: "reishost" | "public_api" | "featured";
};

const FEATURED_SERVERS: OnlineLibraryServer[] = [
  {
    id: "mush",
    name: "Mush MC",
    host: "mush.com.br",
    port: 25565,
    version: "1.8.9",
    category: "pvp",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "O maior servidor de PvP e Minigames do Brasil! BedWars, SkyWars, HG e Duels.",
    tags: ["PvP", "BedWars", "Duels", "Brasil", "Pirata"],
    source: "featured",
  },
  {
    id: "redesky",
    name: "Rede Sky",
    host: "redesky.net",
    port: 25565,
    version: "1.8.9",
    category: "minigames",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor clássico brasileiro de SkyWars, RankUP e Minigames variados.",
    tags: ["Minigames", "SkyWars", "RankUP", "Pirata"],
    source: "featured",
  },
  {
    id: "craftlandia",
    name: "CraftLandia Farewell",
    host: "jogar.craftlandia.com.br",
    port: 25565,
    version: "1.5.2",
    category: "survival",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "O servidor de Survival raiz mais antigo e famoso da comunidade brasileira.",
    tags: ["Survival", "Clássico", "Economia", "Pirata"],
    source: "featured",
  },
  {
    id: "rederevo",
    name: "Rede Revo",
    host: "jogar.rederevo.com.br",
    port: 25565,
    version: "1.20.1",
    category: "survival",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor brasileiro de Survival, Slimefun, terrenos e economia ativa via ReisHost.",
    tags: ["Survival", "Slimefun", "Economia", "Pirata", "ReisHost"],
    source: "reishost",
  },
  {
    id: "sparklypower",
    name: "SparklyPower Network",
    host: "jogar.sparklypower.net",
    port: 25565,
    version: "1.20.4",
    category: "survival",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor focado em Survival amigável, sem griefing e com proteções avançadas.",
    tags: ["Survival", "SemGrief", "Brasil", "ReisHost"],
    source: "reishost",
  },
  {
    id: "brasilcraft",
    name: "BrasilCraft Network",
    host: "jogar.brasilcraft.com.br",
    port: 25565,
    version: "1.16.5",
    category: "minigames",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Rede brasileira com RankUP, Survival e Minigames integrados.",
    tags: ["RankUP", "Survival", "Brasil", "Pirata"],
    source: "reishost",
  },
  {
    id: "hypixel",
    name: "Hypixel Network",
    host: "mc.hypixel.net",
    port: 25565,
    version: "1.8.9",
    category: "minigames",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "O maior servidor de Minecraft do mundo! BedWars, SkyBlock, Murder Mystery e mais.",
    tags: ["Minigames", "BedWars", "SkyBlock", "Original"],
    source: "featured",
  },
  {
    id: "pvplegacy",
    name: "PvP Legacy",
    host: "play.pvplegacy.net",
    port: 25565,
    version: "1.20.1",
    category: "pvp",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "Servidor focado em PvP moderno (1.9+ 1.20+), KitPvP, Crystal e Sword.",
    tags: ["PvP 1.20", "Crystal", "Sword", "Original"],
    source: "featured",
  },
  {
    id: "minemen",
    name: "Minemen Club",
    host: "minemen.club",
    port: 25565,
    version: "1.8.9",
    category: "pvp",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "Servidor competitivo de Duels e Practice com registro de cliques e knocks perfeitos.",
    tags: ["Duels", "Practice", "Competitivo", "Original"],
    source: "featured",
  },
  {
    id: "universocraft",
    name: "UniversoCraft",
    host: "mc.universocraft.com",
    port: 25565,
    version: "1.8.9",
    category: "minigames",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor latino-americano com grande público e dezenas de modos de jogo.",
    tags: ["Minigames", "BedWars", "Latino", "Pirata"],
    source: "featured",
  },
  {
    id: "wynncraft",
    name: "Wynncraft MMORPG",
    host: "play.wynncraft.com",
    port: 25565,
    version: "1.20.1",
    category: "rpg",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "O maior MMORPG dentro do Minecraft! Quests, magia, dungeons e mapa gigantesco.",
    tags: ["RPG", "Quests", "MMO", "Original"],
    source: "featured",
  },
  {
    id: "purpleprison",
    name: "Purple Prison",
    host: "purpleprison.net",
    port: 25565,
    version: "1.20.1",
    category: "survival",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor de Prison número 1 do mundo. Mineração, parkour e economia ativa.",
    tags: ["Prison", "Parkour", "Economia", "Pirata"],
    source: "featured",
  },
  {
    id: "hoplite",
    name: "Hoplite UHC",
    host: "hoplite.gg",
    port: 25565,
    version: "1.20.1",
    category: "pvp",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "Servidor moderno de Battle Royale e UHC na versão 1.20+ com habilidades únicas.",
    tags: ["UHC", "Battle Royale", "PvP 1.20", "Original"],
    source: "featured",
  },
  {
    id: "complex",
    name: "Complex Pixelmon",
    host: "hub.mc-complex.com",
    port: 25565,
    version: "1.16.5",
    category: "modded",
    requiresMicrosoft: false,
    hasMods: true,
    allowPirate: true,
    description: "Servidor modded com Pixelmon Reforged, Pokémons, batalhas e torneios.",
    tags: ["Modded", "Pixelmon", "Mods", "Pirata"],
    source: "featured",
  },
];

let cachedOnlineServers: OnlineLibraryServer[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchServerLibrary(): Promise<OnlineLibraryServer[]> {
  const now = Date.now();
  if (cachedOnlineServers.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedOnlineServers;
  }

  const resultList: OnlineLibraryServer[] = [...FEATURED_SERVERS];

  try {
    const res = await fetch("https://minecraftserve.rs/api/servers?limit=50", {
      headers: { "User-Agent": "MLUltimateLauncher/3.2" },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as { servers?: Record<string, unknown>[] } | Record<string, unknown>[];
      if (Array.isArray(data) || (data && Array.isArray(data.servers))) {
        const rawList = Array.isArray(data) ? data : data.servers ?? [];
        rawList.forEach((item: Record<string, unknown>, idx: number) => {
          const host = String(item.ip || item.host || item.address || "");
          if (host && !resultList.some((existing) => existing.host.toLowerCase() === host.toLowerCase())) {
            const tags = Array.isArray(item.tags) ? item.tags.map(String) : ["Minecraft", "Online"];
            const validCategories = ["pvp", "survival", "minigames", "anarchy", "rpg", "modded"] as const;
            const rawCat = typeof tags[0] === "string" ? tags[0].toLowerCase() : "";
            const category = (validCategories.find((c) => c === rawCat) ?? "survival") as OnlineLibraryServer["category"];

            resultList.push({
              id: `public-${idx}-${host}`,
              name: String(item.name || host),
              host,
              port: Number(item.port) || 25565,
              version: String(item.version || "1.20.1"),
              category,
              requiresMicrosoft: false,
              hasMods: Boolean(item.modded),
              allowPirate: true,
              description: String(item.description || item.motd || `Servidor Minecraft online (${host})`),
              tags,
              playersOnline: typeof item.players === "object" && item.players && "online" in item.players ? Number((item.players as { online: number }).online) : typeof item.onlinePlayers === "number" ? item.onlinePlayers : undefined,
              playersMax: typeof item.players === "object" && item.players && "max" in item.players ? Number((item.players as { max: number }).max) : typeof item.maxPlayers === "number" ? item.maxPlayers : undefined,
              source: "public_api",
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn("Could not fetch online minecraft serve API, fallback to featured", err);
  }

  try {
    const resReis = await fetch("https://reishosting.com.br/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(5000),
    });
    if (resReis.ok) {
      const html = await resReis.text();
      const ipMatches = html.match(/(?:jogar\.|mc\.|play\.)?[a-zA-Z0-9-]+\.(?:com\.br|net|org|com)/gi);
      if (ipMatches) {
        const unique = Array.from(new Set(ipMatches));
        unique.slice(0, 30).forEach((foundHostStr, idx) => {
          const foundHost = foundHostStr as string;
          const lower = foundHost.toLowerCase();
          if (
            !lower.includes("reishosting.com.br") &&
            !lower.includes("reishost.com.br") &&
            !lower.includes("schema.org") &&
            !resultList.some((existing) => existing.host.toLowerCase() === lower)
          ) {
            resultList.push({
              id: `reis-${idx}-${foundHost}`,
              name: (foundHost.split(".")[0] || "SERVIDORES").toUpperCase() + " MC",
              host: foundHost,
              port: 25565,
              version: "1.20.1",
              category: "survival",
              requiresMicrosoft: false,
              hasMods: false,
              allowPirate: true,
              description: `Servidor recomendado hospedado via ReisHost Brasil (${foundHost}).`,
              tags: ["ReisHost", "Brasil", "Pirata"],
              source: "reishost",
            });
          }
        });
      }
    }
  } catch (err) {
    console.warn("ReisHosting fetch error", err);
  }

  cachedOnlineServers = resultList;
  lastFetchTime = now;
  return resultList;
}
