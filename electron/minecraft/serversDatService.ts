import * as nbt from "prismarine-nbt";
import * as fs from "node:fs";
import * as path from "node:path";

type NbtServerEntry = {
  name?: { type: string; value: string } | string;
  ip?: { type: string; value: string } | string;
  [key: string]: unknown;
};

type NbtDataStructure = {
  type: string;
  name: string;
  value: {
    servers?: {
      type: string;
      value: {
        type: string;
        value: NbtServerEntry[];
      } | NbtServerEntry[];
    };
    [key: string]: unknown;
  };
};

export class ServersDatService {
  static async addServer(gameDir: string, serverName: string, serverIp: string): Promise<void> {
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }

    const serversDatPath = path.join(gameDir, "servers.dat");
    let data: NbtDataStructure | null = null;

    try {
      if (fs.existsSync(serversDatPath)) {
        const buffer = fs.readFileSync(serversDatPath);
        if (buffer.length > 0) {
          const res = await nbt.parse(buffer);
          data = (res.parsed as unknown as NbtDataStructure) || (res as unknown as NbtDataStructure);
        }
      }
    } catch (e) {
      console.warn("Falha ao analisar servers.dat existente, recriando:", e);
    }

    if (!data || !data.value || typeof data.value !== "object") {
      data = {
        type: "compound",
        name: "",
        value: {},
      };
    }

    if (!data.value.servers) {
      data.value.servers = {
        type: "list",
        value: {
          type: "compound",
          value: [],
        },
      };
    }

    const serversList = data.value.servers;
    let list: NbtServerEntry[];
    if (Array.isArray(serversList.value)) {
      list = serversList.value;
    } else if (serversList.value && Array.isArray(serversList.value.value)) {
      list = serversList.value.value;
    } else {
      serversList.value = {
        type: "compound",
        value: [],
      };
      list = serversList.value.value;
    }

    const cleanIp = serverIp.trim();
    const cleanName = serverName.trim() || cleanIp;
    const normalizedIp = cleanIp.toLowerCase();

    // Check if server already exists in list (case-insensitive IP)
    const existingIndex = list.findIndex((serverObj: NbtServerEntry) => {
      const ipTag = serverObj?.ip;
      const val =
        typeof ipTag === "object" && ipTag !== null && "value" in ipTag && typeof ipTag.value === "string"
          ? ipTag.value.trim().toLowerCase()
          : typeof ipTag === "string"
            ? ipTag.trim().toLowerCase()
            : "";
      return val === normalizedIp;
    });

    if (existingIndex !== -1 && list[existingIndex]) {
      // Update existing entry
      list[existingIndex]!.name = { type: "string", value: cleanName };
      list[existingIndex]!.ip = { type: "string", value: cleanIp };
    } else {
      // Add new server
      list.push({
        name: { type: "string", value: cleanName },
        ip: { type: "string", value: cleanIp },
      });
    }

    const uncompressed = nbt.writeUncompressed(data as unknown as nbt.NBT);
    fs.writeFileSync(serversDatPath, uncompressed);
  }
}
