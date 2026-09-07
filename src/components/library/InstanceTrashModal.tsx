import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  Globe,
  Loader2,
  Package,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import instanceDefaultImage from "../../assets/instance-default.png";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useAppDialog } from "../ui/appDialogContext";
import { useTrash } from "../../hooks/useTrash";
import type { TrashedInstance } from "../../types/launcher";

type InstanceTrashModalProps = {
  open: boolean;
  onClose: () => void;
};

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const formatDate = (value?: string) => {
  if (!value) return "Data desconhecida";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const InstanceTrashModal = ({ open, onClose }: InstanceTrashModalProps) => {
  const dialog = useAppDialog();
  const { trashList, restoreTrash, deleteTrash, emptyTrash } = useTrash();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const items = useMemo(() => trashList.data ?? [], [trashList.data]);

  if (!open) return null;

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < items.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRestoreSelected = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setActionInProgress("Restaurando instâncias...");

    try {
      for (const id of ids) {
        await restoreTrash.mutateAsync(id);
      }
      setSelectedIds(new Set());
    } catch (err) {
      await dialog.alert({
        title: "Erro ao restaurar",
        description: err instanceof Error ? err.message : "Falha ao restaurar as instâncias selecionadas.",
        tone: "danger",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestoreOne = async (item: TrashedInstance) => {
    setActionInProgress(`Restaurando "${item.name}"...`);
    try {
      await restoreTrash.mutateAsync(item.id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    } catch (err) {
      await dialog.alert({
        title: "Erro ao restaurar",
        description: err instanceof Error ? err.message : "Falha ao restaurar a instância.",
        tone: "danger",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;

    const confirmed = await dialog.confirm({
      title: `Excluir permanentemente ${count} instância(s)?`,
      description:
        "Deseja realmente excluir permanentemente os itens selecionados da lixeira? Todos os mundos salvos contidos nessas instâncias serão perdidos para sempre.",
      confirmLabel: "Excluir permanentemente",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;

    setActionInProgress("Excluindo itens selecionados...");
    try {
      await deleteTrash.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err) {
      await dialog.alert({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Falha ao excluir itens selecionados.",
        tone: "danger",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeleteOne = async (item: TrashedInstance) => {
    const confirmed = await dialog.confirm({
      title: `Excluir "${item.name}" permanentemente?`,
      description: `Deseja realmente excluir esta instância da lixeira? ${
        item.worldsCount > 0
          ? `Os ${item.worldsCount} mundo(s) salvos nela serão excluídos permanentemente.`
          : "Esta ação não pode ser desfeita."
      }`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;

    setActionInProgress(`Excluindo "${item.name}"...`);
    try {
      await deleteTrash.mutateAsync([item.id]);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    } catch (err) {
      await dialog.alert({
        title: "Erro ao excluir",
        description: err instanceof Error ? err.message : "Falha ao excluir instância.",
        tone: "danger",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (items.length === 0) return;

    const confirmed = await dialog.confirm({
      title: "Esvaziar toda a lixeira?",
      description:
        "Deseja realmente esvaziar a lixeira? Todos os mundos e configurações salvas de todas as instâncias serão excluídos permanentemente. Esta ação é irreversível.",
      confirmLabel: "Esvaziar lixeira",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;

    setActionInProgress("Esvaziando lixeira...");
    try {
      await emptyTrash.mutateAsync();
      setSelectedIds(new Set());
    } catch (err) {
      await dialog.alert({
        title: "Erro ao esvaziar lixeira",
        description: err instanceof Error ? err.message : "Falha ao esvaziar lixeira.",
        tone: "danger",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 p-3 backdrop-blur-sm sm:p-4">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#161B22] shadow-2xl shadow-black/70">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Lixeira de Instâncias</h2>
                <Badge tone="slate">{items.length}</Badge>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Mundos e manifestos de mods preservados para economia de espaço e recuperação segura.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#94A3B8] transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar lixeira"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#12161D] px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={items.length === 0}
              className="flex items-center gap-2 text-xs font-semibold text-[#D8DEE9] transition hover:text-white disabled:opacity-40"
            >
              {isAllSelected ? (
                <CheckSquare className="h-4 w-4 text-[#3B82F6]" />
              ) : isSomeSelected ? (
                <CheckSquare className="h-4 w-4 text-[#94A3B8]" />
              ) : (
                <Square className="h-4 w-4 text-[#64748B]" />
              )}
              Selecionar todos ({selectedIds.size}/{items.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedIds.size > 0 ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleRestoreSelected}
                  disabled={Boolean(actionInProgress)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                  Restaurar ({selectedIds.size})
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={Boolean(actionInProgress)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-xs text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  Excluir selecionados
                </Button>
              </>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleEmptyTrash}
              disabled={items.length === 0 || Boolean(actionInProgress)}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-600/20 text-xs font-semibold text-red-200 hover:bg-red-600/30 disabled:opacity-40"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              Esvaziar lixeira
            </Button>
          </div>
        </div>

        {/* Action Loading Status */}
        {actionInProgress ? (
          <div className="flex items-center gap-2 border-b border-blue-500/20 bg-blue-500/10 px-6 py-2 text-xs text-blue-200">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
            {actionInProgress}
          </div>
        ) : null}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-[#64748B]">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">A lixeira está vazia</h3>
              <p className="mt-1 max-w-sm text-xs text-[#94A3B8]">
                Quando você excluir uma instância da biblioteca, seus mundos e a lista de mods serão preservados aqui para que você nunca perca suas construções.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-4 rounded-xl border p-4 transition md:flex-row md:items-center ${
                      isSelected
                        ? "border-[#3B82F6]/50 bg-[#3B82F6]/10"
                        : "border-white/8 bg-[#1B222D]/60 hover:border-white/15 hover:bg-[#1B222D]"
                    }`}
                  >
                    {/* Checkbox and Icon */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(item.id)}
                        className="text-[#94A3B8] transition hover:text-white"
                        aria-label={`Selecionar ${item.name}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-[#3B82F6]" />
                        ) : (
                          <Square className="h-5 w-5 text-[#64748B]" />
                        )}
                      </button>
                      <div
                        className="h-14 w-14 shrink-0 rounded-lg bg-cover bg-center shadow-md"
                        style={{
                          backgroundImage: `url(${item.iconDataUrl ?? instanceDefaultImage})`,
                        }}
                      />
                    </div>

                    {/* Instance Info & World Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-base font-bold text-white">{item.name}</h4>
                        <Badge tone="slate">{item.loader}</Badge>
                        <Badge tone="blue">{item.minecraftVersion}</Badge>
                        <span className="text-[11px] text-[#64748B]">
                          Excluído em {formatDate(item.deletedAt)}
                        </span>
                      </div>

                      {/* Saved Worlds Details */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                          <Globe className="h-3.5 w-3.5" />
                          <span>
                            {item.worldsCount > 0
                              ? `${item.worldsCount} mundo(s) salvo(s):`
                              : "Nenhum mundo"}
                          </span>
                          {item.worlds.length > 0 ? (
                            <span className="max-w-[280px] truncate text-emerald-400">
                              {item.worlds.map((w) => `${w.name} (${formatBytes(w.sizeBytes)})`).join(", ")}
                            </span>
                          ) : null}
                        </div>

                        {/* Mod Manifest Details */}
                        <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-xs text-[#B8C2D0]">
                          <Package className="h-3.5 w-3.5 text-[#60A5FA]" />
                          <span>{item.modsCount} mods no manifesto</span>
                        </div>
                      </div>
                    </div>

                    {/* Individual Actions */}
                    <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleRestoreOne(item)}
                        disabled={Boolean(actionInProgress)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeleteOne(item)}
                        disabled={Boolean(actionInProgress)}
                        className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20"
                        title="Excluir permanentemente"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-white/10 bg-[#12161D] px-6 py-3 text-xs text-[#94A3B8]">
          <span>
            {items.length > 0
              ? `${items.length} perfil(is) na lixeira · Os arquivos pesados foram descartados para economizar espaço.`
              : "Lixeira vazia."}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="rounded-lg text-xs"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
