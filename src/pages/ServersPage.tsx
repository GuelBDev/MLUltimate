import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Plus,
  RefreshCw,
  Search,
  Server as ServerIcon,
  Shield,
  Trash2,
  Users,
  Play,
  Layers,
  Settings2,
  X,
  Star,
  Sparkles,
  Loader2,
  ChevronDown,
  Info,
  Check,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { AppSelect, type AppSelectOption } from "../components/ui/AppSelect";
import { useAuthSession } from "../hooks/useAuthSession";
import { launcherApi } from "../services/launcherApi";
import type { AddCustomServerInput, LoaderType, ServerStatusResult } from "../types/launcher";

type ServerCategoryTab = "my-servers" | "library";

type LibraryServer = {
  id: string;
  name: string;
  host: string;
  port?: number;
  version: string;
  category: "pvp" | "survival" | "minigames" | "anarchy" | "rpg" | "modded";
  requiresMicrosoft: boolean;
  hasMods: boolean;
  allowPirate: boolean;
  description: string;
  tags: string[];
  bannerUrl?: string;
  recommendedLoader?: string;
  playersOnline?: number;
  source?: string;
};

type InspectedServerInfo = {
  id: string;
  name: string;
  host: string;
  port?: number;
  version?: string;
  category?: string;
  requiresMicrosoft?: boolean;
  hasMods?: boolean;
  allowPirate?: boolean;
  description?: string;
  tags?: string[];
  bannerUrl?: string;
  recommendedLoader?: string;
  playersOnline?: number;
  source?: string;
  preferredInstanceId?: string;
  isCustom?: boolean;
};

const FAVORITES_STORAGE_KEY = "mlultimate:favorite-servers";
const SERVER_INSTANCES_STORAGE_KEY = "mlultimate:server-instance-map";

const fallbackCatalog: LibraryServer[] = [
  {
    id: "mush",
    name: "Mush MC",
    host: "mush.com.br",
    version: "1.8.9",
    category: "pvp",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "O maior servidor de PvP e Minigames do Brasil! BedWars, SkyWars, HG e Duels.",
    tags: ["PvP", "BedWars", "Duels", "Brasil", "Pirata"],
  },
  {
    id: "redesky",
    name: "Rede Sky",
    host: "redesky.net",
    version: "1.8.9",
    category: "minigames",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor clássico brasileiro de SkyWars, RankUP e Minigames variados.",
    tags: ["Minigames", "SkyWars", "RankUP", "Pirata"],
  },
  {
    id: "craftlandia",
    name: "CraftLandia Farewell",
    host: "jogar.craftlandia.com.br",
    version: "1.5.2",
    category: "survival",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "O servidor de Survival raiz mais antigo e famoso da comunidade brasileira.",
    tags: ["Survival", "Clássico", "Economia", "Pirata"],
  },
  {
    id: "rederevo",
    name: "Rede Revo",
    host: "jogar.rederevo.com.br",
    version: "1.20.1",
    category: "survival",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor brasileiro de Survival, Slimefun, terrenos e economia ativa via ReisHost.",
    tags: ["Survival", "Slimefun", "ReisHost", "Pirata"],
    source: "reishost",
  },
  {
    id: "sparklypower",
    name: "SparklyPower Network",
    host: "jogar.sparklypower.net",
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
    id: "hypixel",
    name: "Hypixel Network",
    host: "mc.hypixel.net",
    version: "1.8.9",
    category: "minigames",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "O maior servidor de Minecraft do mundo! BedWars, SkyBlock, Murder Mystery e mais.",
    tags: ["Minigames", "BedWars", "SkyBlock", "Original"],
  },
  {
    id: "pvplegacy",
    name: "PvP Legacy",
    host: "play.pvplegacy.net",
    version: "1.20.1",
    category: "pvp",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "Servidor focado em PvP moderno (1.9+ 1.20+), KitPvP, Crystal e Sword.",
    tags: ["PvP 1.20", "Crystal", "Sword", "Original"],
  },
  {
    id: "minemen",
    name: "Minemen Club",
    host: "minemen.club",
    version: "1.8.9",
    category: "pvp",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "Servidor competitivo de Duels e Practice com registro de cliques e knocks perfeitos.",
    tags: ["Duels", "Practice", "Competitivo", "Original"],
  },
  {
    id: "universocraft",
    name: "UniversoCraft",
    host: "mc.universocraft.com",
    version: "1.8.9",
    category: "minigames",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor latino-americano com grande público e dezenas de modos de jogo.",
    tags: ["Minigames", "BedWars", "Latino", "Pirata"],
  },
  {
    id: "wynncraft",
    name: "Wynncraft MMORPG",
    host: "play.wynncraft.com",
    version: "1.20.1",
    category: "rpg",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "O maior MMORPG dentro do Minecraft! Quests, magia, dungeons e mapa gigantesco.",
    tags: ["RPG", "Quests", "MMO", "Original"],
  },
  {
    id: "purpleprison",
    name: "Purple Prison",
    host: "purpleprison.net",
    version: "1.20.1",
    category: "survival",
    requiresMicrosoft: false,
    hasMods: false,
    allowPirate: true,
    description: "Servidor de Prison número 1 do mundo. Mineração, parkour e economia ativa.",
    tags: ["Prison", "Parkour", "Economia", "Pirata"],
  },
  {
    id: "hoplite",
    name: "Hoplite UHC",
    host: "hoplite.gg",
    version: "1.20.1",
    category: "pvp",
    requiresMicrosoft: true,
    hasMods: false,
    allowPirate: false,
    description: "Servidor moderno de Battle Royale e UHC na versão 1.20+ com habilidades únicas.",
    tags: ["UHC", "Battle Royale", "PvP 1.20", "Original"],
  },
  {
    id: "complex",
    name: "Complex Pixelmon",
    host: "hub.mc-complex.com",
    version: "1.16.5",
    category: "modded",
    requiresMicrosoft: false,
    hasMods: true,
    allowPirate: true,
    description: "Servidor modded com Pixelmon Reforged, Pokémons, batalhas e torneios.",
    tags: ["Modded", "Pixelmon", "Mods", "Pirata"],
  },
];

const defaultCustomServers: AddCustomServerInput[] = [
  { name: "Mush MC", host: "mush.com.br", port: 25565, requiresMicrosoft: false },
  { name: "Rede Sky", host: "redesky.net", port: 25565, requiresMicrosoft: false },
  { name: "Hypixel", host: "mc.hypixel.net", port: 25565, requiresMicrosoft: true },
  { name: "PvP Legacy", host: "play.pvplegacy.net", port: 25565, requiresMicrosoft: true },
];

export const ServersPage = () => {
  const queryClient = useQueryClient();
  const { session } = useAuthSession();

  const [activeTab, setActiveTab] = useState<ServerCategoryTab>("my-servers");
  const [searchQuery, setSearchQuery] = useState("");
  const [versionFilter, setVersionFilter] = useState<string>("");
  const [moddedFilter, setModdedFilter] = useState<string>("");
  const [authFilter, setAuthFilter] = useState<string>("");

  // Infinite Scroll limit
  const [displayLimit, setDisplayLimit] = useState(12);

  // Favorites state
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set(["mush.com.br"]);
    } catch {
      return new Set(["mush.com.br"]);
    }
  });

  const toggleFavorite = (host: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(host.toLowerCase())) {
        next.delete(host.toLowerCase());
      } else {
        next.add(host.toLowerCase());
      }
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  // Add Custom Server Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customHost, setCustomHost] = useState("");
  const [customPort, setCustomPort] = useState("25565");
  const [customRequiresMicrosoft, setCustomRequiresMicrosoft] = useState(false);
  const [customPreferredInstanceId, setCustomPreferredInstanceId] = useState("");

  const [createInstanceModalOpen, setCreateInstanceModalOpen] = useState(false);
  const [targetServerIdForNewInstance, setTargetServerIdForNewInstance] = useState<string | null>(null);
  const [newInstanceName, setNewInstanceName] = useState("Instância Servidor");
  const [newInstanceVersion, setNewInstanceVersion] = useState("1.20.1");
  const [newInstanceLoader, setNewInstanceLoader] = useState<LoaderType>("fabric");
  const [newInstanceRam, setNewInstanceRam] = useState(4096);
  const [launchingServerId, setLaunchingServerId] = useState<string | null>(null);
  const [inspectServer, setInspectServer] = useState<InspectedServerInfo | null>(null);

  const [selectedInstanceByServerId, setSelectedInstanceByServerId] = useState<Record<string, string>>(() => {
    try {
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(SERVER_INSTANCES_STORAGE_KEY) : null;
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const saveSelectedInstance = (serverIdOrHost: string, instanceId: string, host?: string) => {
    setSelectedInstanceByServerId((prev) => {
      const next = { ...prev, [serverIdOrHost]: instanceId };
      if (host) {
        next[host.toLowerCase()] = instanceId;
      }
      try {
        localStorage.setItem(SERVER_INSTANCES_STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const instancesQuery = useQuery({
    queryKey: ["instances"],
    queryFn: () => launcherApi.listInstances(),
  });

  const versionsQuery = useQuery({
    queryKey: ["minecraft-versions"],
    queryFn: () => launcherApi.listVersions(),
  });

  const customServersQuery = useQuery({
    queryKey: ["custom-servers"],
    queryFn: () => launcherApi.listCustomServers(),
  });

  // REAL-TIME SERVER LIBRARY QUERY (Pulls from ReisHost & Public Server Directory)
  const onlineLibraryQuery = useQuery({
    queryKey: ["online-server-library"],
    queryFn: () => launcherApi.fetchServerLibrary(),
    staleTime: 5 * 60 * 1000,
  });

  const customServers = useMemo(() => customServersQuery.data ?? [], [customServersQuery.data]);
  const instances = instancesQuery.data ?? [];
  const minecraftVersions = versionsQuery.data ?? [];
  const onlineCatalog: LibraryServer[] =
    (onlineLibraryQuery.data && onlineLibraryQuery.data.length > 0)
      ? onlineLibraryQuery.data
      : fallbackCatalog;

  const getSelectedInstanceForServer = (server: {
    id: string;
    host: string;
    preferredInstanceId?: string;
    version?: string;
  }) => {
    const chosenId =
      selectedInstanceByServerId[server.id] ||
      selectedInstanceByServerId[server.host.toLowerCase()] ||
      server.preferredInstanceId;

    if (chosenId && chosenId !== "__create_new__" && instances.some((i) => i.id === chosenId)) {
      return chosenId;
    }

    const compatible = instances.find((i) =>
      server.version ? i.minecraftVersion === server.version : true,
    );
    return compatible?.id || instances[0]?.id || "__create_new__";
  };

  // Create Instance Mutation
  const createInstanceMutation = useMutation({
    mutationFn: () =>
      launcherApi.createInstance({
        name: newInstanceName.trim() || "Nova Instância",
        minecraftVersion: newInstanceVersion,
        loader: newInstanceLoader,
        ramMb: newInstanceRam,
        contentManagementEnabled: true,
      }),
    onSuccess: (createdInstance) => {
      setCreateInstanceModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
      if (targetServerIdForNewInstance) {
        saveSelectedInstance(targetServerIdForNewInstance, createdInstance.id);
      }
    },
  });

  // Hosts list for live status check
  const allHosts = useMemo(() => {
    const list = new Set<string>();
    customServers.forEach((s) => list.add(s.host));
    onlineCatalog.forEach((s) => list.add(s.host));
    defaultCustomServers.forEach((s) => list.add(s.host));
    return Array.from(list);
  }, [customServers, onlineCatalog]);

  const serverStatusesQuery = useQuery({
    queryKey: ["server-statuses", allHosts],
    queryFn: () => launcherApi.getServerStatuses({ hosts: allHosts }),
    refetchInterval: 30000,
  });

  const serverStatusMap = useMemo(() => {
    const map = new Map<string, ServerStatusResult>();
    (serverStatusesQuery.data ?? []).forEach((status) => {
      map.set(status.host.toLowerCase(), status);
    });
    return map;
  }, [serverStatusesQuery.data]);

  const addCustomServerMutation = useMutation({
    mutationFn: (input: AddCustomServerInput) => launcherApi.addCustomServer(input),
    onSuccess: () => {
      setAddModalOpen(false);
      setCustomName("");
      setCustomHost("");
      setCustomPort("25565");
      setCustomRequiresMicrosoft(false);
      setCustomPreferredInstanceId("");
      void queryClient.invalidateQueries({ queryKey: ["custom-servers"] });
    },
  });

  const removeCustomServerMutation = useMutation({
    mutationFn: (id: string) => launcherApi.removeCustomServer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["custom-servers"] });
    },
  });

  const hasMicrosoftAccount =
    session.data?.status === "signed-in" && session.data.account.provider === "microsoft";

  const getInstanceSelectOptions = (): AppSelectOption[] => {
    const opts: AppSelectOption[] = [
      { value: "__create_new__", label: "+ Criar Nova Instância..." },
    ];
    instances.forEach((inst) => {
      opts.push({
        value: inst.id,
        label: `${inst.name} (${inst.minecraftVersion} - ${inst.loader})`,
      });
    });
    return opts;
  };

  const handleInstanceSelectChange = (serverId: string, value: string, serverName?: string, host?: string) => {
    if (value === "__create_new__") {
      setTargetServerIdForNewInstance(serverId);
      setNewInstanceName(`Instância ${serverName || "Servidor"}`);
      setCreateInstanceModalOpen(true);
      return;
    }
    saveSelectedInstance(serverId, value, host);

    const customMatch = customServers.find(
      (c) => c.id === serverId || c.host.toLowerCase() === (host ?? "").toLowerCase(),
    );
    if (customMatch) {
      launcherApi
        .updateCustomServer({
          id: customMatch.id,
          preferredInstanceId: value,
        })
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ["custom-servers"] });
        })
        .catch(() => {});
    }
  };

  const handleLaunchServer = async (server: {
    id: string;
    name: string;
    host: string;
    port?: number;
    requiresMicrosoft?: boolean;
    preferredInstanceId?: string;
    version?: string;
  }) => {
    if (server.requiresMicrosoft && !hasMicrosoftAccount) {
      alert(`${server.name} exige uma conta Microsoft licenciada. Conecte-se com sua conta Microsoft no menu Avatar.`);
      return;
    }

    const targetInstanceId = getSelectedInstanceForServer(server);

    if (!targetInstanceId || targetInstanceId === "__create_new__") {
      setTargetServerIdForNewInstance(server.id);
      setNewInstanceName(`Instância ${server.name}`);
      setCreateInstanceModalOpen(true);
      return;
    }

    setLaunchingServerId(server.id);
    try {
      let cleanHost = server.host.trim();
      let cleanPort = server.port || 25565;

      if (cleanHost.includes(":")) {
        const parts = cleanHost.split(":");
        cleanHost = parts[0]?.trim() || cleanHost;
        const parsedP = parts[1] ? parseInt(parts[1], 10) : NaN;
        if (!isNaN(parsedP)) {
          cleanPort = parsedP;
        }
      }

      const hostLower = cleanHost.toLowerCase();
      if (!customServers.some(s => s.host.toLowerCase() === hostLower) && 
          !defaultCustomServers.some(s => s.host.toLowerCase() === hostLower)) {
         await addCustomServerMutation.mutateAsync({
           name: server.name,
           host: cleanHost,
           port: cleanPort,
           requiresMicrosoft: server.requiresMicrosoft,
           preferredInstanceId: targetInstanceId
         });
      }

      await launcherApi.launch({
        instanceId: targetInstanceId,
        server: {
          name: server.name,
          host: cleanHost,
          port: cleanPort,
          requiresMicrosoft: server.requiresMicrosoft,
        },
      });
    } catch (e) {
      alert(`Falha ao iniciar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLaunchingServerId(null);
    }
  };

  // Combine & Sort "Meus Servidores" (Favorites on TOP)
  const myServersList = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      host: string;
      port: number;
      requiresMicrosoft: boolean;
      preferredInstanceId?: string;
      isCustom: boolean;
    }> = [];

    const seenHosts = new Set<string>();

    customServers.forEach((s) => {
      let host = s.host.trim();
      let port = s.port || 25565;
      if (host.includes(":")) {
        const parts = host.split(":");
        host = parts[0]?.trim() || host;
        const p = parts[1] ? parseInt(parts[1], 10) : NaN;
        if (!isNaN(p)) port = p;
      }
      const hostKey = `${host.toLowerCase()}:${port}`;
      if (!seenHosts.has(hostKey)) {
        seenHosts.add(hostKey);
        list.push({
          id: s.id,
          name: s.name,
          host,
          port,
          requiresMicrosoft: s.requiresMicrosoft,
          preferredInstanceId: s.preferredInstanceId,
          isCustom: true,
        });
      }
    });

    defaultCustomServers.forEach((s) => {
      let host = s.host.trim();
      let port = s.port || 25565;
      if (host.includes(":")) {
        const parts = host.split(":");
        host = parts[0]?.trim() || host;
        const p = parts[1] ? parseInt(parts[1], 10) : NaN;
        if (!isNaN(p)) port = p;
      }
      const hostKey = `${host.toLowerCase()}:${port}`;
      if (!seenHosts.has(hostKey) && !list.some((existing) => existing.host.toLowerCase() === host.toLowerCase())) {
        seenHosts.add(hostKey);
        list.push({
          id: `default-${host}`,
          name: s.name,
          host,
          port,
          requiresMicrosoft: Boolean(s.requiresMicrosoft),
          isCustom: false,
        });
      }
    });

    return list.sort((a, b) => {
      const favA = favorites.has(a.host.toLowerCase()) ? 1 : 0;
      const favB = favorites.has(b.host.toLowerCase()) ? 1 : 0;
      if (favA !== favB) return favB - favA;
      return a.name.localeCompare(b.name);
    });
  }, [customServers, favorites]);

  // Filtered Real-Time Online Library Catalog
  const filteredLibrary = useMemo(() => {
    return onlineCatalog.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesVersion =
        !versionFilter || item.version === versionFilter;

      const matchesModded =
        !moddedFilter ||
        (moddedFilter === "modded" && item.hasMods) ||
        (moddedFilter === "vanilla" && !item.hasMods);

      const matchesAuth =
        !authFilter ||
        (authFilter === "pirate" && item.allowPirate) ||
        (authFilter === "original" && item.requiresMicrosoft);

      return matchesSearch && matchesVersion && matchesModded && matchesAuth;
    });
  }, [onlineCatalog, searchQuery, versionFilter, moddedFilter, authFilter]);

  const visibleLibrary = useMemo(() => {
    return filteredLibrary.slice(0, displayLimit);
  }, [filteredLibrary, displayLimit]);

  const serverIconUrl = (host: string) =>
    `https://api.mcsrvstat.us/icon/${encodeURIComponent(host)}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-[#121824] p-6 shadow-2xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 shadow-lg">
                <ServerIcon className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-wide">Servidores Minecraft</h1>
            </div>
            <p className="mt-2 text-sm text-gray-300">
              Conecte-se em tempo real com centenas de servidores brasileiros e internacionais.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02] hover:from-blue-500 hover:to-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Adicionar Servidor por IP
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("my-servers")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-200 ${
              activeTab === "my-servers"
                ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Layers className="h-4 w-4" />
            Meus Servidores ({myServersList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-200 ${
              activeTab === "library"
                ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Globe className="h-4 w-4" />
            Biblioteca de Servidores ({onlineCatalog.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            void onlineLibraryQuery.refetch();
            void serverStatusesQuery.refetch();
          }}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${(onlineLibraryQuery.isFetching || serverStatusesQuery.isFetching) ? "animate-spin text-blue-400" : ""}`} />
          Sincronizar Tempo Real
        </button>
      </div>

      {/* SUB-TAB 1: MEUS SERVIDORES */}
      {activeTab === "my-servers" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {myServersList.map((server) => {
              const status = serverStatusMap.get(server.host.toLowerCase());
              const isFav = favorites.has(server.host.toLowerCase());
              const selectedInstId = getSelectedInstanceForServer(server);

              return (
                <Card
                  key={server.id}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-[#161b22]/90 p-5 shadow-xl transition hover:border-white/20 ${
                    isFav ? "border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-[#161b22]" : "border-white/10"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={serverIconUrl(server.host)}
                          alt=""
                          className="h-12 w-12 rounded-xl border border-white/10 bg-black/40 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "icon.png";
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">{server.name}</h3>
                            {isFav && (
                              <span className="text-amber-400" title="Servidor Favorito">
                                ★
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-gray-400">
                            {server.port && server.port !== 25565 ? `${server.host}:${server.port}` : server.host}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(server.host)}
                          className={`p-1.5 rounded-lg transition ${
                            isFav
                              ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
                              : "text-gray-500 hover:text-amber-400 hover:bg-white/5"
                          }`}
                          title={isFav ? "Remover dos Favoritos" : "Marcar como Favorito"}
                        >
                          <Star className={`h-4 w-4 ${isFav ? "fill-amber-400" : ""}`} />
                        </button>

                        {server.isCustom && (
                          <button
                            type="button"
                            onClick={() => removeCustomServerMutation.mutate(server.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition"
                            title="Remover Servidor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Status & Online Info */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      {status?.online ? (
                        <>
                          <Badge tone="green" className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Online
                          </Badge>
                          <span className="flex items-center gap-1 text-gray-300">
                            <Users className="h-3 w-3 text-blue-400" />
                            {status.playersOnline ?? 0} / {status.playersMax ?? "?"}
                          </span>
                        </>
                      ) : (
                        <Badge tone="slate" className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                          Offline
                        </Badge>
                      )}

                      {server.requiresMicrosoft ? (
                        <Badge tone="slate" className="text-amber-300 border-amber-500/30 flex items-center gap-1">
                          <Shield className="h-3 w-3" /> Original
                        </Badge>
                      ) : (
                        <Badge tone="blue">Pirata & Original</Badge>
                      )}
                    </div>

                    {status?.motd && (
                      <p className="text-xs text-gray-400 line-clamp-2 italic bg-black/20 p-2 rounded-lg border border-white/5">
                        {status.motd}
                      </p>
                    )}
                  </div>

                  {/* Instance Selector Dropdown */}
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold flex items-center gap-1">
                        <Settings2 className="h-3.5 w-3.5 text-blue-400" /> Instância para Abrir:
                      </label>

                      <AppSelect
                        value={selectedInstId}
                        onChange={(val) => handleInstanceSelectChange(server.id, val, server.name, server.host)}
                        options={getInstanceSelectOptions()}
                        placeholder="Selecione ou Crie uma Instância..."
                        className="w-full h-10 text-xs bg-[#0d1117]/90"
                      />
                    </div>

                    <div className="flex gap-2 w-full">
                      <Button
                        variant="secondary"
                        onClick={() => setInspectServer(server)}
                        className="flex-shrink-0"
                        title="Inspecionar Servidor"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button
                        disabled={launchingServerId === server.id}
                        onClick={() => handleLaunchServer(server)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-white shadow-lg shadow-blue-600/20 py-2.5"
                      >
                        {launchingServerId === server.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Iniciando...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 fill-white mr-2" />
                            Jogar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BIBLIOTECA DE SERVIDORES (TEMPO REAL & INFINITE SCROLL) */}
      {activeTab === "library" && (
        <div className="space-y-5">
          {/* Filters Controls */}
          <Card className="rounded-2xl border border-white/10 bg-[#161b22] p-4 space-y-4 shadow-xl">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar servidor ou IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1117] pl-10 pr-3 text-xs text-white outline-none focus:border-blue-500 transition"
                />
              </div>

              {/* Version Filter */}
              <AppSelect
                value={versionFilter}
                onChange={setVersionFilter}
                placeholder="Todas as Versões"
                options={[
                  { value: "", label: "Todas as Versões" },
                  { value: "1.20.4", label: "Minecraft 1.20.4" },
                  { value: "1.20.1", label: "Minecraft 1.20.1" },
                  { value: "1.16.5", label: "Minecraft 1.16.5" },
                  { value: "1.12.2", label: "Minecraft 1.12.2" },
                  { value: "1.8.9", label: "Minecraft 1.8.9 (PvP)" },
                  { value: "1.5.2", label: "Minecraft 1.5.2 (Raiz)" },
                ]}
                className="h-11 text-xs"
              />

              {/* Modded / Vanilla Filter */}
              <AppSelect
                value={moddedFilter}
                onChange={setModdedFilter}
                placeholder="Todos os Modos"
                options={[
                  { value: "", label: "Todos os Modos (Mods & Vanilla)" },
                  { value: "vanilla", label: "Sem Mods (Vanilla)" },
                  { value: "modded", label: "Com Mods (Modded)" },
                ]}
                className="h-11 text-xs"
              />

              {/* Account Type Filter */}
              <AppSelect
                value={authFilter}
                onChange={setAuthFilter}
                placeholder="Qualquer Autenticação"
                options={[
                  { value: "", label: "Qualquer Autenticação" },
                  { value: "pirate", label: "Pirata (Aceita Não-Licenciado)" },
                  { value: "original", label: "Original (Requer Microsoft)" },
                ]}
                className="h-11 text-xs"
              />
            </div>
          </Card>

          {/* Live Catalog Status Banner */}
          <div className="flex items-center justify-between px-2 text-xs text-gray-400">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Exibindo {visibleLibrary.length} de {filteredLibrary.length} servidores sincronizados em tempo real.
            </span>
            {onlineLibraryQuery.isFetching && (
              <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Puxando do ReisHost...
              </span>
            )}
          </div>

          {/* Grid Catalog */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleLibrary.map((item) => {
              const status = serverStatusMap.get(item.host.toLowerCase());
              const isFav = favorites.has(item.host.toLowerCase());
              const isAlreadyAdded = myServersList.some(
                (s) => s.host.toLowerCase() === item.host.toLowerCase(),
              );

              return (
                <Card
                  key={item.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-[#161b22] p-5 shadow-xl transition hover:border-white/20 ${
                    isFav ? "border-amber-500/30" : "border-white/10"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={serverIconUrl(item.host)}
                          alt=""
                          className="h-12 w-12 rounded-xl border border-white/10 bg-black/40 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "icon.png";
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">{item.name}</h3>
                            {isFav && <span className="text-amber-400">★</span>}
                          </div>
                          <p className="text-xs font-mono text-gray-400">{item.host}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFavorite(item.host)}
                          className={`p-1.5 rounded-lg transition ${
                            isFav
                              ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20"
                              : "text-gray-500 hover:text-amber-400 hover:bg-white/5"
                          }`}
                          title={isFav ? "Remover dos Favoritos" : "Marcar como Favorito"}
                        >
                          <Star className={`h-4 w-4 ${isFav ? "fill-amber-400" : ""}`} />
                        </button>
                        <Badge tone="blue">{item.version}</Badge>
                      </div>
                    </div>

                    <p className="text-xs text-gray-300 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {item.source === "reishost" && (
                        <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                          ReisHost
                        </span>
                      )}
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-white/5"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 text-xs border-t border-white/5">
                      {status?.online ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                          {status.playersOnline ?? item.playersOnline ?? 0} Jogadores
                        </span>
                      ) : (
                        <span className="text-gray-500">Offline</span>
                      )}

                      {item.requiresMicrosoft ? (
                        <span className="text-amber-400 font-medium ml-auto">Original</span>
                      ) : (
                        <span className="text-blue-400 font-medium ml-auto">Pirata & Original</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setInspectServer(item)}
                      className="h-9 w-9 p-0 shrink-0"
                      title="Inspecionar Servidor"
                    >
                      <Info className="h-4 w-4" />
                    </Button>

                    {isAlreadyAdded ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled
                        className="flex-1 h-9 px-2 text-xs whitespace-nowrap opacity-90 cursor-not-allowed border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium"
                      >
                        <Check className="h-3.5 w-3.5 mr-1 shrink-0 text-emerald-400" />
                        Já Adicionado
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={addCustomServerMutation.isPending}
                        onClick={() => {
                          addCustomServerMutation.mutate({
                            name: item.name,
                            host: item.host,
                            port: item.port || 25565,
                            requiresMicrosoft: item.requiresMicrosoft,
                          });
                        }}
                        className="flex-1 h-9 text-xs whitespace-nowrap"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1 shrink-0" />
                        Salvar
                      </Button>
                    )}

                    <Button
                      size="sm"
                      disabled={launchingServerId === item.id}
                      onClick={() => handleLaunchServer(item)}
                      className="flex-1 h-9 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap"
                    >
                      {launchingServerId === item.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 shrink-0" />
                          Iniciando...
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 mr-1 fill-white shrink-0" />
                          Entrar
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* INFINITE SCROLL / LOAD MORE BUTTON */}
          {visibleLibrary.length < filteredLibrary.length && (
            <div className="flex justify-center pt-6">
              <Button
                onClick={() => setDisplayLimit((prev) => prev + 12)}
                className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-6 py-3 text-sm font-semibold text-white border border-white/10 shadow-lg transition"
              >
                <ChevronDown className="h-4 w-4" />
                Carregar Mais Servidores ({filteredLibrary.length - visibleLibrary.length} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CRIAR NOVA INSTÂNCIA RAPIDAMENTE */}
      {createInstanceModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161b22] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-400" />
                Criar Nova Instância
              </h3>
              <button
                type="button"
                onClick={() => setCreateInstanceModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-medium mb-1">Nome da Instância</label>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-[#0d1117] px-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">Versão do Minecraft</label>
                <AppSelect
                  value={newInstanceVersion}
                  onChange={setNewInstanceVersion}
                  placeholder="Selecione a Versão"
                  options={minecraftVersions.map((v) => ({
                    value: v.id,
                    label: `Minecraft ${v.id} (${v.type})`,
                  }))}
                  className="w-full h-10 text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">ModLoader (Motor)</label>
                <AppSelect
                  value={newInstanceLoader}
                  onChange={(val) => setNewInstanceLoader(val as LoaderType)}
                  placeholder="Selecione o Loader"
                  options={[
                    { value: "vanilla", label: "Vanilla (Sem mods)" },
                    { value: "fabric", label: "Fabric (Leve & Mods)" },
                    { value: "iris-sodium", label: "Iris + Sodium (Alta Performance & Shaders)" },
                    { value: "forge", label: "Forge (Modpacks Tradicionais)" },
                    { value: "neoforge", label: "NeoForge (Modern Forge)" },
                    { value: "quilt", label: "Quilt" },
                  ]}
                  className="w-full h-10 text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  Memória RAM Alocada: {(newInstanceRam / 1024).toFixed(1)} GB ({newInstanceRam} MB)
                </label>
                <input
                  type="range"
                  min={2048}
                  max={16384}
                  step={1024}
                  value={newInstanceRam}
                  onChange={(e) => setNewInstanceRam(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button variant="secondary" onClick={() => setCreateInstanceModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!newInstanceName.trim() || createInstanceMutation.isPending}
                onClick={() => createInstanceMutation.mutate()}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                {createInstanceMutation.isPending ? "Criando..." : "Criar e Selecionar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSPECIONAR SERVIDOR */}
      {inspectServer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#161b22] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-400" />
                Inspecionar Servidor
              </h3>
              <button
                type="button"
                onClick={() => setInspectServer(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-start gap-4">
              <img
                src={serverIconUrl(inspectServer.host)}
                alt=""
                className="h-20 w-20 rounded-xl border border-white/10 bg-black/40 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "icon.png";
                }}
              />
              <div className="space-y-1 flex-1">
                <h2 className="text-xl font-bold text-white">{inspectServer.name}</h2>
                <p className="text-sm font-mono text-blue-400">{inspectServer.host}{inspectServer.port && inspectServer.port !== 25565 ? `:${inspectServer.port}` : ""}</p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Badge tone="blue">Versão: {inspectServer.version || "Diversas/Qualquer"}</Badge>
                  {inspectServer.requiresMicrosoft ? (
                    <Badge tone="slate" className="text-amber-400 border-amber-500/30">Original (Premium)</Badge>
                  ) : (
                    <Badge tone="slate" className="text-emerald-400 border-emerald-500/30">Pirata & Original</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-300">
              <div className="bg-[#0d1117] rounded-xl p-4 border border-white/5">
                <h4 className="font-semibold text-white mb-2">Descrição</h4>
                <p className="leading-relaxed text-xs">
                  {inspectServer.description || "Nenhuma descrição detalhada disponível."}
                </p>
              </div>

              {inspectServer.tags && inspectServer.tags.length > 0 && (
                <div>
                  <h4 className="font-semibold text-white mb-2">Tags / Categorias</h4>
                  <div className="flex flex-wrap gap-2">
                    {inspectServer.tags.map((tag: string) => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-gray-400">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {serverStatusMap.has(inspectServer.host.toLowerCase()) && (
                <div className="border-t border-white/10 pt-4">
                  <h4 className="font-semibold text-white mb-2">Status em Tempo Real</h4>
                  {serverStatusMap.get(inspectServer.host.toLowerCase())?.online ? (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400 font-medium">Online</span>
                      <span className="text-gray-400 ml-2">
                        {serverStatusMap.get(inspectServer.host.toLowerCase())?.playersOnline ?? 0} jogadores conectados
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      <span className="text-red-400 font-medium">Offline</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
              <Button onClick={() => setInspectServer(null)} className="bg-white/10 hover:bg-white/20 text-white">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR SERVIDOR CUSTOMIZADO */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161b22] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-400" />
                Adicionar Servidor
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-medium mb-1">Nome do Servidor (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Meu Servidor Survival"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-[#0d1117] px-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">IP / Domínio do Servidor (*)</label>
                <input
                  type="text"
                  placeholder="Ex: jogar.mush.com.br ou 192.168.1.10"
                  value={customHost}
                  onChange={(e) => setCustomHost(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-[#0d1117] px-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">Porta (Padrão: 25565)</label>
                <input
                  type="number"
                  placeholder="25565"
                  value={customPort}
                  onChange={(e) => setCustomPort(e.target.value)}
                  className="w-full h-10 rounded-xl border border-white/10 bg-[#0d1117] px-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">Instância Preferida</label>
                <AppSelect
                  value={customPreferredInstanceId}
                  onChange={setCustomPreferredInstanceId}
                  placeholder="Selecione uma Instância..."
                  options={[
                    { value: "", label: "Nenhuma (Auto-selecionar)" },
                    ...instances.map((inst) => ({
                      value: inst.id,
                      label: `${inst.name} (${inst.minecraftVersion})`,
                    })),
                  ]}
                  className="w-full h-10 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="req-microsoft"
                  checked={customRequiresMicrosoft}
                  onChange={(e) => setCustomRequiresMicrosoft(e.target.checked)}
                  className="h-4 w-4 accent-blue-500"
                />
                <label htmlFor="req-microsoft" className="text-gray-300 select-none">
                  Exige conta Original (Microsoft)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={!customHost.trim() || addCustomServerMutation.isPending}
                onClick={() => {
                  let cleanHost = customHost.trim();
                  let cleanPort = Number(customPort) || 25565;

                  if (cleanHost.includes(":")) {
                    const parts = cleanHost.split(":");
                    cleanHost = parts[0]?.trim() || cleanHost;
                    const parsedP = parts[1] ? parseInt(parts[1], 10) : NaN;
                    if (!isNaN(parsedP)) {
                      cleanPort = parsedP;
                    }
                  }

                  if (!cleanHost) return;

                  addCustomServerMutation.mutate({
                    name: customName.trim() || cleanHost,
                    host: cleanHost,
                    port: cleanPort,
                    requiresMicrosoft: customRequiresMicrosoft,
                    preferredInstanceId: customPreferredInstanceId || undefined,
                  });
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                Salvar Servidor
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
