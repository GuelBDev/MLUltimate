import { ArrowLeft, FolderOpen, Package, Palette, Plus, Play, Power, RefreshCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import instanceDefaultImage from "../assets/instance-default.png";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useDownloads } from "../hooks/useDownloads";
import { useInstalledContent } from "../hooks/useInstalledContent";
import { useInstances } from "../hooks/useInstances";
import { useRunningInstances } from "../hooks/useRunningInstances";
import { launcherApi } from "../services/launcherApi";
import type { ContentType, DownloadItem, LaunchEvent, LauncherInstance } from "../types/launcher";

type InstanceDetailPageProps = {
  instance: LauncherInstance;
  onBack: () => void;
  onExplore: (type: ContentType, instanceId: string) => void;
};

const tabs: Array<{ id: ContentType; label: string }> = [
  { id: "mod", label: "Mods" },
  { id: "resourcepack", label: "Resource Packs" },
  { id: "shader", label: "Shaders" },
];

export const InstanceDetailPage = ({ instance, onBack, onExplore }: InstanceDetailPageProps) => {
  const queryClient = useQueryClient();
  const dialog = useAppDialog();
  const [activeTab, setActiveTab] = useState<ContentType>("mod");
  const content = useInstalledContent(instance.id);
  const updates = useQuery({
    queryKey: ["installed-content-updates", instance.id],
    queryFn: () => launcherApi.checkInstalledContentUpdates(instance.id),
    enabled: instance.contentManagementEnabled && (content.data?.length ?? 0) > 0,
    staleTime: 60_000,
  });
  const { openFolder } = useInstances();
  const downloads = useDownloads();
  const runningInstances = useRunningInstances();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchEvent, setLaunchEvent] = useState<LaunchEvent | null>(null);
  const [contentQuery, setContentQuery] = useState("");
  const items = useMemo(
    () => {
      const normalized = contentQuery.trim().toLowerCase();

      return (content.data ?? []).filter((item) => {
        if (item.type !== activeTab) {
          return false;
        }

        if (!normalized) {
          return true;
        }

        return [item.name, item.fileName, item.provider]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      });
    },
    [activeTab, content.data, contentQuery],
  );
  const activeDownload = useMemo(
    () => findInstanceDownload(downloads.data ?? [], instance),
    [downloads.data, instance],
  );
  const activity = launchEvent ?? activeDownload;
  const activityLabel = launchEvent?.message ?? activeDownload?.label;
  const activityProgress = launchEvent?.progress ?? activeDownload?.progress ?? 0;
  const updateMap = useMemo(
    () => new Map((updates.data ?? []).map((item) => [item.id, item])),
    [updates.data],
  );
  const updateCount = items.filter((item) => updateMap.get(item.id)?.updateAvailable).length;

  const refreshContent = () => {
    void queryClient.invalidateQueries({ queryKey: ["installed-content", instance.id] });
    void queryClient.invalidateQueries({ queryKey: ["installed-content-updates", instance.id] });
    void queryClient.invalidateQueries({ queryKey: ["instances"] });
  };

  const updateOne = useMutation({
    mutationFn: launcherApi.updateInstalledContent,
    onSuccess: refreshContent,
  });
  const updateAll = useMutation({
    mutationFn: launcherApi.updateAllInstalledContent,
    onSuccess: refreshContent,
  });
  const toggleContent = useMutation({
    mutationFn: launcherApi.toggleInstalledContent,
    onSuccess: refreshContent,
  });
  const removeContent = useMutation({
    mutationFn: launcherApi.removeInstalledContent,
    onSuccess: refreshContent,
  });

  const warnBeforeUpdate = async (count: number) =>
    dialog.confirm({
      title: count > 1 ? "Atualizar mods" : "Atualizar mod",
      description:
        "Atualizar mods pode quebrar o modpack quando dependencias ou compatibilidades mudam. Continue apenas se quiser testar a versao mais recente compativel.",
      confirmLabel: count > 1 ? `Atualizar ${count}` : "Atualizar",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

  const updateAllVisible = async () => {
    if (updateCount === 0 || !(await warnBeforeUpdate(updateCount))) {
      return;
    }

    updateAll.mutate({ instanceId: instance.id, type: activeTab });
  };

  const updateSingle = async (id: string) => {
    if (!(await warnBeforeUpdate(1))) {
      return;
    }

    updateOne.mutate(id);
  };

  const removeSingle = async (id: string, name: string) => {
    const confirmed = await dialog.confirm({
      title: "Remover conteudo",
      description: `Remover ${name} da instancia? O arquivo sera apagado da pasta do perfil.`,
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (confirmed) {
      removeContent.mutate(id);
    }
  };

  useEffect(
    () =>
      launcherApi.onLaunchEvent((event) => {
        if (event.id !== instance.id) {
          return;
        }

        setLaunchEvent(event);
        if (["complete", "cancelled", "error", "closed", "killed"].includes(event.type)) {
          window.setTimeout(() => setLaunchEvent(null), 1800);
        }
      }),
    [instance.id],
  );

  const play = async () => {
    setLaunchError(null);

    try {
      await launcherApi.launch({ instanceId: instance.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir o jogo.";

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
          await launcherApi.launch({ instanceId: instance.id, force: true });
        }
        return;
      }

      setLaunchError(message);
    }
  };

  const cancelActivity = () => {
    if (launchEvent) {
      void launcherApi.cancel({ instanceId: instance.id });
      return;
    }

    if (activeDownload) {
      void launcherApi.cancelDownload(activeDownload.id);
    }
  };

  const killInstance = () => {
    void launcherApi.killInstance(instance.id);
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

      <section className="overflow-hidden rounded-sm bg-[#1f1f1f]">
        <div className="flex items-center gap-5 p-4">
          <div
            className="h-28 w-28 shrink-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${instance.iconDataUrl ?? instanceDefaultImage})` }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="truncate text-2xl font-semibold text-white">{instance.name}</h2>
              <Badge tone="slate">{instance.loader}</Badge>
            </div>
            <p className="mt-2 text-sm text-[#B8C2D0]">
              Minecraft {instance.minecraftVersion} | {Math.round(instance.ramMb / 1024)} GB RAM
            </p>
            <div className="mt-4 flex gap-2 text-xs text-[#B8C2D0]">
              <Badge tone="slate">{instance.modsCount} Mods</Badge>
              <Badge tone="slate">{instance.resourcepacksCount} Resource Packs</Badge>
              <Badge tone="slate">{instance.shaderpacksCount} Shaders</Badge>
            </div>
            {activity && activityLabel ? (
              <div className="mt-4 max-w-xl rounded-sm border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-xs text-[#D8DEE9]">{activityLabel}</p>
                  <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[#94A3B8] hover:bg-red-500/20 hover:text-red-100"
                    title="Cancelar"
                    onClick={cancelActivity}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Progress value={activityProgress} className="h-1.5" />
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => openFolder.mutate(instance.id)}>
              <FolderOpen className="h-4 w-4" />
              Pasta
            </Button>
            {runningInstances.isRunning(instance.id) ? (
              <Button onClick={killInstance} className="rounded-sm bg-red-600 hover:bg-red-500">
                <Power className="h-4 w-4" />
                Kill Instance
              </Button>
            ) : (
              <Button onClick={play} className="rounded-sm bg-[#f05a28] hover:bg-[#ff733f]">
                <Play className="h-4 w-4 fill-white" />
                Play
              </Button>
            )}
          </div>
        </div>
      </section>

      {!instance.contentManagementEnabled ? (
        <Card className="border-yellow-300/20 bg-yellow-500/10 p-4">
          <p className="text-sm font-semibold text-yellow-100">
            Gerenciamento de conteudo desativado
          </p>
          <p className="mt-1 text-sm leading-6 text-yellow-100/75">
            Ative "Permitir gerenciamento de conteudo neste perfil" nas opcoes da instancia para
            adicionar, atualizar, remover ou desativar arquivos.
          </p>
        </Card>
      ) : null}

      {launchError ? (
        <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {launchError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
        <div className="flex gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`border-b-2 px-1 pb-3 text-sm ${
                activeTab === tab.id
                  ? "border-[#f05a28] text-white"
                  : "border-transparent text-[#94A3B8] hover:text-white"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {instance.contentManagementEnabled ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="rounded-sm"
                onClick={() => updates.refetch()}
                disabled={updates.isFetching}
                title="Verificar updates"
              >
                <RefreshCw className={`h-4 w-4 ${updates.isFetching ? "animate-spin" : ""}`} />
                Verificar
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="rounded-sm"
                onClick={updateAllVisible}
                disabled={updateCount === 0 || updateAll.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${updateAll.isPending ? "animate-spin" : ""}`} />
                Atualizar {tabs.find((tab) => tab.id === activeTab)?.label ?? "conteudo"} ({updateCount})
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="rounded-sm"
            onClick={() => onExplore(activeTab, instance.id)}
            disabled={!instance.contentManagementEnabled}
          >
            <Plus className="h-4 w-4" />
            Add Content
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-sm border-white/10 bg-[#1f1f1f]">
        <div className="border-b border-white/10 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={contentQuery}
              onChange={(event) => setContentQuery(event.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-[#0D1117] pl-9 pr-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
              placeholder={`Pesquisar ${tabs.find((tab) => tab.id === activeTab)?.label ?? "conteúdo"}`}
            />
          </div>
        </div>
        <div className="hidden grid-cols-[1fr_150px_140px_120px] border-b border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white md:grid">
          <span>Name</span>
          <span>Provider</span>
          <span>Active</span>
          <span>Action</span>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className={`grid grid-cols-1 items-center gap-3 border-b border-white/6 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_150px_140px_120px] ${
              item.enabled ? "" : "opacity-55"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <ContentIcon type={item.type} iconUrl={item.iconUrl} name={item.name} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{item.name}</p>
                <p className="mt-1 truncate text-[#94A3B8]">{item.fileName}</p>
              </div>
            </div>
            <span className="text-[#B8C2D0]">{item.provider}</span>
            <div>
              {instance.contentManagementEnabled ? (
                <button
                  type="button"
                  className={`flex h-8 w-14 items-center rounded-full border p-1 transition ${
                    item.enabled
                      ? "border-orange-400/40 bg-[#f05a28]"
                      : "border-white/10 bg-white/10"
                  }`}
                  onClick={() => toggleContent.mutate({ id: item.id, enabled: !item.enabled })}
                  disabled={toggleContent.isPending}
                  title={item.enabled ? "Desativar" : "Ativar"}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow transition ${
                      item.enabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              ) : (
                <span className="text-xs text-[#94A3B8]">{item.enabled ? "Ativo" : "Desativado"}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {instance.contentManagementEnabled && updateMap.get(item.id)?.updateAvailable ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-sm"
                  onClick={() => updateSingle(item.id)}
                  disabled={updateOne.isPending}
                  title={updateMap.get(item.id)?.latestFileName ?? "Update disponivel"}
                >
                  Update
                </Button>
              ) : null}
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-sm text-[#94A3B8] hover:bg-red-500/15 hover:text-red-200"
                title="Remover arquivo da instancia"
                disabled={!instance.contentManagementEnabled || removeContent.isPending}
                onClick={() => removeSingle(item.id, item.name)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#94A3B8]">
            Nenhum conteúdo deste tipo instalado ainda.
          </div>
        ) : null}
      </Card>
    </div>
  );
};

const findInstanceDownload = (downloads: DownloadItem[], instance: LauncherInstance) => {
  const gameDir = normalizePath(instance.gameDir);
  const needles = [
    `minecraft ${instance.minecraftVersion}`,
    `${instance.loader} ${instance.minecraftVersion}`,
  ];

  return downloads.find((download) => {
    if (!["queued", "running"].includes(download.status)) {
      return false;
    }

    const destination = normalizePath(download.destination);
    const label = download.label.toLowerCase();

    return (
      destination.startsWith(gameDir) ||
      needles.some((needle) => label.includes(needle.toLowerCase()))
    );
  });
};

const normalizePath = (value: string) => value.replaceAll("\\", "/").toLowerCase();

const ContentIcon = ({
  type,
  iconUrl,
  name,
}: {
  type: ContentType;
  iconUrl?: string;
  name: string;
}) => {
  const Icon =
    type === "resourcepack" ? Palette : type === "shader" ? Sparkles : Package;

  if (iconUrl) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#0D1117] shadow-sm shadow-black/30">
        <img
          src={iconUrl}
          alt=""
          title={name}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-[#60A5FA]">
      <Icon className="h-4 w-4" />
    </span>
  );
};
