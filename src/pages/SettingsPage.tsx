import { CheckCircle2, DownloadCloud, Languages, MonitorPlay, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { languageOptions } from "../constants/languages";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useUpdater } from "../hooks/useUpdater";
import { launcherApi } from "../services/launcherApi";
import { formatAppVersion } from "../utils/version";

const settingsKey = ["settings"] as const;
const minecraftOpenActions = [
  {
    id: "none",
    label: "Não fazer nada",
    description: "O launcher continua aberto normalmente.",
  },
  {
    id: "minimize",
    label: "Minimizar launcher",
    description: "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.",
  },
  {
    id: "background",
    label: "Fechar para segundo plano",
    description: "Quando o Minecraft abrir, a janela do launcher fica escondida.",
  },
] as const;

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const dialog = useAppDialog();
  const { updater, check, install } = useUpdater();
  const [checkCooldown, setCheckCooldown] = useState(0);
  const [checkingProgress, setCheckingProgress] = useState(0);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: launcherApi.getSettings,
  });
  const updateSettings = useMutation({
    mutationFn: launcherApi.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKey, data);
    },
  });

  const updaterState = updater.data;
  const isChecking = check.isPending || updaterState?.status === "checking";
  const isDownloading = updaterState?.status === "downloading";
  const isDownloaded = updaterState?.status === "downloaded";
  const isUpToDate = updaterState?.status === "not-available";
  const disableCheck = isChecking || isDownloading || checkCooldown > 0 || installingUpdate;
  const statusLabel = isDownloaded
    ? "Pronta"
    : isChecking
      ? "Procurando"
      : isDownloading
        ? "Baixando"
        : isUpToDate
          ? "Atualizado"
          : updaterState?.status === "error"
            ? "Erro"
            : "Aguardando";
  const updateMessage = (() => {
    if (!updaterState) return "Clique em procurar para verificar se existe uma nova versão.";
    if (isChecking) return "Procurando atualizações no GitHub Releases...";
    if (isDownloading) return `Baixando atualização ${updaterState.progress ?? 0}%...`;
    if (isDownloaded) {
      return `Atualização ${formatAppVersion(updaterState.availableVersion)} baixada e pronta para instalar.`;
    }
    if (isUpToDate) return "Você já está com o app atualizado.";
    if (updaterState.status === "available") {
      return `Atualização ${formatAppVersion(updaterState.availableVersion)} encontrada. O download vai começar automaticamente.`;
    }
    if (updaterState.status === "error") {
      return updaterState.message ?? "Não foi possível procurar atualizações agora.";
    }

    return "Clique em procurar para verificar se existe uma nova versão.";
  })();

  useEffect(() => {
    if (checkCooldown <= 0) return;

    const timer = window.setTimeout(() => {
      setCheckCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [checkCooldown]);

  useEffect(() => {
    if (!isChecking) return;

    const timer = window.setInterval(() => {
      setCheckingProgress((current) => (current >= 86 ? 42 : current + 11));
    }, 360);

    return () => window.clearInterval(timer);
  }, [isChecking]);

  const runUpdateCheck = () => {
    if (disableCheck) return;
    setCheckCooldown(5);
    setCheckingProgress(18);
    check.mutate();
  };

  const installDownloadedUpdate = async () => {
    const shouldRestart = await dialog.confirm({
      title: "Atualização pronta",
      description:
        "O MLUltimate vai fechar por alguns segundos e aplicar a atualização em modo silencioso.",
      confirmLabel: "Atualizar agora",
      cancelLabel: "Depois",
      tone: "success",
      progress: 100,
    });

    if (!shouldRestart) return;

    setInstallingUpdate(true);
    install.mutate(undefined, {
      onError: (error) => {
        setInstallingUpdate(false);
        void dialog.alert({
          title: "Não foi possível atualizar",
          description:
            error instanceof Error
              ? error.message
              : "O instalador não conseguiu reiniciar o launcher.",
          tone: "danger",
        });
      },
    });
  };

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="overflow-hidden p-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#60A5FA]/25 bg-[#3B82F6]/12">
              <DownloadCloud className="h-5 w-5 text-[#60A5FA]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">Atualizações</h2>
              <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                Versão instalada:{" "}
                <span className="font-semibold text-white">
                  {formatAppVersion(updaterState?.currentVersion ?? "dev")}
                </span>
              </p>
            </div>
            <Badge
              tone={
                isDownloaded || isUpToDate
                  ? "green"
                  : updaterState?.status === "error"
                    ? "red"
                    : "blue"
              }
              className="ml-auto shrink-0"
            >
              {statusLabel}
            </Badge>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0D1117]/70 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  isUpToDate ? "text-[#22C55E]" : "text-[#60A5FA]"
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {isDownloaded
                    ? "Atualização pronta"
                    : isUpToDate
                      ? "Launcher atualizado"
                      : isChecking
                        ? "Procurando atualizações"
                        : "Verificação de atualização"}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-[#94A3B8]">
                  {updateMessage}
                </p>
              </div>
            </div>

            {isChecking || (typeof updaterState?.progress === "number" && isDownloading) ? (
              <Progress
                value={isChecking ? checkingProgress : updaterState?.progress ?? 0}
                className="mt-4"
              />
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={disableCheck}
                onClick={runUpdateCheck}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isChecking || isDownloading ? "animate-spin" : ""}`}
                />
                {isChecking
                  ? "Procurando atualizações"
                  : checkCooldown > 0
                    ? `Aguarde ${checkCooldown}s`
                    : "Procurar atualizações"}
              </Button>
              {isDownloaded ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={install.isPending || installingUpdate}
                  onClick={installDownloadedUpdate}
                >
                  {installingUpdate ? "Aplicando atualização..." : "Reiniciar e atualizar"}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <MonitorPlay className="h-5 w-5 text-[#60A5FA]" />
            <div>
              <h2 className="text-lg font-semibold text-white">Ao abrir Minecraft</h2>
              <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                Escolha o que o launcher deve fazer depois que a instância iniciar.
              </p>
            </div>
          </div>
          <Badge tone="slate">
            {minecraftOpenActions.find((item) => item.id === settings.data?.minecraftOpenAction)?.label ??
              "Não fazer nada"}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3">
          {minecraftOpenActions.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={settings.isLoading || updateSettings.isPending}
              onClick={() => updateSettings.mutate({ minecraftOpenAction: action.id })}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                (settings.data?.minecraftOpenAction ?? "none") === action.id
                  ? "border-[#60A5FA]/60 bg-[#3B82F6]/12"
                  : "border-white/10 bg-[#0D1117]/70 hover:border-white/20"
              }`}
            >
              <span className="text-sm font-semibold text-white">{action.label}</span>
              <span className="mt-1 block text-sm text-[#94A3B8]">{action.description}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <Languages className="h-5 w-5 text-[#60A5FA]" />
            <div>
              <h2 className="text-lg font-semibold text-white">Linguagem</h2>
              <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                Escolha o idioma do app. A preferência fica salva neste computador.
              </p>
            </div>
          </div>
          <Badge tone="blue" data-i18n-skip="true">
            {languageOptions.find((language) => language.id === settings.data?.language)?.label ?? "Português Brasil"}
          </Badge>
        </div>

        <select
          data-i18n-skip="true"
          value={settings.data?.language ?? "pt-BR"}
          disabled={settings.isLoading || updateSettings.isPending}
          onChange={(event) =>
            updateSettings.mutate({
              language: event.target.value as typeof languageOptions[number]["id"],
              languageSelected: true,
            })
          }
          className="mt-5 h-11 w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition focus:border-[#60A5FA]/70"
        >
          {languageOptions.map((language) => (
            <option key={language.id} value={language.id}>
              {language.label}
            </option>
          ))}
        </select>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-white">Dados locais</h2>
        <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
          Instâncias, versões baixadas e conteúdo instalado ficam na pasta de dados do launcher.
          Abra a pasta de uma instância por Minhas Instâncias para gerenciar mods, resourcepacks e
          shaderpacks manualmente quando quiser.
        </p>
      </Card>
    </div>
  );
};
