import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ImagePlus, Plus, Upload, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import heroImage from "../assets/launcher-hero.png";
import { InstanceTile } from "../components/library/InstanceTile";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useInstances } from "../hooks/useInstances";
import { useDownloads } from "../hooks/useDownloads";
import { useMinecraftVersions } from "../hooks/useMinecraftVersions";
import { useRunningInstances } from "../hooks/useRunningInstances";
import { launcherApi } from "../services/launcherApi";
import type { ContentType, DownloadItem, LaunchEvent, LauncherInstance, LoaderType } from "../types/launcher";
import { InstanceDetailPage } from "./InstanceDetailPage";

type LibraryPageProps = {
  onExploreInstance?: (type: ContentType, instanceId: string) => void;
};

const loaders: LoaderType[] = ["forge", "fabric", "quilt", "neoforge", "vanilla"];

const mapDownloadsToInstances = (
  downloads: DownloadItem[],
  instances: LauncherInstance[],
) => {
  const activeDownloads = downloads.filter((item) => ["queued", "running"].includes(item.status));
  const mapped: Record<string, DownloadItem> = {};

  for (const instance of instances) {
    const gameDir = normalizePath(instance.gameDir);
    const versionNeedles = [
      `minecraft ${instance.minecraftVersion}`,
      `${instance.loader} ${instance.minecraftVersion}`,
    ];

    const match = activeDownloads.find((download) => {
      const destination = normalizePath(download.destination);
      const label = download.label.toLowerCase();

      return (
        destination.startsWith(gameDir) ||
        versionNeedles.some((needle) => label.includes(needle.toLowerCase()))
      );
    });

    if (match) {
      mapped[instance.id] = match;
    }
  }

  return mapped;
};

const normalizePath = (value: string) => value.replaceAll("\\", "/").toLowerCase();

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
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [selected, setSelected] = useState<LauncherInstance | null>(null);
  const [editing, setEditing] = useState<LauncherInstance | null>(null);
  const [name, setName] = useState("");
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [loader, setLoader] = useState<LoaderType>("vanilla");
  const [ramGb, setRamGb] = useState(4);
  const [selectedIconPath, setSelectedIconPath] = useState("");
  const [selectedIconPreview, setSelectedIconPreview] = useState("");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchEvents, setLaunchEvents] = useState<Record<string, LaunchEvent>>({});

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
    setRamGb(4);
    setSelectedIconPath("");
    setSelectedIconPreview("");
    setModalOpen(true);
  };

  const openEdit = (instance: LauncherInstance) => {
    setEditing(instance);
    setName(instance.name);
    setMinecraftVersion(instance.minecraftVersion);
    setLoader(instance.loader);
    setRamGb(Math.round(instance.ramMb / 1024));
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
          ramMb: ramGb * 1024,
          iconPath: selectedIconPath || undefined,
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
        ramMb: ramGb * 1024,
        iconPath: selectedIconPath || undefined,
      },
      {
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["instances"] }),
      },
    );
  };

  useEffect(
    () =>
      launcherApi.onLaunchEvent((event) => {
        setLaunchEvents((current) => ({ ...current, [event.id]: event }));

        if (["complete", "cancelled", "error", "closed", "killed"].includes(event.type)) {
          window.setTimeout(() => {
            setLaunchEvents((current) => {
              const next = { ...current };
              delete next[event.id];
              return next;
            });
          }, 1800);
        }
      }),
    [],
  );

  const play = async (instance: LauncherInstance) => {
    setLaunchError(null);

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

      setLaunchError(message);
    }
  };

  const cancelLaunch = (instance: LauncherInstance) => {
    void launcherApi.cancel({ instanceId: instance.id });
  };

  const cancelDownload = (downloadId: string) => {
    void launcherApi.cancelDownload(downloadId);
  };

  const killInstance = (instance: LauncherInstance) => {
    void launcherApi.killInstance(instance.id);
  };

  const importArchive = () => {
    importInstance.mutate(
      { source: "archive" },
      {
        onSuccess: () => {
          setImportOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["instances"] });
        },
      },
    );
  };

  const importByCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    importInstance.mutate(
      { source: "code", code: importCode },
      {
        onSuccess: () => {
          setImportOpen(false);
          setImportCode("");
          void queryClient.invalidateQueries({ queryKey: ["instances"] });
        },
      },
    );
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
    <div className="space-y-5">
      <div className="flex items-center gap-5 border-b border-white/10 pb-5">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold text-white hover:text-[#f05a28]"
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
      </div>

      {launchError ? (
        <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {launchError}
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={submit}
            className="w-[530px] border border-white/15 bg-[#1f1f1f] p-8 shadow-2xl shadow-black/50"
          >
            <div className="mb-7 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {editing ? "Edit Profile" : "Create Profile"}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-[#94A3B8] hover:text-white" />
              </button>
            </div>

            <div className="grid grid-cols-[108px_1fr] gap-6">
              <div className="space-y-3">
                <div
                  className="h-28 w-28 bg-cover bg-center"
                  style={{ backgroundImage: `url(${selectedIconPreview || heroImage})` }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 w-28 rounded-sm px-2 text-xs"
                  onClick={selectIcon}
                >
                  <ImagePlus className="h-4 w-4" />
                  Imagem
                </Button>
              </div>
              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold text-white">Modpack Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 h-10 w-full border border-white/30 bg-[#303030] px-3 text-sm text-white outline-none focus:border-[#f05a28]"
                    placeholder="Profile name"
                    minLength={2}
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-white">Minecraft Version</span>
                  <select
                    value={selectedVersion}
                    onChange={(event) => setMinecraftVersion(event.target.value)}
                    disabled={Boolean(editing)}
                    className="mt-2 h-10 w-full border border-transparent bg-[#303030] px-3 text-sm text-white outline-none focus:border-[#f05a28] disabled:opacity-60"
                  >
                    {releaseVersions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.id}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="text-sm font-semibold text-white">Modloader</span>
                  <div className="mt-3 flex flex-wrap gap-4">
                    {loaders.map((item) => (
                      <label key={item} className="flex items-center gap-2 text-sm text-[#D8DEE9]">
                        <input
                          type="radio"
                          name="loader"
                          checked={loader === item}
                          onChange={() => setLoader(item)}
                          disabled={Boolean(editing)}
                          className="h-4 w-4 accent-[#f05a28]"
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-white">RAM</span>
                  <input
                    value={ramGb}
                    onChange={(event) => setRamGb(Number(event.target.value))}
                    type="number"
                    min={1}
                    max={64}
                    className="mt-2 h-10 w-full border border-transparent bg-[#303030] px-3 text-sm text-white outline-none focus:border-[#f05a28]"
                  />
                </label>
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-sm border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="mt-8 flex justify-end gap-3 border-t border-white/10 pt-6">
              <Button type="button" variant="secondary" className="rounded-sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-sm bg-[#f05a28] hover:bg-[#ff733f]">
                {editing ? "Save" : createInstance.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={importByCode}
            className="w-[520px] border border-white/15 bg-[#1f1f1f] p-7 shadow-2xl shadow-black/50"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Import Profile</h2>
              <button type="button" onClick={() => setImportOpen(false)}>
                <X className="h-5 w-5 text-[#94A3B8] hover:text-white" />
              </button>
            </div>
            <div className="space-y-4">
              <Button type="button" className="w-full rounded-sm" onClick={importArchive}>
                <Upload className="h-4 w-4" />
                Importar arquivo .zip, .mrpack, .mlultimate ou .rar
              </Button>
              <label className="block">
                <span className="text-sm font-semibold text-white">Codigo ou URL</span>
                <input
                  value={importCode}
                  onChange={(event) => setImportCode(event.target.value)}
                  className="mt-2 h-10 w-full border border-white/30 bg-[#303030] px-3 text-sm text-white outline-none focus:border-[#f05a28]"
                  placeholder="CurseForge ID, URL ou código compartilhado"
                />
              </label>
              {error ? (
                <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {error}
                </div>
              ) : null}
            </div>
            <div className="mt-7 flex justify-end gap-3 border-t border-white/10 pt-5">
              <Button type="button" variant="secondary" className="rounded-sm" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-sm bg-[#f05a28] hover:bg-[#ff733f]">
                Importar código
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge tone="slate">{visibleInstances.length} perfis</Badge>
        <Badge tone="blue">Mods, resource packs e shaders entram pelo detalhe do perfil</Badge>
      </div>
    </div>
  );
};
