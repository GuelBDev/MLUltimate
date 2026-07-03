import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Download,
  Gauge,
  Keyboard,
  Lock,
  Package,
  Palette,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Swords,
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
  LauncherInstance,
  LaunchEvent,
} from "../types/launcher";
import { cn } from "../utils/cn";

const PVP_VERSION = "1.8.9";
const PVP_LOADER = "forge";
const PVP_INSTANCE_NAME = "MLUltimate PvP 1.8.9";

type PvpServer = {
  name: string;
  host: string;
  port?: number;
  region: string;
  description: string;
  mode: string;
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
};

const pvpServers: PvpServer[] = [
  {
    name: "Hypixel",
    host: "mc.hypixel.net",
    region: "Global",
    description: "BedWars, SkyWars, Duels e minigames competitivos.",
    mode: "Premium",
    requiresMicrosoft: true,
    accent: "from-yellow-500/25 to-orange-500/10",
  },
  {
    name: "MushMC",
    host: "mush.com.br",
    region: "Brasil",
    description: "PvP BR com modos rápidos, treino e comunidade ativa.",
    mode: "PvP BR",
    requiresMicrosoft: false,
    accent: "from-emerald-500/25 to-blue-500/10",
  },
  {
    name: "Minemen Club",
    host: "minemen.club",
    region: "Global",
    description: "Practice PvP, ranked, unranked e treino de mira.",
    mode: "Practice",
    requiresMicrosoft: true,
    accent: "from-red-500/25 to-pink-500/10",
  },
  {
    name: "PvP Legacy",
    host: "play.pvplegacy.net",
    region: "Global",
    description: "Duels e kits customizados para treinar combate.",
    mode: "Duels",
    requiresMicrosoft: true,
    accent: "from-purple-500/25 to-blue-500/10",
  },
  {
    name: "BlocksMC",
    host: "blocksmc.com",
    region: "Global",
    description: "BedWars, SkyWars e partidas rápidas para aquecer.",
    mode: "Minigames",
    requiresMicrosoft: false,
    accent: "from-cyan-500/25 to-slate-500/10",
  },
];

const curatedMods: CuratedPvpContent[] = [
  {
    title: "BasicHUD",
    provider: "modrinth",
    projectId: "vqonj1T8",
    type: "mod",
    description: "HUD compacto para FPS, CPS, ping e informações úteis em 1.8.9.",
    tag: "HUD + CPS",
  },
  {
    title: "Lunar Keystrokes",
    provider: "curseforge",
    projectId: "558935",
    type: "mod",
    description: "Mostruário de teclas no estilo Lunar para treinar movimento.",
    tag: "Teclas",
  },
  {
    title: "VanillaHUD",
    provider: "curseforge",
    projectId: "1147254",
    type: "mod",
    description: "HUD leve para partidas PvP em Forge 1.8.9.",
    tag: "HUD",
  },
  {
    title: "PolySprint",
    provider: "curseforge",
    projectId: "1147262",
    type: "mod",
    description: "Sprint mais confortável para prática PvP.",
    tag: "Sprint",
  },
  {
    title: "BetterFps",
    provider: "curseforge",
    projectId: "229876",
    type: "mod",
    description: "Otimizações clássicas para deixar a 1.8.9 mais leve.",
    tag: "FPS",
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
  },
  {
    title: "Technofault",
    provider: "curseforge",
    projectId: "935096",
    type: "resourcepack",
    description: "Visual PvP famoso inspirado no estilo Techno.",
    tag: "16x",
  },
  {
    title: "Faithful Edit for PvP",
    provider: "curseforge",
    projectId: "417255",
    type: "resourcepack",
    description: "Edição Faithful com leitura boa para BedWars e duels.",
    tag: "PvP",
  },
  {
    title: "Naypack Nebula",
    provider: "modrinth",
    projectId: "PBCcz4co",
    type: "resourcepack",
    description: "Pack 16x com tema Nebula para Minecraft 1.8.9.",
    tag: "Nebula",
  },
  {
    title: "LowoFault Definitive 16x",
    provider: "curseforge",
    projectId: "1387760",
    type: "resourcepack",
    description: "Textura 16x moderna para PvP clássico.",
    tag: "Low fire",
  },
];

const quickFeatures = [
  { icon: Keyboard, title: "Keystrokes", text: "Mostra WASD, clique esquerdo/direito e espaço." },
  { icon: Gauge, title: "CPS HUD", text: "HUD para acompanhar CPS durante duels e bridging." },
  { icon: Zap, title: "FPS leve", text: "Forge 1.8.9 com mods pensados para PvP rápido." },
  { icon: Palette, title: "5 texturas", text: "Resource packs PvP já ficam na pasta da instância." },
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
          ramMb: 3072,
          contentManagementEnabled: true,
        }));

      await refreshPvpData(queryClient);
      const installed = await launcherApi.listInstalledContent(instance.id).catch(() => []);
      const installedKeys = new Set(
        installed.map((item) => `${item.provider}:${item.type}:${item.projectId}`),
      );
      const failures: string[] = [];
      let done = 0;
      const items = [...curatedMods, ...curatedTextures];

      for (const item of items) {
        const key = `${item.provider}:${item.type}:${item.projectId}`;

        if (installedKeys.has(key)) {
          done += 1;
          setSetupStatus(`Já instalado: ${item.title} (${done}/${items.length})`);
          continue;
        }

        try {
          setSetupStatus(`Baixando ${item.title} (${done + 1}/${items.length})...`);
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
          `Perfil criado, mas ${failures.length} item(ns) não baixaram. Você pode tentar novamente. ${failures.slice(0, 2).join(" | ")}`,
        );
        setSetupStatus("Kit PvP parcialmente pronto.");
        return;
      }

      setSetupStatus("Kit PvP 1.8.9 pronto para jogar.");
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Não foi possível criar o kit PvP.");
      setSetupStatus(null);
    }
  };

  const installCurated = async (item: CuratedPvpContent) => {
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

  const isSettingUp = Boolean(setupStatus?.startsWith("Preparando") || setupStatus?.startsWith("Baixando"));
  const pvpIsRunning = Boolean(pvpInstance && runningInstances.isRunning(pvpInstance.id));

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-blue-300/15 bg-[#101722] shadow-2xl shadow-blue-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.16),transparent_32%)]" />
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
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-blue-300/25 bg-blue-500/15 shadow-xl shadow-blue-500/10">
                <Swords className="h-8 w-8 text-[#60A5FA]" />
              </div>
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
              <Button onClick={installKit} disabled={isSettingUp}>
                {isSettingUp ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {pvpInstance ? "Reparar / completar Kit PvP" : "Baixar Kit PvP 1.8.9"}
              </Button>
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {quickFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                >
                  <Icon className="h-5 w-5 text-[#60A5FA]" />
                  <p className="mt-3 font-semibold text-white">{feature.title}</p>
                  <p className="mt-1 text-sm leading-5 text-[#94A3B8]">{feature.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={Server}
          title="Servidores disponíveis"
          description="Entre direto com o Kit PvP. Servidores premium ficam bloqueados sem Microsoft."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {pvpServers.map((serverInfo) => {
            const locked = serverInfo.requiresMicrosoft && !hasMicrosoft;
            return (
              <Card key={serverInfo.host} className="overflow-hidden p-0">
                <div className={cn("bg-gradient-to-br p-5", serverInfo.accent)}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{serverInfo.name}</h3>
                        <Badge tone={serverInfo.requiresMicrosoft ? "blue" : "slate"}>
                          {serverInfo.requiresMicrosoft ? "Microsoft" : "Aberto"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-[#A7B4C8]" data-i18n-skip="true">
                        {serverInfo.host}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      {locked ? <Lock className="h-5 w-5 text-amber-200" /> : <Server className="h-5 w-5 text-[#60A5FA]" />}
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-[#D7E2F2]">{serverInfo.description}</p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="slate">{serverInfo.region}</Badge>
                      <Badge tone="slate">{serverInfo.mode}</Badge>
                      {pvpIsRunning ? <Badge tone="green">PvP aberto</Badge> : null}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => launchServer(serverInfo)}
                      disabled={locked || !pvpInstance}
                      title={
                        locked
                          ? "Entre com Microsoft para acessar este servidor"
                          : !pvpInstance
                            ? "Baixe o Kit PvP 1.8.9 primeiro"
                            : `Entrar em ${serverInfo.name}`
                      }
                    >
                      {locked ? <Lock className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {locked ? "Bloqueado" : "Entrar"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-5">
          <SectionHeader
            icon={Package}
            title="Mods do Kit PvP"
            description="Conteúdo compatível com Forge 1.8.9 para HUD, CPS, teclas e FPS."
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
            title="Texturas PvP padrão"
            description="Cinco resource packs famosos ficam prontos para ativar dentro do Minecraft."
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
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0B111A]">
      {item.type === "mod" ? (
        <Package className="h-5 w-5 text-[#60A5FA]" />
      ) : (
        <Palette className="h-5 w-5 text-[#60A5FA]" />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-white">{item.title}</p>
        <Badge tone="slate">{item.tag}</Badge>
      </div>
      <p className="mt-1 text-sm leading-5 text-[#94A3B8]">{item.description}</p>
    </div>
    <Button size="sm" variant="secondary" onClick={onInstall} disabled={!installed}>
      <Download className="h-4 w-4" />
      Adicionar
    </Button>
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

const filterPvpResults = (
  results: ContentSearchResult[],
  type: Extract<ContentType, "mod" | "resourcepack">,
) =>
  results.filter((result) => {
    if (result.type !== type) return false;

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
