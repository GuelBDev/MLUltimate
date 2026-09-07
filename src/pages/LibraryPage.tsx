import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import instanceDefaultImage from "../assets/instance-default.png";
import { LaunchErrorNotice } from "../components/launcher/LaunchErrorNotice";
import { InstanceTile } from "../components/library/InstanceTile";
import { InstanceTrashModal } from "../components/library/InstanceTrashModal";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { AppSelect } from "../components/ui/AppSelect";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useInstances } from "../hooks/useInstances";
import { useDownloads } from "../hooks/useDownloads";
import { useMinecraftVersions } from "../hooks/useMinecraftVersions";
import { useRunningInstances } from "../hooks/useRunningInstances";
import { useLaunchEvents } from "../hooks/useLaunchEvents";
import { useTrash } from "../hooks/useTrash";
import { launcherApi } from "../services/launcherApi";
import type { ContentType, CrashReportDetails, DownloadItem, LauncherInstance, LoaderType } from "../types/launcher";
import { InstanceDetailPage } from "./InstanceDetailPage";

type LibraryPageProps = {
  onExploreInstance?: (type: ContentType, instanceId: string) => void;
};

const loaderOptions: Array<{
  id: LoaderType;
  title: string;
  description: string;
}> = [
  { id: "vanilla", title: "Vanilla", description: "Minecraft limpo, ideal para texturas." },
  { id: "fabric", title: "Fabric", description: "Leve, moderno e bom para mods." },
  { id: "iris-sodium", title: "Iris + Sodium", description: "Shaders com otimização de FPS." },
  { id: "forge", title: "Forge", description: "Compatível com mods clássicos." },
  { id: "neoforge", title: "NeoForge", description: "Ecossistema Forge moderno." },
  { id: "quilt", title: "Quilt", description: "Loader leve derivado do Fabric." },
];

const mapDownloadsToInstances = (
  downloads: DownloadItem[],
  instances: LauncherInstance[],
) => {
  const activeDownloads = downloads.filter((item) => ["queued", "running"].includes(item.status));
  const mapped: Record<string, DownloadItem> = {};

  for (const instance of instances) {
    const gameDir = normalizePath(instance.gameDir);

    const match = activeDownloads.find((download) => {
      const destination = normalizePath(download.destination);

      return isSameOrInsidePath(destination, gameDir);
    });

    if (match) {
      mapped[instance.id] = match;
    }
  }

  return mapped;
};

const normalizePath = (value: string) =>
  value.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
const isSameOrInsidePath = (childPath: string, parentPath: string) =>
  childPath === parentPath || childPath.startsWith(`${parentPath}/`);
const DEFAULT_RAM_MB = 4096;
const MIN_RAM_MB = 1024;
const FALLBACK_MAX_RAM_MB = 16384;
const RAM_STEP_MB = 512;
type RamMode = "recommended" | "custom";

const clampMaxRamMb = (value: number) => Math.max(MIN_RAM_MB, Math.floor(value));

const clampRamMb = (value: number, maxRamMb = FALLBACK_MAX_RAM_MB) => {
  const safeValue = Number.isFinite(value) ? value : DEFAULT_RAM_MB;
  const steppedValue = Math.round(safeValue / RAM_STEP_MB) * RAM_STEP_MB;

  return Math.min(maxRamMb, Math.max(MIN_RAM_MB, steppedValue));
};

const formatRam = (ramMb: number) =>
  ramMb % 1024 === 0 ? `${ramMb / 1024} GB` : `${(ramMb / 1024).toFixed(1)} GB`;

const getCustomDefaultRam = (maxRamMb: number) =>
  Math.min(maxRamMb, Math.max(MIN_RAM_MB, 8192));

export const LibraryPage = ({ onExploreInstance }: LibraryPageProps) => {
  const queryClient = useQueryClient();
  const dialog = useAppDialog();
  const { versions } = useMinecraftVersions();
  const {
    instances,
    createInstance,
    updateInstance,
    removeInstance,
    openFolder,
    importInstance,
  } = useInstances();
  const downloads = useDownloads();
  const runningInstances = useRunningInstances();
  const systemMemory = useQuery({
    queryKey: ["system-memory"],
    queryFn: launcherApi.getSystemMemory,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [selected, setSelected] = useState<LauncherInstance | null>(null);
  const [editing, setEditing] = useState<LauncherInstance | null>(null);
  const [name, setName] = useState("");
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [loader, setLoader] = useState<LoaderType>("vanilla");
  const [ramMb, setRamMb] = useState(DEFAULT_RAM_MB);
  const [ramMode, setRamMode] = useState<RamMode>("recommended");
  const [contentManagementEnabled, setContentManagementEnabled] = useState(true);
  const [selectedIconPath, setSelectedIconPath] = useState("");
  const [selectedIconPreview, setSelectedIconPreview] = useState("");
  const [launchErrorLog, setLaunchErrorLog] = useState<string | null>(null);
  const [activeCrashReport, setActiveCrashReport] = useState<CrashReportDetails | null>(null);
  const [errorInstanceId, setErrorInstanceId] = useState<string | null>(null);
  const { launchEvents, cancelLaunch: cancelLaunchProcess } = useLaunchEvents();
  const { trashList } = useTrash();
  const [trashOpen, setTrashOpen] = useState(false);
  const trashedCount = trashList.data?.length ?? 0;
  const [openMenuInstanceId, setOpenMenuInstanceId] = useState<string | null>(null);

  const releaseVersions = useMemo(
    () =>
      (versions.data ?? [])
        .filter((version) => version.type === "release")
        .slice(0, 120),
    [versions.data],
  );
  const selectedVersion = minecraftVersion || releaseVersions.at(0)?.id || "";
  const visibleInstances = useMemo(() => instances.data ?? [], [instances.data]);
  const activeDownloadsByInstance = useMemo(
    () => mapDownloadsToInstances(downloads.data ?? [], visibleInstances),
    [downloads.data, visibleInstances],
  );
  const maxRamMb = useMemo(
    () => clampMaxRamMb(systemMemory.data?.totalMb ?? FALLBACK_MAX_RAM_MB),
    [systemMemory.data?.totalMb],
  );
  const customRam = ramMode === "custom";
  const updateRamMb = (value: number) => setRamMb(clampRamMb(value, maxRamMb));
  const normalizedRamMb = clampRamMb(ramMb, maxRamMb);
  const error =
    createInstance.error instanceof Error
      ? createInstance.error.message
      : updateInstance.error instanceof Error
        ? updateInstance.error.message
        : importInstance.error instanceof Error
          ? importInstance.error.message
          : versions.error instanceof Error
            ? versions.error.message
            : null;

  const openCreate = () => {
    setEditing(null);
    setName("");
    setMinecraftVersion("");
    setLoader("vanilla");
    setRamMode("recommended");
    setContentManagementEnabled(true);
    setRamMb(clampRamMb(DEFAULT_RAM_MB, maxRamMb));
    setSelectedIconPath("");
    setSelectedIconPreview("");
    setModalOpen(true);
  };

  const openEdit = (instance: LauncherInstance) => {
    setEditing(instance);
    setName(instance.name);
    setMinecraftVersion(instance.minecraftVersion);
    setLoader(instance.loader);
    setRamMode(instance.ramMb === DEFAULT_RAM_MB ? "recommended" : "custom");
    setContentManagementEnabled(instance.contentManagementEnabled);
    setRamMb(clampRamMb(instance.ramMb, maxRamMb));
    setSelectedIconPath("");
    setSelectedIconPreview(instance.iconDataUrl ?? "");
    setModalOpen(true);
  };

  const selectIcon = async () => {
    const icon = await launcherApi.selectInstanceIcon();

    if (!icon) {
      return;
    }

    setSelectedIconPath(icon.iconPath);
    setSelectedIconPreview(icon.iconDataUrl);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editing) {
      updateInstance.mutate(
        {
          id: editing.id,
          name,
          ramMb: normalizedRamMb,
          iconPath: selectedIconPath || undefined,
          contentManagementEnabled,
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            void queryClient.invalidateQueries({ queryKey: ["instances"] });
          },
        },
      );
      return;
    }

    setModalOpen(false);
    createInstance.mutate(
      {
        name,
        minecraftVersion: selectedVersion,
        loader,
        ramMb: normalizedRamMb,
        iconPath: selectedIconPath || undefined,
        contentManagementEnabled,
      },
      {
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["instances"] }),
      },
    );
  };

  useEffect(
    () =>
      launcherApi.onLaunchEvent((event) => {
        if (event.type === "error") {
          setActiveCrashReport(event.crashReport ?? null);
          setErrorInstanceId(event.id);
          setLaunchErrorLog(event.message);
        }
      }),
    [],
  );

  const play = async (instance: LauncherInstance) => {
    setLaunchErrorLog(null);
    setActiveCrashReport(null);
    setErrorInstanceId(null);

    try {
      await launcherApi.launch({ instanceId: instance.id });
    } catch (launchException) {
      const message =
        launchException instanceof Error
          ? launchException.message
          : "Não foi possível abrir o jogo.";

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

      setLaunchErrorLog(message);
    }
  };

  const cancelLaunch = (instance: LauncherInstance) => {
    void cancelLaunchProcess(instance.id);
  };

  const cancelDownload = (downloadId: string) => {
    void launcherApi.cancelDownload(downloadId);
  };

  const killInstance = (instance: LauncherInstance) => {
    void launcherApi.killInstance(instance.id);
  };

  const confirmSharedImport = (sourceLabel: string) =>
    dialog.confirm({
      title: "Importar instância compartilhada?",
      description:
        `O launcher vai baixar e preparar a instância compartilhada por ${sourceLabel}. Confirme apenas se você confia nesse pacote.`,
      confirmLabel: "Baixar instância",
      cancelLabel: "Cancelar",
      tone: "info",
    });

  const importArchive = async () => {
    try {
      const file = await launcherApi.selectArchiveFile();
      if (!file) {
        return;
      }

      const confirmed = await dialog.confirm({
        title: "Importar instância compartilhada?",
        description: `O launcher vai baixar e preparar a instância compartilhada do arquivo "${file.fileName}". Confirme apenas se você confia nesse pacote.`,
        confirmLabel: "Baixar instância",
        cancelLabel: "Cancelar",
        tone: "info",
      });

      if (!confirmed) {
        return;
      }

      setImportOpen(false);
      importInstance.mutate(
        { source: "archive", archivePath: file.filePath },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["instances"] });
          },
        },
      );
    } catch (importException) {
      console.error("Falha ao selecionar pacote para importação", importException);
    }
  };

  const importByCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const code = importCode.trim();

    if (!code) {
      await dialog.alert({
        title: "Código vazio",
        description: "Cole um código, URL ou caminho de arquivo para importar a instância compartilhada.",
        tone: "danger",
      });
      return;
    }

    const confirmed = await confirmSharedImport("código ou URL");

    if (!confirmed) {
      return;
    }

    setImportOpen(false);
    setImportCode("");
    importInstance.mutate(
      { source: "code", code },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ["instances"] });
        },
      },
    );
  };

  if (selected) {
    return (
      <InstanceDetailPage
        instance={selected}
        initialLaunchEvent={launchEvents[selected.id]}
        onBack={() => setSelected(null)}
        onExplore={(type, instanceId) => onExploreInstance?.(type, instanceId)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5 border-b border-white/10 pb-5">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-white hover:text-[#60A5FA]"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-[#B8C2D0] hover:text-white"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="h-4 w-4" />
          Import
        </button>
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-[#B8C2D0] hover:text-white"
          onClick={() => setTrashOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Lixeira
          {trashedCount > 0 ? (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
              {trashedCount}
            </span>
          ) : null}
        </button>
      </div>

      {launchErrorLog ? (
        <LaunchErrorNotice
          log={launchErrorLog}
          crashReport={activeCrashReport ?? undefined}
          instanceId={errorInstanceId ?? undefined}
          onRefreshInstance={() => void queryClient.invalidateQueries({ queryKey: ["instances"] })}
          onClear={() => {
            setLaunchErrorLog(null);
            setActiveCrashReport(null);
            setErrorInstanceId(null);
          }}
        />
      ) : null}

      {!modalOpen && error ? (
        <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <section className="flex flex-wrap gap-3">
        {visibleInstances.map((instance) => (
          <InstanceTile
            key={instance.id}
            instance={instance}
            onOpen={setSelected}
            onPlay={play}
            onEdit={openEdit}
            onDelete={(item) => removeInstance.mutate(item.id)}
            onOpenFolder={(item) => openFolder.mutate(item.id)}
            onKill={killInstance}
            download={activeDownloadsByInstance[instance.id]}
            launchEvent={launchEvents[instance.id]}
            isRunning={runningInstances.isRunning(instance.id)}
            onCancelDownload={cancelDownload}
            onCancelLaunch={cancelLaunch}
            isMenuOpen={openMenuInstanceId === instance.id}
            onToggleMenu={(open) => setOpenMenuInstanceId(open ? instance.id : null)}
          />
        ))}
      </section>

      {visibleInstances.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-white">Nenhuma instância criada</p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Clique em Create para criar um perfil vanilla ou customizado.
          </p>
        </Card>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/75 p-3 backdrop-blur-sm sm:p-4">
          <form
            onSubmit={submit}
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#161B22] shadow-2xl shadow-black/50"
          >
            <div className="relative shrink-0 border-b border-white/10 bg-[#0D1117] p-5 sm:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_38%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">
                    MLUltimate
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {editing ? "Edit Profile" : "Create Profile"}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-[#94A3B8]">
                    Escolha a versão, o motor do perfil e a memória. Iris e Iris + Sodium usam Fabric por baixo.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-xl p-2 text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
                  onClick={() => setModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <aside className="shrink-0 border-b border-white/10 p-4 sm:p-6 md:w-[178px] md:border-b-0 md:border-r">
                <div className="space-y-3 md:sticky md:top-0">
                <div
                  className="h-36 w-36 rounded-2xl border border-white/10 bg-cover bg-center shadow-xl shadow-black/30"
                  style={{ backgroundImage: `url(${selectedIconPreview || instanceDefaultImage})` }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 w-36 rounded-xl px-2 text-xs"
                  onClick={selectIcon}
                >
                  <ImagePlus className="h-4 w-4" />
                  Imagem
                </Button>
                </div>
              </aside>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold text-white">Modpack Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
                    placeholder="Profile name"
                    minLength={2}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-white">Minecraft Version</span>
                  <div className="mt-2">
                    <AppSelect
                      value={selectedVersion}
                      onChange={(val) => setMinecraftVersion(val)}
                      disabled={Boolean(editing)}
                      options={releaseVersions.map((version) => ({
                        value: version.id,
                        label: version.id,
                      }))}
                      className="w-full"
                    />
                  </div>
                </label>

                <div>
                  <span className="text-sm font-semibold text-white">Modloader</span>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {loaderOptions.map((item) => (
                      <label
                        key={item.id}
                        className={`rounded-xl border p-3 transition ${
                          loader === item.id
                            ? "border-[#60A5FA] bg-[#3B82F6]/15 shadow-lg shadow-blue-500/10"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
                        } ${editing ? "opacity-60" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <input
                          type="radio"
                          name="loader"
                          checked={loader === item.id}
                          onChange={() => setLoader(item.id)}
                          disabled={Boolean(editing)}
                          className="h-4 w-4 accent-[#3B82F6]"
                        />
                          {item.title}
                        </div>
                        <p className="mt-1 pl-6 text-xs leading-5 text-[#94A3B8]">
                          {item.description}
                        </p>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-white">Gerenciamento de conteudo</p>
                    <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm text-[#D8DEE9]">
                      <input
                        type="checkbox"
                        checked={contentManagementEnabled}
                        onChange={(event) => setContentManagementEnabled(event.target.checked)}
                        className="h-5 w-5 accent-[#3B82F6]"
                      />
                      Permitir gerenciamento de conteudo neste perfil
                    </label>
                    <p className="mt-2 text-xs leading-5 text-[#94A3B8]">
                      Quando desligado, o launcher nao altera mods, texturas ou shaders deste perfil.
                    </p>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-sm font-semibold text-white">Memory Settings</span>
                      <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
                        O valor escolhido aqui e aplicado diretamente no Java ao iniciar o Minecraft.
                      </p>
                    </div>
                    <span className="rounded-full border border-[#60A5FA]/30 bg-[#3B82F6]/15 px-3 py-1 text-xs font-semibold text-[#BFDBFE]">
                      {normalizedRamMb} MB
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 transition hover:border-white/20">
                      <input
                        type="radio"
                        name="ram-mode"
                        checked={!customRam}
                        onChange={() => {
                          setRamMode("recommended");
                          updateRamMb(DEFAULT_RAM_MB);
                        }}
                        className="h-4 w-4 accent-[#3B82F6]"
                      />
                      <span className="text-sm font-semibold text-white">
                        MLUltimate recomendado - {DEFAULT_RAM_MB}MB
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 transition hover:border-white/20">
                      <input
                        type="radio"
                        name="ram-mode"
                        checked={customRam}
                        onChange={() => {
                          setRamMode("custom");
                          updateRamMb(normalizedRamMb === DEFAULT_RAM_MB ? getCustomDefaultRam(maxRamMb) : normalizedRamMb);
                        }}
                        className="h-4 w-4 accent-[#3B82F6]"
                      />
                      <span className="text-sm font-semibold text-white">
                        Custom RAM Allocation
                      </span>
                    </label>
                  </div>

                  <div className={`mt-4 space-y-3 ${customRam ? "" : "opacity-45"}`}>
                    <input
                      type="range"
                      min={MIN_RAM_MB}
                      max={maxRamMb}
                      step={RAM_STEP_MB}
                      value={normalizedRamMb}
                      disabled={!customRam}
                      onChange={(event) => updateRamMb(Number(event.target.value))}
                      className="h-2 w-full cursor-pointer accent-[#3B82F6] disabled:cursor-not-allowed"
                    />
                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                      <span>{formatRam(MIN_RAM_MB)}</span>
                      <span>{formatRam(maxRamMb)} max</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        value={normalizedRamMb}
                        onChange={(event) => updateRamMb(Number(event.target.value))}
                        disabled={!customRam}
                        type="number"
                        min={MIN_RAM_MB}
                        max={maxRamMb}
                        step={RAM_STEP_MB}
                        className="h-11 w-36 rounded-xl border border-white/10 bg-[#161B22] px-3 text-sm font-semibold text-white outline-none focus:border-[#60A5FA]/70 disabled:cursor-not-allowed"
                      />
                      <span className="text-sm text-[#94A3B8]">{formatRam(normalizedRamMb)}</span>
                    </div>
                    <p className="text-xs leading-5 text-[#94A3B8]">
                      Limite detectado do PC: {formatRam(maxRamMb)} de RAM.
                    </p>
                  </div>
                </div>

                  {error ? (
                    <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 px-5 py-4 sm:px-6 sm:py-5">
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-[#3B82F6] hover:bg-[#60A5FA]">
                {editing ? "Save" : createInstance.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <form
            onSubmit={importByCode}
            className="relative w-full max-w-[540px] overflow-hidden rounded-2xl border border-white/12 bg-[#161B22] p-6 shadow-2xl shadow-black/70 sm:p-8"
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">
                  Instâncias & Modpacks
                </span>
                <h2 className="mt-1 text-2xl font-bold text-white">Importar perfil</h2>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Adicione um modpack exportado ou compartilhado por código/link.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl p-1.5 text-[#94A3B8] transition hover:bg-white/10 hover:text-white"
                onClick={() => setImportOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div
                role="button"
                tabIndex={0}
                onClick={() => void importArchive()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void importArchive();
                  }
                }}
                className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/[0.03] px-6 py-6 text-center transition-all duration-200 hover:border-[#3B82F6]/60 hover:bg-[#3B82F6]/5"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3B82F6]/10 text-[#60A5FA] transition group-hover:scale-110 group-hover:bg-[#3B82F6]/20">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-white group-hover:text-[#60A5FA]">
                  Clique para selecionar o arquivo do pacote
                </p>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  O seletor de arquivos será aberto para você escolher o arquivo no PC.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {[".ZIP", ".MRPACK", ".JSON", ".MLULTIMATE", ".RAR"].map((ext) => (
                    <span
                      key={ext}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-[#CBD5E1]"
                    >
                      {ext}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <span className="relative bg-[#161B22] px-3 text-xs font-semibold uppercase tracking-widest text-[#64748B]">
                  ou por código / link
                </span>
              </div>

              <div>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                    Código, URL ou CurseForge ID
                  </span>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={importCode}
                      onChange={(event) => setImportCode(event.target.value)}
                      className="h-11 flex-1 rounded-xl border border-white/10 bg-[#0D1117] px-3.5 text-sm text-white outline-none transition placeholder:text-[#64748B] focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6]"
                      placeholder="Ex: CurseForge ID, URL do Modrinth ou código..."
                    />
                    <Button
                      type="submit"
                      className="h-11 shrink-0 rounded-xl bg-[#3B82F6] px-5 font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-[#60A5FA]"
                    >
                      Importar
                    </Button>
                  </div>
                </label>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-100">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="mt-7 flex justify-end border-t border-white/10 pt-4">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={() => setImportOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {trashOpen ? (
        <InstanceTrashModal open={trashOpen} onClose={() => setTrashOpen(false)} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge tone="slate">{visibleInstances.length} perfis</Badge>
        <Badge tone="blue">Mods, resource packs e shaders entram pelo detalhe do perfil</Badge>
      </div>
    </div>
  );
};
