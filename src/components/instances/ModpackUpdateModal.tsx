import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "../ui/button";
import { launcherApi } from "../../services/launcherApi";
import { useState } from "react";
import { X } from "lucide-react";

interface ModpackUpdateModalProps {
  instanceId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newVersionId: string;
  newVersionNumber?: string;
  autoUpdateEnabled: boolean;
}

export function ModpackUpdateModal({
  instanceId,
  isOpen,
  onOpenChange,
  newVersionId,
  newVersionNumber,
  autoUpdateEnabled,
}: ModpackUpdateModalProps) {
  const queryClient = useQueryClient();
  const [autoUpdate, setAutoUpdate] = useState(autoUpdateEnabled);

  const updateMutation = useMutation({
    mutationFn: async (mode: "in-place" | "new-instance") => {
      onOpenChange(false);
      if (autoUpdate !== autoUpdateEnabled) {
        await launcherApi.updateInstance({
          id: instanceId,
          autoUpdateModpack: autoUpdate,
        });
      }
      return launcherApi.updateModpack(instanceId, mode, newVersionId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
      void queryClient.invalidateQueries({ queryKey: ["instance-inspection", instanceId] });
      void queryClient.invalidateQueries({ queryKey: ["modpack-update", instanceId] });
    },
  });

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#1f1f1f] p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-white">
            Atualização de Modpack
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-gray-400">
            Uma nova versão ({newVersionNumber || newVersionId}) está disponível para este modpack. Como você deseja atualizar?
          </Dialog.Description>

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 rounded-full p-1 opacity-70 transition-opacity hover:bg-white/10 hover:opacity-100">
              <X className="h-4 w-4 text-white" />
            </button>
          </Dialog.Close>

          <div className="mt-6 flex flex-col gap-4">
            <Button
              variant="secondary"
              className="flex h-auto flex-col items-start gap-1 p-4"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate("in-place")}
            >
              <span className="font-semibold text-white">Atualizar nesta instância</span>
              <span className="text-left text-xs font-normal text-gray-400">
                Apaga a pasta de mods antiga e atualiza as configurações. Seus mundos, shaders e resourcepacks são mantidos.
              </span>
            </Button>

            <Button
              variant="secondary"
              className="flex h-auto flex-col items-start gap-1 border-white/10 bg-transparent p-4 outline outline-1 outline-white/10 hover:bg-white/5"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate("new-instance")}
            >
              <span className="font-semibold text-white">Criar como nova instância</span>
              <span className="text-left text-xs font-normal text-gray-400">
                Abre a tela de importação para baixar esta versão do zero, sem afetar sua instalação atual.
              </span>
            </Button>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-update"
                className="h-4 w-4 accent-blue-500"
                checked={autoUpdate}
                onChange={(e) => setAutoUpdate(e.target.checked)}
              />
              <label
                htmlFor="auto-update"
                className="select-none text-sm font-medium text-gray-300"
              >
                Manter este modpack sempre atualizado (Auto-Update)
              </label>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
