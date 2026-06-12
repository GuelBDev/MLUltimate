import { dialog } from "electron";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { getLauncherDataSubpath } from "../utils/launcherPaths";
import type {
  LauncherSkin,
  SaveNicknameSkinInput,
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

const mojangProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
});

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
  local_path?: string | null;
  created_at: string;
  equipped_at?: string | null;
};

export class AvatarService {
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
        (id, name, source, nickname, uuid, skin_url, preview_url, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        parsed.name ?? result.nickname,
        "namemc",
        result.nickname,
        result.uuid,
        result.skinUrl,
        result.avatarUrl,
        localPath,
        now,
      ],
    );

    return this.getById(id);
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
        (id, name, source, local_path, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
      [id, name, "custom", localPath, now],
    );

    return this.getById(id);
  }

  list() {
    return this.database
      .all<SkinRow>("SELECT * FROM avatar_skins ORDER BY equipped_at DESC, created_at DESC")
      .map(this.toPublicSkin);
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
      imageDataUrl,
      createdAt: skin.created_at,
      equippedAt: skin.equipped_at ?? undefined,
    };
  };
}

const downloadBytes = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Não foi possível baixar a skin (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
};

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
