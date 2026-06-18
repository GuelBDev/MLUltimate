import {
  ArrowLeft,
  Clock3,
  FileText,
  FolderOpen,
  HardDrive,
  History,
  Images,
  Map as MapIcon,
  Package,
  Palette,
  Play,
  Plus,
  Power,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import instanceDefaultImage from "../assets/instance-default.png";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useDownloads } from "../hooks/useDownloads";
import { useInstances } from "../hooks/useInstances";
import { useRunningInstances } from "../hooks/useRunningInstances";
import { launcherApi } from "../services/launcherApi";
import type {
  ContentType,
  DownloadItem,
  InstanceContentCategory,
  InstanceContentEntry,
  LaunchEvent,
  LauncherInstance,
} from "../types/launcher";

type InstanceDetailPageProps = {
  instance: LauncherInstance;
  onBack: () => void;
  onExplore: (type: ContentType, instanceId: string) => void;
};

type Section =
  | "overview"
  | "content"
  | "changelog"
  | "gallery"
  | "versions"
  | "logs"
  | "screenshots";

const sections: Array<{ id: Section; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "content", label: "Conteúdo" },
  { id: "changelog", label: "Changelog" },
  { id: "gallery", label: "Galeria" },
  { id: "versions", label: "Versões" },
  { id: "logs", label: "Logs" },
  { id: "screenshots", label: "Screenshots" },
];

const categories: Array<{
  id: InstanceContentCategory;
  label: string;
  icon: typeof Package;
}> = [
  { id: "mod", label: "Mods", icon: Package },
  { id: "datapack", label: "Data Packs", icon: FileText },
  { id: "resourcepack", label: "Resource Packs", icon: Palette },
  { id: "shader", label: "Shaders", icon: Sparkles },
  { id: "world", label: "Mundos", icon: MapIcon },
];

export const InstanceDetailPage = ({
  instance,
  onBack,
  onExplore,
}: InstanceDetailPageProps) => {
  const queryClient = useQueryClient();
  const dialog = useAppDialog();
  const { instances, openFolder } = useInstances();
  const current =
    instances.data?.find((candidate) => candidate.id === instance.id) ?? instance;
  const inspection = useQuery({
    queryKey: ["instance-inspection", current.id],
    queryFn: () => launcherApi.inspectInstance(current.id),
  });
  const project = useQuery({
    queryKey: [
      "instance-source-project",
      current.sourceProvider,
      current.sourceProjectId,
      current.sourceVersionId,
    ],
    queryFn: () =>
      launcherApi.getContentProject({
        provider: current.sourceProvider!,
        projectId: current.sourceProjectId!,
        type: "modpack",
        includeModpackContent: false,
      }),
    enabled: Boolean(current.sourceProvider && current.sourceProjectId),
    staleTime: 5 * 60_000,
  });
  const updates = useQuery({
    queryKey: ["installed-content-updates", current.id],
    queryFn: () => launcherApi.checkInstalledContentUpdates(current.id),
    enabled: false,
    staleTime: 60_000,
  });
  const downloads = useDownloads();
  const runningInstances = useRunningInstances();
  const [section, setSection] = useState<Section>("overview");
  const [category, setCategory] = useState<InstanceContentCategory>("mod");
  const [query, setQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<string>();
  const [logQuery, setLogQuery] = useState("");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchEvent, setLaunchEvent] = useState<LaunchEvent | null>(null);
  const effectiveSelectedLog =
    selectedLog ??
    inspection.data?.logs.find((log) => log.name.toLowerCase() === "latest.log")
      ?.relativePath ??
    inspection.data?.logs[0]?.relativePath;

  const logContent = useQuery({
    queryKey: ["instance-log", current.id, effectiveSelectedLog],
    queryFn: () =>
      launcherApi.readInstanceTextFile({
        instanceId: current.id,
        relativePath: effectiveSelectedLog!,
      }),
    enabled: Boolean(effectiveSelectedLog),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["instance-inspection", current.id] });
    void queryClient.invalidateQueries({ queryKey: ["installed-content", current.id] });
    void queryClient.invalidateQueries({
      queryKey: ["installed-content-updates", current.id],
    });
    void queryClient.invalidateQueries({ queryKey: ["instances"] });
  };

  const toggleFile = useMutation({
    mutationFn: launcherApi.toggleInstanceFile,
    onSuccess: refresh,
  });
  const removeFile = useMutation({
    mutationFn: launcherApi.removeInstanceFile,
    onSuccess: refresh,
  });
  const updateOne = useMutation({
    mutationFn: launcherApi.updateInstalledContent,
    onSuccess: refresh,
  });
  const updateAll = useMutation({
    mutationFn: launcherApi.updateAllInstalledContent,
    onSuccess: refresh,
  });
  const installVersion = useMutation({
    mutationFn: (versionId: string) =>
      launcherApi.installContentAsInstance({
        provider: current.sourceProvider!,
        projectId: current.sourceProjectId!,
        type: "modpack",
        versionId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  const content = useMemo(() => inspection.data?.content ?? [], [inspection.data]);
  const visibleContent = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return content.filter(
      (item) =>
        item.category === category &&
        (!normalized ||
          [item.name, item.fileName, item.provider, item.relativePath]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalized)),
    );
  }, [category, content, query]);
  const categoryCounts = useMemo(
    () =>
      new Map(
        categories.map((item) => [
          item.id,
          content.filter((contentItem) => contentItem.category === item.id).length,
        ]),
      ),
    [content],
  );
  const updateMap = useMemo(
    () => new Map((updates.data ?? []).map((item) => [item.id, item])),
    [updates.data],
  );
  const visibleUpdates = visibleContent.filter(
    (item) =>
      item.installedContentId &&
      updateMap.get(item.installedContentId)?.updateAvailable,
  );
  const activeDownload = useMemo(
    () => findInstanceDownload(downloads.data ?? [], current),
    [current, downloads.data],
  );
  const activity = launchEvent ?? activeDownload;
  const activityLabel = launchEvent?.message ?? activeDownload?.label;
  const activityProgress = launchEvent?.progress ?? activeDownload?.progress ?? 0;
  const selectedVersion =
    project.data?.versions.find((version) => version.id === current.sourceVersionId) ??
    project.data?.versions[0];
  const filteredLog = useMemo(() => {
    const text = logContent.data ?? "";
    const normalized = logQuery.trim().toLowerCase();

    if (!normalized) {
      return text;
    }

    return text
      .split(/\r?\n/)
      .filter((line) => line.toLowerCase().includes(normalized))
      .join("\n");
  }, [logContent.data, logQuery]);

  useEffect(
    () =>
      launcherApi.onLaunchEvent((event) => {
        if (event.id !== current.id) return;
        setLaunchEvent(event);

        if (["closed", "killed", "cancelled", "error"].includes(event.type)) {
          refresh();
        }

        if (["complete", "cancelled", "error", "closed", "killed"].includes(event.type)) {
          window.setTimeout(() => setLaunchEvent(null), 1800);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current.id],
  );

  const play = async () => {
    setLaunchError(null);

    try {
      await launcherApi.launch({ instanceId: current.id });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível abrir o jogo.";

      if (message.startsWith("INSTANCE_ALREADY_RUNNING")) {
        const openAgain = await dialog.confirm({
          title: "Instância já aberta",
          description:
            "Essa instância já está aberta ou iniciando. Deseja abrir outra cópia mesmo assim?",
          confirmLabel: "Abrir outra",
          cancelLabel: "Cancelar",
          tone: "info",
        });

        if (openAgain) {
          await launcherApi.launch({ instanceId: current.id, force: true });
        }
        return;
      }

      setLaunchError(message);
    }
  };

  const removeContent = async (item: InstanceContentEntry) => {
    const confirmed = await dialog.confirm({
      title: item.category === "world" ? "Excluir mundo" : "Remover conteúdo",
      description: `Remover ${item.name} da instância? Essa ação apaga o arquivo local.`,
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (confirmed) {
      removeFile.mutate({
        instanceId: current.id,
        relativePath: item.relativePath,
      });
    }
  };

  const updateVisible = async () => {
    if (visibleUpdates.length === 0) return;
    const confirmed = await dialog.confirm({
      title: "Atualizar conteúdo",
      description: `Atualizar ${visibleUpdates.length} item(ns) compatíveis desta categoria?`,
      confirmLabel: "Atualizar",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (confirmed) {
      const type = categoryToContentType(category);
      if (type) updateAll.mutate({ instanceId: current.id, type });
    }
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-[#94A3B8] transition hover:text-white"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <section className="overflow-hidden rounded-sm border border-white/8 bg-[#1f1f1f]">
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-center">
          <div
            className="h-28 w-28 shrink-0 rounded-sm bg-cover bg-center"
            style={{ backgroundImage: `url(${current.iconDataUrl ?? instanceDefaultImage})` }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-2xl font-semibold text-white">{current.name}</h2>
              <Badge tone="slate">{current.loader}</Badge>
              {current.sourceProvider ? (
                <Badge tone={current.sourceProvider === "curseforge" ? "blue" : "green"}>
                  {current.sourceProvider}
                </Badge>
              ) : null}
              {current.shaderSupport.supported ? (
                <Badge tone="blue">
                  Shaders: {current.shaderSupport.engines.join(", ")}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[#B8C2D0]">
              Minecraft {current.minecraftVersion} · {Math.round(current.ramMb / 1024)} GB RAM
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#B8C2D0]">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-[#60A5FA]" />
                Tempo jogado: {formatPlayTime(current.playTimeSeconds)}
              </span>
              <span className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-[#60A5FA]" />
                Última vez: {formatDate(current.lastPlayedAt)}
              </span>
              <span>{current.modsCount} mods</span>
              <span>{current.resourcepacksCount} texturas</span>
              <span>{current.shaderpacksCount} shaders</span>
            </div>
            {activity && activityLabel ? (
              <div className="mt-4 max-w-xl rounded-sm border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-xs text-[#D8DEE9]">{activityLabel}</p>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center text-[#94A3B8] hover:text-red-100"
                    onClick={() =>
                      launchEvent
                        ? void launcherApi.cancel({ instanceId: current.id })
                        : activeDownload
                          ? void launcherApi.cancelDownload(activeDownload.id)
                          : undefined
                    }
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Progress value={activityProgress} className="h-1.5" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => openFolder.mutate(current.id)}>
              <FolderOpen className="h-4 w-4" />
              Pasta
            </Button>
            {runningInstances.isRunning(current.id) ? (
              <Button
                onClick={() => void launcherApi.killInstance(current.id)}
                className="rounded-sm bg-red-600 hover:bg-red-500"
              >
                <Power className="h-4 w-4" />
                Encerrar
              </Button>
            ) : (
              <Button onClick={play} className="rounded-sm bg-[#3B82F6] hover:bg-[#60A5FA]">
                <Play className="h-4 w-4 fill-white" />
                Jogar
              </Button>
            )}
          </div>
        </div>
      </section>

      {launchError ? (
        <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {launchError}
        </div>
      ) : null}

      <div className="flex gap-5 overflow-x-auto border-b border-white/10">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`shrink-0 border-b-2 px-1 pb-3 text-sm ${
              section === item.id
                ? "border-[#3B82F6] text-white"
                : "border-transparent text-[#94A3B8] hover:text-white"
            }`}
            onClick={() => setSection(item.id)}
          >
            {item.label}
            {item.id === "content" ? ` (${content.length})` : ""}
          </button>
        ))}
      </div>

      {section === "overview" ? (
        <Overview
          instance={current}
          projectBody={project.data?.body}
          projectCategories={project.data?.categories}
          inspection={inspection.data}
          heroUrl={project.data?.gallery[0]?.url}
        />
      ) : null}

      {section === "content" ? (
        <Card className="overflow-hidden rounded-sm border-white/10 bg-[#1f1f1f]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
            <div className="flex gap-4 overflow-x-auto">
              {categories.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`flex shrink-0 items-center gap-2 border-b-2 px-1 pb-2 text-sm ${
                      category === item.id
                        ? "border-[#3B82F6] text-white"
                        : "border-transparent text-[#94A3B8]"
                    }`}
                    onClick={() => setCategory(item.id)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label} ({categoryCounts.get(item.id) ?? 0})
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryToContentType(category) ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => updates.refetch()}
                    disabled={updates.isFetching}
                  >
                    <RefreshCw className={`h-4 w-4 ${updates.isFetching ? "animate-spin" : ""}`} />
                    Verificar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={updateVisible}
                    disabled={visibleUpdates.length === 0 || updateAll.isPending}
                  >
                    Atualizar ({visibleUpdates.length})
                  </Button>
                  <Button
                    onClick={() =>
                      onExplore(categoryToContentType(category)!, current.id)
                    }
                    disabled={category === "shader" && !current.shaderSupport.supported}
                    title={
                      category === "shader" && !current.shaderSupport.supported
                        ? "Instale Iris, OptiFine, Oculus, Angelica ou outro motor de shader primeiro."
                        : undefined
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          {category === "shader" && !current.shaderSupport.supported ? (
            <div className="border-b border-blue-400/15 bg-blue-500/8 px-4 py-3 text-sm text-blue-100">
              Esta instancia nao possui um carregador de shaders reconhecido. O download sera
              liberado automaticamente quando Iris, Iris + Sodium, OptiFine, Oculus, Angelica
              ou ShadersMod estiver instalado e ativo.
            </div>
          ) : null}
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-xl border border-white/10 bg-[#0D1117] pl-9 pr-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
                placeholder={`Pesquisar em ${categories.find((item) => item.id === category)?.label}`}
              />
            </div>
          </div>
          <div className="hidden grid-cols-[1fr_120px_110px_130px] border-b border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white md:grid">
            <span>Nome</span>
            <span>Tamanho</span>
            <span>Ativo</span>
            <span>Ações</span>
          </div>
          {visibleContent.map((item) => (
            <div
              key={item.id}
              className={`grid grid-cols-1 items-center gap-3 border-b border-white/6 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_120px_110px_130px] ${
                item.enabled ? "" : "opacity-55"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <ContentIcon item={item} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{item.name}</p>
                  <p className="mt-1 truncate text-[#94A3B8]">{item.relativePath}</p>
                </div>
              </div>
              <span className="text-[#B8C2D0]">{formatBytes(item.sizeBytes)}</span>
              <div>
                {item.category !== "world" ? (
                  <button
                    type="button"
                    className={`flex h-8 w-14 items-center rounded-full border p-1 transition ${
                      item.enabled
                        ? "border-blue-400/40 bg-[#3B82F6]"
                        : "border-white/10 bg-white/10"
                    }`}
                    onClick={() =>
                      toggleFile.mutate({
                        instanceId: current.id,
                        relativePath: item.relativePath,
                        enabled: !item.enabled,
                      })
                    }
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white transition ${
                        item.enabled ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <span className="text-xs text-[#94A3B8]">Mundo local</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.installedContentId &&
                updateMap.get(item.installedContentId)?.updateAvailable ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateOne.mutate(item.installedContentId!)}
                  >
                    Update
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center text-[#94A3B8] hover:bg-red-500/15 hover:text-red-200"
                  onClick={() => removeContent(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {visibleContent.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[#94A3B8]">
              Nenhum conteúdo nesta categoria.
            </div>
          ) : null}
        </Card>
      ) : null}

      {section === "changelog" ? (
        <Card className="whitespace-pre-wrap rounded-sm border-white/10 bg-[#1f1f1f] p-5 text-sm leading-7 text-[#D8DEE9]">
          {selectedVersion?.changelog ??
            "Não há changelog publicado para a versão instalada deste modpack."}
        </Card>
      ) : null}

      {section === "gallery" ? (
        <Card className="rounded-sm border-white/10 bg-[#1f1f1f] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(project.data?.gallery ?? []).map((image) => (
              <figure key={image.url} className="overflow-hidden rounded-sm bg-black/20">
                <img src={image.url} alt="" className="h-52 w-full object-cover" />
                {image.title ? (
                  <figcaption className="px-3 py-2 text-sm text-[#B8C2D0]">
                    {image.title}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
          {(project.data?.gallery ?? []).length === 0 ? (
            <EmptyState icon={Images} text="A galeria deste projeto não está disponível." />
          ) : null}
        </Card>
      ) : null}

      {section === "versions" ? (
        <Card className="overflow-hidden rounded-sm border-white/10 bg-[#1f1f1f]">
          {(project.data?.versions ?? []).map((version) => (
            <div
              key={version.id}
              className="grid grid-cols-1 items-center gap-3 border-b border-white/8 px-4 py-4 text-sm last:border-0 md:grid-cols-[1fr_130px_120px_180px]"
            >
              <div>
                <p className="font-semibold text-white">{version.name}</p>
                <p className="mt-1 text-[#94A3B8]">{version.fileName}</p>
              </div>
              <span className="text-[#B8C2D0]">{version.gameVersions[0] ?? "-"}</span>
              <Badge tone={version.id === current.sourceVersionId ? "green" : "slate"}>
                {version.id === current.sourceVersionId ? "Instalada" : version.releaseType ?? "release"}
              </Badge>
              <Button
                variant="secondary"
                disabled={installVersion.isPending || version.id === current.sourceVersionId}
                onClick={() => installVersion.mutate(version.id)}
              >
                Instalar como nova
              </Button>
            </div>
          ))}
          {!current.sourceProjectId ? (
            <EmptyState
              icon={History}
              text="Esta instância local não possui um projeto de origem vinculado."
            />
          ) : null}
        </Card>
      ) : null}

      {section === "logs" ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="overflow-hidden rounded-sm border-white/10 bg-[#1f1f1f]">
            <div className="flex items-center justify-between border-b border-white/10 p-3">
              <span className="text-sm font-semibold text-white">Arquivos</span>
              <button
                type="button"
                className="text-[#94A3B8] hover:text-white"
                onClick={() => launcherApi.openInstanceSubfolder(current.id, "logs")}
              >
                <FolderOpen className="h-4 w-4" />
              </button>
            </div>
            {(inspection.data?.logs ?? []).map((log) => (
              <button
                key={log.relativePath}
                type="button"
                className={`block w-full border-b border-white/6 px-3 py-3 text-left text-sm ${
                  effectiveSelectedLog === log.relativePath
                    ? "bg-[#3B82F6]/15 text-white"
                    : "text-[#B8C2D0] hover:bg-white/5"
                }`}
                onClick={() => setSelectedLog(log.relativePath)}
              >
                <span className="block truncate">{log.name}</span>
                <span className="mt-1 block text-xs text-[#64748B]">
                  {formatBytes(log.sizeBytes)}
                </span>
              </button>
            ))}
          </Card>
          <Card className="min-w-0 rounded-sm border-white/10 bg-[#0b0d10]">
            <div className="border-b border-white/10 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={logQuery}
                  onChange={(event) => setLogQuery(event.target.value)}
                  className="h-10 w-full rounded-sm border border-white/10 bg-[#161B22] pl-9 pr-3 text-sm text-white outline-none"
                  placeholder="Pesquisar no log"
                />
              </div>
            </div>
            <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-[#D8DEE9]">
              {filteredLog || "Selecione um arquivo de log."}
            </pre>
          </Card>
        </div>
      ) : null}

      {section === "screenshots" ? (
        <Card className="rounded-sm border-white/10 bg-[#1f1f1f] p-4">
          <div className="mb-4 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => launcherApi.openInstanceSubfolder(current.id, "screenshots")}
            >
              <FolderOpen className="h-4 w-4" />
              Abrir pasta
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(inspection.data?.screenshots ?? []).map((screenshot) => (
              <figure
                key={screenshot.relativePath}
                className="overflow-hidden rounded-sm bg-black/20"
              >
                {screenshot.imageDataUrl ? (
                  <img
                    src={screenshot.imageDataUrl}
                    alt={screenshot.name}
                    className="h-52 w-full object-cover"
                  />
                ) : (
                  <div className="grid h-52 place-items-center text-[#64748B]">
                    Prévia muito grande
                  </div>
                )}
                <figcaption className="truncate px-3 py-2 text-xs text-[#B8C2D0]">
                  {screenshot.name}
                </figcaption>
              </figure>
            ))}
          </div>
          {(inspection.data?.screenshots ?? []).length === 0 ? (
            <EmptyState
              icon={Images}
              text="Nenhuma screenshot encontrada. Use F2 dentro do Minecraft."
            />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
};

const Overview = ({
  instance,
  projectBody,
  projectCategories,
  inspection,
  heroUrl,
}: {
  instance: LauncherInstance;
  projectBody?: string;
  projectCategories?: string[];
  inspection?: Awaited<ReturnType<typeof launcherApi.inspectInstance>>;
  heroUrl?: string;
}) => (
  <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={Package} label="Mods" value={instance.modsCount} />
      <Stat icon={Palette} label="Texturas" value={instance.resourcepacksCount} />
      <Stat icon={Sparkles} label="Shaders" value={instance.shaderpacksCount} />
      <Stat
        icon={HardDrive}
        label="Conteúdo"
        value={formatBytes(inspection?.totalContentSizeBytes ?? 0)}
      />
    </div>
    <Card className="rounded-sm border-white/10 bg-[#1f1f1f] p-5">
      {(projectCategories ?? []).length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {projectCategories?.map((category) => (
            <Badge key={category} tone="slate">
              {category}
            </Badge>
          ))}
        </div>
      ) : null}
      {heroUrl ? (
        <img src={heroUrl} alt="" className="mb-5 max-h-[520px] w-full rounded-sm object-cover" />
      ) : null}
      <div className="whitespace-pre-wrap text-sm leading-7 text-[#D8DEE9]">
        {projectBody ??
          "Instância local do MLUltimate. Use as abas para gerenciar conteúdo, conferir logs, versões e screenshots."}
      </div>
      <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm text-[#94A3B8] sm:grid-cols-3">
        <span>{inspection?.configFilesCount ?? 0} arquivos de configuração</span>
        <span>{instance.dataPacksCount} data packs</span>
        <span>{instance.worldsCount} mundos</span>
      </div>
    </Card>
  </div>
);

const Stat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
}) => (
  <Card className="rounded-sm border-white/10 bg-[#1f1f1f] p-4">
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-sm bg-[#3B82F6]/15 text-[#60A5FA]">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-[#64748B]">{label}</p>
        <p className="mt-1 text-lg font-semibold text-white">{value}</p>
      </div>
    </div>
  </Card>
);

const ContentIcon = ({ item }: { item: InstanceContentEntry }) => {
  const category = categories.find((candidate) => candidate.id === item.category);
  const Icon = category?.icon ?? Package;
  const imageUrl = item.iconUrl ?? item.previewDataUrl;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="h-14 w-14 shrink-0 rounded-lg border border-white/10 bg-black/20 object-cover"
      />
    );
  }

  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/6 text-[#60A5FA]">
      <Icon className="h-4 w-4" />
    </span>
  );
};

const EmptyState = ({
  icon: Icon,
  text,
}: {
  icon: typeof Package;
  text: string;
}) => (
  <div className="grid min-h-64 place-items-center text-center text-sm text-[#94A3B8]">
    <div>
      <Icon className="mx-auto mb-3 h-7 w-7" />
      {text}
    </div>
  </div>
);

const categoryToContentType = (
  category: InstanceContentCategory,
): ContentType | null => {
  if (category === "mod") return "mod";
  if (category === "resourcepack") return "resourcepack";
  if (category === "shader") return "shader";
  return null;
};

const findInstanceDownload = (downloads: DownloadItem[], instance: LauncherInstance) => {
  const gameDir = normalizePath(instance.gameDir);
  const needles = [
    `minecraft ${instance.minecraftVersion}`,
    `${instance.loader} ${instance.minecraftVersion}`,
    instance.name,
  ];

  return downloads.find((download) => {
    if (!["queued", "running"].includes(download.status)) return false;
    const destination = normalizePath(download.destination);
    const label = download.label.toLowerCase();
    return (
      destination.startsWith(gameDir) ||
      needles.some((needle) => label.includes(needle.toLowerCase()))
    );
  });
};

const normalizePath = (value: string) => value.replaceAll("\\", "/").toLowerCase();

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
};

const formatPlayTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes} min`;
};

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Ainda não jogado";
