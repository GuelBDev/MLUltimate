import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./button";
import { Progress } from "./progress";
import { AppDialogContext, type AppDialogApi, type DialogRequest } from "./appDialogContext";

type DialogState = DialogRequest & {
  mode: "alert" | "confirm";
  resolve: (value: boolean) => void;
};

export const AppDialogProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const close = useCallback(
    (value: boolean) => {
      setDialog((current) => {
        current?.resolve(value);
        return null;
      });
    },
    [],
  );

  const openDialog = useCallback(
    (request: DialogRequest, mode: DialogState["mode"]) =>
      new Promise<boolean>((resolve) => {
        setDialog({ ...request, mode, resolve });
      }),
    [],
  );

  const api = useMemo<AppDialogApi>(
    () => ({
      alert: async (request) => {
        await openDialog(request, "alert");
      },
      confirm: (request) => openDialog(request, "confirm"),
    }),
    [openDialog],
  );

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {dialog ? (
          <motion.div
            className="fixed inset-0 z-[90] grid place-items-center bg-black/68 px-4 text-white backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.section
              className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#161B22]/96 shadow-2xl shadow-black/50"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="relative p-5">
                {!dialog.locked ? (
                  <button
                    type="button"
                    className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
                    onClick={() => close(false)}
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}

                <div className="flex gap-4 pr-9">
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${
                      dialog.tone === "danger"
                        ? "border-red-300/25 bg-red-500/12 text-red-200"
                        : dialog.tone === "success"
                          ? "border-green-300/25 bg-green-500/12 text-green-200"
                          : "border-blue-300/25 bg-blue-500/12 text-[#60A5FA]"
                    }`}
                  >
                    {dialog.tone === "loading" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : dialog.tone === "danger" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : dialog.tone === "success" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Info className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-white">{dialog.title}</h2>
                    {dialog.description ? (
                      <p className="mt-2 break-words text-sm leading-6 text-[#94A3B8]">
                        {dialog.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                {typeof dialog.progress === "number" ? (
                  <div className="mt-5">
                    <Progress value={dialog.progress} />
                    <p className="mt-2 text-right text-xs text-[#94A3B8]">
                      {Math.round(dialog.progress)}%
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 bg-[#0D1117]/55 px-5 py-4">
                {dialog.mode === "confirm" && !dialog.locked ? (
                  <Button type="button" variant="secondary" onClick={() => close(false)}>
                    {dialog.cancelLabel ?? "Cancelar"}
                  </Button>
                ) : null}
                {!dialog.locked ? (
                  <Button
                    type="button"
                    variant={dialog.tone === "danger" ? "danger" : "primary"}
                    onClick={() => close(true)}
                  >
                    {dialog.confirmLabel ?? "OK"}
                  </Button>
                ) : null}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AppDialogContext.Provider>
  );
};
