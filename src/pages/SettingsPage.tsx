import { useState, type FormEvent } from "react";
import { CheckCircle2, DownloadCloud, KeyRound, RefreshCw, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { useUpdater } from "../hooks/useUpdater";
import { launcherApi } from "../services/launcherApi";

const settingsKey = ["settings"] as const;

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [curseForgeKey, setCurseForgeKey] = useState("");
  const { updater, check, install } = useUpdater();
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: launcherApi.getSettings,
  });
  const updateSettings = useMutation({
    mutationFn: launcherApi.updateSettings,
    onSuccess: (data) => {
      setCurseForgeKey("");
      queryClient.setQueryData(settingsKey, data);
    },
  });

  const saveCurseForgeKey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateSettings.mutate({ curseForgeApiKey: curseForgeKey });
  };

  const updaterState = updater.data;
  const isChecking = check.isPending || updaterState?.status === "checking";
  const isDownloading = updaterState?.status === "downloading";
  const isDownloaded = updaterState?.status === "downloaded";
  const isUpToDate = updaterState?.status === "not-available";
  const updateMessage = (() => {
    if (!updaterState) return "Clique em procurar para verificar se existe uma nova versao.";
    if (isChecking) return "Procurando uma nova versao no GitHub Releases...";
    if (isDownloading) return `Baixando atualizacao ${updaterState.progress ?? 0}%...`;
    if (isDownloaded) {
      return `Versao ${updaterState.availableVersion ?? "nova"} baixada e pronta para instalar.`;
    }
    if (isUpToDate) return "Voce ja esta com o app atualizado.";
    if (updaterState.status === "available") {
      return `Versao ${updaterState.availableVersion ?? "nova"} encontrada. O download vai comecar automaticamente.`;
    }
    if (updaterState.status === "error") {
      return updaterState.message?.includes("releases.atom")
        ? "Ainda nao existe uma release publicada no GitHub para comparar atualizacoes."
        : (updaterState.message ?? "Nao foi possivel procurar atualizacoes agora.");
    }

    return "Clique em procurar para verificar se existe uma nova versao.";
  })();

  const installDownloadedUpdate = () => {
    const shouldRestart = window.confirm(
      "A atualizacao ja foi baixada. Quer fechar e reiniciar o MLUltimate agora para instalar?",
    );

    if (shouldRestart) {
      install.mutate();
    }
  };

  const error =
    updateSettings.error instanceof Error
      ? updateSettings.error.message
      : settings.error instanceof Error
        ? settings.error.message
        : null;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="overflow-hidden p-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#60A5FA]/25 bg-[#3B82F6]/12">
              <DownloadCloud className="h-5 w-5 text-[#60A5FA]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">Atualizacoes</h2>
              <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                Versao instalada:{" "}
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
                    ? "Atualizacao pronta"
                    : isUpToDate
                      ? "Launcher atualizado"
                      : "Verificacao de atualizacao"}
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
                Procurar atualizacoes
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
            <KeyRound className="h-5 w-5 text-[#60A5FA]" />
            <div>
              <h2 className="text-lg font-semibold text-white">CurseForge API</h2>
              <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                Salve uma chave propria para buscar e instalar conteudo da CurseForge.
              </p>
            </div>
          </div>
          <Badge tone={settings.data?.curseForgeApiKeyConfigured ? "green" : "slate"}>
            {settings.data?.curseForgeApiKeyConfigured ? "Configurada" : "N/A"}
          </Badge>
        </div>

        <form className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={saveCurseForgeKey}>
          <input
            value={curseForgeKey}
            onChange={(event) => setCurseForgeKey(event.target.value)}
            type="password"
            className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
            placeholder="Cole sua API key da CurseForge"
            autoComplete="off"
          />
          <Button type="submit" disabled={!curseForgeKey.trim() || updateSettings.isPending}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={updateSettings.isPending}
            onClick={() => updateSettings.mutate({ clearCurseForgeApiKey: true })}
          >
            <Trash2 className="h-4 w-4" />
            Limpar
          </Button>
        </form>

        <p className="mt-3 text-xs leading-5 text-[#94A3B8]">
          A chave fica criptografada pelo sistema operacional quando essa protecao esta disponivel.
        </p>
        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-white">Dados locais</h2>
        <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
          Instancias, versoes baixadas e conteudo instalado ficam na pasta de dados do launcher.
          Abra a pasta de uma instancia pela Biblioteca para gerenciar mods, resourcepacks e
          shaderpacks manualmente quando quiser.
        </p>
      </Card>
    </div>
  );
};
