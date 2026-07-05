import { dialog } from "electron";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type {
  LauncherSkin,
  MinecraftSkinVariant,
  NameMCSkinLibraryInput,
  NameMCSkinLibraryItem,
  NameMCSkinLibraryResult,
  NameMCSkinSearchResult,
  SaveNicknameSkinInput,
  SaveNameMCSkinInput,
  SkinSearchResult,
  SkinSource,
} from "../../src/types/launcher";

const nicknameSchema = z
  .string()
  .trim()
  .min(3, "Digite um nick com pelo menos 3 caracteres.")
  .max(16, "Nick do Minecraft deve ter no maximo 16 caracteres.")
  .regex(/^[A-Za-z0-9_]+$/, "Use apenas letras, numeros e underline.");

const saveNicknameSkinSchema = z.object({
  nickname: nicknameSchema,
  name: z.string().trim().min(1).max(40).optional(),
});

const nameMcSkinIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{16}$/i, "Skin do NameMC invalida.");

const saveNameMcSkinSchema = z.object({
  skinId: nameMcSkinIdSchema.optional(),
  skinUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  name: z.string().trim().min(1).max(40).optional(),
  variant: z.enum(["classic", "slim"]).optional(),
}).refine((value) => value.skinId || value.skinUrl, {
  message: "Skin do NameMC invalida.",
});

const nameMcSearchSchema = z
  .string()
  .trim()
  .min(2, "Digite pelo menos 2 caracteres para pesquisar.")
  .max(16, "Pesquise nomes com no maximo 16 caracteres.")
  .regex(/^[A-Za-z0-9_]+$/, "Use apenas letras, numeros e underline.");

const nameMcLibrarySchema = z.object({
  category: z.enum(["trending", "new", "random", "tag"]),
  tag: z.string().trim().min(1).max(40).optional(),
  page: z.number().int().min(1).max(20).optional(),
  refresh: z.boolean().optional(),
});

const mojangProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const mojangProfilesSchema = z.array(mojangProfileSchema);

const sessionProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  properties: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    }),
  ),
});

const texturePayloadSchema = z.object({
  textures: z.object({
    SKIN: z.object({
      url: z.string().url(),
      metadata: z.object({
        model: z.enum(["slim"]).optional(),
      }).optional(),
    }),
  }),
});

type SkinRow = {
  id: string;
  name: string;
  source: SkinSource;
  nickname?: string | null;
  uuid?: string | null;
  skin_url?: string | null;
  preview_url?: string | null;
  skin_variant?: MinecraftSkinVariant | null;
  local_path?: string | null;
  created_at: string;
  equipped_at?: string | null;
};

type NameMcLibraryCacheEntry = NameMCSkinLibraryResult & {
  cachedAt: number;
};

const NAMEMC_CACHE_TTL_MS = 10 * 60 * 1000;
const NAMEMC_READER_PREFIX = "https://r.jina.ai/http://";
const NAMEMC_FALLBACK_SEEDS = [
  "qBergie",
  "bochonokoff",
  "sim0nekk",
  "Kylaz",
  "WauWauLeah",
  "NetheriteBarren",
  "Nyafiu",
  "CadeMeuCachorro",
  "blones",
  "sweetily",
  "Mugm_",
  "LuckyySnow",
];
const SIMILAR_NAME_PREFIXES = ["king", "queen", "the", "real", "dark", "red", "blue", "green", "pro", "fang"];
const SIMILAR_NAME_SUFFIXES = ["mc", "pvp", "br", "x", "hd", "yt", "pro", "king", "play", "craft"];

export class AvatarService {
  private readonly nameMcLibraryCache = new Map<string, NameMcLibraryCacheEntry>();

  constructor(private readonly database: LauncherDatabase) {}

  async searchNickname(input: string): Promise<SkinSearchResult> {
    const nickname = nicknameSchema.parse(input);
    const profileResponse = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(nickname)}`,
    );

    if (profileResponse.status === 404) {
      throw new Error("Nick não encontrado na Mojang.");
    }

    if (!profileResponse.ok) {
      throw new Error(`Não foi possível buscar esse nick (${profileResponse.status}).`);
    }

    const profile = mojangProfileSchema.parse(await profileResponse.json());
    const sessionResponse = await fetch(
      `https://sessionserver.mojang.com/session/minecraft/profile/${profile.id}`,
    );

    if (!sessionResponse.ok) {
      throw new Error("Não foi possível carregar a skin desse perfil.");
    }

    const session = sessionProfileSchema.parse(await sessionResponse.json());
    const textures = session.properties.find((property) => property.name === "textures");

    if (!textures) {
      throw new Error("Esse perfil não retornou textura de skin.");
    }

    const payload = texturePayloadSchema.parse(
      JSON.parse(Buffer.from(textures.value, "base64").toString("utf8")),
    );

    return {
      nickname: session.name,
      uuid: session.id,
      skinUrl: payload.textures.SKIN.url,
      avatarUrl: payload.textures.SKIN.url,
      namemcUrl: `https://namemc.com/profile/${session.name}`,
      variant: payload.textures.SKIN.metadata?.model === "slim" ? "slim" : "classic",
    };
  }

  async saveNicknameSkin(input: SaveNicknameSkinInput) {
    const parsed = saveNicknameSkinSchema.parse(input);
    const result = await this.searchNickname(parsed.nickname);
    const id = randomUUID();
    const now = new Date().toISOString();
    const localPath = path.join(this.getSkinsDir(), `${id}.png`);
    const skinBytes = await downloadBytes(result.skinUrl);

    writeFileSync(localPath, skinBytes);
    this.database.run(
      `
      INSERT INTO avatar_skins
        (id, name, source, nickname, uuid, skin_url, preview_url, skin_variant, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        parsed.name ?? result.nickname,
        "namemc",
        result.nickname,
        result.uuid,
        result.skinUrl,
        result.avatarUrl,
        result.variant ?? "classic",
        localPath,
        now,
      ],
    );

    return this.getById(id);
  }

  async browseNameMcLibrary(input: NameMCSkinLibraryInput): Promise<NameMCSkinLibraryResult> {
    const parsed = nameMcLibrarySchema.parse(input);
    const page = parsed.page ?? 1;
    const cacheKey = `${parsed.category}:${parsed.tag ?? ""}:${page}`;
    const cached = this.nameMcLibraryCache.get(cacheKey);

    if (
      cached &&
      !parsed.refresh &&
      Date.now() - cached.cachedAt < NAMEMC_CACHE_TTL_MS
    ) {
      return { ...cached, source: "cache" };
    }

    const pathAndQuery = buildNameMcLibraryPath(parsed.category, page, parsed.tag);

    try {
      const markdown = await fetchNameMcMarkdown(pathAndQuery);
      const items = parseNameMcLibraryItems(markdown).slice(0, 30);

      if (items.length === 0) {
        throw new Error("NameMC nao retornou skins nesta pagina.");
      }

      const result: NameMCSkinLibraryResult = {
        category: parsed.category,
        tag: parsed.tag,
        page,
        fetchedAt: new Date().toISOString(),
        source: "namemc",
        items,
      };

      this.nameMcLibraryCache.set(cacheKey, { ...result, cachedAt: Date.now() });
      return result;
    } catch {
      if (cached) {
        return { ...cached, source: "cache" };
      }

      const items = await this.buildFallbackNameMcLibrary();
      const result: NameMCSkinLibraryResult = {
        category: parsed.category,
        tag: parsed.tag,
        page,
        fetchedAt: new Date().toISOString(),
        source: "cache",
        items,
      };

      this.nameMcLibraryCache.set(cacheKey, { ...result, cachedAt: Date.now() });
      return result;
    }
  }

  async searchNameMcLibrary(input: string): Promise<NameMCSkinSearchResult> {
    const query = nameMcSearchSchema.parse(input);
    const normalizedQuery = query.toLowerCase();
    const profileMap = new Map<string, SkinSearchResult>();

    try {
      const exact = await this.searchNickname(query);
      profileMap.set(exact.nickname.toLowerCase(), { ...exact, match: "exact" });
    } catch {
      // Exact names can be unavailable; similar results and tag skins still help.
    }

    try {
      const markdown = await fetchNameMcMarkdown(
        `/search?q=${encodeURIComponent(query)}&type=names`,
      );
      const candidates = parseNameMcProfileNames(markdown);
      const generatedCandidates = buildSimilarNicknameCandidates(query);
      const profiles = await lookupMojangProfiles([...candidates, ...generatedCandidates]);

      for (const profile of profiles) {
        const key = profile.name.toLowerCase();

        if (profileMap.has(key)) {
          continue;
        }

        if (key !== normalizedQuery && !key.includes(normalizedQuery)) {
          continue;
        }

        try {
          const result = await this.searchNickname(profile.name);
          profileMap.set(key, {
            ...result,
            match: key === normalizedQuery ? "exact" : "similar",
          });
        } catch {
          // Ignore names whose profile texture could not be read.
        }

        if (profileMap.size >= 9) {
          break;
        }
      }
    } catch {
      // Keep any exact profile already found and continue with tag skins.
    }

    let skins: NameMCSkinLibraryItem[] = [];
    let source: NameMCSkinSearchResult["source"];

    try {
      const tagResult = await this.browseNameMcLibrary({
        category: "tag",
        tag: query,
        page: 1,
      });

      skins = tagResult.items.slice(0, 18);
      source = tagResult.source;
    } catch {
      source = "cache";
    }

    const profiles = Array.from(profileMap.values()).sort((a, b) => {
      if (a.match === b.match) {
        return a.nickname.localeCompare(b.nickname);
      }

      return a.match === "exact" ? -1 : 1;
    });

    return {
      query,
      fetchedAt: new Date().toISOString(),
      source,
      profiles,
      skins,
    };
  }

  async saveNameMcSkin(input: SaveNameMCSkinInput) {
    const parsed = saveNameMcSkinSchema.parse(input);
    const name = parsed.name ?? `NameMC ${(parsed.skinId ?? "skin").slice(0, 8)}`;
    const id = randomUUID();
    const now = new Date().toISOString();
    const localPath = path.join(this.getSkinsDir(), `${id}.png`);
    const skinUrl = parsed.skinId ? nameMcSkinDownloadUrl(parsed.skinId) : parsed.skinUrl;
    const variant = parsed.variant ?? inferVariantFromUrl(parsed.previewUrl) ?? "classic";
    const previewUrl = parsed.skinId
      ? nameMcSkinPreviewUrl(parsed.skinId, variant)
      : parsed.previewUrl ?? parsed.skinUrl;

    if (!skinUrl || !previewUrl) {
      throw new Error("Skin do NameMC invalida.");
    }

    const skinBytes = await downloadBytes(skinUrl);

    assertMinecraftSkinPng(skinBytes);
    writeFileSync(localPath, skinBytes);
    this.database.run(
      `
      INSERT INTO avatar_skins
        (id, name, source, skin_url, preview_url, skin_variant, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, name, "namemc", skinUrl, previewUrl, variant, localPath, now],
    );

    return this.getById(id);
  }

  async refreshNameMcSkins() {
    const rows = this.database.all<SkinRow>(
      "SELECT * FROM avatar_skins WHERE source = ? AND nickname IS NOT NULL ORDER BY created_at DESC",
      ["namemc"],
    );
    let updated = 0;
    let checked = 0;

    for (const row of rows) {
      if (!row.nickname) {
        continue;
      }

      checked += 1;

      try {
        const result = await this.searchNickname(row.nickname);

        if (result.skinUrl === row.skin_url && row.local_path && existsSync(row.local_path)) {
          continue;
        }

        const localPath = row.local_path && existsSync(row.local_path)
          ? row.local_path
          : path.join(this.getSkinsDir(), `${row.id}.png`);
        const skinBytes = await downloadBytes(result.skinUrl);

        assertMinecraftSkinPng(skinBytes);
        writeFileSync(localPath, skinBytes);
        this.database.run(
          `
          UPDATE avatar_skins
          SET uuid = ?, skin_url = ?, preview_url = ?, skin_variant = ?, local_path = ?
          WHERE id = ?
          `,
          [result.uuid, result.skinUrl, result.avatarUrl, result.variant ?? "classic", localPath, row.id],
        );
        updated += 1;
      } catch {
        // Keep the last working skin if NameMC/Mojang is temporarily unavailable.
      }
    }

    return {
      checked,
      updated,
      refreshedAt: new Date().toISOString(),
    };
  }

  async importCustomSkin() {
    const result = await dialog.showOpenDialog({
      title: "Importar skin customizada",
      properties: ["openFile"],
      filters: [{ name: "Skin PNG do Minecraft", extensions: ["png"] }],
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const sourcePath = result.filePaths[0];
    const sourceBytes = readFileSync(sourcePath);
    const id = randomUUID();
    const now = new Date().toISOString();
    const localPath = path.join(this.getSkinsDir(), `${id}.png`);
    const name = path.basename(sourcePath, path.extname(sourcePath)).slice(0, 40) || "Skin customizada";

    assertMinecraftSkinPng(sourceBytes);
    writeFileSync(localPath, sourceBytes);
    this.database.run(
      `
      INSERT INTO avatar_skins
        (id, name, source, skin_variant, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, name, "custom", "classic", localPath, now],
    );

    return this.getById(id);
  }

  list() {
    return this.database
      .all<SkinRow>("SELECT * FROM avatar_skins ORDER BY equipped_at DESC, created_at DESC")
      .map(this.toPublicSkin);
  }

  getEquippedSkinFile() {
    const skin = this.database.get<SkinRow>(
      "SELECT * FROM avatar_skins WHERE equipped_at IS NOT NULL ORDER BY equipped_at DESC LIMIT 1",
    );

    if (!skin?.local_path || !existsSync(skin.local_path)) {
      return null;
    }

    return {
      id: skin.id,
      name: skin.name,
      localPath: skin.local_path,
    };
  }

  syncEquippedSkinForPlayer(gameDir: string, playerName: string) {
    const skin = this.getEquippedSkinFile();

    if (!skin) {
      return null;
    }

    const safePlayerName = sanitizeMinecraftName(playerName);
    const skinsDir = path.join(gameDir, "CustomSkinLoader", "LocalSkin", "skins");
    const destination = path.join(skinsDir, `${safePlayerName}.png`);

    mkdirSync(skinsDir, { recursive: true });
    copyFileSync(skin.localPath, destination);

    return {
      skinName: skin.name,
      destination,
    };
  }

  equip(id: string) {
    const skin = this.getById(id);
    const now = new Date().toISOString();

    this.database.run("UPDATE avatar_skins SET equipped_at = NULL");
    this.database.run("UPDATE avatar_skins SET equipped_at = ? WHERE id = ?", [now, id]);

    return {
      ...skin,
      equippedAt: now,
    };
  }

  remove(id: string) {
    const skin = this.database.get<SkinRow>("SELECT * FROM avatar_skins WHERE id = ?", [id]);

    if (!skin) {
      return;
    }

    this.database.run("DELETE FROM avatar_skins WHERE id = ?", [id]);
  }

  private getById(id: string) {
    const skin = this.database.get<SkinRow>("SELECT * FROM avatar_skins WHERE id = ?", [id]);

    if (!skin) {
      throw new Error("Skin não encontrada.");
    }

    return this.toPublicSkin(skin);
  }

  private getSkinsDir() {
    const dir = getLauncherDataSubpath("Skins");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private toPublicSkin = (skin: SkinRow): LauncherSkin => {
    const imageDataUrl =
      skin.local_path && existsSync(skin.local_path)
        ? `data:image/png;base64,${readFileSync(skin.local_path).toString("base64")}`
        : undefined;

    return {
      id: skin.id,
      name: skin.name,
      source: skin.source,
      nickname: skin.nickname ?? undefined,
      uuid: skin.uuid ?? undefined,
      skinUrl: skin.skin_url ?? undefined,
      previewUrl: imageDataUrl ?? skin.preview_url ?? undefined,
      variant: skin.skin_variant ?? inferVariantFromUrl(skin.preview_url) ?? "classic",
      imageDataUrl,
      createdAt: skin.created_at,
      equippedAt: skin.equipped_at ?? undefined,
    };
  };

  private async buildFallbackNameMcLibrary(): Promise<NameMCSkinLibraryItem[]> {
    const items: NameMCSkinLibraryItem[] = [];

    for (const nickname of NAMEMC_FALLBACK_SEEDS) {
      try {
        const skin = await this.searchNickname(nickname);

        items.push({
          id: skin.uuid.slice(0, 16).toLowerCase(),
          name: skin.nickname,
          skinUrl: skin.skinUrl,
          previewUrl: skin.skinUrl,
          namemcUrl: skin.namemcUrl,
        });
      } catch {
        // Ignore stale fallback names.
      }
    }

    return items;
  }
}

const downloadBytes = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Não foi possível baixar a skin (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const buildNameMcLibraryPath = (
  category: "trending" | "new" | "random" | "tag",
  page: number,
  tag?: string,
) => {
  const pageQuery = page > 1 ? `?page=${page}` : "";

  if (category === "new") {
    return `/minecraft-skins/new${pageQuery}`;
  }

  if (category === "random") {
    return "/minecraft-skins/random";
  }

  if (category === "tag") {
    const safeTag = (tag ?? "pvp")
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    return `/minecraft-skins/tag/${safeTag || "pvp"}${pageQuery}`;
  }

  return `/minecraft-skins/trending${pageQuery}`;
};

const fetchNameMcMarkdown = async (pathAndQuery: string) => {
  const target = `https://namemc.com${pathAndQuery}`;
  const direct = await fetch(target, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "MLUltimateLauncher/skins",
    },
  }).catch(() => null);

  if (direct?.ok) {
    const text = await direct.text();

    if (!isCloudflareChallenge(text)) {
      return text;
    }
  }

  const reader = await fetch(`${NAMEMC_READER_PREFIX}${target}`, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "MLUltimateLauncher/skins",
    },
  });

  if (!reader.ok) {
    throw new Error(`NameMC retornou ${reader.status}.`);
  }

  const markdown = await reader.text();

  if (isCloudflareChallenge(markdown)) {
    throw new Error("NameMC bloqueou a leitura automatica.");
  }

  return markdown;
};

const parseNameMcLibraryItems = (markdown: string): NameMCSkinLibraryItem[] => {
  const lines = markdown.split(/\r?\n/);
  const seen = new Set<string>();
  const items: NameMCSkinLibraryItem[] = [];

  for (const line of lines) {
    const skinMatch = line.match(
      /https:\/\/s\.namemc\.com\/3d\/skin\/body\.png\?id=([a-f0-9]{16})&model=(classic|slim)&width=256&height=256/i,
    );

    if (!skinMatch?.[1] || seen.has(skinMatch[1])) {
      continue;
    }

    const id = skinMatch[1].toLowerCase();
    const name = extractNameMcSkinName(line, id);
    const rank = Number(line.match(/#(\d+)/)?.[1]);

    seen.add(id);
    items.push({
      id,
      name: name || `Skin ${id.slice(0, 8)}`,
      skinUrl: nameMcSkinDownloadUrl(id),
      previewUrl: nameMcSkinPreviewUrl(id, skinMatch[2] as "classic" | "slim"),
      namemcUrl: `https://namemc.com/skin/${id}`,
      model: skinMatch[2] as "classic" | "slim",
      rank: Number.isFinite(rank) ? rank : undefined,
    });
  }

  return items;
};

const parseNameMcProfileNames = (markdown: string) => {
  const seen = new Set<string>();
  const names: string[] = [];
  const profileLinkPattern = /\[([A-Za-z0-9_]{3,16})\]\(https:\/\/namemc\.com\/profile\/[A-Za-z0-9_]+(?:\.\d+)?\)/g;

  for (const match of markdown.matchAll(profileLinkPattern)) {
    const name = match[1];

    if (!name || seen.has(name.toLowerCase())) {
      continue;
    }

    seen.add(name.toLowerCase());
    names.push(name);
  }

  return names;
};

const buildSimilarNicknameCandidates = (query: string) => {
  const normalized = query.toLowerCase();
  const candidates = new Set<string>([query]);

  for (const prefix of SIMILAR_NAME_PREFIXES) {
    candidates.add(`${prefix}${normalized}`);
  }

  for (const suffix of SIMILAR_NAME_SUFFIXES) {
    candidates.add(`${normalized}${suffix}`);
  }

  return Array.from(candidates)
    .filter((candidate) => candidate.length >= 3 && candidate.length <= 16)
    .filter((candidate) => /^[A-Za-z0-9_]+$/.test(candidate));
};

const lookupMojangProfiles = async (names: string[]) => {
  const uniqueNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).slice(0, 50);

  if (uniqueNames.length === 0) {
    return [];
  }

  const response = await fetch("https://api.mojang.com/profiles/minecraft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "MLUltimateLauncher/skins",
    },
    body: JSON.stringify(uniqueNames),
  });

  if (!response.ok) {
    throw new Error(`Mojang retornou ${response.status}.`);
  }

  return mojangProfilesSchema.parse(await response.json());
};

const extractNameMcSkinName = (line: string, id: string) => {
  const beforeSkinImage = line.split(`https://s.namemc.com/3d/skin/body.png?id=${id}`)[0] ?? "";
  const linkText = beforeSkinImage.replace(/^\[/, "");
  const withoutImages = linkText.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  const cleaned = withoutImages.replace(/\s+/g, " ").trim();

  return cleaned === "—" ? "" : cleaned;
};

const nameMcSkinDownloadUrl = (skinId: string) => `https://s.namemc.com/i/${skinId}.png`;

const nameMcSkinPreviewUrl = (skinId: string, model: "classic" | "slim" = "classic") =>
  `https://s.namemc.com/3d/skin/body.png?id=${skinId}&model=${model}&width=256&height=256`;

const inferVariantFromUrl = (url?: string | null): MinecraftSkinVariant | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    const model = parsed.searchParams.get("model");

    return model === "slim" ? "slim" : model === "classic" ? "classic" : undefined;
  } catch {
    return undefined;
  }
};

const isCloudflareChallenge = (text: string) =>
  text.includes("cf_chl") || text.includes("Just a moment") || text.includes("Enable JavaScript and cookies");

const sanitizeMinecraftName = (name: string) =>
  name.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 16) || "Player";

const assertMinecraftSkinPng = (bytes: Buffer) => {
  const pngSignature = "89504e470d0a1a0a";

  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== pngSignature) {
    throw new Error("Selecione um arquivo PNG valido.");
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const validSkinSize = width === 64 && (height === 64 || height === 32);

  if (!validSkinSize) {
    throw new Error("A skin precisa ser PNG 64x64 ou 64x32.");
  }
};
