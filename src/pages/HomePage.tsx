import { Download, FolderPlus, PackageOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import heroImage from "../assets/launcher-hero.png";
import { InstanceTile } from "../components/library/InstanceTile";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useDownloads } from "../hooks/useDownloads";
import { useInstances } from "../hooks/useInstances";
import { useRunningInstances } from "../hooks/useRunningInstances";
import { launcherApi } from "../services/launcherApi";
import type { ContentType, LauncherInstance } from "../types/launcher";
import type { PageId } from "../components/layout/Sidebar";
import { InstanceDetailPage } from "./InstanceDetailPage";

type HomePageProps = {
  focus: PageId;
  onNavigate?: (page: PageId) => void;
  onExploreInstance?: (type: ContentType, instanceId: string) => void;
};

export const HomePage = ({ focus, onNavigate, onExploreInstance }: HomePageProps) => {
  const queryClient = useQueryClient();
  const dialog = useAppDialog();
  const { instances, removeInstance, openFolder } = useInstances();
  const downloads = useDownloads();
  const runningInstances = useRunningInstances();
  const [selected, setSelected] = useState<LauncherInstance | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const realInstances = instances.data ?? [];
  const realDownloads = downloads.data ?? [];
  const runningDownloads = realDownloads.filter((item) => item.status === "running");

  const play = async (instance: LauncherInstance) => {
    setLaunchError(null);

    try {
      await launcherApi.launch({ instanceId: instance.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível abrir o jogo.";

      if (message.startsWith("INSTANCE_ALREADY_RUNNING")) {
        const openAgain = await dialog.confirm({
          title: "Instância já aberta",
          description:
            "Essa instância já está aberta ou iniciando. Deseja abrir outra cópia mesmo assim?",
          confirmLabel: "Abrir outra",
          cancelLabel: "Cancelar",
          tone: "info",
        });

        if (openAgain) {
          await launcherApi.launch({ instanceId: instance.id, force: true });
        }
        return;
      }

      setLaunchError(message);
    }
  };

  const killInstance = (instance: LauncherInstance) => {
    void launcherApi.killInstance(instance.id);
  };

  if (selected) {
    return (
      <InstanceDetailPage
        instance={selected}
        onBack={() => setSelected(null)}
        onExplore={(type, instanceId) => onExploreInstance?.(type, instanceId)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section
        className="relative min-h-[250px] overflow-hidden rounded-sm border border-white/10 bg-cover bg-center shadow-2xl shadow-black/30"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/96 via-[#0D1117]/75 to-[#0D1117]/30" />
        <div className="relative flex min-h-[250px] flex-col justify-between p-7">
          <div className="flex items-center gap-2">
            <Badge tone="blue">Instâncias reais</Badge>
            <Badge tone="green">Play vanilla conectado</Badge>
          </div>
          <div className="max-w-xl">
            <p className="text-sm font-medium text-[#f05a28]">
              {focus === "explore" ? "Explorar" : "My Profiles"}
            </p>
            <h2 className="mt-2 text-4xl font-semibold leading-tight text-white">
              Suas instâncias
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-[#C7D2FE]">
              Crie perfis customizados, adicione mods, resource packs e shaders, e abra a instância pela própria grade.
            </p>
            <div className="mt-5 flex gap-3">
              <Button type="button" onClick={() => onNavigate?.("library")}>
                <FolderPlus className="h-4 w-4" />
                Criar instância
              </Button>
              <Button type="button" variant="secondary" onClick={() => onNavigate?.("explore")}>
                <Download className="h-4 w-4" />
                Explorar conteúdo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {launchError ? (
        <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {launchError}
        </div>
      ) : null}

      <section className="flex flex-wrap gap-3">
        {realInstances.map((instance) => (
          <InstanceTile
            key={instance.id}
            instance={instance}
            onOpen={setSelected}
            onPlay={play}
            onEdit={() => onNavigate?.("library")}
            onOpenFolder={(item) => openFolder.mutate(item.id)}
            onKill={killInstance}
            isRunning={runningInstances.isRunning(instance.id)}
            onDelete={(item) =>
              removeInstance.mutate(item.id, {
                onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["instances"] }),
              })
            }
          />
        ))}
      </section>

      {realInstances.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-white">Nenhuma instância criada</p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Va em Biblioteca e crie seu primeiro perfil.
          </p>
        </Card>
      ) : null}

      <section className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <PackageOpen className="h-5 w-5 text-[#60A5FA]" />
          <p className="mt-4 text-2xl font-semibold text-white">{realInstances.length}</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Instâncias</p>
        </Card>
        <Card className="p-5">
          <Download className="h-5 w-5 text-[#60A5FA]" />
          <p className="mt-4 text-2xl font-semibold text-white">{runningDownloads.length}</p>
          <p className="mt-1 text-sm text-[#94A3B8]">Downloads ativos</p>
        </Card>
        <Card className="p-5">
          <FolderPlus className="h-5 w-5 text-[#60A5FA]" />
          <p className="mt-4 text-2xl font-semibold text-white">
            {realInstances.reduce((total, item) => total + item.modsCount, 0)}
          </p>
          <p className="mt-1 text-sm text-[#94A3B8]">Mods instalados</p>
        </Card>
      </section>
    </div>
  );
};
