import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  FolderOpen,
  Layers,
  Loader2,
  Palette,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  Zap,
} from "lucide-react";
import React, { useMemo, useState, useEffect } from "react";
import { LaunchErrorNotice } from "../launcher/LaunchErrorNotice";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useInstances } from "../../hooks/useInstances";
import { useRunningInstances } from "../../hooks/useRunningInstances";
import { launcherApi } from "../../services/launcherApi";
import type {
  CrashReportDetails,
  LaunchEvent,
} from "../../types/launcher";

const PVP_VERSION = "1.8.9";
const PVP_LOADER = "forge";
const PVP_LOADER_VERSION = "11.15.0.1656";
const PVP_INSTANCE_NAME = "MLUltimate PvP 1.8.9";
const PVP_INSTANCE_ID = "mlultimate-pvp-1.8.9";

type PvpSubTab = "servers" | "textures";

type PvpServer = {
  id: string;
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
  badge?: string;
};

const serverIconUrl = (host: string) =>
  `https://api.mcstatus.io/v2/icon/${encodeURIComponent(host)}`;

const pvpServers: PvpServer[] = [
  {
    id: "mush",
    name: "Mush MC",
    host: "mush.com.br",
    imageUrl: serverIconUrl("mush.com.br"),
    region: "Brasil",
    description: "O maior servidor de PvP e Minigames do Brasil! BedWars, SkyWars, HG e Duels.",
    mode: "PvP BR",
    category: "PvP",
    features: ["BedWars", "Duels", "HG", "RankUP", "Pirata"],
    requiresMicrosoft: false,
    accent: "from-emerald-500/30 to-blue-600/10",
    badge: "MAIS JOGADO BR",
  },
  {
    id: "redesky",
    name: "Rede Sky",
    host: "redesky.net",
    imageUrl: serverIconUrl("redesky.net"),
    region: "Brasil",
    description: "Servidor clássico brasileiro de SkyWars, Duels, RankUP e Minigames variados.",
    mode: "Rede BR",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "HG", "Duels", "Pirata"],
    requiresMicrosoft: false,
    accent: "from-sky-500/30 to-indigo-600/10",
  },
  {
    id: "hypixel",
    name: "Hypixel Network",
    host: "mc.hypixel.net",
    imageUrl: serverIconUrl("mc.hypixel.net"),
    region: "Global",
    description: "O maior servidor de Minecraft do mundo! BedWars, SkyWars, Duels e SkyBlock.",
    mode: "Original",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "Duels", "SkyBlock", "Original"],
    requiresMicrosoft: true,
    accent: "from-amber-500/30 to-orange-600/10",
    badge: "GLOBAL TOP #1",
  },
  {
    id: "minemen",
    name: "Minemen Club",
    host: "minemen.club",
    imageUrl: serverIconUrl("minemen.club"),
    region: "Global",
    description: "Servidor mais famoso de Practice PvP, Ranked Duels, Boxing e Knockback perfeito.",
    mode: "Practice",
    category: "PvP",
    features: ["Ranked", "Boxing", "BuildUHC", "Duels", "Original"],
    requiresMicrosoft: true,
    accent: "from-red-500/30 to-pink-600/10",
    badge: "PRACTICE PRO",
  },
  {
    id: "pvplegacy",
    name: "PvP Legacy",
    host: "play.pvplegacy.net",
    imageUrl: serverIconUrl("play.pvplegacy.net"),
    region: "Global",
    description: "Duels e kits customizados para treinar combate e mirar cliques com precisão.",
    mode: "Duels",
    category: "PvP",
    features: ["Duels", "Kits", "Practice", "Custom PvP"],
    requiresMicrosoft: true,
    accent: "from-purple-500/30 to-blue-600/10",
  },
  {
    id: "blocksmc",
    name: "BlocksMC",
    host: "blocksmc.com",
    imageUrl: serverIconUrl("blocksmc.com"),
    region: "Global",
    description: "BedWars, SkyWars, Lucky Blocks e partidas rápidas para aquecer sem original.",
    mode: "Minigames",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "Lucky Blocks", "Pirata"],
    requiresMicrosoft: false,
    accent: "from-cyan-500/30 to-slate-600/10",
  },
  {
    id: "universocraft",
    name: "UniversoCraft",
    host: "mc.universocraft.com",
    imageUrl: serverIconUrl("mc.universocraft.com"),
    region: "América Latina",
    description: "Rede hispânica gigantesca com BedWars, SkyWars e dezenas de modos de jogo.",
    mode: "Rede",
    category: "Minigames",
    features: ["BedWars", "SkyWars", "BuildBattle", "Pirata"],
    requiresMicrosoft: false,
    accent: "from-blue-500/30 to-violet-600/10",
  },
  {
    id: "pikanetwork",
    name: "PikaNetwork",
    host: "play.pika-network.net",
    imageUrl: serverIconUrl("play.pika-network.net"),
    region: "Global",
    description: "Rede internacional com BedWars, Practice, SkyWars e modos competitivos.",
    mode: "Rede",
    category: "Minigames",
    features: ["BedWars", "Practice", "SkyWars", "Pirata"],
    requiresMicrosoft: false,
    accent: "from-yellow-500/30 to-red-600/10",
  },
  {
    id: "craftlandia",
    name: "CraftLandia Farewell",
    host: "jogar.craftlandia.com.br",
    imageUrl: serverIconUrl("jogar.craftlandia.com.br"),
    region: "Brasil",
    description: "O servidor de Survival e PvP raiz mais clássico da comunidade brasileira.",
    mode: "Survival",
    category: "Economia",
    features: ["Survival", "Gladiador", "Clans", "Pirata"],
    requiresMicrosoft: false,
    accent: "from-lime-500/30 to-emerald-600/10",
  },
  {
    id: "hoplite",
    name: "Hoplite UHC",
    host: "hoplite.gg",
    imageUrl: serverIconUrl("hoplite.gg"),
    region: "Global",
    description: "Battle Royale competitivo e modos intensos de combate e UHC.",
    mode: "UHC",
    category: "Competitivo",
    features: ["Battle Royale", "UHC", "Teams", "Original"],
    requiresMicrosoft: true,
    accent: "from-amber-500/30 to-slate-600/10",
  },
];

export const PvpAreaView: React.FC = () => {
  const queryClient = useQueryClient();
  const { session, loginMicrosoft } = useAuthSession();
  const { instances } = useInstances();
  const runningInstances = useRunningInstances();

  const [activeSubTab, setActiveSubTab] = useState<PvpSubTab>("servers");
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchErrorLog, setLaunchErrorLog] = useState<string | null>(null);
  const [activeCrashReport, setActiveCrashReport] = useState<CrashReportDetails | null>(null);
  const [launchEvent, setLaunchEvent] = useState<LaunchEvent | null>(null);
  const [serverSearchQuery, setServerSearchQuery] = useState("");
  const [serverFilterMode, setServerFilterMode] = useState<"all" | "br" | "global" | "cracked">("all");

  const account = session.data?.status === "signed-in" ? session.data.account : null;
  const hasMicrosoft = account?.provider === "microsoft" && account.license.status === "verified";

  // Find 1.8.9 dedicated PvP instance
  const pvpInstance = useMemo(
    () =>
      (instances.data ?? []).find((inst) => inst.id === PVP_INSTANCE_ID) ??
      (instances.data ?? []).find(
        (inst) =>
          inst.minecraftVersion === PVP_VERSION &&
          inst.loader === "forge" &&
          inst.name.toLowerCase().includes("pvp"),
      ) ??
      (instances.data ?? []).find(
        (inst) =>
          inst.minecraftVersion === PVP_VERSION &&
          inst.name.toLowerCase().includes("pvp"),
      ),
    [instances.data],
  );

  const pvpIsRunning = Boolean(pvpInstance && runningInstances.isRunning(pvpInstance.id));

  // Server Statuses Query
  const serverHosts = useMemo(
    () => Array.from(new Set(pvpServers.map((s) => s.host))),
    [],
  );

  const serverStatuses = useQuery({
    queryKey: ["pvp", "servers", "status", serverHosts],
    queryFn: () => launcherApi.getServerStatuses({ hosts: serverHosts }),
    refetchInterval: 45_000,
    staleTime: 20_000,
  });

  const serverStatusByHost = useMemo(
    () => new Map((serverStatuses.data ?? []).map((status) => [status.host.toLowerCase(), status])),
    [serverStatuses.data],
  );

  // Launch event listener
  useEffect(() => {
    if (!pvpInstance) return undefined;

    return launcherApi.onLaunchEvent((event) => {
      if (event.id !== pvpInstance.id) return;
      setLaunchEvent(event);

      if (event.type === "error") {
        setActiveCrashReport(event.crashReport ?? null);
        setLaunchErrorLog(event.message);
      }

      if (["complete", "cancelled", "closed", "killed"].includes(event.type)) {
        window.setTimeout(() => {
          setLaunchEvent(null);
        }, 2000);
      }
    });
  }, [pvpInstance]);

  const createOrSetupPvPClient = async () => {
    setSetupError(null);
    setLaunchError(null);
    setSetupStatus("Preparando Cliente PvP 1.8.9 Customizado...");

    try {
      if (!pvpInstance) {
        await launcherApi.createInstance({
          name: PVP_INSTANCE_NAME,
          minecraftVersion: PVP_VERSION,
          loader: PVP_LOADER,
          loaderVersion: PVP_LOADER_VERSION,
          ramMb: 4096,
          contentManagementEnabled: true,
        });
        await queryClient.invalidateQueries({ queryKey: ["instances"] });
      }

      setSetupStatus("Cliente 1.8.9 Customizado pronto!");
      setTimeout(() => setSetupStatus(null), 3000);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Falha ao preparar cliente PvP.");
      setSetupStatus(null);
    }
  };

  const launchPvPClient = async (server?: { name: string; host: string; port?: number; requiresMicrosoft?: boolean }) => {
    setLaunchError(null);
    setLaunchErrorLog(null);
    setActiveCrashReport(null);

    let targetInstance = pvpInstance;

    if (!targetInstance) {
      try {
        setSetupStatus("Inicializando Perfil 1.8.9 Customizado...");
        targetInstance = await launcherApi.createInstance({
          name: PVP_INSTANCE_NAME,
          minecraftVersion: PVP_VERSION,
          loader: PVP_LOADER,
          loaderVersion: PVP_LOADER_VERSION,
          ramMb: 4096,
          contentManagementEnabled: true,
        });
        await queryClient.invalidateQueries({ queryKey: ["instances"] });
      } catch {
        setLaunchError("Não foi possível criar o perfil PvP automaticamente.");
        return;
      }
    }

    if (server?.requiresMicrosoft && !hasMicrosoft) {
      setLaunchError(`${server.name} exige uma conta Microsoft licenciada.`);
      return;
    }

    try {
      await launcherApi.launch({
        instanceId: targetInstance.id,
        server: server
          ? {
              name: server.name,
              host: server.host,
              port: server.port || 25565,
              requiresMicrosoft: server.requiresMicrosoft,
            }
          : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao iniciar o Minecraft.";
      if (message.startsWith("INSTANCE_ALREADY_RUNNING")) {
        setLaunchError("O Cliente PvP já está em execução.");
        return;
      }
      setLaunchErrorLog(message);
    }
  };

  const handleOpenFolder = async () => {
    if (!pvpInstance) {
      await createOrSetupPvPClient();
    }
    const inst = pvpInstance;
    if (inst) {
      try {
        await launcherApi.openInstanceFolder(inst.id);
      } catch (err) {
        console.warn("Falha ao abrir pasta da instância:", err);
      }
    }
  };

  const filteredServers = useMemo(() => {
    let list = pvpServers;
    if (serverFilterMode === "br") {
      list = list.filter((s) => s.region === "Brasil");
    } else if (serverFilterMode === "global") {
      list = list.filter((s) => s.region !== "Brasil");
    } else if (serverFilterMode === "cracked") {
      list = list.filter((s) => !s.requiresMicrosoft);
    }

    if (!serverSearchQuery.trim()) return list;

    const q = serverSearchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        s.features.some((f) => f.toLowerCase().includes(q)) ||
        s.description.toLowerCase().includes(q),
    );
  }, [serverFilterMode, serverSearchQuery]);

  const isSettingUp = Boolean(setupStatus?.startsWith("Preparando") || setupStatus?.startsWith("Inicializando") || setupStatus?.startsWith("Instalando"));

  return (
    <div className="space-y-6 pb-12">
      {/* PVP CLIENT HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-[#0c121e]/90 p-6 md:p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
        {/* Ambient Glow */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-cyan-500/15 blur-[100px]" />
        <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px]" />

        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          {/* Left Column: Title, Badges & Play Button */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300 shadow-sm shadow-cyan-500/20">
                <Swords className="h-3.5 w-3.5 text-cyan-400" />
                MLUltimate PvP 1.8.9
              </span>
              <span className="flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase text-amber-300">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                OptiFine HD U M5 Integrado
              </span>
              <Badge tone={hasMicrosoft ? "green" : "blue"}>
                {hasMicrosoft ? "Microsoft Oficial" : "Modo Pirata & Offline"}
              </Badge>
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
                PVP Launcher Hub
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-300 hidden sm:inline-block">
                  Mod Oficial Integrado
                </span>
              </h1>
              <p className="mt-1 text-sm text-gray-300">
                Instância de alta performance com OptiFine, HUD customizável em jogo e compatibilidade total com os principais servidores competitivos.
              </p>
            </div>

            {/* Main Action Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                disabled={pvpIsRunning || isSettingUp}
                onClick={() => launchPvPClient()}
                className="relative flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-cyan-500/25 transition duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-indigo-500 active:scale-[0.98]"
              >
                {pvpIsRunning ? (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                    </span>
                    Jogando 1.8.9 PvP...
                  </>
                ) : isSettingUp ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Iniciando PvP...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-white" />
                    JOGAR 1.8.9 PVP
                  </>
                )}
              </Button>

              {pvpInstance && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleOpenFolder}
                  className="rounded-2xl border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white transition"
                >
                  <FolderOpen className="h-4 w-4 mr-2 text-cyan-400" />
                  Abrir Pasta do Jogo
                </Button>
              )}

              {!pvpInstance && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={createOrSetupPvPClient}
                  disabled={isSettingUp}
                  className="rounded-2xl border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Criar Perfil Custom
                </Button>
              )}

              {!hasMicrosoft && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => loginMicrosoft.mutate()}
                  disabled={loginMicrosoft.isPending}
                  className="rounded-2xl border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Login Original
                </Button>
              )}
            </div>
          </div>

          {/* Right Column: Feature Highlights */}
          <div className="grid gap-3">
            <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-black/30 p-3.5 backdrop-blur-md transition hover:border-cyan-500/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400">
                <Zap className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">OptiFine HD U M5 Ativo</h4>
                <p className="text-[11px] text-gray-400 leading-snug">+FPS, Shaders, Fast Render e estabilidade total.</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-black/30 p-3.5 backdrop-blur-md transition hover:border-cyan-500/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-400">
                <Swords className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Editor de HUD em Jogo</h4>
                <p className="text-[11px] text-gray-400 leading-snug">Pressione <kbd className="px-1 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[10px]">H</kbd> ou <kbd className="px-1 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[10px]">RSHIFT</kbd> para mover elementos e configurar cores.</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-black/30 p-3.5 backdrop-blur-md transition hover:border-cyan-500/30">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                <Server className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Servidores Competitivos</h4>
                <p className="text-[11px] text-gray-400 leading-snug">Conecte direto em 1 clique para Mush, Rede Sky, Hypixel e Minemen.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notices & Setup Messages */}
        {(setupStatus || setupError || launchError || launchErrorLog || launchEvent) && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            {setupStatus && (
              <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-200">
                <RefreshCw className="h-4 w-4 animate-spin shrink-0 text-cyan-400" />
                <span>{setupStatus}</span>
              </div>
            )}
            {setupError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{setupError}</span>
              </div>
            )}
            {launchError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{launchError}</span>
              </div>
            )}
            {launchErrorLog && (
              <LaunchErrorNotice
                log={launchErrorLog}
                crashReport={activeCrashReport ?? undefined}
                instanceId={pvpInstance?.id}
                onClear={() => {
                  setLaunchErrorLog(null);
                  setActiveCrashReport(null);
                  setLaunchError(null);
                }}
              />
            )}
            {launchEvent && ["step", "console", "security"].includes(launchEvent.type) && (
              <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs text-blue-200">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
                  <span>{launchEvent.message}</span>
                </div>
                <Button size="sm" variant="danger" onClick={() => launcherApi.cancel({ instanceId: pvpInstance?.id })}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("servers")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeSubTab === "servers"
                ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 shadow-md shadow-cyan-500/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Server className="h-4 w-4" />
            Servidores PvP ({pvpServers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("textures")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeSubTab === "textures"
                ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 shadow-md shadow-cyan-500/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Palette className="h-4 w-4" />
            Texturas & Cosméticos
            <span className="rounded-md bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-cyan-300 ring-1 ring-cyan-500/30">
              Em Breve
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => void serverStatuses.refetch()}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-cyan-300 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${serverStatuses.isFetching ? "animate-spin text-cyan-400" : ""}`} />
          Atualizar Ping ao Vivo
        </button>
      </div>

      {/* SUB-TAB 1: SERVIDORES PVP */}
      {activeSubTab === "servers" && (
        <div className="space-y-5">
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#161b22]/90 p-4 shadow-xl">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar servidor PvP (Mush, BedWars, Practice, Hypixel)..."
                value={serverSearchQuery}
                onChange={(e) => setServerSearchQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0d1117] pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500 transition"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {([
                { id: "all", label: "Todos" },
                { id: "br", label: "🇧🇷 Brasil" },
                { id: "global", label: "🌎 Internacionais" },
                { id: "cracked", label: "Pirata / Offline" },
              ] as const).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setServerFilterMode(f.id)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    serverFilterMode === f.id
                      ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Servers Grid */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredServers.map((server) => {
              const status = serverStatusByHost.get(server.host.toLowerCase());
              return (
                <Card
                  key={server.id}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#161b22]/95 p-5 shadow-xl transition duration-200 hover:border-cyan-500/40 hover:shadow-cyan-500/5"
                >
                  <div className="space-y-3">
                    {/* Header with Icon, Name and Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={server.imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-xl border border-white/10 bg-black/40 object-cover shadow-md"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "icon.png";
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base">{server.name}</h3>
                            {server.badge && (
                              <span className="rounded-md bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-cyan-300 ring-1 ring-cyan-500/30">
                                {server.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-gray-400">{server.host}</p>
                        </div>
                      </div>

                      <Badge tone={server.requiresMicrosoft ? "slate" : "blue"}>
                        {server.requiresMicrosoft ? "Original" : "Pirata"}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                      {server.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {server.features.map((f) => (
                        <span
                          key={f}
                          className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-white/5"
                        >
                          {f}
                        </span>
                      ))}
                    </div>

                    {/* Status & Player Count */}
                    <div className="flex items-center justify-between rounded-xl bg-black/30 p-2.5 border border-white/5 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            status?.online ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" : "bg-gray-500"
                          }`}
                        />
                        <span className={status?.online ? "font-semibold text-emerald-400" : "text-gray-400"}>
                          {status?.online ? "Online" : "Offline"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-gray-300 font-mono">
                        <Users className="h-3.5 w-3.5 text-cyan-400" />
                        <span>
                          {status?.playersOnline !== undefined
                            ? new Intl.NumberFormat("pt-BR").format(status.playersOnline)
                            : "..."}
                          <span className="text-gray-500">
                            /{status?.playersMax !== undefined ? new Intl.NumberFormat("pt-BR").format(status.playersMax) : "?"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connect Direct Button */}
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <Button
                      onClick={() => launchPvPClient(server)}
                      disabled={pvpIsRunning}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white shadow-md shadow-cyan-600/20 py-2.5 hover:from-cyan-500 hover:to-blue-500 transition"
                    >
                      <Play className="h-4 w-4 fill-white" />
                      Conectar Direto (1.8.9)
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TEXTURAS & COSMÉTICOS (EM BREVE...) */}
      {activeSubTab === "textures" && (
        <div className="space-y-6">
          {/* Main Coming Soon Showcase Card */}
          <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-[#121927]/95 via-[#0d1420]/90 to-[#101622]/95 p-8 md:p-10 shadow-2xl text-center backdrop-blur-xl">
            <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[100px]" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/20">
                <Palette className="h-8 w-8" />
              </div>

              <div>
                <span className="inline-block rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30 mb-2">
                  Em Desenvolvimento
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Texturas & Cosméticos Oficiais
                </h2>
                <p className="mt-2 text-sm text-gray-300 leading-relaxed">
                  Em breve você poderá navegar, visualizar e instalar os melhores Resource Packs de PvP (16x, 32x, Faithful, FPS Boost) e cosméticos exclusivos diretamente pelo launcher com apenas 1 clique!
                </p>
              </div>

              {pvpInstance && (
                <div className="pt-2">
                  <Button
                    variant="secondary"
                    onClick={handleOpenFolder}
                    className="rounded-2xl border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/50 transition"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Abrir Pasta de Resource Packs da Instância
                  </Button>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Você já pode colocar qualquer pacote .zip na pasta resourcepacks para usar no jogo agora mesmo.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Feature Teasers */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-2xl border border-white/10 bg-[#161b22]/90 p-6 shadow-xl space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Texture Packs PvP Otimizados</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Seleção com espadas curtas, partículas limpas, minérios destacados e céus estelares leves para máxima taxa de quadros e visibilidade em duelos.
              </p>
            </Card>

            <Card className="rounded-2xl border border-white/10 bg-[#161b22]/90 p-6 shadow-xl space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Cosméticos 3D MLUltimate</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Capas animadas, asas e bandanas exclusivas para se destacar nos servidores competitivos com personalização de cores em tempo real.
              </p>
            </Card>

            <Card className="rounded-2xl border border-white/10 bg-[#161b22]/90 p-6 shadow-xl space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Download className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Instalação com 1 Clique</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Integração direta com o Modrinth e CurseForge para você baixar e ativar texturas sem precisar sair do launcher ou descompactar arquivos manuais.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
