import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Download,
  Gauge,
  Keyboard,
  Lock,
  MoreVertical,
  Package,
  Palette,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Server,
  Shirt,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAuthSession } from "../hooks/useAuthSession";
import { useDownloads } from "../hooks/useDownloads";
import { useInstances } from "../hooks/useInstances";
import { useRunningInstances } from "../hooks/useRunningInstances";
import { launcherApi } from "../services/launcherApi";
import type {
  ContentProvider,
  ContentSearchResult,
  ContentType,
  InstanceContentEntry,
  LauncherInstance,
  LaunchEvent,
  ServerStatusResult,
} from "../types/launcher";
import { cn } from "../utils/cn";

const PVP_VERSION = "1.8.9";
const PVP_LOADER = "forge";
const PVP_INSTANCE_NAME = "MLUltimate PvP 1.8.9";

type PvpServer = {
  name: string;
  host: string;
  port?: number;
  imageUrl: string;
  region: string;
  description: string;
  mode: string;
  category: string;
  features: string[];
  requiresMicrosoft: boolean;
  accent: string;
};

type CuratedPvpContent = {
  title: string;
  provider: ContentProvider;
  projectId: string;
  type: Extract<ContentType, "mod" | "resourcepack">;
  description: string;
  tag: string;
  imageUrl: string;
};

const serverIconUrl = (host: string) =>
  `https://api.mcstatus.io/v2/icon/${encodeURIComponent(host)}`;

const pvpServers: PvpServer[] = [
  {
    name: "Hypixel",
    host: "mc.hypixel.net",
    imageUrl: serverIconUrl("mc.hypixel.net"),
    region: "Global",
    description: "BedWars, SkyWars, Duels e minigames competitivos.",
    mode: "Premium",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "Duels", "SkyBlock"],
    requiresMicrosoft: true,
    accent: "from-yellow-500/25 to-orange-500/10",
  },
  {
    name: "Minemen Club",
    host: "minemen.club",
    imageUrl: serverIconUrl("minemen.club"),
    region: "Global",
    description: "Practice PvP, ranked, unranked e treino de mira.",
    mode: "Practice",
    category: "PvP",
    features: ["Ranked", "Unranked", "Boxing", "BuildUHC"],
    requiresMicrosoft: true,
    accent: "from-red-500/25 to-pink-500/10",
  },
  {
    name: "PvP Legacy",
    host: "play.pvplegacy.net",
    imageUrl: serverIconUrl("play.pvplegacy.net"),
    region: "Global",
    description: "Duels e kits customizados para treinar combate.",
    mode: "Duels",
    category: "PvP",
    features: ["Duels", "Kits", "Practice", "Custom PvP"],
    requiresMicrosoft: true,
    accent: "from-purple-500/25 to-blue-500/10",
  },
  {
    name: "CubeCraft",
    host: "play.cubecraft.net",
    imageUrl: serverIconUrl("play.cubecraft.net"),
    region: "Global",
    description: "Minigames rápidos com PvP, SkyWars e EggWars.",
    mode: "Minigames",
    category: "Arcade",
    features: ["SkyWars", "EggWars", "Lucky Islands", "Parkour"],
    requiresMicrosoft: true,
    accent: "from-cyan-500/25 to-blue-500/10",
  },
  {
    name: "MCC Island",
    host: "play.mccisland.net",
    imageUrl: serverIconUrl("play.mccisland.net"),
    region: "Global",
    description: "Minigames competitivos inspirados no MCC.",
    mode: "Minigames",
    category: "Competitivo",
    features: ["Battle Box", "Sky Battle", "Parkour", "Dynaball"],
    requiresMicrosoft: true,
    accent: "from-orange-500/25 to-red-500/10",
  },
  {
    name: "Wynncraft",
    host: "play.wynncraft.com",
    imageUrl: serverIconUrl("play.wynncraft.com"),
    region: "Global",
    description: "RPG/MMO com classes, quests e exploração.",
    mode: "RPG",
    category: "RPG",
    features: ["Quests", "Classes", "Dungeons", "Economia"],
    requiresMicrosoft: true,
    accent: "from-emerald-500/25 to-lime-500/10",
  },
  {
    name: "ManaCube",
    host: "play.manacube.com",
    imageUrl: serverIconUrl("play.manacube.com"),
    region: "Global",
    description: "Rede com parkour, skyblock, survival e minigames.",
    mode: "Rede",
    category: "Minigames",
    features: ["Parkour", "Skyblock", "Survival", "Factions"],
    requiresMicrosoft: true,
    accent: "from-violet-500/25 to-cyan-500/10",
  },
  {
    name: "Purple Prison",
    host: "purpleprison.net",
    imageUrl: serverIconUrl("purpleprison.net"),
    region: "Global",
    description: "Prison competitivo com economia e PvP.",
    mode: "Prison",
    category: "Economia",
    features: ["Prison", "PvP", "Economia", "Ranks"],
    requiresMicrosoft: true,
    accent: "from-fuchsia-500/25 to-purple-500/10",
  },
  {
    name: "Hoplite",
    host: "hoplite.gg",
    imageUrl: serverIconUrl("hoplite.gg"),
    region: "Global",
    description: "Battle royale e modos competitivos de combate.",
    mode: "PvP",
    category: "Competitivo",
    features: ["Battle Royale", "UHC", "Teams", "Practice"],
    requiresMicrosoft: true,
    accent: "from-amber-500/25 to-slate-500/10",
  },
  {
    name: "MushMC",
    host: "mush.com.br",
    imageUrl: serverIconUrl("mush.com.br"),
    region: "Brasil",
    description: "PvP BR com modos rápidos, treino e comunidade ativa.",
    mode: "PvP BR",
    category: "PvP",
    features: ["BedWars", "Duels", "HG", "RankUP"],
    requiresMicrosoft: false,
    accent: "from-emerald-500/25 to-blue-500/10",
  },
  {
    name: "BlocksMC",
    host: "blocksmc.com",
    imageUrl: serverIconUrl("blocksmc.com"),
    region: "Global",
    description: "BedWars, SkyWars e partidas rápidas para aquecer.",
    mode: "Minigames",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "Lucky Blocks", "PvP"],
    requiresMicrosoft: false,
    accent: "from-cyan-500/25 to-slate-500/10",
  },
  {
    name: "RedeSky",
    host: "redesky.net",
    imageUrl: serverIconUrl("redesky.net"),
    region: "Brasil",
    description: "Rede brasileira com minigames e modos competitivos.",
    mode: "Rede BR",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "HG", "Duels"],
    requiresMicrosoft: false,
    accent: "from-sky-500/25 to-indigo-500/10",
  },
  {
    name: "CraftLandia",
    host: "jogar.craftlandia.com.br",
    imageUrl: serverIconUrl("jogar.craftlandia.com.br"),
    region: "Brasil",
    description: "Servidor clássico brasileiro focado em survival e economia.",
    mode: "Survival",
    category: "Economia",
    features: ["Survival", "Clan", "Economia", "PvP"],
    requiresMicrosoft: false,
    accent: "from-lime-500/25 to-emerald-500/10",
  },
  {
    name: "UniversoCraft",
    host: "mc.universocraft.com",
    imageUrl: serverIconUrl("mc.universocraft.com"),
    region: "Global",
    description: "Rede hispânica grande com PvP e minigames variados.",
    mode: "Rede",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "BuildBattle", "Survival"],
    requiresMicrosoft: false,
    accent: "from-blue-500/25 to-violet-500/10",
  },
  {
    name: "PikaNetwork",
    host: "play.pika-network.net",
    imageUrl: serverIconUrl("play.pika-network.net"),
    region: "Global",
    description: "Rede com BedWars, SkyWars, survival e factions.",
    mode: "Rede",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "Survival", "Factions"],
    requiresMicrosoft: false,
    accent: "from-yellow-500/25 to-red-500/10",
  },
  {
    name: "JartexNetwork",
    host: "play.jartexnetwork.com",
    imageUrl: serverIconUrl("play.jartexnetwork.com"),
    region: "Global",
    description: "Minigames, survival e modos competitivos.",
    mode: "Rede",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "Prison", "Factions"],
    requiresMicrosoft: false,
    accent: "from-red-500/25 to-orange-500/10",
  },
  {
    name: "Herobrine.org",
    host: "herobrine.org",
    imageUrl: serverIconUrl("herobrine.org"),
    region: "Global",
    description: "Rede com survival, skyblock, factions e minigames.",
    mode: "Rede",
    category: "Survival",
    features: ["Survival", "SkyBlock", "Factions", "BedWars"],
    requiresMicrosoft: false,
    accent: "from-red-600/25 to-stone-500/10",
  },
  {
    name: "MineLand",
    host: "join.mineland.net",
    imageUrl: serverIconUrl("join.mineland.net"),
    region: "Global",
    description: "Rede grande com criativo, minigames e survival.",
    mode: "Rede",
    category: "Criativo",
    features: ["Creative", "BedWars", "SkyWars", "Survival"],
    requiresMicrosoft: false,
    accent: "from-green-500/25 to-cyan-500/10",
  },
  {
    name: "LibreCraft",
    host: "mc.librecraft.com",
    imageUrl: serverIconUrl("mc.librecraft.com"),
    region: "Global",
    description: "Rede com survival, skywars e minigames.",
    mode: "Rede",
    category: "Minigames",
    features: ["SkyWars", "Survival", "BedWars", "BuildBattle"],
    requiresMicrosoft: false,
    accent: "from-indigo-500/25 to-teal-500/10",
  },
  {
    name: "UltimisMC",
    host: "ultimismc.com",
    imageUrl: serverIconUrl("ultimismc.com"),
    region: "Global",
    description: "Servidor com survival, skyblock e modos sociais.",
    mode: "Survival",
    category: "Comunidade",
    features: ["Survival", "SkyBlock", "Economia", "PvP"],
    requiresMicrosoft: false,
    accent: "from-rose-500/25 to-purple-500/10",
  },
  {
    name: "Twerion",
    host: "twerion.net",
    imageUrl: serverIconUrl("twerion.net"),
    region: "Europa",
    description: "Rede europeia com PvP, citybuild e minigames.",
    mode: "Rede",
    category: "Minigames",
    features: ["CityBuild", "BedWars", "PvP", "SkyWars"],
    requiresMicrosoft: false,
    accent: "from-orange-500/25 to-cyan-500/10",
  },
];

const curatedMods: CuratedPvpContent[] = [
  {
    title: "CPS Display",
    provider: "curseforge",
    projectId: "618222",
    type: "mod",
    description: "Mostra CPS em Forge 1.8.9 sem carregar OneConfig.",
    tag: "CPS",
    imageUrl: "https://media.forgecdn.net/avatars/793/118/638150818846195429.png",
  },
  {
    title: "Lunar Keystrokes",
    provider: "curseforge",
    projectId: "558935",
    type: "mod",
    description: "Mostruario de teclas para treino de movimento.",
    tag: "Teclas",
    imageUrl: "https://media.forgecdn.net/avatars/1727/773/639099368200386239.png",
  },
  {
    title: "PolySprint",
    provider: "modrinth",
    projectId: "i9xRThb3",
    type: "mod",
    description: "Toggle sprint leve para PvP 1.8.9, baixado pela Modrinth.",
    tag: "Sprint",
    imageUrl: "https://cdn.modrinth.com/data/i9xRThb3/icon.png",
  },
  {
    title: "VanillaHUD",
    provider: "curseforge",
    projectId: "1147254",
    type: "mod",
    description: "HUD limpo para Forge 1.8.9 via CurseForge.",
    tag: "HUD",
    imageUrl: "https://media.forgecdn.net/avatars/1147/254/638706762970781068.png",
  },
  {
    title: "BetterFps",
    provider: "curseforge",
    projectId: "229876",
    type: "mod",
    description: "Otimizacoes classicas para deixar a 1.8.9 mais leve.",
    tag: "FPS",
    imageUrl: "https://media.forgecdn.net/avatars/16/988/635655885251312698.png",
  },
  {
    title: "FoamFix",
    provider: "curseforge",
    projectId: "278494",
    type: "mod",
    description: "Reduz uso de memoria e melhora carregamento em Forge 1.8.9.",
    tag: "Memoria",
    imageUrl: "https://media.forgecdn.net/avatars/1134/50/638694652184423538.png",
  },
  {
    title: "Memory Fix",
    provider: "curseforge",
    projectId: "950156",
    type: "mod",
    description: "Corrige vazamentos de memoria e ajuda com texturas pesadas.",
    tag: "Fix",
    imageUrl: "https://media.forgecdn.net/avatars/919/408/638381618061787810.png",
  },
  {
    title: "BetterHurtCam",
    provider: "modrinth",
    projectId: "DQKdq5re",
    type: "mod",
    description: "Ajusta a camera de dano para PvP 1.8.9.",
    tag: "Camera",
    imageUrl: "https://cdn.modrinth.com/data/DQKdq5re/icon.png",
  },
  {
    title: "TCPDelayMod",
    provider: "modrinth",
    projectId: "d9VOPfkU",
    type: "mod",
    description: "Ajuste leve de rede para Minecraft 1.8.9.",
    tag: "Rede",
    imageUrl: "https://cdn.modrinth.com/data/d9VOPfkU/icon.png",
  },
  {
    title: "SimpleTimeChanger",
    provider: "modrinth",
    projectId: "uHERytn5",
    type: "mod",
    description: "Troca de horario do mundo para visual PvP mais limpo.",
    tag: "Tempo",
    imageUrl: "https://cdn.modrinth.com/data/uHERytn5/icon.png",
  },
  {
    title: "CustomSkinLoader",
    provider: "modrinth",
    projectId: "idMHQ4n2",
    type: "mod",
    description: "Carrega a skin equipada no launcher dentro do Kit PvP offline.",
    tag: "Skin",
    imageUrl: "https://cdn.modrinth.com/data/idMHQ4n2/icon.png",
  },
];

const curatedTextures: CuratedPvpContent[] = [
  {
    title: "PvP+ Faithful Revamped",
    provider: "curseforge",
    projectId: "373042",
    type: "resourcepack",
    description: "Faithful edit focado em PvP, limpo e fácil de enxergar.",
    tag: "Faithful",
    imageUrl: "https://media.forgecdn.net/avatars/260/670/637215376386607499.png",
  },
  {
    title: "Technofault",
    provider: "curseforge",
    projectId: "935096",
    type: "resourcepack",
    description: "Visual PvP famoso inspirado no estilo Techno.",
    tag: "16x",
    imageUrl: "https://media.forgecdn.net/avatars/963/143/638460513823037113.png",
  },
  {
    title: "Faithful Edit for PvP",
    provider: "curseforge",
    projectId: "417255",
    type: "resourcepack",
    description: "Edição Faithful com leitura boa para BedWars e duels.",
    tag: "PvP",
    imageUrl: "https://media.forgecdn.net/avatars/310/651/637399535085990048.jpeg",
  },
  {
    title: "Naypack Nebula",
    provider: "modrinth",
    projectId: "PBCcz4co",
    type: "resourcepack",
    description: "Pack 16x com tema Nebula para Minecraft 1.8.9.",
    tag: "Nebula",
    imageUrl: "https://cdn.modrinth.com/data/PBCcz4co/66cda21701e00d7d83b93792e8605d1ff66e0d57_96.webp",
  },
  {
    title: "LowoFault Definitive 16x",
    provider: "curseforge",
    projectId: "1387760",
    type: "resourcepack",
    description: "Textura 16x moderna para PvP clássico.",
    tag: "Low fire",
    imageUrl: "https://media.forgecdn.net/avatars/1526/705/638991481185278519.png",
  },
];

type ProviderUnavailableItem = {
  title: string;
  reason: string;
};

const providerUnavailableItems: ProviderUnavailableItem[] = [
  { title: "OptiFine", reason: "Nao possui distribuicao oficial por Modrinth/CurseForge." },
  { title: "Patcher", reason: "Distribuido fora dos providers do launcher." },
  { title: "The 5zig Mod", reason: "Nao possui build Forge 1.8.9 atual nesses providers." },
  { title: "OverflowAnimations", reason: "Nao encontrado com download oficial em Modrinth/CurseForge." },
  { title: "Block Overlay / Crosshair do video", reason: "As versoes exatas do video nao aparecem nos providers oficiais." },
];

const quickFeatures = [
  { icon: Keyboard, title: "Keystrokes", value: "WASD", text: "Teclas e cliques para treino de movimento." },
  { icon: Gauge, title: "CPS", value: "HUD", text: "Contador limpo para duels e bridging." },
  { icon: Zap, title: "Otimizacao", value: "11 mods", text: "Downloads seguros por Modrinth e CurseForge." },
  { icon: Shirt, title: "Skin offline", value: "Avatar", text: "A skin equipada entra no Kit PvP via CustomSkinLoader." },
  { icon: Palette, title: "Texturas", value: "5 packs", text: "Resource packs baixados pelos providers do launcher." },
];

const pvpSearchSuggestions = {
  mod: "keystrokes cps hud",
  resourcepack: "faithful pvp 16x",
} satisfies Record<Extract<ContentType, "mod" | "resourcepack">, string>;

const providerLabel: Record<ContentProvider, string> = {
  modrinth: "Modrinth",
  curseforge: "CurseForge",
};

export const PvpPage = () => {
  const queryClient = useQueryClient();
  const { session, loginMicrosoft } = useAuthSession();
  const { instances } = useInstances();
  const downloads = useDownloads();
  const runningInstances = useRunningInstances();
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchEvent, setLaunchEvent] = useState<LaunchEvent | null>(null);
  const [activeContentType, setActiveContentType] =
    useState<Extract<ContentType, "mod" | "resourcepack">>("mod");
  const [searchQuery, setSearchQuery] = useState(pvpSearchSuggestions.mod);
  const [searchResults, setSearchResults] = useState<ContentSearchResult[]>([]);
  const [serverSearchQuery, setServerSearchQuery] = useState("");
  const [kitMenuOpen, setKitMenuOpen] = useState(false);
  const [kitEditorOpen, setKitEditorOpen] = useState(false);

  const account = session.data?.status === "signed-in" ? session.data.account : null;
  const hasMicrosoft = account?.provider === "microsoft" && account.license.status === "verified";
  const pvpInstance = useMemo(
    () => findPvpInstance(instances.data ?? []),
    [instances.data],
  );
  const activeDownloads = useMemo(
    () =>
      (downloads.data ?? []).filter(
        (download) => download.status === "queued" || download.status === "running",
      ),
    [downloads.data],
  );
  const serverHosts = useMemo(
    () => Array.from(new Set(pvpServers.map((serverInfo) => serverInfo.host))),
    [],
  );
  const serverStatuses = useQuery({
    queryKey: ["pvp", "servers", "status", serverHosts],
    queryFn: () => launcherApi.getServerStatuses({ hosts: serverHosts }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const serverStatusByHost = useMemo(
    () => new Map((serverStatuses.data ?? []).map((status) => [status.host, status])),
    [serverStatuses.data],
  );
  const visibleServers = useMemo(
    () => filterServers(pvpServers, serverSearchQuery),
    [serverSearchQuery],
  );
  const microsoftServers = useMemo(
    () => visibleServers.filter((serverInfo) => serverInfo.requiresMicrosoft),
    [visibleServers],
  );
  const crackedServers = useMemo(
    () => visibleServers.filter((serverInfo) => !serverInfo.requiresMicrosoft),
    [visibleServers],
  );
  const highlightedServer = serverSearchQuery.trim() ? visibleServers.at(0) : undefined;
  const kitInspection = useQuery({
    queryKey: ["pvp", "kit", "inspection", pvpInstance?.id],
    queryFn: () => launcherApi.inspectInstance(pvpInstance?.id ?? ""),
    enabled: Boolean(pvpInstance && kitEditorOpen),
  });
  const editableKitContent = useMemo(
    () =>
      (kitInspection.data?.content ?? []).filter(
        (item) => item.category === "mod" || item.category === "resourcepack",
      ),
    [kitInspection.data],
  );

  const search = useMutation({
    mutationFn: () =>
      launcherApi.searchContent({
        provider: "all",
        type: activeContentType,
        query: searchQuery.trim() || pvpSearchSuggestions[activeContentType],
        minecraftVersion: PVP_VERSION,
        loader: activeContentType === "mod" ? PVP_LOADER : undefined,
        sort: "downloads",
        limit: 24,
      }),
    onSuccess: (results) => setSearchResults(filterPvpResults(results, activeContentType)),
  });
  const removeKitItem = useMutation({
    mutationFn: async (item: InstanceContentEntry) => {
      if (!pvpInstance) {
        throw new Error("Kit PvP não encontrado.");
      }

      if (item.installedContentId) {
        await launcherApi.removeInstalledContent(item.installedContentId);
        return;
      }

      await launcherApi.removeInstanceFile({
        instanceId: pvpInstance.id,
        relativePath: item.relativePath,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pvp", "kit", "inspection"] }),
        queryClient.invalidateQueries({ queryKey: ["instances"] }),
      ]);
    },
  });

  const changeContentType = (type: Extract<ContentType, "mod" | "resourcepack">) => {
    setActiveContentType(type);
    setSearchQuery(pvpSearchSuggestions[type]);
    setSearchResults([]);
  };

  useEffect(() => {
    if (!pvpInstance) return undefined;

    return launcherApi.onLaunchEvent((event) => {
      if (event.id !== pvpInstance.id) return;
      setLaunchEvent(event);

      if (["complete", "cancelled", "error", "closed", "killed"].includes(event.type)) {
        window.setTimeout(() => setLaunchEvent(null), 1800);
      }
    });
  }, [pvpInstance]);

  const installSingleContent = async (
    instanceId: string,
    item: CuratedPvpContent | ContentSearchResult,
  ) => {
    await launcherApi.installContent({
      provider: item.provider,
      type: item.type,
      projectId: item.projectId,
      instanceId,
    });
    await refreshPvpData(queryClient);
  };

  const ensureSkinLoaderInstalled = async (instance: LauncherInstance) => {
    const skinLoader = curatedMods.find((item) => item.title === "CustomSkinLoader");

    if (!skinLoader) {
      return;
    }

    const installed = await launcherApi.listInstalledContent(instance.id).catch(() => []);
    const installedKeys = new Set(
      installed.map((item) => `${item.provider}:${item.type}:${item.projectId}`),
    );
    const key = `${skinLoader.provider}:${skinLoader.type}:${skinLoader.projectId}`;

    if (installedKeys.has(key) || installed.some((item) => /customskinloader/i.test(item.fileName))) {
      return;
    }

    setSetupStatus("Preparando skin offline no Kit PvP...");
    await installSingleContent(instance.id, skinLoader);
    setSetupStatus("Skin offline pronta para o Kit PvP.");
  };

  const installKit = async () => {
    setSetupError(null);
    setLaunchError(null);
    setSetupStatus("Preparando perfil Forge 1.8.9...");

    try {
      const instance =
        pvpInstance ??
        (await launcherApi.createInstance({
          name: PVP_INSTANCE_NAME,
          minecraftVersion: PVP_VERSION,
          loader: PVP_LOADER,
          ramMb: 4096,
          contentManagementEnabled: true,
        }));

      await refreshPvpData(queryClient);
      const installed = await launcherApi.listInstalledContent(instance.id).catch(() => []);
      const installedKeys = new Set(
        installed.map((item) => `${item.provider}:${item.type}:${item.projectId}`),
      );
      const items = [...curatedMods, ...curatedTextures];
      const failures: string[] = [];
      let done = 0;

      for (const item of items) {
        const key = `${item.provider}:${item.type}:${item.projectId}`;
        const alreadyInstalled = installedKeys.has(key);

        try {
          setSetupStatus(
            alreadyInstalled
              ? `Verificando atualizacao via ${providerLabel[item.provider]}: ${item.title} (${done + 1}/${items.length})...`
              : `Baixando via ${providerLabel[item.provider]}: ${item.title} (${done + 1}/${items.length})...`,
          );
          await installSingleContent(instance.id, item);
          installedKeys.add(key);
        } catch (error) {
          failures.push(`${item.title}: ${error instanceof Error ? error.message : "falhou"}`);
        } finally {
          done += 1;
        }
      }

      await refreshPvpData(queryClient);

      if (failures.length > 0) {
        setSetupError(
          `Kit criado, mas ${failures.length} item(ns) nao baixaram pelos providers. ${failures.slice(0, 2).join(" | ")}`,
        );
        setSetupStatus("Kit PvP parcialmente pronto com downloads oficiais.");
        return;
      }

      setSetupStatus("Kit PvP pronto com mods e texturas baixados por Modrinth/CurseForge.");
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Nao foi possivel criar o kit PvP.");
      setSetupStatus(null);
    }
  };

  const installCurated = async (item: CuratedPvpContent) => {
    setSetupError(null);
    const instance = pvpInstance;

    if (!instance) {
      setSetupError("Instale o Kit PvP 1.8.9 antes de adicionar conteudo.");
      return;
    }

    try {
      setSetupStatus(`Baixando ou atualizando via ${providerLabel[item.provider]}: ${item.title}...`);
      await installSingleContent(instance.id, item);
      setSetupStatus(`${item.title} instalado via ${providerLabel[item.provider]}.`);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Nao foi possivel instalar.");
    }
  };

  const installSearchResult = async (item: ContentSearchResult) => {
    setSetupError(null);
    const instance = pvpInstance;

    if (!instance) {
      setSetupError("Instale o Kit PvP 1.8.9 antes de adicionar conteúdo.");
      return;
    }

    try {
      setSetupStatus(`Baixando ${item.title}...`);
      await installSingleContent(instance.id, item);
      setSetupStatus(`${item.title} instalado no Kit PvP.`);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Não foi possível instalar.");
    }
  };

  const launchKit = async () => {
    setLaunchError(null);

    if (!pvpInstance) {
      setLaunchError("Baixe o Kit PvP 1.8.9 antes de iniciar.");
      return;
    }

    try {
      await ensureSkinLoaderInstalled(pvpInstance);
      await launcherApi.launch({ instanceId: pvpInstance.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir o Kit PvP.";

      if (message.startsWith("INSTANCE_ALREADY_RUNNING")) {
        setLaunchError("O Kit PvP já está aberto.");
        return;
      }

      setLaunchError(message);
    }
  };

  const launchServer = async (serverInfo: PvpServer) => {
    setLaunchError(null);

    if (!pvpInstance) {
      setLaunchError("Instale o Kit PvP 1.8.9 antes de entrar em servidores.");
      return;
    }

    if (serverInfo.requiresMicrosoft && !hasMicrosoft) {
      setLaunchError(`${serverInfo.name} exige conta Microsoft licenciada.`);
      return;
    }

    try {
      await ensureSkinLoaderInstalled(pvpInstance);
      await launcherApi.launch({
        instanceId: pvpInstance.id,
        server: {
          name: serverInfo.name,
          host: serverInfo.host,
          port: serverInfo.port,
          requiresMicrosoft: serverInfo.requiresMicrosoft,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir o servidor.";

      if (message.startsWith("INSTANCE_ALREADY_RUNNING")) {
        await launcherApi.launch({
          instanceId: pvpInstance.id,
          force: true,
          server: {
            name: serverInfo.name,
            host: serverInfo.host,
            port: serverInfo.port,
            requiresMicrosoft: serverInfo.requiresMicrosoft,
          },
        });
        return;
      }

      setLaunchError(message);
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search.mutate();
  };

  const isSettingUp = Boolean(
    setupStatus?.startsWith("Preparando") ||
      setupStatus?.startsWith("Baixando") ||
      setupStatus?.startsWith("Removendo"),
  );
  const pvpIsRunning = Boolean(pvpInstance && runningInstances.isRunning(pvpInstance.id));

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-blue-300/15 bg-[#101722] shadow-2xl shadow-blue-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.16),transparent_32%)]" />
        {pvpInstance ? (
          <div className="absolute right-5 top-5 z-20">
            <button
              type="button"
              onClick={() => setKitMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-[#D7E2F2] transition hover:border-blue-300/35 hover:bg-white/10"
              title="Opções do Kit PvP"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {kitMenuOpen ? (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-[#111923] p-2 shadow-2xl shadow-black/30">
                <button
                  type="button"
                  onClick={() => {
                    setKitMenuOpen(false);
                    installKit();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#D7E2F2] transition hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reparar / completar
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:p-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">PvP 1.8.9</Badge>
              <Badge tone={hasMicrosoft ? "green" : "slate"}>
                {hasMicrosoft ? "Microsoft verificada" : "Offline limitado"}
              </Badge>
              <Badge tone={pvpInstance ? "green" : "slate"}>
                {pvpInstance ? "Kit instalado" : "Kit não instalado"}
              </Badge>
            </div>

            <div>
              <h2 className="text-3xl font-bold tracking-tight text-white">
                Central PvP do MLUltimate
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#A7B4C8]">
                Baixe um perfil Forge 1.8.9 pronto para PvP, com HUD de CPS,
                mostruário de teclas, mods leves e cinco texturas PvP famosas.
                Depois entre direto nos servidores pela própria aba.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {!pvpInstance ? (
                <Button onClick={installKit} disabled={isSettingUp}>
                  {isSettingUp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Baixar Kit PvP 1.8.9
                </Button>
              ) : (
                <>
                  <Button
                    onClick={launchKit}
                    disabled={pvpIsRunning || isSettingUp}
                    title={
                      pvpIsRunning
                        ? "O Kit PvP já está aberto"
                        : "Jogar sem entrar direto em um servidor"
                    }
                  >
                    <Play className="h-4 w-4" />
                    {pvpIsRunning ? "Kit aberto" : "Jogar Kit"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setKitEditorOpen(true)}
                    disabled={isSettingUp}
                  >
                    <Settings2 className="h-4 w-4" />
                    Editar Kit
                  </Button>
                </>
              )}
              {!hasMicrosoft ? (
                <Button
                  variant="secondary"
                  onClick={() => loginMicrosoft.mutate()}
                  disabled={loginMicrosoft.isPending}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Entrar com Microsoft
                </Button>
              ) : null}
            </div>

            {setupStatus || setupError || launchError || launchEvent ? (
              <div className="space-y-2">
                {setupStatus ? <StatusLine tone="info" text={setupStatus} /> : null}
                {setupError ? <StatusLine tone="error" text={setupError} /> : null}
                {launchError ? <StatusLine tone="error" text={launchError} /> : null}
                {launchEvent ? <StatusLine tone="info" text={launchEvent.message} /> : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/15 p-4 shadow-inner shadow-white/[0.02]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-[#60A5FA]">Kit incluso</p>
                <p className="mt-1 text-lg font-bold text-white">Pronto para PvP</p>
              </div>
              <Badge tone="green">Leve</Badge>
            </div>

            <div className="divide-y divide-white/10">
              {quickFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10">
                      <Icon className="h-4 w-4 text-[#60A5FA]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-white">{feature.title}</p>
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-[#D7E2F2]">
                          {feature.value}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#9EACBF]">{feature.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeader
            icon={Server}
            title="Servidores PvP"
            description="Pesquise, veja players online e entre pelo Kit PvP."
          />
          <Badge tone={serverStatuses.isFetching ? "blue" : "green"}>
            {serverStatuses.isFetching ? "Atualizando status" : "Status ao vivo"}
          </Badge>
        </div>

        <div className="space-y-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={serverSearchQuery}
              onChange={(event) => setServerSearchQuery(event.target.value)}
              placeholder="Pesquise por servidor, IP, BedWars, HG, BuildBattle..."
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0B111A] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#6B7280] focus:border-[#60A5FA]/70"
            />
          </label>

          <ServerSearchResult
            serverInfo={highlightedServer}
            status={highlightedServer ? serverStatusByHost.get(highlightedServer.host) : undefined}
            query={serverSearchQuery}
            hasMicrosoft={hasMicrosoft}
            pvpInstanceReady={Boolean(pvpInstance)}
            pvpIsRunning={pvpIsRunning}
            onLaunch={launchServer}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_auto_1fr]">
          <ServerColumn
            title="Servidores Microsoft"
            description="Servidores originais com conta licenciada."
            servers={microsoftServers}
            statusByHost={serverStatusByHost}
            hasMicrosoft={hasMicrosoft}
            pvpInstanceReady={Boolean(pvpInstance)}
            pvpIsRunning={pvpIsRunning}
            onLaunch={launchServer}
          />
          <div className="hidden w-px bg-white/10 xl:block" />
          <ServerColumn
            title="Servidores Pirata"
            description="Servidores offline/pirata que aceitam conta sem Microsoft."
            servers={crackedServers}
            statusByHost={serverStatusByHost}
            hasMicrosoft={hasMicrosoft}
            pvpInstanceReady={Boolean(pvpInstance)}
            pvpIsRunning={pvpIsRunning}
            onLaunch={launchServer}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <SectionHeader
            icon={Package}
            title="Mods oficiais do Kit PvP"
            description="Downloads feitos direto por Modrinth e CurseForge, com versao Forge 1.8.9 filtrada pelo launcher."
          />
          <div className="mt-4 space-y-3">
            {curatedMods.map((item) => (
              <CuratedContentRow
                key={`${item.provider}-${item.projectId}`}
                item={item}
                installed={Boolean(pvpInstance)}
                onInstall={() => installCurated(item)}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            icon={Palette}
            title="Texturas por providers"
            description="Resource packs baixados pelos mesmos providers seguros do launcher."
          />
          <div className="mt-4 space-y-3">
            {curatedTextures.map((item) => (
              <CuratedContentRow
                key={`${item.provider}-${item.projectId}`}
                item={item}
                installed={Boolean(pvpInstance)}
                onInstall={() => installCurated(item)}
              />
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <SectionHeader
          icon={ShieldCheck}
          title="Fora do download automatico"
          description="Itens do video que nao entram porque nao achei distribuicao oficial no Modrinth/CurseForge."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {providerUnavailableItems.map((item) => (
            <ProviderUnavailableRow key={item.title} item={item} />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            icon={Crosshair}
            title="Adicionar conteúdo PvP 1.8.9"
            description="A busca desta aba mostra apenas mods Forge 1.8.9 ou texturas 1.8.9."
          />
          <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => changeContentType("mod")}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold text-[#94A3B8] transition",
                activeContentType === "mod" && "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20",
              )}
            >
              Mods PvP
            </button>
            <button
              type="button"
              onClick={() => changeContentType("resourcepack")}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-semibold text-[#94A3B8] transition",
                activeContentType === "resourcepack" && "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20",
              )}
            >
              Texturas PvP
            </button>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={
                activeContentType === "mod"
                  ? "Buscar mods PvP 1.8.9"
                  : "Buscar texturas PvP 1.8.9"
              }
              className="h-12 w-full rounded-2xl border border-white/10 bg-[#0B111A] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[#6B7280] focus:border-[#60A5FA]/70"
            />
          </label>
          <Button type="submit" disabled={search.isPending}>
            {search.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </form>

        {search.error instanceof Error ? (
          <div className="mt-4">
            <StatusLine tone="error" text={search.error.message} />
          </div>
        ) : null}

        {searchResults.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {searchResults.map((result) => (
              <div
                key={`${result.provider}-${result.projectId}`}
                className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {result.iconUrl ? (
                    <img src={result.iconUrl} alt="" className="h-full w-full object-cover" />
                  ) : activeContentType === "mod" ? (
                    <Package className="h-5 w-5 text-[#60A5FA]" />
                  ) : (
                    <Palette className="h-5 w-5 text-[#60A5FA]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-white">{result.title}</p>
                    <Badge tone="slate" data-i18n-skip="true">
                      {providerLabel[result.provider]}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#94A3B8]">
                    {result.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[#6B7280]">
                      {activeContentType === "mod" ? "Forge 1.8.9" : "Minecraft 1.8.9"}
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => installSearchResult(result)}
                      disabled={!pvpInstance}
                    >
                      <Download className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm text-[#94A3B8]">
            Busque mods ou texturas. Os resultados já saem filtrados para PvP 1.8.9.
          </div>
        )}
      </Card>

      {activeDownloads.length > 0 ? (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-[#60A5FA]" />
            <div>
              <p className="font-semibold text-white">Downloads em andamento</p>
              <p className="text-sm text-[#94A3B8]">
                {activeDownloads[0]?.label} — {Math.round(activeDownloads[0]?.progress ?? 0)}%
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {kitEditorOpen ? (
        <KitEditorModal
          items={editableKitContent}
          loading={kitInspection.isFetching}
          removingId={removeKitItem.isPending ? removeKitItem.variables?.relativePath : undefined}
          onClose={() => setKitEditorOpen(false)}
          onRemove={(item) => removeKitItem.mutate(item)}
        />
      ) : null}
    </div>
  );
};

const SectionHeader = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Server;
  title: string;
  description: string;
}) => (
  <div className="flex gap-3">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/12">
      <Icon className="h-5 w-5 text-[#60A5FA]" />
    </div>
    <div>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-[#94A3B8]">{description}</p>
    </div>
  </div>
);

const ServerImage = ({
  serverInfo,
  status,
  locked,
  compact = false,
}: {
  serverInfo: PvpServer;
  status?: ServerStatusResult;
  locked: boolean;
  compact?: boolean;
}) => {
  const iconSrc = status?.icon ?? serverInfo.imageUrl;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === iconSrc;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-black/25 shadow-lg shadow-black/20",
        compact ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl",
      )}
    >
      {!failed ? (
        <img
          src={iconSrc}
          alt=""
          data-i18n-skip="true"
          onError={() => setFailedSrc(iconSrc)}
          className={cn("h-full w-full object-cover [image-rendering:pixelated]", locked && "opacity-55")}
        />
      ) : (
        <Server className={cn("h-7 w-7 text-[#60A5FA]", locked && "text-amber-200")} />
      )}
    </div>
  );
};

const ServerSearchResult = ({
  serverInfo,
  status,
  query,
  hasMicrosoft,
  pvpInstanceReady,
  pvpIsRunning,
  onLaunch,
}: {
  serverInfo?: PvpServer;
  status?: ServerStatusResult;
  query: string;
  hasMicrosoft: boolean;
  pvpInstanceReady: boolean;
  pvpIsRunning: boolean;
  onLaunch: (serverInfo: PvpServer) => void;
}) => {
  const trimmed = query.trim();

  if (!trimmed) {
    return (
      <div className="flex min-h-16 items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 text-sm text-[#94A3B8]">
        Digite o nome, IP ou modo do servidor.
      </div>
    );
  }

  if (!serverInfo) {
    return (
      <div className="flex min-h-16 items-center rounded-2xl border border-red-400/20 bg-red-500/10 px-4 text-sm text-red-100">
        Nenhum servidor encontrado para "{trimmed}".
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-blue-300/20 bg-[#101722] p-3 sm:flex-row sm:items-center">
      <ServerImage
        serverInfo={serverInfo}
        status={status}
        locked={serverInfo.requiresMicrosoft && !hasMicrosoft}
        compact
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-white">{serverInfo.name}</p>
          <Badge tone={serverInfo.requiresMicrosoft ? "blue" : "slate"}>
            {serverInfo.requiresMicrosoft ? "Microsoft" : "Pirata"}
          </Badge>
          <Badge tone="slate">{serverInfo.category}</Badge>
        </div>
        <p className="mt-1 truncate text-sm text-[#94A3B8]" data-i18n-skip="true">
          {serverInfo.host}
        </p>
      </div>
      <PlayerCount status={status} />
      <Button
        size="sm"
        onClick={() => onLaunch(serverInfo)}
        disabled={!pvpInstanceReady || (serverInfo.requiresMicrosoft && !hasMicrosoft)}
        title={
          !pvpInstanceReady
            ? "Baixe o Kit PvP 1.8.9 primeiro"
            : serverInfo.requiresMicrosoft && !hasMicrosoft
              ? "Entre com Microsoft para acessar este servidor"
              : `Entrar em ${serverInfo.name}`
        }
      >
        <Play className="h-4 w-4" />
        {pvpIsRunning ? "Trocar" : "Play"}
      </Button>
    </div>
  );
};

const ServerColumn = ({
  title,
  description,
  servers,
  statusByHost,
  hasMicrosoft,
  pvpInstanceReady,
  pvpIsRunning,
  onLaunch,
}: {
  title: string;
  description: string;
  servers: PvpServer[];
  statusByHost: Map<string, ServerStatusResult>;
  hasMicrosoft: boolean;
  pvpInstanceReady: boolean;
  pvpIsRunning: boolean;
  onLaunch: (serverInfo: PvpServer) => void;
}) => (
  <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-[#94A3B8]">{description}</p>
      </div>
      <Badge tone="slate">{servers.length} servidores</Badge>
    </div>

    <div className="max-h-[620px] space-y-3 overflow-y-auto pr-2">
      {servers.length > 0 ? (
        servers.map((serverInfo) => (
          <ServerDirectoryCard
            key={serverInfo.host}
            serverInfo={serverInfo}
            status={statusByHost.get(serverInfo.host)}
            hasMicrosoft={hasMicrosoft}
            pvpInstanceReady={pvpInstanceReady}
            pvpIsRunning={pvpIsRunning}
            onLaunch={onLaunch}
          />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm text-[#94A3B8]">
          Nenhum servidor nesta coluna.
        </div>
      )}
    </div>
  </div>
);

const ServerDirectoryCard = ({
  serverInfo,
  status,
  hasMicrosoft,
  pvpInstanceReady,
  pvpIsRunning,
  onLaunch,
}: {
  serverInfo: PvpServer;
  status?: ServerStatusResult;
  hasMicrosoft: boolean;
  pvpInstanceReady: boolean;
  pvpIsRunning: boolean;
  onLaunch: (serverInfo: PvpServer) => void;
}) => {
  const locked = serverInfo.requiresMicrosoft && !hasMicrosoft;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br", serverInfo.accent)}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <ServerImage serverInfo={serverInfo} status={status} locked={locked} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-base font-bold text-white">{serverInfo.name}</h4>
              <Badge tone={serverInfo.requiresMicrosoft ? "blue" : "slate"}>
                {serverInfo.requiresMicrosoft ? "Microsoft" : "Pirata"}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-[#A7B4C8]" data-i18n-skip="true">
              {serverInfo.host}
            </p>
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#D7E2F2]">
              {serverInfo.description}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="slate">{serverInfo.region}</Badge>
          <Badge tone="slate">{serverInfo.category}</Badge>
          <Badge tone={status?.online ? "green" : "slate"}>
            {status?.online ? "Online" : status ? "Offline" : "Buscando"}
          </Badge>
          {status?.version ? <Badge tone="slate">{status.version}</Badge> : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {serverInfo.features.map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-[#D7E2F2]"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <PlayerCount status={status} />
          <Button
            size="sm"
            onClick={() => onLaunch(serverInfo)}
            disabled={!pvpInstanceReady || locked}
            title={
              locked
                ? "Entre com Microsoft para acessar este servidor"
                : !pvpInstanceReady
                  ? "Baixe o Kit PvP 1.8.9 primeiro"
                  : `Entrar em ${serverInfo.name}`
            }
          >
            {locked ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {locked ? "Bloqueado" : pvpIsRunning ? "Trocar" : "Entrar"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const PlayerCount = ({ status }: { status?: ServerStatusResult }) => {
  if (!status) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-xs text-[#94A3B8]">
        players
        <div className="font-semibold text-white">...</div>
      </div>
    );
  }

  if (!status.online) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-xs text-[#94A3B8]">
        players
        <div className="font-semibold text-white">offline</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right text-xs text-[#94A3B8]">
      players
      <div className="font-semibold text-white">
        {formatPlayers(status.playersOnline)}/{formatPlayers(status.playersMax)}
      </div>
    </div>
  );
};

const KitEditorModal = ({
  items,
  loading,
  removingId,
  onClose,
  onRemove,
}: {
  items: InstanceContentEntry[];
  loading: boolean;
  removingId?: string;
  onClose: () => void;
  onRemove: (item: InstanceContentEntry) => void;
}) => {
  const mods = items.filter((item) => item.category === "mod");
  const resourcepacks = items.filter((item) => item.category === "resourcepack");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0D1117] shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h3 className="text-xl font-bold text-white">Editar Kit PvP</h3>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Remova mods ou texturas instaladas no Kit PvP 1.8.9.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#D7E2F2] transition hover:bg-white/10"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(86vh-96px)] overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-blue-100">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Carregando conteúdo do kit...
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <KitEditorSection
                title="Mods"
                emptyText="Nenhum mod encontrado no kit."
                items={mods}
                removingId={removingId}
                onRemove={onRemove}
              />
              <KitEditorSection
                title="Texturas"
                emptyText="Nenhuma textura encontrada no kit."
                items={resourcepacks}
                removingId={removingId}
                onRemove={onRemove}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const KitEditorSection = ({
  title,
  emptyText,
  items,
  removingId,
  onRemove,
}: {
  title: string;
  emptyText: string;
  items: InstanceContentEntry[];
  removingId?: string;
  onRemove: (item: InstanceContentEntry) => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h4 className="font-bold text-white">{title}</h4>
      <Badge tone="slate">{items.length}</Badge>
    </div>

    {items.length > 0 ? (
      items.map((item) => (
        <div
          key={item.relativePath}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0B111A]">
            {item.previewDataUrl ?? item.iconUrl ? (
              <img
                src={item.previewDataUrl ?? item.iconUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : item.category === "mod" ? (
              <Package className="h-5 w-5 text-[#60A5FA]" />
            ) : (
              <Palette className="h-5 w-5 text-[#60A5FA]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{item.name}</p>
            <p className="mt-1 truncate text-xs text-[#94A3B8]" data-i18n-skip="true">
              {item.fileName} · {formatBytes(item.sizeBytes)}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRemove(item)}
            disabled={removingId === item.relativePath}
            title={`Remover ${item.name}`}
          >
            {removingId === item.relativePath ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remover
          </Button>
        </div>
      ))
    ) : (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-center text-sm text-[#94A3B8]">
        {emptyText}
      </div>
    )}
  </div>
);

const CuratedContentRow = ({
  item,
  installed,
  onInstall,
}: {
  item: CuratedPvpContent;
  installed: boolean;
  onInstall: () => void;
}) => (
  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0B111A]">
      <CuratedContentImage item={item} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-white">{item.title}</p>
        <Badge tone="slate">{item.tag}</Badge>
        <Badge tone="blue">{providerLabel[item.provider]}</Badge>
      </div>
      <p className="mt-1 text-sm leading-5 text-[#94A3B8]">{item.description}</p>
    </div>
    <Button size="sm" variant="secondary" onClick={onInstall} disabled={!installed}>
      <Download className="h-4 w-4" />
      Adicionar
    </Button>
  </div>
);

const CuratedContentImage = ({ item }: { item: CuratedPvpContent }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === item.imageUrl;

  if (failed) {
    return item.type === "mod" ? (
      <Package className="h-5 w-5 text-[#60A5FA]" />
    ) : (
      <Palette className="h-5 w-5 text-[#60A5FA]" />
    );
  }

  return (
    <img
      src={item.imageUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailedSrc(item.imageUrl)}
    />
  );
};

const ProviderUnavailableRow = ({ item }: { item: ProviderUnavailableItem }) => (
  <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
    <div className="flex items-center gap-2">
      <Lock className="h-4 w-4 text-amber-200" />
      <p className="font-semibold text-amber-50">{item.title}</p>
    </div>
    <p className="mt-2 text-sm leading-6 text-amber-100/80">{item.reason}</p>
  </div>
);

const StatusLine = ({ tone, text }: { tone: "info" | "error"; text: string }) => (
  <div
    className={cn(
      "flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm",
      tone === "error"
        ? "border-red-400/25 bg-red-500/10 text-red-100"
        : "border-blue-400/25 bg-blue-500/10 text-blue-100",
    )}
  >
    {tone === "error" ? (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    ) : (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
    )}
    <span>{text}</span>
  </div>
);

const refreshPvpData = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["instances"] }),
    queryClient.invalidateQueries({ queryKey: ["downloads"] }),
    queryClient.invalidateQueries({ queryKey: ["minecraft", "versions"] }),
  ]);
};

const findPvpInstance = (instances: LauncherInstance[]) =>
  instances.find(
    (instance) =>
      instance.minecraftVersion === PVP_VERSION &&
      instance.loader === PVP_LOADER &&
      instance.name.toLowerCase().includes("pvp"),
  );

const legacyPvpFilePattern = /(basichud|oneconfig)/i;

const filterServers = (servers: PvpServer[], query: string) => {
  const normalized = normalizeSearch(query);

  if (!normalized) {
    return servers;
  }

  const compactQuery = normalized.replace(/\s+/g, "");

  return servers.filter((serverInfo) => {
    const haystack = normalizeSearch(
      [
        serverInfo.name,
        serverInfo.host,
        serverInfo.region,
        serverInfo.mode,
        serverInfo.category,
        serverInfo.description,
        serverInfo.requiresMicrosoft ? "microsoft original premium" : "pirata offline cracked aberto",
        ...serverInfo.features,
      ].join(" "),
    );

    return haystack.includes(normalized) || haystack.replace(/\s+/g, "").includes(compactQuery);
  });
};

const normalizeSearch = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const formatPlayers = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR").format(value)
    : "?";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};


const filterPvpResults = (
  results: ContentSearchResult[],
  type: Extract<ContentType, "mod" | "resourcepack">,
) =>
  results.filter((result) => {
    if (result.type !== type) return false;
    if (type === "mod" && legacyPvpFilePattern.test(`${result.title} ${result.description}`)) {
      return false;
    }

    const title = `${result.title} ${result.description} ${result.compatibleLoaders?.join(" ") ?? ""}`.toLowerCase();
    const looksPvp =
      /(pvp|keystrokes|cps|hud|fps|faithful|fault|16x|bedwars|skywars|duels|sprint|low fire|crosshair)/i.test(
        title,
      );
    const supportsVersion =
      !result.compatibleGameVersions?.length ||
      result.compatibleGameVersions.some((version) => version === PVP_VERSION || version === "1.8.x");

    if (type === "mod") {
      const supportsForge =
        !result.compatibleLoaders?.length || result.compatibleLoaders.includes(PVP_LOADER);
      return supportsVersion && supportsForge && looksPvp;
    }

    return supportsVersion && looksPvp;
  });
