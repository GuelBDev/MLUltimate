import { AlertTriangle, Clipboard, FileText, FolderOpen, PowerOff, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { CrashReportDetails } from "../../types/launcher";
import { launcherApi } from "../../services/launcherApi";

type LaunchErrorNoticeProps = {
  log: string;
  crashReport?: CrashReportDetails;
  instanceId?: string;
  onRefreshInstance?: () => void;
  onClear?: () => void;
};

export const LaunchErrorNotice = ({
  log,
  crashReport,
  instanceId,
  onRefreshInstance,
  onClear,
}: LaunchErrorNoticeProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disablingMod, setDisablingMod] = useState(false);
  const [modDisabled, setModDisabled] = useState(false);

  const displayLog = crashReport?.fullContent || log;
  const culprit = crashReport?.culpritModName;
  const recommendation = crashReport?.recommendation;

  const copyLog = async () => {
    await navigator.clipboard.writeText(displayLog);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDisableCulpritMod = async () => {
    if (!instanceId || !crashReport?.culpritFilePath) return;

    setDisablingMod(true);
    try {
      await launcherApi.toggleInstanceFile({
        instanceId,
        relativePath: crashReport.culpritFilePath,
        enabled: false,
      });
      setModDisabled(true);
      onRefreshInstance?.();
    } catch (e) {
      console.warn("Falha ao desativar mod:", e);
    } finally {
      setDisablingMod(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-950/40 via-[#160B0E] to-[#120D14] p-4 text-sm shadow-lg shadow-black/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/20 text-red-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-red-200">
                  {crashReport ? "Minecraft fechou inesperadamente (Crash Detectado)" : "Ocorreu um erro no Minecraft"}
                </span>
                {culprit ? (
                  <Badge tone="red">
                    Mod causador: {culprit}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#D8B4B8]">
                {recommendation || log.split("\n")[0] || "O jogo foi encerrado após uma falha de execução."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="rounded-lg font-medium shadow-md shadow-red-950/50"
              onClick={() => setOpen(true)}
            >
              <FileText className="h-3.5 w-3.5" />
              Ver Diagnóstico
            </Button>
            {onClear ? (
              <button
                type="button"
                className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-white"
                onClick={onClear}
                title="Dispensar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-md">
          <section className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-red-500/30 bg-[#0E131F] shadow-2xl shadow-black/80 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#141A28] p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/20 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Relatório de Diagnóstico de Crash</h2>
                    {culprit ? <Badge tone="red">{culprit}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">
                    {crashReport?.crashFileName
                      ? `Arquivo: ${crashReport.crashFileName}`
                      : "Detalhes do encerramento inesperado do Minecraft"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl p-2 text-[#94A3B8] hover:bg-white/8 hover:text-white"
                onClick={() => setOpen(false)}
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
              {/* Diagnosis Summary Card */}
              {recommendation || culprit ? (
                <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-sm text-[#D7E2F2]">
                  <div className="flex items-center gap-2 font-semibold text-blue-300">
                    <Sparkles className="h-4 w-4" />
                    Diagnóstico Automático
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#CBD5E1]">
                    {recommendation}
                  </p>

                  {crashReport?.exceptionType ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono">
                      <span className="rounded bg-black/40 px-2 py-1 text-red-300">
                        Exceção: {crashReport.exceptionType}
                      </span>
                      {crashReport.description ? (
                        <span className="rounded bg-black/40 px-2 py-1 text-[#94A3B8]">
                          Causa: {crashReport.description}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Action Banner for Disabling Culprit Mod */}
              {instanceId && crashReport?.culpritFilePath ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <PowerOff className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      {modDisabled
                        ? `O mod ${culprit || "problemático"} foi desativado com sucesso nesta instância.`
                        : `Deseja desativar o mod ${culprit || ""} para conseguir abrir o jogo normalmente?`}
                    </span>
                  </div>
                  {!modDisabled ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={disablingMod}
                      className="rounded-lg border-amber-500/30 text-amber-100 hover:bg-amber-500/20"
                      onClick={handleDisableCulpritMod}
                    >
                      {disablingMod ? "Desativando..." : `Desativar ${culprit || "Mod"}`}
                    </Button>
                  ) : (
                    <Badge tone="green">Mod Desativado</Badge>
                  )}
                </div>
              ) : null}

              {/* Full Log Viewer */}
              <div className="flex flex-1 flex-col">
                <div className="mb-1.5 flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Conteúdo do Relatório / Stacktrace:</span>
                  <span>{displayLog.split(/\r?\n/).length} linhas</span>
                </div>
                <textarea
                  readOnly
                  value={displayLog}
                  className="min-h-[280px] flex-1 resize-none rounded-xl border border-white/10 bg-[#05080D] p-4 font-mono text-xs leading-5 text-[#D7E2F2] outline-none select-text selection:bg-[#3B82F6]/40"
                />
              </div>

              {/* Modal Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                <div className="flex items-center gap-2">
                  {instanceId ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => launcherApi.openInstanceSubfolder(instanceId, "logs")}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Pasta de Logs
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => launcherApi.openInstanceSubfolder(instanceId, "mods")}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Pasta de Mods
                      </Button>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" className="rounded-xl" onClick={copyLog}>
                    <Clipboard className="h-4 w-4" />
                    {copied ? "Copiado!" : "Copiar Relatório"}
                  </Button>
                  <Button type="button" className="rounded-xl" onClick={() => setOpen(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};
