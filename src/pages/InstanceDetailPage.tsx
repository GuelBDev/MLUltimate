import { ArrowLeft, FolderOpen, Plus, Play, Power, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import heroImage from "../assets/launcher-hero.png";
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
  const dialog = useAppDialog();
  const [activeTab, setActiveTab] = useState<ContentType>("mod");
  const content = useInstalledContent(instance.id);
  const { openFolder } = useInstances();
  const downloads = useDownloads();
  const runningInstances = useRunningInstances();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchEvent, setLaunchEvent] = useState<LaunchEvent | null>(null);
  const items = useMemo(
    () => (content.data ?? []).filter((item) => item.type === activeTab),
    [activeTab, content.data],
  );
  const activeDownload = useMemo(
    () => findInstanceDownload(downloads.data ?? [], instance),
    [downloads.data, instance],
  );
  const activity = launchEvent ?? activeDownload;
  const activityLabel = launchEvent?.message ?? activeDownload?.label;
  const activityProgress = launchEvent?.progress ?? activeDownload?.progress ?? 0;

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
            style={{ backgroundImage: `url(${instance.iconDataUrl ?? heroImage})` }}
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

      {launchError ? (
        <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {launchError}
        </div>
      ) : null}

      <div className="flex items-center justify-between border-b border-white/10">
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
        <Button
          type="button"
          variant="secondary"
          className="mb-3 rounded-sm"
          onClick={() => onExplore(activeTab, instance.id)}
        >
          <Plus className="h-4 w-4" />
          Add Content
        </Button>
      </div>

      <Card className="overflow-hidden rounded-sm border-white/10 bg-[#1f1f1f]">
        <div className="grid grid-cols-[1fr_180px_120px] border-b border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-white">
          <span>Name</span>
          <span>Provider</span>
          <span>Action</span>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_180px_120px] items-center border-b border-white/6 px-4 py-4 text-sm last:border-b-0"
          >
            <div>
              <p className="font-semibold text-white">{item.name}</p>
              <p className="mt-1 text-[#94A3B8]">{item.fileName}</p>
            </div>
            <span className="text-[#B8C2D0]">{item.provider}</span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-sm text-[#94A3B8] hover:bg-red-500/15 hover:text-red-200"
              title="Remover arquivo manualmente pela pasta da instância"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
