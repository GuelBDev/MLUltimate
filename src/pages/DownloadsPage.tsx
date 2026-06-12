import { AlertCircle, CheckCircle2, Download, X } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { useDownloads } from "../hooks/useDownloads";
import { launcherApi } from "../services/launcherApi";

export const DownloadsPage = () => {
  const downloads = useDownloads();
  const items = downloads.data ?? [];

  return (
    <div className="space-y-4">
      {items.map((item) => (
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
              </div>
              <p className="mt-1 truncate text-sm text-[#94A3B8]">{item.destination}</p>
              {item.error ? <p className="mt-2 text-sm text-red-200">{item.error}</p> : null}
            </div>
            <div className="flex items-center gap-2">
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
            <div className="mb-2 flex justify-between text-sm text-[#94A3B8]">
              <span>{formatBytes(item.speedBytesPerSecond)}/s</span>
              <span>
                {formatBytes(item.bytesReceived)}
                {item.totalBytes ? ` / ${formatBytes(item.totalBytes)}` : ""}
              </span>
            </div>
            <Progress value={item.progress} />
          </div>
        </Card>
      ))}

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-white">Nenhum download na fila</p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Baixe uma versão do Minecraft, mod, textura ou shader para acompanhar o progresso aqui.
          </p>
        </Card>
      ) : null}
    </div>
  );
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};
