import { useState, useMemo } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  FolderOpen,
  Info,
  Package,
  X,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useDownloads } from "../hooks/useDownloads";
import { launcherApi } from "../services/launcherApi";
import { cn } from "../utils/cn";
import {
  formatDownloadEta,
  formatDownloadSize,
  formatDownloadSpeed,
} from "../utils/downloadFormat";
import type { DownloadItem, DownloadStatus } from "../types/launcher";

const detectDownloadType = (
  item: DownloadItem,
): { label: string; tone: "blue" | "green" | "slate" } => {
  const destLower = item.destination.toLowerCase();
  const labelLower = item.label.toLowerCase();

  if (
    destLower.includes("/mods/") ||
    destLower.includes("\\mods\\") ||
    labelLower.includes("mod ") ||
    labelLower.startsWith("mod:")
  ) {
    return { label: "Mod", tone: "blue" };
  }
  if (
    destLower.includes("/shaderpacks/") ||
    destLower.includes("\\shaderpacks\\") ||
    labelLower.includes("shader")
  ) {
    return { label: "Shaderpack", tone: "blue" };
  }
  if (
    destLower.includes("/resourcepacks/") ||
    destLower.includes("\\resourcepacks\\") ||
    labelLower.includes("textura") ||
    labelLower.includes("resourcepack")
  ) {
    return { label: "Textura", tone: "slate" };
  }
  if (
    destLower.includes("/modpacks/") ||
    destLower.includes("\\modpacks\\") ||
    labelLower.includes("modpack")
  ) {
    return { label: "Modpack", tone: "green" };
  }
  if (
    destLower.includes("/instances/") ||
    destLower.includes("\\instances\\") ||
    labelLower.includes("instancia") ||
    labelLower.includes("instância")
  ) {
    return { label: "Instância", tone: "green" };
  }
  if (
    labelLower.includes("minecraft") ||
    destLower.includes("/versions/") ||
    destLower.includes("\\versions\\")
  ) {
    return { label: "Versão Minecraft", tone: "blue" };
  }

  return { label: "Arquivo", tone: "slate" };
};

const DownloadInfoModal = ({
  item,
  onClose,
}: {
  item: DownloadItem;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState(false);
  const typeInfo = detectDownloadType(item);
  const fileName = item.destination.split(/[/\\]/).pop() || item.destination;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.destination);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignora erro se clipboard não estiver disponível
    }
  };

  const handleOpenFolder = () => {
    void launcherApi.openDownloadFolder(item.destination);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/12 bg-[#121620] p-6 shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                Informações do Download
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-white truncate max-w-[340px]">
                {item.label}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-[#94A3B8] transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge tone={typeInfo.tone}>{typeInfo.label}</Badge>
          <Badge
            tone={
              item.status === "completed"
                ? "green"
                : item.status === "failed"
                  ? "red"
                  : item.status === "cancelled"
                    ? "slate"
                    : "blue"
            }
          >
            {item.status === "completed"
              ? "Concluído"
              : item.status === "failed"
                ? "Falhou"
                : item.status === "cancelled"
                  ? "Cancelado"
                  : item.status === "running"
                    ? "Baixando"
                    : "Na fila"}
          </Badge>
          {item.progress > 0 && item.status !== "completed" ? (
            <Badge tone="slate">{Math.round(item.progress)}%</Badge>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-white/8 bg-[#0D1117]/80 p-3.5 text-xs text-[#94A3B8]">
          <div>
            <span className="text-[#64748B] block">Tamanho</span>
            <span className="font-medium text-white">{formatDownloadSize(item)}</span>
          </div>
          <div>
            <span className="text-[#64748B] block">Arquivo</span>
            <span className="font-medium text-white truncate block" title={fileName}>
              {fileName}
            </span>
          </div>
          <div>
            <span className="text-[#64748B] block">Iniciado em</span>
            <span className="font-medium text-white">
              {new Date(item.startedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
          <div>
            <span className="text-[#64748B] block">Status Final</span>
            <span className="font-medium text-white">
              {item.completedAt
                ? new Date(item.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : item.status === "running"
                  ? "Em andamento"
                  : "-"}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#94A3B8]">
              Diretório de Destino
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-green-400" />
                  <span className="text-green-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copiar caminho</span>
                </>
              )}
            </button>
          </div>
          <div className="mt-1.5 rounded-xl border border-white/10 bg-[#090D14] p-3 text-xs font-mono text-[#CBD5E1] break-all select-all">
            {item.destination}
          </div>
        </div>

        {item.error ? (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
            {item.error}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button
            type="button"
            className="flex items-center gap-2"
            onClick={handleOpenFolder}
          >
            <FolderOpen className="h-4 w-4" />
            <span>Abrir Pasta no Explorer</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

const extractModpackGroup = (item: DownloadItem): { groupId: string; groupTitle: string } | null => {
  if (item.groupId && item.groupTitle) {
    return { groupId: item.groupId, groupTitle: item.groupTitle };
  }

  const match = item.label.match(/^(?:Adicionando|Atualizando|Instalando)\s+(.+?)\s+em\s+(.+)$/i);
  if (match && match[2]) {
    const title = match[2].trim();
    return { groupId: `named:${title.toLowerCase()}`, groupTitle: title };
  }

  const destMatch = item.destination.match(/[\\/]instances[\\/]([^\\/]+)[\\/](?:mods|resourcepacks|shaderpacks)[\\/]/i);
  if (destMatch && destMatch[1]) {
    const instanceName = destMatch[1].trim();
    return { groupId: `instance:${instanceName.toLowerCase()}`, groupTitle: instanceName };
  }

  return null;
};

const getItemDetails = (item: DownloadItem) => {
  const typeInfo = detectDownloadType(item);
  let typeLabel = typeInfo.label;
  let tone: "blue" | "green" | "slate" = typeInfo.tone;

  if (item.contentType === "mod") {
    typeLabel = "Mod";
    tone = "blue";
  } else if (item.contentType === "resourcepack") {
    typeLabel = "Textura";
    tone = "slate";
  } else if (item.contentType === "shader") {
    typeLabel = "Shader";
    tone = "blue";
  }

  const fileName = item.destination.split(/[/\\]/).pop() || item.destination;

  let name = item.contentName;
  let version = item.contentVersion;

  if (!name) {
    const match = item.label.match(/^(?:Adicionando|Atualizando|Instalando)\s+(.+?)(?:\s+em\s+.+)?$/i);
    name = match ? match[1] : fileName;
  }

  if (!version) {
    const vMatch = fileName.match(/[-_](\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.]+)?)(?:\.jar|\.zip)?$/i);
    if (vMatch) {
      version = vMatch[1];
    }
  }

  return {
    typeLabel,
    tone,
    fileName,
    name,
    version: version || "Padrão",
  };
};

const formatExactTime = (dateStr?: string) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const dateFormatted = date.toLocaleDateString([], {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeFormatted = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `${dateFormatted} às ${timeFormatted}`;
  } catch {
    return dateStr;
  }
};

type GroupedDownload = {
  key: string;
  title: string;
  items: DownloadItem[];
  startedAt: string;
  completedAt?: string;
  totalBytes: number;
  bytesReceived: number;
  status: DownloadStatus;
  progress: number;
  speedBytesPerSecond: number;
  hasActive: boolean;
};

type DownloadDisplayEntry =
  | { kind: "group"; group: GroupedDownload }
  | { kind: "single"; item: DownloadItem };

export const DownloadsPage = () => {
  const downloads = useDownloads();
  const items = downloads.data ?? [];
  const [selectedInfoItem, setSelectedInfoItem] = useState<DownloadItem | null>(null);
  const [openTrays, setOpenTrays] = useState<Record<string, boolean>>({});

  const toggleTray = (key: string) => {
    setOpenTrays((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const isTrayOpen = (key: string) => openTrays[key] !== false;

  const displayEntries: DownloadDisplayEntry[] = useMemo(() => {
    const groupMap = new Map<string, GroupedDownload>();
    const singles: DownloadItem[] = [];

    for (const item of items) {
      const groupInfo = extractModpackGroup(item);
      if (groupInfo) {
        let group = groupMap.get(groupInfo.groupId);
        if (!group) {
          group = {
            key: groupInfo.groupId,
            title: groupInfo.groupTitle,
            items: [],
            startedAt: item.startedAt,
            completedAt: item.completedAt,
            totalBytes: 0,
            bytesReceived: 0,
            status: "completed",
            progress: 0,
            speedBytesPerSecond: 0,
            hasActive: false,
          };
          groupMap.set(groupInfo.groupId, group);
        }
        group.items.push(item);
      } else {
        singles.push(item);
      }
    }

    const entries: DownloadDisplayEntry[] = [];
    for (const group of groupMap.values()) {
      let totalB = 0;
      let receivedB = 0;
      let speed = 0;
      let hasRunning = false;
      let hasFailed = false;
      let allCancelled = true;

      for (const item of group.items) {
        totalB += item.totalBytes || 0;
        receivedB += item.bytesReceived || 0;
        speed += item.speedBytesPerSecond || 0;
        if (item.status === "running" || item.status === "queued") {
          hasRunning = true;
          allCancelled = false;
        } else if (item.status === "failed") {
          hasFailed = true;
          allCancelled = false;
        } else if (item.status === "completed") {
          allCancelled = false;
        }
      }

      group.totalBytes = totalB;
      group.bytesReceived = receivedB;
      group.speedBytesPerSecond = speed;
      group.hasActive = hasRunning;
      group.status = hasRunning
        ? "running"
        : hasFailed
          ? "failed"
          : allCancelled
            ? "cancelled"
            : "completed";
      group.progress =
        totalB > 0
          ? Math.min(100, Math.round((receivedB / totalB) * 100))
          : group.status === "completed"
            ? 100
            : 0;

      entries.push({ kind: "group", group });
    }

    for (const single of singles) {
      entries.push({ kind: "single", item: single });
    }

    return entries;
  }, [items]);

  return (
    <div className="space-y-4">
      {displayEntries.map((entry) => {
        if (entry.kind === "group") {
          const { group } = entry;
          const open = isTrayOpen(group.key);
          const firstDestination = group.items[0]?.destination;

          return (
            <Card
              key={group.key}
              className="overflow-hidden border border-white/10 bg-[#121620] p-0 shadow-lg"
            >
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-sky-500/25 bg-sky-500/10 text-sky-400 shrink-0 shadow-sm">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-white">
                          {group.title}
                        </h3>
                        <Badge tone="green">Bandeja do Modpack</Badge>
                        <Badge tone="slate">
                          {group.items.length}{" "}
                          {group.items.length === 1 ? "item adicionado" : "itens adicionados"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">
                        {group.status === "running"
                          ? "Instalando mods e conteúdos nesta instância..."
                          : `Todos os ${group.items.length} itens foram processados nesta instância.`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      tone={
                        group.status === "completed"
                          ? "green"
                          : group.status === "failed"
                            ? "red"
                            : group.status === "cancelled"
                              ? "slate"
                              : "blue"
                      }
                    >
                      {group.status === "completed"
                        ? "Concluído"
                        : group.status === "failed"
                          ? "Com Falhas"
                          : group.status === "cancelled"
                            ? "Cancelado"
                            : "Baixando"}
                    </Badge>

                    {firstDestination ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-1.5"
                        onClick={() => launcherApi.openDownloadFolder(firstDestination)}
                        title="Abrir pasta do modpack no Explorer"
                      >
                        <FolderOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">Pasta</span>
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleTray(group.key)}
                      className="flex items-center gap-1.5 border-white/15 bg-white/5 hover:bg-white/10"
                    >
                      <span>{open ? "Recolher" : "Abrir Bandeja"}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          open && "rotate-180",
                        )}
                      />
                    </Button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex flex-wrap justify-between gap-3 text-xs text-[#94A3B8]">
                    <span>
                      {group.status === "running"
                        ? `${formatDownloadSpeed(group.speedBytesPerSecond)} · Baixando...`
                        : `${group.items.length} arquivos organizados`}
                    </span>
                    <span className="font-medium text-slate-300">
                      {formatDownloadSize({
                        bytesReceived: group.bytesReceived,
                        totalBytes: group.totalBytes,
                      })}
                    </span>
                  </div>
                  <Progress value={group.progress} />
                </div>
              </div>

              {open ? (
                <div className="border-t border-white/10 bg-[#0A0E17]/60 p-4 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    <span>Mods e complementos nesta bandeja</span>
                    <span>Hora & Tamanho</span>
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const details = getItemDetails(item);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-3 transition hover:border-white/12 hover:bg-white/[0.05]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {item.status === "completed" ? (
                              <CheckCircle2 className="h-4 w-4 text-[#22C55E] shrink-0" />
                            ) : item.status === "failed" ? (
                              <AlertCircle className="h-4 w-4 text-[#EF4444] shrink-0" />
                            ) : (
                              <Download className="h-4 w-4 text-[#60A5FA] shrink-0 animate-pulse" />
                            )}
                            <Badge tone={details.tone} className="shrink-0 text-[11px] px-2 py-0.5">
                              {details.typeLabel}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className="truncate text-sm font-medium text-white"
                                  title={details.name}
                                >
                                  {details.name}
                                </p>
                                <span className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] font-mono text-[#94A3B8]">
                                  {details.version}
                                </span>
                              </div>
                              <p className="truncate text-xs text-[#64748B]" title={details.fileName}>
                                {details.fileName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t border-white/5 sm:border-0">
                            <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
                              <Clock className="h-3.5 w-3.5 text-[#64748B]" />
                              <span>{formatExactTime(item.completedAt || item.startedAt)}</span>
                            </div>
                            <div className="min-w-[70px] text-right text-xs font-medium text-sky-400">
                              {formatDownloadSize(item)}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedInfoItem(item)}
                              className="h-7 w-7 p-0 flex items-center justify-center"
                              title="Ver detalhes do arquivo"
                            >
                              <Info className="h-3.5 w-3.5 text-sky-400" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        }

        const { item } = entry;
        const typeInfo = detectDownloadType(item);

        return (
          <Card key={item.id} className="p-5">
            <div className="flex items-center justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {item.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                  ) : item.status === "failed" ? (
                    <AlertCircle className="h-4 w-4 text-[#EF4444]" />
                  ) : (
                    <Download className="h-4 w-4 text-[#60A5FA]" />
                  )}
                  <p className="truncate text-base font-semibold text-white">{item.label}</p>
                  <Badge tone={typeInfo.tone}>{typeInfo.label}</Badge>
                </div>
                {item.currentStep ? (
                  <p className="mt-1 truncate text-xs font-medium text-sky-400">
                    {item.currentStep}
                  </p>
                ) : null}
                {item.error ? <p className="mt-2 text-sm text-red-200">{item.error}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedInfoItem(item)}
                  className="flex items-center gap-1.5"
                  title="Ver detalhes do arquivo e abrir pasta"
                >
                  <Info className="h-3.5 w-3.5 text-sky-400" />
                  <span>Info</span>
                </Button>
                <Badge
                  tone={
                    item.status === "completed"
                      ? "green"
                      : item.status === "failed"
                        ? "red"
                        : item.status === "cancelled"
                          ? "slate"
                          : "blue"
                  }
                >
                  {item.status}
                </Badge>
                {["queued", "running"].includes(item.status) ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    title="Cancelar download"
                    onClick={() => launcherApi.cancelDownload(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap justify-between gap-3 text-sm text-[#94A3B8]">
                <span>
                  {formatDownloadSpeed(item.speedBytesPerSecond)}
                  {item.status === "running" ? ` · ${formatDownloadEta(item)}` : ""}
                </span>
                <span>{formatDownloadSize(item)}</span>
              </div>
              <Progress value={item.progress} />
            </div>
          </Card>
        );
      })}

      {displayEntries.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-white">Nenhum download na fila</p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Baixe uma versão do Minecraft, mod, textura ou shader para acompanhar o progresso aqui.
          </p>
        </Card>
      ) : null}

      {selectedInfoItem ? (
        <DownloadInfoModal
          item={selectedInfoItem}
          onClose={() => setSelectedInfoItem(null)}
        />
      ) : null}
    </div>
  );
};
