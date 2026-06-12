import { CheckCircle2, DownloadCloud, Languages, MonitorPlay, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { languageOptions } from "../constants/languages";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { useUpdater } from "../hooks/useUpdater";
import { launcherApi } from "../services/launcherApi";

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
  const { updater, check, install } = useUpdater();
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
  const updateMessage = (() => {
    if (!updaterState) return "Clique em procurar para verificar se existe uma nova versão.";
    if (isChecking) return "Procurando uma nova versão no GitHub Releases...";
    if (isDownloading) return `Baixando atualização ${updaterState.progress ?? 0}%...`;
    if (isDownloaded) {
      return `Versão ${updaterState.availableVersion ?? "nova"} baixada e pronta para instalar.`;
    }
    if (isUpToDate) return "Você já está com o app atualizado.";
    if (updaterState.status === "available") {
      return `Versão ${updaterState.availableVersion ?? "nova"} encontrada. O download vai começar automaticamente.`;
    }
    if (updaterState.status === "error") {
      return updaterState.message?.includes("releases.atom")
        ? "Ainda não existe uma release publicada no GitHub para comparar atualizações."
        : (updaterState.message ?? "Não foi possível procurar atualizações agora.");
    }

    return "Clique em procurar para verificar se existe uma nova versão.";
  })();

  const installDownloadedUpdate = () => {
    const shouldRestart = window.confirm(
      "A atualização já foi baixada. Quer fechar e reiniciar o MLUltimate agora para instalar?",
    );

    if (shouldRestart) {
      install.mutate();
    }
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
                  {updaterState?.currentVersion ?? "dev"}
                </span>
              </p>
            </div>
            <Badge
              tone={isDownloaded ? "green" : isUpToDate ? "green" : updaterState?.status === "error" ? "red" : "blue"}
              className="ml-auto shrink-0"
            >
              {isDownloaded ? "Pronta" : isUpToDate ? "Atualizado" : updaterState?.status ?? "idle"}
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
                      : "Verificação de atualização"}
                </p>
                <p className="mt-1 break-words text-sm leading-6 text-[#94A3B8]">
                  {updateMessage}
                </p>
              </div>
            </div>
            {typeof updaterState?.progress === "number" && isDownloading ? (
              <Progress value={updaterState.progress} className="mt-4" />
            ) : null}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={isChecking || isDownloading}
                onClick={() => check.mutate()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isChecking || isDownloading ? "animate-spin" : ""}`}
                />
                Procurar atualizações
              </Button>
              {isDownloaded ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={install.isPending}
                  onClick={installDownloadedUpdate}
                >
                  Reiniciar e atualizar
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
          <Badge tone="blue">
            {languageOptions.find((language) => language.id === settings.data?.language)?.label ?? "Português Brasil"}
          </Badge>
        </div>

        <select
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
          Abra a pasta de uma instância pela Biblioteca para gerenciar mods, resourcepacks e
          shaderpacks manualmente quando quiser.
        </p>
      </Card>
    </div>
  );
};
