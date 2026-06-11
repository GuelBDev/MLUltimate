import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { launcherApi } from "../../services/launcherApi";
import appIcon from "../../assets/mlultimate-icon.png";

type StartupStepStatus = "waiting" | "running" | "done";

type StartupStep = {
  id: string;
  label: string;
  detail: string;
  status: StartupStepStatus;
};

const baseSteps: StartupStep[] = [
  {
    id: "core",
    label: "Inicializando o launcher",
    detail: "Carregando servicos internos",
    status: "waiting",
  },
  {
    id: "session",
    label: "Carregando perfil",
    detail: "Verificando sessao local",
    status: "waiting",
  },
  {
    id: "updates",
    label: "Checando atualizacoes",
    detail: "Procurando uma versao mais recente",
    status: "waiting",
  },
  {
    id: "library",
    label: "Preparando biblioteca",
    detail: "Sincronizando instancias e downloads",
    status: "waiting",
  },
  {
    id: "ready",
    label: "Abrindo MLUltimate",
    detail: "Tudo pronto para jogar",
    status: "waiting",
  },
];

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const updateStep = (
  steps: StartupStep[],
  id: string,
  status: StartupStepStatus,
  detail?: string,
) =>
  steps.map((step) =>
    step.id === id
      ? {
          ...step,
          status,
          detail: detail ?? step.detail,
        }
      : step,
  );

type StartupScreenProps = {
  onComplete: () => void;
};

export function StartupScreen({ onComplete }: StartupScreenProps) {
  const [steps, setSteps] = useState(baseSteps);
  const [progress, setProgress] = useState(8);
  const [statusText, setStatusText] = useState("Iniciando MLUltimate Launcher");
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const currentStep = useMemo(
    () => steps.find((step) => step.status === "running") ?? steps.find((step) => step.status !== "done"),
    [steps],
  );

  useEffect(() => {
    let cancelled = false;

    const setRunning = (id: string, detail?: string) => {
      if (cancelled) return;
      setSteps((current) => updateStep(current, id, "running", detail));
    };

    const setDone = (id: string, detail?: string) => {
      if (cancelled) return;
      setSteps((current) => updateStep(current, id, "done", detail));
    };

    const runStartup = async () => {
      const startedAt = Date.now();
      setError(null);
      setIsRetrying(false);

      try {
        setRunning("core");
        setStatusText("Inicializando o launcher");
        setProgress(14);
        await sleep(420);
        setDone("core", "Core carregado");

        setRunning("session");
        setStatusText("Carregando sua conta");
        setProgress(32);
        await Promise.allSettled([launcherApi.getSession(), launcherApi.getSettings()]);
        setDone("session", "Perfil local pronto");

        setRunning("updates");
        setStatusText("Checando atualizacoes");
        setProgress(52);
        const updaterState = await launcherApi.checkForUpdates();
        setDone(
          "updates",
          updaterState.status === "downloaded"
            ? "Atualizacao pronta para instalar"
            : updaterState.status === "available" || updaterState.status === "downloading"
              ? "Atualizacao encontrada"
              : "Nenhuma atualizacao bloqueando a entrada",
        );

        setRunning("library");
        setStatusText("Preparando biblioteca");
        setProgress(78);
        await Promise.allSettled([launcherApi.listInstances(), launcherApi.listDownloads()]);
        setDone("library", "Biblioteca pronta");

        setRunning("ready");
        setStatusText("Abrindo launcher");
        setProgress(94);

        const elapsed = Date.now() - startedAt;
        await sleep(Math.max(500, 2600 - elapsed));

        if (!cancelled) {
          setDone("ready");
          setProgress(100);
          await sleep(360);
          onComplete();
        }
      } catch (startupError) {
        if (cancelled) return;
        setError(startupError instanceof Error ? startupError.message : "Nao foi possivel iniciar o launcher.");
        setIsRetrying(false);
      }
    };

    void runStartup();

    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid min-h-screen place-items-center overflow-hidden bg-transparent px-6 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <motion.section
        className="relative flex w-full max-w-[460px] flex-col items-center rounded-2xl border border-white/10 bg-[#161B22]/86 px-8 py-9 text-center shadow-2xl shadow-black/40 backdrop-blur-xl"
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div
          className="mb-6 grid size-24 place-items-center rounded-[28px] border border-[#60A5FA]/30 bg-[#0D1117]/80 shadow-xl shadow-[#3B82F6]/20"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img src={appIcon} alt="MLUltimate" className="size-20 rounded-2xl object-contain" />
        </motion.div>

        <p className="text-sm font-semibold text-[#60A5FA]">MLUltimate Launcher</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white">
          {statusText}
        </h1>
        <p className="mt-2 min-h-5 text-sm text-[#94A3B8]">
          {currentStep?.detail ?? "Preparando sua experiencia"}
        </p>

        <div className="mt-7 w-full">
          <Progress value={progress} className="h-2 bg-[#1F2937]" />
          <div className="mt-3 flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Alpha 1.0</span>
            <span>{progress}%</span>
          </div>
        </div>

        <div className="mt-7 flex w-full flex-col gap-2 text-left">
          {steps.map((step) => (
            <motion.div
              key={step.id}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-[#0D1117]/52 px-3 py-2.5"
              animate={{
                opacity: step.status === "waiting" ? 0.58 : 1,
                borderColor: step.status === "running" ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.08)",
              }}
            >
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-[#1F2937] text-[#94A3B8]">
                {step.status === "done" ? (
                  <Check className="size-4 text-[#22C55E]" />
                ) : step.status === "running" ? (
                  <Loader2 className="size-4 animate-spin text-[#60A5FA]" />
                ) : (
                  <span className="size-1.5 rounded-full bg-[#94A3B8]/70" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{step.label}</p>
                <p className="truncate text-xs text-[#94A3B8]">{step.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {error ? (
            <motion.div
              className="mt-5 w-full rounded-xl border border-[#EF4444]/35 bg-[#EF4444]/10 p-3 text-left"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              <p className="text-sm font-medium text-white">Falha ao iniciar</p>
              <p className="mt-1 text-xs text-[#FCA5A5]">{error}</p>
              <Button
                className="mt-3 w-full"
                disabled={isRetrying}
                onClick={() => {
                  setIsRetrying(true);
                  setSteps(baseSteps);
                  setProgress(8);
                  window.location.reload();
                }}
              >
                <RefreshCw className="size-4" />
                Tentar novamente
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
