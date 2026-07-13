import { Clock3, FolderOpen, MoreVertical, Pencil, Play, Power, Trash2, X } from "lucide-react";
import { useState } from "react";
import instanceDefaultImage from "../../assets/instance-default.png";
import type { DownloadItem, LaunchEvent, LauncherInstance } from "../../types/launcher";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { cn } from "../../utils/cn";
import { formatDownloadEta, formatDownloadSize, formatDownloadSpeed } from "../../utils/downloadFormat";

type InstanceTileProps = {
  instance: LauncherInstance;
  onOpen: (instance: LauncherInstance) => void;
  onPlay: (instance: LauncherInstance) => void;
  onEdit: (instance: LauncherInstance) => void;
  onDelete: (instance: LauncherInstance) => void;
  onOpenFolder?: (instance: LauncherInstance) => void;
  onKill?: (instance: LauncherInstance) => void;
  download?: DownloadItem;
  launchEvent?: LaunchEvent;
  isRunning?: boolean;
  onCancelDownload?: (downloadId: string) => void;
  onCancelLaunch?: (instance: LauncherInstance) => void;
  compact?: boolean;
};

export const InstanceTile = ({
  instance,
  onOpen,
  onPlay,
  onEdit,
  onDelete,
  onOpenFolder,
  onKill,
  download,
  launchEvent,
  isRunning = false,
  onCancelDownload,
  onCancelLaunch,
  compact = false,
}: InstanceTileProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLaunch =
    launchEvent && ["step", "console", "security"].includes(launchEvent.type)
      ? launchEvent
      : null;
  const activeDownload =
    download && ["queued", "running"].includes(download.status) ? download : null;
  const activityLabel = activeLaunch?.message ?? activeDownload?.label;
  const activityProgress = activeLaunch?.progress ?? activeDownload?.progress ?? 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-sm bg-[#1f1f1f] shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:bg-[#252525]",
        compact ? "w-full" : "w-[164px]",
      )}
    >
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onOpen(instance)}
      >
        <div
          className="relative h-[160px] bg-cover bg-center"
          style={{ backgroundImage: `url(${instance.iconDataUrl ?? instanceDefaultImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" />
          <div className="absolute left-2 top-2 rounded-sm bg-black/70 px-2 py-1 text-xs font-semibold text-white">
            {instance.minecraftVersion}
          </div>
          <button
            type="button"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-sm bg-black/70 text-white transition hover:bg-[#3B82F6]"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((value) => !value);
            }}
            aria-label="Ações da instância"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <p className="truncate text-sm font-semibold text-white">{instance.name}</p>
          <p className="mt-1 truncate text-xs text-[#B8C2D0]">
            {instance.loader} | {instance.modsCount} mods
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <Clock3 className="h-3.5 w-3.5 text-[#60A5FA]" />
            {formatPlayTime(instance.playTimeSeconds)} jogados
          </p>
          {activityLabel ? (
            <div className="mt-3 rounded-sm border border-white/10 bg-black/20 p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs text-[#D8DEE9]">{activityLabel}</p>
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[#94A3B8] hover:bg-red-500/20 hover:text-red-100"
                  title="Cancelar"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (activeLaunch) {
                      onCancelLaunch?.(instance);
                      return;
                    }
                    if (activeDownload) {
                      onCancelDownload?.(activeDownload.id);
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {activeDownload ? (
                <div className="mb-2 flex flex-wrap justify-between gap-1 text-[11px] text-[#94A3B8]">
                  <span>
                    {formatDownloadSpeed(activeDownload.speedBytesPerSecond)}
                    {" · "}
                    {formatDownloadEta(activeDownload)}
                  </span>
                  <span>{formatDownloadSize(activeDownload)}</span>
                </div>
              ) : null}
              <Progress value={activityProgress} className="h-1.5" />
            </div>
          ) : null}
        </div>
      </button>

      <div className="px-3 pb-3">
        {isRunning ? (
          <Button
            type="button"
            className="h-9 w-full rounded-sm bg-red-600 hover:bg-red-500"
            onClick={() => onKill?.(instance)}
          >
            <Power className="h-4 w-4" />
            Kill Instance
          </Button>
        ) : (
          <Button
            type="button"
            className="h-9 w-full rounded-sm bg-[#3B82F6] hover:bg-[#60A5FA]"
            onClick={() => onPlay(instance)}
          >
            <Play className="h-4 w-4 fill-white" />
            Play
          </Button>
        )}
      </div>

      {menuOpen ? (
        <div className="absolute right-2 top-11 z-10 w-36 overflow-hidden rounded-sm border border-white/10 bg-[#2b2b2b] shadow-2xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10"
            onClick={() => {
              setMenuOpen(false);
              onEdit(instance);
            }}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10"
            onClick={() => {
              setMenuOpen(false);
              onOpenFolder?.(instance);
            }}
          >
            <FolderOpen className="h-4 w-4" />
            Pasta
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20"
            onClick={() => {
              setMenuOpen(false);
              onDelete(instance);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </button>
        </div>
      ) : null}
    </div>
  );
};

const formatPlayTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes} min`;
};
