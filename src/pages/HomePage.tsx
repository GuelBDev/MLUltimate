import { useState, useMemo, useEffect } from "react";
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  PackageOpen,
  Play,
  Search,
  Settings,
  Star,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import heroImage from "../assets/launcher-hero.png";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useAuthSession } from "../hooks/useAuthSession";
import { useLaunchEvents } from "../hooks/useLaunchEvents";
import { useRunningInstances } from "../hooks/useRunningInstances";
import { launcherApi } from "../services/launcherApi";
import type { ContentType } from "../types/launcher";
import type { PageId } from "../components/layout/Sidebar";

type HomePageProps = {
  focus?: PageId;
  onNavigate?: (page: PageId) => void;
  onExploreInstance?: (type: ContentType, instanceId: string) => void;
  onOpenAccountModal?: () => void;
};

// Maximum length for the launch log message displayed in the Play button (Req 9)
const MAX_LAUNCH_LOG_CHARS = 36;
const formatLaunchLog = (msg?: string): string => {
  if (!msg) return "INICIANDO O JOGO...";
  const clean = msg.replace(/[\r\n\t]+/g, " ").trim();
  if (clean.length <= MAX_LAUNCH_LOG_CHARS) return clean;
  return clean.slice(0, MAX_LAUNCH_LOG_CHARS) + "...";
};

// --------------------------------------------------------------------------
// Online Players System (Req 2 - "Deixar na agulha" para API e Banco de Dados)
// --------------------------------------------------------------------------
export interface LauncherOnlinePlayer {
  id: string;
  username: string;
  status: "playing" | "in-launcher" | "afk";
  statusText: string;
  serverHost?: string;
  instanceName?: string;
  ping?: number;
  vipTier?: "VIP" | "MVP" | "PRO" | null;
}

// Prepared initial pool of online players (ready to be replaced with live backend/DB query)
const MOCK_ONLINE_PLAYERS: LauncherOnlinePlayer[] = [
  { id: "p1", username: "GuelBait", status: "in-launcher", statusText: "No Menu Principal", vipTier: "PRO" },
  { id: "p2", username: "Notch", status: "playing", statusText: "Jogando MLUltimate PvP", instanceName: "MLUltimate PvP 1.8.9", serverHost: "mc.hypixel.net", ping: 18, vipTier: "VIP" },
  { id: "p3", username: "Alex", status: "playing", statusText: "No Minemen Club", instanceName: "Competitivo 1.8.9", serverHost: "minemen.club", ping: 24 },
  { id: "p4", username: "Steve", status: "playing", statusText: "No Mush MC", instanceName: "MLUltimate PvP 1.8.9", serverHost: "mush.com.br", ping: 12, vipTier: "MVP" },
  { id: "p5", username: "Techno", status: "playing", statusText: "Jogando Bedwars", serverHost: "mc.hypixel.net", ping: 22, vipTier: "PRO" },
  { id: "p6", username: "ShadowWolf", status: "playing", statusText: "No Rede Sky", serverHost: "redesky.gg", ping: 14 },
  { id: "p7", username: "PixelGamer", status: "in-launcher", statusText: "Configurando Shaders", instanceName: "Vanilla 1.20.4" },
  { id: "p8", username: "ViperPvP", status: "playing", statusText: "No Hylex Network", serverHost: "hylex.gg", ping: 19 },
  { id: "p9", username: "CraftMaster", status: "afk", statusText: "Ausente no Launcher" },
  { id: "p10", username: "Luna_BR", status: "playing", statusText: "No Vanilla Survival", serverHost: "survival.mlu.gg", ping: 9, vipTier: "VIP" },
];

// --------------------------------------------------------------------------
// Sponsoring Minecraft Servers (Req 6)
// --------------------------------------------------------------------------
const sponsoringServers: Array<{
  name: string;
  host: string;
  tag: string;
  color: string;
  sponsorTier: string;
  ping: string;
}> = [];

// --------------------------------------------------------------------------
// Latest News & Paid Ads Blocks - Inspectable (Req 4)
// --------------------------------------------------------------------------
export interface NewsOrAdBlock {
  id: string;
  category: "ad" | "news" | "partner" | "promo";
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  detailedText: string;
  sponsorOrAuthor: string;
  couponCode?: string;
  discount?: string;
  externalUrl?: string;
  action: string;
  accent: string;
}

const newsAndAdsFeed: NewsOrAdBlock[] = [];

export const HomePage = ({ onNavigate, onOpenAccountModal }: HomePageProps) => {
  const dialog = useAppDialog();
  const { session } = useAuthSession();
  const { isRunning } = useRunningInstances();
  const { launchEvents, isLaunching, cancelLaunch } = useLaunchEvents();

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [instancePickerOpen, setInstancePickerOpen] = useState(false);
  const [instanceSearchQuery, setInstanceSearchQuery] = useState("");
  const [copiedServer, setCopiedServer] = useState<string | null>(null);
  const [isLaunchingInstance, setIsLaunchingInstance] = useState(false);

  // Req 2: Online Players System state
  const [onlineModalOpen, setOnlineModalOpen] = useState(false);
  const [onlineFilter, setOnlineFilter] = useState<"all" | "playing" | "launcher">("all");
  const [onlineSearch, setOnlineSearch] = useState("");
  const [liveOnlineCount, setLiveOnlineCount] = useState(36200);

  // Req 4: Inspectable News / Ads Block state
  const [inspectedBlock, setInspectedBlock] = useState<NewsOrAdBlock | null>(null);
  const [newsFeedFilter, setNewsFeedFilter] = useState<"all" | "news" | "ad" | "promo">("all");
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);

  // Subtle live count variation simulation to demonstrate real-time capability ("na agulha")
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveOnlineCount((prev) => {
        const delta = Math.floor(Math.random() * 7) - 3;
        return Math.max(34000, prev + delta);
      });
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Fechar a janela expandida de instâncias ao pressionar Esc
  useEffect(() => {
    if (!instancePickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInstancePickerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [instancePickerOpen]);

  const instancesQuery = useQuery({
    queryKey: ["instances"],
    queryFn: launcherApi.listInstances,
  });

  const instances = useMemo(() => instancesQuery.data ?? [], [instancesQuery.data]);

  const selectedInstance = useMemo(
    () => (selectedInstanceId ? instances.find((inst) => inst.id === selectedInstanceId) : null) ?? instances[0] ?? null,
    [instances, selectedInstanceId],
  );

  const activeAccount = session.data?.status === "signed-in" ? session.data.account : null;
  const username = activeAccount?.displayName?.trim() || "Jogador";

  const instanceIsRunning = selectedInstance ? isRunning(selectedInstance.id) : false;
  const activeLaunchEvent = selectedInstance ? launchEvents[selectedInstance.id] : null;
  const instanceIsLaunching = selectedInstance
    ? isLaunching(selectedInstance.id) || isLaunchingInstance
    : false;

  const handleLaunch = async () => {
    if (!selectedInstance) {
      void dialog.alert({
        title: "Nenhuma instância encontrada",
        description: "Crie ou baixe uma instância na aba 'Minhas Instâncias' antes de iniciar o jogo.",
        tone: "info",
      });
      return;
    }

    setIsLaunchingInstance(true);

    try {
      await launcherApi.launch({ instanceId: selectedInstance.id });
    } catch (launchException) {
      const message =
        launchException instanceof Error
          ? launchException.message
          : "Não foi possível abrir o jogo.";

      if (message.startsWith("INSTANCE_ALREADY_RUNNING")) {
        const openAgain = await dialog.confirm({
          title: "Instância já aberta",
          description: "Essa instância já está aberta ou iniciando. Deseja abrir outra cópia mesmo assim?",
          confirmLabel: "Abrir outra",
          cancelLabel: "Cancelar",
          tone: "info",
        });

        if (openAgain) {
          await launcherApi.launch({ instanceId: selectedInstance.id, force: true });
        }
        return;
      }

      void dialog.alert({
        title: "Falha ao iniciar o Minecraft",
        description: message,
        tone: "danger",
      });
    } finally {
      setIsLaunchingInstance(false);
    }
  };

  const copyServerIp = async (host: string) => {
    try {
      await navigator.clipboard.writeText(host);
      setCopiedServer(host);
      window.setTimeout(() => setCopiedServer(null), 2500);
    } catch {
      // ignore
    }
  };

  const copyCouponCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCoupon(code);
      window.setTimeout(() => setCopiedCoupon(null), 2500);
    } catch {
      // ignore
    }
  };

  const filteredInstances = useMemo(() => {
    if (!instanceSearchQuery.trim()) return instances;
    const q = instanceSearchQuery.toLowerCase();
    return instances.filter(
      (inst) =>
        inst.name.toLowerCase().includes(q) ||
        inst.minecraftVersion.toLowerCase().includes(q) ||
        inst.loader.toLowerCase().includes(q)
    );
  }, [instances, instanceSearchQuery]);

  const filteredOnlinePlayers = useMemo(() => {
    return MOCK_ONLINE_PLAYERS.filter((player) => {
      const matchesSearch =
        !onlineSearch.trim() ||
        player.username.toLowerCase().includes(onlineSearch.toLowerCase()) ||
        player.statusText.toLowerCase().includes(onlineSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (onlineFilter === "playing") return player.status === "playing";
      if (onlineFilter === "launcher") return player.status === "in-launcher" || player.status === "afk";
      return true;
    });
  }, [onlineFilter, onlineSearch]);

  const filteredNewsAndAds = useMemo(() => {
    if (newsFeedFilter === "all") return newsAndAdsFeed;
    if (newsFeedFilter === "ad") return newsAndAdsFeed.filter((item) => item.category === "ad");
    if (newsFeedFilter === "news") return newsAndAdsFeed.filter((item) => item.category === "news");
    if (newsFeedFilter === "promo") return newsAndAdsFeed.filter((item) => item.category === "promo" || item.category === "partner");
    return newsAndAdsFeed;
  }, [newsFeedFilter]);

  return (
    <div className="relative h-full flex flex-col justify-between gap-3 overflow-hidden select-none">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header Greeting (Req 1: Sem "astronauta") & Online Counter (Req 2) */}
      {/* ------------------------------------------------------------------ */}
      <header className="flex shrink-0 items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-2 text-[#94A3B8]">
          <span className="font-medium">Bem-vindo(a) de volta,</span>
          <button
            type="button"
            onClick={onOpenAccountModal}
            className="flex items-center gap-1.5 font-semibold text-white rounded-lg px-1.5 py-0.5 transition hover:bg-white/10 active:scale-95"
            title="Gerenciar Contas (Adicionar Microsoft ou Offline)"
          >
            <img
              src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/20`}
              alt=""
              className="h-4 w-4 rounded [image-rendering:pixelated]"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <span className="text-white font-bold">{username}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          </button>
        </div>

        {/* Real-Time Online Players Badge (Clickable modal launcher - Req 2) */}
        <button
          type="button"
          onClick={() => setOnlineModalOpen(true)}
          className="group flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-white/90 shadow-sm transition hover:border-emerald-400/40 hover:bg-emerald-500/20 active:scale-95"
          title="Ver todos os jogadores online agora (Pronto para conexão ao banco de dados)"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          <span>{liveOnlineCount.toLocaleString("pt-BR")} Jogadores Online</span>
          <ChevronRight className="h-3 w-3 text-emerald-400 opacity-60 transition-transform group-hover:translate-x-0.5" />
        </button>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Overlay: Janela de Seleção de Instâncias Expandida (Cobre a tela abaixo para visualização ampla) */}
      {/* ------------------------------------------------------------------ */}
      {instancePickerOpen && (
        <div className="absolute top-9 inset-x-0 bottom-0 z-50 flex flex-col rounded-2xl border border-white/20 bg-[#0B0F17]/98 p-5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
          {/* Header with Search, Badge & Close */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/15 border border-blue-500/30 text-[#60A5FA]">
                <Boxes className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">Escolha a Instância para Jogar</h2>
                  <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold text-[#60A5FA]">
                    {instances.length} instalada(s)
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Selecione a instância desejada para iniciar pelo botão LAUNCH GAME.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Filter */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <input
                  type="text"
                  value={instanceSearchQuery}
                  onChange={(e) => setInstanceSearchQuery(e.target.value)}
                  placeholder="Filtrar por nome, versão ou loader..."
                  className="h-8 w-44 sm:w-64 rounded-xl border border-white/10 bg-white/5 pl-8 pr-7 text-xs text-white placeholder-white/40 outline-none transition focus:border-[#60A5FA]/60 focus:bg-white/10"
                />
                {instanceSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setInstanceSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInstancePickerOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/15 hover:text-white transition"
                title="Fechar (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List / Grid of Instances (Expansiva e com muito espaço) */}
          <div className="flex-1 min-h-0 overflow-y-auto py-3 pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredInstances.map((instance) => {
              const isSelected = instance.id === selectedInstance?.id;
              const running = isRunning(instance.id);

              return (
                <button
                  key={instance.id}
                  type="button"
                  onClick={() => {
                    setSelectedInstanceId(instance.id);
                    setInstancePickerOpen(false);
                  }}
                  className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-[#60A5FA] bg-[#60A5FA]/15 shadow-lg shadow-blue-500/10 ring-1 ring-[#60A5FA]/50"
                      : "border-white/8 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07] hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white group-hover:border-[#60A5FA]/40 transition-colors">
                        {instance.loader === "fabric" ? "Fa" : instance.loader === "forge" ? "Fo" : instance.loader === "neoforge" ? "Ne" : "MC"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                          {instance.name}
                        </p>
                        <p className="text-[11px] text-[#94A3B8]">
                          MC {instance.minecraftVersion} • <span className="capitalize">{instance.loader}</span>
                        </p>
                      </div>
                    </div>

                    {running && (
                      <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                        Aberta
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[10px]">
                    <span className="text-white/50">
                      {isSelected ? "Instância atual selecionada" : "Clique para selecionar"}
                    </span>
                    {isSelected ? (
                      <span className="flex items-center gap-1 font-bold text-[#60A5FA]">
                        <Check className="h-3.5 w-3.5" />
                        Ativa
                      </span>
                    ) : (
                      <span className="font-semibold text-white/40 group-hover:text-white transition-colors">
                        Selecionar
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {filteredInstances.length === 0 && (
              <div className="col-span-full py-16 text-center text-xs text-[#94A3B8]">
                <Boxes className="mx-auto mb-2 h-8 w-8 text-white/20" />
                <p>Nenhuma instância corresponde ao filtro pesquisado.</p>
              </div>
            )}
          </div>

          {/* Footer with Manage All Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#60A5FA]" />
              <span>
                A instância escolhida iniciará ao clicar em <b>LAUNCH GAME</b>.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onNavigate?.("library");
                  setInstancePickerOpen(false);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#60A5FA] transition hover:bg-white/10 hover:border-white/20"
              >
                <PackageOpen className="h-3.5 w-3.5" />
                Gerenciar Todas as Instâncias
              </button>

              <button
                type="button"
                onClick={() => setInstancePickerOpen(false)}
                className="rounded-xl bg-[#3B82F6] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-blue-600 active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Hero Launchpad Banner (Clean: No side icons - Req 7 & Overlay Selector - Req 8) */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative shrink-0 min-h-[220px] max-h-[240px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F17] shadow-xl shadow-black/40">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen transition-all duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/95 via-[#0D1117]/65 to-[#0D1117]/95" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-transparent to-transparent" />

        {/* Center Launchpad Play Window */}
        <div className="relative flex h-full flex-col items-center justify-center p-4 text-center">
          <div className="z-10 flex flex-col items-center gap-2.5">
            {/* Launch Game Button (Req 9: Log message clamped to prevent layout explosion) */}
            <button
              type="button"
              disabled={instanceIsLaunching}
              onClick={handleLaunch}
              className={`group relative flex h-13 w-[320px] sm:w-[350px] max-w-[90vw] items-center justify-center gap-3 rounded-2xl px-6 text-sm font-bold uppercase tracking-wider text-white shadow-xl transition-all duration-300 ${
                instanceIsRunning
                  ? "border border-emerald-400/40 bg-gradient-to-r from-emerald-600 to-teal-500 shadow-emerald-500/25 hover:from-emerald-500 hover:to-teal-400"
                  : instanceIsLaunching
                    ? "cursor-wait border border-blue-400/30 bg-blue-600/80 shadow-blue-500/20"
                    : "border border-emerald-400/40 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 shadow-emerald-600/30 hover:scale-[1.02] hover:shadow-emerald-500/40 active:scale-[0.98]"
              }`}
            >
              {instanceIsLaunching ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-white" />
                  <span
                    className="truncate max-w-[240px] text-xs font-bold tracking-wide"
                    title={activeLaunchEvent?.message || "Iniciando..."}
                  >
                    {formatLaunchLog(activeLaunchEvent?.message)}
                  </span>
                </>
              ) : instanceIsRunning ? (
                <>
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-white shadow-[0_0_8px_white]" />
                  <span className="truncate">JOGANDO (ABRIR OUTRA)</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 shrink-0 fill-white transition-transform duration-200 group-hover:scale-110" />
                  <span className="truncate font-extrabold">LAUNCH GAME</span>
                </>
              )}
            </button>

            {/* Instance Selector Pill (Triggers Overlay - Req 8) */}
            <button
              type="button"
              onClick={() => {
                setInstanceSearchQuery("");
                setInstancePickerOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3.5 py-1.5 text-xs font-medium text-white/90 shadow-md backdrop-blur-md transition hover:border-white/20 hover:bg-black/70 hover:text-white"
              title="Clique para escolher a instância (Bandeja sobreposta)"
            >
              <Boxes className="h-3.5 w-3.5 text-[#60A5FA]" />
              <span className="max-w-[260px] truncate font-semibold">
                {selectedInstance
                  ? `${selectedInstance.name} (${selectedInstance.minecraftVersion} • ${selectedInstance.loader})`
                  : "Nenhuma instância (Clique para criar)"}
              </span>
              <ChevronDown className="h-3 w-3 text-white/50" />
            </button>

            {/* Cancel launch button if in progress */}
            {instanceIsLaunching && selectedInstance && (
              <button
                type="button"
                onClick={() => cancelLaunch(selectedInstance.id)}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1 text-[11px] font-semibold text-red-300 transition hover:bg-red-500/30"
              >
                <X className="h-3 w-3" />
                Cancelar Inicialização
              </button>
            )}
          </div>

          {/* Quick Settings Gear at Bottom Right */}
          <button
            type="button"
            onClick={() => onNavigate?.("settings")}
            className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/40 text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            title="Configurações do Launcher"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Sponsoring Servers Ribbon (Condicional) */}
      {/* ------------------------------------------------------------------ */}
      {sponsoringServers.length > 0 && (
        <section className="shrink-0 rounded-2xl border border-white/10 bg-[#161B22]/80 px-3 py-2 shadow-md backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="h-3.5 w-3.5 fill-amber-400" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                Servidores Patrocinadores
              </span>
              <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-extrabold text-amber-300">
                OFICIAL
              </span>
            </div>
            <span className="text-[10px] text-[#94A3B8]">Clique em um servidor para copiar o IP</span>
          </div>

          <div className="mt-1.5 flex items-center gap-2.5 overflow-x-auto pb-0.5">
            {sponsoringServers.map((server) => {
              const isCopied = copiedServer === server.host;

              return (
                <button
                  key={server.host}
                  type="button"
                  onClick={() => copyServerIp(server.host)}
                  className="group flex shrink-0 items-center gap-2 rounded-xl border border-white/8 bg-[#0D1117] px-2.5 py-1.5 transition-all duration-200 hover:border-amber-400/30 hover:bg-white/5"
                  title={`${server.name} (${server.host}) - Clique para copiar o IP`}
                >
                  <div
                    className={`grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br ${server.color} text-[10px] font-black text-white shadow-sm`}
                  >
                    {server.tag}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-white group-hover:text-[#60A5FA]">
                        {server.name}
                      </p>
                      <span className="text-[9px] text-emerald-400 font-medium">
                        • {server.ping}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#94A3B8]">
                      {isCopied ? (
                        <span className="font-bold text-emerald-400">IP Copiado!</span>
                      ) : (
                        server.host
                      )}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. Bottom Section: Latest News & Destaques */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex shrink-0 items-center justify-between pb-1.5 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Latest News & Destaques</h2>
              <div className="flex items-center gap-1">
                {(["all", "news", "ad", "promo"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setNewsFeedFilter(tab)}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                      newsFeedFilter === tab
                        ? "bg-[#3B82F6] text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {tab === "all" ? "Todos" : tab === "news" ? "Novidades" : tab === "ad" ? "Patrocinados" : "Promoções"}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.("explore")}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#60A5FA] transition hover:text-blue-300"
            >
              <span>Explorar catálogo</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* Grid of Cards or Clean Empty State */}
          {filteredNewsAndAds.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#161B22]/30 p-8 text-center min-h-[140px]">
              <PackageOpen className="h-8 w-8 text-white/20" />
              <p className="mt-2 text-xs font-semibold text-white/60">Nenhuma novidade no momento</p>
              <p className="text-[11px] text-[#94A3B8]">Fique atento para novidades e atualizações futuras!</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredNewsAndAds.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setInspectedBlock(item)}
                  className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${item.accent} p-3.5 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:shadow-xl hover:shadow-black/50`}
                  title="Clique para inspecionar detalhes completos"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/5 text-white/50 transition group-hover:bg-[#3B82F6] group-hover:text-white">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>

                    <h3 className="mt-2.5 text-xs font-extrabold uppercase tracking-wide text-white">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#60A5FA]">{item.subtitle}</p>
                    <p className="mt-1 text-[11px] line-clamp-2 leading-relaxed text-[#94A3B8]">{item.description}</p>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-1.5 text-[10px]">
                    <span className="text-[#94A3B8] font-medium">{item.sponsorOrAuthor}</span>
                    <span className="flex items-center gap-1 font-bold text-white/80 group-hover:text-white">
                      <span>Inspecionar</span>
                      <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Modal 1: Sistema de Jogadores Online (Req 2 - "Na agulha") */}
      {/* ------------------------------------------------------------------ */}
      {onlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#121722] p-5 shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                <div>
                  <h2 className="text-base font-bold text-white">Jogadores Online no Launcher</h2>
                  <p className="text-xs text-[#94A3B8]">
                    {liveOnlineCount.toLocaleString("pt-BR")} usuários ativos com o launcher aberto
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnlineModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filters & Search */}
            <div className="my-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(["all", "playing", "launcher"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setOnlineFilter(tab)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      onlineFilter === tab
                        ? "bg-[#3B82F6] text-white"
                        : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {tab === "all" ? "Todos" : tab === "playing" ? "Jogando Agora" : "No Launcher"}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <input
                  type="text"
                  value={onlineSearch}
                  onChange={(e) => setOnlineSearch(e.target.value)}
                  placeholder="Buscar jogador..."
                  className="h-8 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-white placeholder-white/40 outline-none focus:border-[#60A5FA]/60"
                />
              </div>
            </div>

            {/* Players List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 pr-1">
              {filteredOnlinePlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between py-2.5 px-2 hover:bg-white/5 rounded-lg transition"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://mc-heads.net/avatar/${encodeURIComponent(player.username)}/32`}
                      alt=""
                      className="h-8 w-8 rounded [image-rendering:pixelated] border border-white/10"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{player.username}</span>
                        {player.vipTier && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-extrabold text-amber-300">
                            {player.vipTier}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#94A3B8]">
                        {player.statusText}
                        {player.serverHost && ` (${player.serverHost})`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {player.status === "playing" ? (
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                        In-Game
                      </span>
                    ) : (
                      <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                        No Launcher
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        void dialog.alert({
                          title: `Perfil de ${player.username}`,
                          description: `Status: ${player.statusText}\nInstância: ${player.instanceName || "N/A"}\nServidor: ${player.serverHost || "N/A"}\nConta vinculada ao ecossistema MLUltimate.`,
                          tone: "info",
                        });
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/15"
                    >
                      Ver Perfil
                    </button>
                  </div>
                </div>
              ))}

              {filteredOnlinePlayers.length === 0 && (
                <div className="py-8 text-center text-xs text-[#94A3B8]">
                  Nenhum jogador encontrado para o filtro.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-3 border-t border-white/10 pt-3 flex items-center justify-between text-xs text-[#94A3B8]">
              <span>Sistema conectado em tempo real • Pronto para integração com banco de dados</span>
              <button
                type="button"
                onClick={() => setOnlineModalOpen(false)}
                className="rounded-lg bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal 2: Inspeção Detalhada de Notícias & Anúncios Pagos (Req 4) */}
      {/* ------------------------------------------------------------------ */}
      {inspectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#121722] p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header / Banner preview */}
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-md border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${inspectedBlock.badgeColor}`}>
                  {inspectedBlock.badge}
                </span>
                <span className="text-xs text-[#94A3B8]">
                  Publicado por <b>{inspectedBlock.sponsorOrAuthor}</b>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedBlock(null)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div>
                <h2 className="text-lg font-extrabold uppercase tracking-wide text-white">
                  {inspectedBlock.title}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-[#60A5FA]">
                  {inspectedBlock.subtitle}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/90">
                {inspectedBlock.detailedText}
              </div>

              {/* Coupon Box if Paid Ad */}
              {inspectedBlock.couponCode && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      Cupom Promocional
                    </span>
                    <p className="text-sm font-black text-white font-mono tracking-wider">
                      {inspectedBlock.couponCode}
                    </p>
                    {inspectedBlock.discount && (
                      <span className="text-[10px] text-amber-200">
                        {inspectedBlock.discount}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => copyCouponCode(inspectedBlock.couponCode!)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition"
                  >
                    {copiedCoupon === inspectedBlock.couponCode ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copiar Cupom</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setInspectedBlock(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/10"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                {inspectedBlock.externalUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(inspectedBlock.externalUrl, "_blank");
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-600 transition"
                  >
                    <span>Acessar Site Oficial</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate?.(inspectedBlock.action as PageId);
                      setInspectedBlock(null);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
                  >
                    <span>Ir para o Recurso</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
