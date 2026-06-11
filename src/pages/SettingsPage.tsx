import { useState, type FormEvent } from "react";
import { DownloadCloud, KeyRound, RefreshCw, Save, Trash2 } from "lucide-react";
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

  const error =
    updateSettings.error instanceof Error
      ? updateSettings.error.message
      : settings.error instanceof Error
        ? settings.error.message
        : null;

  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex items-center gap-3">
            <DownloadCloud className="h-5 w-5 text-[#60A5FA]" />
            <div>
              <h2 className="text-lg font-semibold text-white">Atualizacoes</h2>
              <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                Canal GitHub Releases configurado para procurar novas versoes alpha.
              </p>
            </div>
          </div>
          <Badge tone={updater.data?.status === "downloaded" ? "green" : "blue"}>
            {updater.data?.currentVersion ?? "dev"}
          </Badge>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {updater.data?.availableVersion
                  ? `Versao disponivel: ${updater.data.availableVersion}`
                  : "Nenhuma atualizacao baixada"}
              </p>
              <p className="mt-1 truncate text-sm text-[#94A3B8]">
                {updater.data?.message ?? "O launcher procura updates automaticamente ao abrir."}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={check.isPending || updater.data?.status === "checking"}
                onClick={() => check.mutate()}
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    check.isPending || updater.data?.status === "checking" ? "animate-spin" : ""
                  }`}
                />
                Verificar
              </Button>
              <Button
                type="button"
                disabled={updater.data?.status !== "downloaded" || install.isPending}
                onClick={() => install.mutate()}
              >
                Instalar
              </Button>
            </div>
          </div>
          {typeof updater.data?.progress === "number" ? (
            <Progress value={updater.data.progress} className="mt-4" />
          ) : null}
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

        <form className="mt-5 grid grid-cols-[1fr_auto_auto] gap-3" onSubmit={saveCurseForgeKey}>
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
