import { AlertTriangle, Clipboard, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";

type LaunchErrorNoticeProps = {
  log: string;
};

export const LaunchErrorNotice = ({ log }: LaunchErrorNoticeProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLog = async () => {
    await navigator.clipboard.writeText(log);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">Ocorreu um erro inesperado.</span>
        </div>
        <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>
          Ver Log
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <section className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#10151E] shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Log do erro</h2>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Use este log para diagnosticar o problema sem poluir a tela principal.
                </p>
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

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
              <textarea
                readOnly
                value={log}
                className="min-h-[320px] flex-1 resize-none rounded-xl border border-white/10 bg-[#05080D] p-4 font-mono text-xs leading-5 text-[#D7E2F2] outline-none"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={copyLog}>
                  <Clipboard className="h-4 w-4" />
                  {copied ? "Copiado" : "Copiar Log"}
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};
