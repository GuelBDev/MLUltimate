import { useState, useMemo, type FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import instanceDefaultImage from "../../assets/instance-default.png";
import { Button } from "../ui/button";
import { AppSelect } from "../ui/AppSelect";
import { useInstances } from "../../hooks/useInstances";
import { useMinecraftVersions } from "../../hooks/useMinecraftVersions";
import { launcherApi } from "../../services/launcherApi";
import type { LauncherInstance, LoaderType } from "../../types/launcher";

type InstanceEditModalProps = {
  instance: LauncherInstance | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedInstance: LauncherInstance) => void;
};

const isNeoForgeSupportedVersion = (minecraftVersion: string) => {
  if (!minecraftVersion) return true;
  if (minecraftVersion === "1.20.1") return true;
  const parts = minecraftVersion.split(".").map(Number);
  if (parts.length >= 2 && parts[0] === 1 && parts[1] !== undefined) {
    if (parts[1] > 20) return true;
    if (parts[1] === 20 && parts.length >= 3 && (parts[2] ?? 0) >= 2) return true;
  }
  return false;
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

export const InstanceEditModal = ({
  instance,
  isOpen,
  onClose,
  onSaved,
}: InstanceEditModalProps) => {
  const queryClient = useQueryClient();
  const { updateInstance, createInstance } = useInstances();
  const { versions } = useMinecraftVersions();
  const systemMemory = useQuery({
    queryKey: ["system-memory"],
    queryFn: launcherApi.getSystemMemory,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const [name, setName] = useState("");
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [loader, setLoader] = useState<LoaderType>("vanilla");
  const [ramMb, setRamMb] = useState(DEFAULT_RAM_MB);
  const [ramMode, setRamMode] = useState<RamMode>("recommended");
  const [contentManagementEnabled, setContentManagementEnabled] = useState(true);
  const [selectedIconPath, setSelectedIconPath] = useState("");
  const [selectedIconPreview, setSelectedIconPreview] = useState("");

  const maxRamMb = useMemo(
    () => clampMaxRamMb(systemMemory.data?.totalMb ?? FALLBACK_MAX_RAM_MB),
    [systemMemory.data?.totalMb],
  );

  const [prevInstanceKey, setPrevInstanceKey] = useState<string | null>(null);
  const currentInstanceKey = isOpen
    ? instance
      ? `${instance.id}:${instance.name}:${instance.minecraftVersion}:${instance.loader}:${instance.ramMb}:${instance.contentManagementEnabled}:${instance.updatedAt ?? ""}`
      : "__new__"
    : null;

  if (currentInstanceKey !== prevInstanceKey) {
    setPrevInstanceKey(currentInstanceKey);
    if (isOpen) {
      if (instance) {
        setName(instance.name);
        setMinecraftVersion(instance.minecraftVersion);
        setLoader(instance.loader);
        setRamMode(instance.ramMb === DEFAULT_RAM_MB ? "recommended" : "custom");
        setContentManagementEnabled(instance.contentManagementEnabled ?? true);
        setRamMb(clampRamMb(instance.ramMb, maxRamMb));
        setSelectedIconPath("");
        setSelectedIconPreview(instance.iconDataUrl ?? "");
      } else {
        setName("");
        setMinecraftVersion("");
        setLoader("vanilla");
        setRamMode("recommended");
        setContentManagementEnabled(true);
        setRamMb(clampRamMb(DEFAULT_RAM_MB, maxRamMb));
        setSelectedIconPath("");
        setSelectedIconPreview("");
      }
    }
  }

  const releaseVersions = useMemo(
    () =>
      (versions.data ?? [])
        .filter((version) => version.type === "release")
        .slice(0, 120),
    [versions.data],
  );

  const selectedVersion = minecraftVersion || releaseVersions.at(0)?.id || "";
  const customRam = ramMode === "custom";
  const updateRamMb = (value: number) => setRamMb(clampRamMb(value, maxRamMb));
  const normalizedRamMb = clampRamMb(ramMb, maxRamMb);

  const error =
    updateInstance.error instanceof Error
      ? updateInstance.error.message
      : createInstance.error instanceof Error
        ? createInstance.error.message
        : null;

  const selectIcon = async () => {
    const icon = await launcherApi.selectInstanceIcon();
    if (!icon) return;
    setSelectedIconPath(icon.iconPath);
    setSelectedIconPreview(icon.iconDataUrl);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (instance) {
      updateInstance.mutate(
        {
          id: instance.id,
          name,
          ramMb: normalizedRamMb,
          iconPath: selectedIconPath || undefined,
          contentManagementEnabled,
        },
        {
          onSuccess: (updated) => {
            onClose();
            void queryClient.invalidateQueries({ queryKey: ["instances"] });
            if (updated && onSaved) {
              onSaved(updated);
            }
          },
        },
      );
      return;
    }

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
        onSuccess: () => {
          onClose();
          void queryClient.invalidateQueries({ queryKey: ["instances"] });
        },
      },
    );
  };

  if (!isOpen) return null;

  return (
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
                {instance ? "Edit Profile" : "Create Profile"}
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-[#94A3B8]">
                Escolha a versão, o motor do perfil e a memória. Iris e Iris + Sodium usam Fabric por baixo.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl p-2 text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
              onClick={onClose}
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
                    onChange={(val) => {
                      setMinecraftVersion(val);
                      if (!isNeoForgeSupportedVersion(val) && loader === "neoforge") {
                        setLoader("forge");
                      }
                    }}
                    disabled={Boolean(instance)}
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
                  {loaderOptions.map((item) => {
                    const isSupported =
                      item.id !== "neoforge" || isNeoForgeSupportedVersion(selectedVersion);
                    const isItemDisabled = Boolean(instance) || !isSupported;

                    return (
                      <label
                        key={item.id}
                        className={`rounded-xl border p-3 transition ${
                          loader === item.id
                            ? "border-[#60A5FA] bg-[#3B82F6]/15 shadow-lg shadow-blue-500/10"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20"
                        } ${isItemDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <input
                            type="radio"
                            name="loader"
                            checked={loader === item.id}
                            onChange={() => isSupported && setLoader(item.id)}
                            disabled={isItemDisabled}
                            className="h-4 w-4 accent-[#3B82F6]"
                          />
                          {item.title}
                          {!isSupported && (
                            <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300">
                              MC 1.20.1+
                            </span>
                          )}
                        </div>
                        <p className="mt-1 pl-6 text-xs leading-5 text-[#94A3B8]">
                          {!isSupported && item.id === "neoforge"
                            ? "Disponível a partir do Minecraft 1.20.1."
                            : item.description}
                        </p>
                      </label>
                    );
                  })}
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
                        updateRamMb(
                          normalizedRamMb === DEFAULT_RAM_MB
                            ? getCustomDefaultRam(maxRamMb)
                            : normalizedRamMb,
                        );
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
          <Button type="button" variant="secondary" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="rounded-xl bg-[#3B82F6] hover:bg-[#60A5FA]">
            {instance ? "Save" : createInstance.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
};
