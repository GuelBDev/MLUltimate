import {
  CheckCircle2,
  DownloadCloud,
  Eye,
  ImagePlus,
  Languages,
  Layers,
  MonitorPlay,
  Palette,
  PanelLeft,
  PaintBucket,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ChangeEvent } from "react";
import { languageOptions } from "../constants/languages";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { useAppDialog } from "../components/ui/appDialogContext";
import { useUpdater } from "../hooks/useUpdater";
import { launcherApi } from "../services/launcherApi";
import type { LauncherAppearancePreset, UpdateLauncherSettingsInput } from "../types/launcher";
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
const appearancePresets = [
  {
    id: "night-dark",
    label: "Night Dark",
    description: "Escuro classico com azul.",
    primaryColor: "#3B82F6",
    secondaryColor: "#60A5FA",
    backgroundColor: "#0D1117",
    mainColor: "#0D1117",
    sidebarColor: "#0A0E14",
    rightPanelColor: "#0B0F15",
    cardColor: "#161B22",
    panelColor: "#0D1117",
    inputColor: "#0B0F15",
    borderColor: "#FFFFFF",
    textColor: "#FFFFFF",
    mutedTextColor: "#94A3B8",
    navActiveColor: "#3B82F6",
    buttonTextColor: "#FFFFFF",
    backgroundOpacity: 1,
    mainOpacity: 0.38,
    surfaceOpacity: 0.82,
    panelOpacity: 0.7,
    inputOpacity: 0.92,
    sidebarOpacity: 0.96,
    rightPanelOpacity: 0.88,
    navActiveOpacity: 0.16,
    borderOpacity: 0.1,
    backgroundImageOpacity: 0.28,
    sidebarImageOpacity: 0.22,
  },
  {
    id: "blue-sky",
    label: "Blue Sky",
    description: "Azul claro e visual limpo.",
    primaryColor: "#0EA5E9",
    secondaryColor: "#38BDF8",
    backgroundColor: "#07111F",
    mainColor: "#0B1726",
    sidebarColor: "#07111F",
    rightPanelColor: "#081827",
    cardColor: "#0F2335",
    panelColor: "#0A1826",
    inputColor: "#07111F",
    borderColor: "#7DD3FC",
    textColor: "#F8FAFC",
    mutedTextColor: "#B6CEE3",
    navActiveColor: "#0EA5E9",
    buttonTextColor: "#FFFFFF",
    backgroundOpacity: 0.92,
    mainOpacity: 0.44,
    surfaceOpacity: 0.78,
    panelOpacity: 0.72,
    inputOpacity: 0.9,
    sidebarOpacity: 0.88,
    rightPanelOpacity: 0.84,
    navActiveOpacity: 0.2,
    borderOpacity: 0.16,
    backgroundImageOpacity: 0.24,
    sidebarImageOpacity: 0.3,
  },
  {
    id: "yellow-sun",
    label: "Yellow Sun",
    description: "Amarelo quente e destaque forte.",
    primaryColor: "#F59E0B",
    secondaryColor: "#FACC15",
    backgroundColor: "#17120A",
    mainColor: "#18130B",
    sidebarColor: "#100D08",
    rightPanelColor: "#161006",
    cardColor: "#21190B",
    panelColor: "#15100A",
    inputColor: "#100D08",
    borderColor: "#FDE68A",
    textColor: "#FFF7ED",
    mutedTextColor: "#D8C9AE",
    navActiveColor: "#F59E0B",
    buttonTextColor: "#120A02",
    backgroundOpacity: 0.9,
    mainOpacity: 0.44,
    surfaceOpacity: 0.76,
    panelOpacity: 0.72,
    inputOpacity: 0.9,
    sidebarOpacity: 0.9,
    rightPanelOpacity: 0.84,
    navActiveOpacity: 0.22,
    borderOpacity: 0.16,
    backgroundImageOpacity: 0.2,
    sidebarImageOpacity: 0.26,
  },
  {
    id: "light-mode",
    label: "Light mode",
    description: "Cores claras com azul suave.",
    primaryColor: "#2563EB",
    secondaryColor: "#14B8A6",
    backgroundColor: "#EAF2FF",
    mainColor: "#EEF6FF",
    sidebarColor: "#DCEBFB",
    rightPanelColor: "#E6F0FA",
    cardColor: "#F8FBFF",
    panelColor: "#EEF4FB",
    inputColor: "#FFFFFF",
    borderColor: "#8EA7C3",
    textColor: "#122033",
    mutedTextColor: "#4B637D",
    navActiveColor: "#2563EB",
    buttonTextColor: "#F8FAFC",
    backgroundOpacity: 0.72,
    mainOpacity: 0.64,
    surfaceOpacity: 0.66,
    panelOpacity: 0.76,
    inputOpacity: 0.96,
    sidebarOpacity: 0.72,
    rightPanelOpacity: 0.7,
    navActiveOpacity: 0.18,
    borderOpacity: 0.34,
    backgroundImageOpacity: 0.16,
    sidebarImageOpacity: 0.18,
  },
  {
    id: "emerald-cave",
    label: "Emerald Cave",
    description: "Verde frio para contraste.",
    primaryColor: "#10B981",
    secondaryColor: "#34D399",
    backgroundColor: "#07130F",
    mainColor: "#081914",
    sidebarColor: "#06100D",
    rightPanelColor: "#071611",
    cardColor: "#10231D",
    panelColor: "#0A1713",
    inputColor: "#06100D",
    borderColor: "#6EE7B7",
    textColor: "#ECFDF5",
    mutedTextColor: "#A8CDBF",
    navActiveColor: "#10B981",
    buttonTextColor: "#06100D",
    backgroundOpacity: 0.94,
    mainOpacity: 0.42,
    surfaceOpacity: 0.78,
    panelOpacity: 0.72,
    inputOpacity: 0.9,
    sidebarOpacity: 0.92,
    rightPanelOpacity: 0.86,
    navActiveOpacity: 0.2,
    borderOpacity: 0.16,
    backgroundImageOpacity: 0.24,
    sidebarImageOpacity: 0.24,
  },
  {
    id: "red-velt",
    label: "Red Velt",
    description: "Vermelho profundo com contraste premium.",
    primaryColor: "#DC2626",
    secondaryColor: "#FB7185",
    backgroundColor: "#150708",
    mainColor: "#17090A",
    sidebarColor: "#100506",
    rightPanelColor: "#17090A",
    cardColor: "#241011",
    panelColor: "#18090A",
    inputColor: "#120607",
    borderColor: "#FCA5A5",
    textColor: "#FFF1F2",
    mutedTextColor: "#E9B8BD",
    navActiveColor: "#DC2626",
    buttonTextColor: "#FFF7F7",
    backgroundOpacity: 0.94,
    mainOpacity: 0.44,
    surfaceOpacity: 0.8,
    panelOpacity: 0.72,
    inputOpacity: 0.92,
    sidebarOpacity: 0.94,
    rightPanelOpacity: 0.88,
    navActiveOpacity: 0.22,
    borderOpacity: 0.18,
    backgroundImageOpacity: 0.22,
    sidebarImageOpacity: 0.22,
  },
] as const;
const maxAppearanceImageBytes = 5 * 1024 * 1024;
type AppearancePreset = (typeof appearancePresets)[number];
type AppearanceImageTarget = "background" | "sidebar";
type AppearanceColorKey =
  | "primaryColor"
  | "secondaryColor"
  | "backgroundColor"
  | "mainColor"
  | "sidebarColor"
  | "rightPanelColor"
  | "cardColor"
  | "panelColor"
  | "inputColor"
  | "borderColor"
  | "textColor"
  | "mutedTextColor"
  | "navActiveColor"
  | "buttonTextColor";
type AppearanceOpacityKey =
  | "backgroundOpacity"
  | "mainOpacity"
  | "surfaceOpacity"
  | "panelOpacity"
  | "inputOpacity"
  | "sidebarOpacity"
  | "rightPanelOpacity"
  | "navActiveOpacity"
  | "borderOpacity";
const appearanceColorControls = [
  { key: "backgroundColor", label: "Fundo geral", description: "Base atras de todo o app.", icon: PaintBucket },
  { key: "mainColor", label: "Area central", description: "Regiao das paginas.", icon: Layers },
  { key: "sidebarColor", label: "Barra lateral", description: "Menu da esquerda.", icon: PanelLeft },
  { key: "rightPanelColor", label: "Painel direito", description: "Conta e area lateral.", icon: PanelLeft },
  { key: "cardColor", label: "Cards", description: "Blocos principais.", icon: Layers },
  { key: "panelColor", label: "Caixas internas", description: "Listas, filtros e paineis.", icon: Layers },
  { key: "inputColor", label: "Inputs", description: "Selects, campos e buscas.", icon: SlidersHorizontal },
  { key: "borderColor", label: "Bordas", description: "Linhas e contornos.", icon: SlidersHorizontal },
  { key: "primaryColor", label: "Botao principal", description: "Acoes mais importantes.", icon: PaintBucket },
  { key: "secondaryColor", label: "Acento", description: "Hover, icones e detalhes.", icon: Palette },
  { key: "navActiveColor", label: "Menu ativo", description: "Item selecionado na lateral.", icon: PanelLeft },
  { key: "textColor", label: "Texto principal", description: "Titulos e textos fortes.", icon: Type },
  { key: "mutedTextColor", label: "Texto secundario", description: "Descricoes e ajudas.", icon: Type },
  { key: "buttonTextColor", label: "Texto dos botoes", description: "Cor dentro dos botoes.", icon: Type },
] as const satisfies ReadonlyArray<{
  key: AppearanceColorKey;
  label: string;
  description: string;
  icon: LucideIcon;
}>;
const appearanceOpacityControls = [
  { key: "backgroundOpacity", label: "Fundo geral", min: 0.35 },
  { key: "mainOpacity", label: "Area central", min: 0 },
  { key: "surfaceOpacity", label: "Cards", min: 0.25 },
  { key: "panelOpacity", label: "Caixas internas", min: 0 },
  { key: "inputOpacity", label: "Inputs", min: 0 },
  { key: "sidebarOpacity", label: "Barra lateral", min: 0.25 },
  { key: "rightPanelOpacity", label: "Painel direito", min: 0.25 },
  { key: "navActiveOpacity", label: "Menu ativo", min: 0 },
  { key: "borderOpacity", label: "Bordas", min: 0 },
] as const satisfies ReadonlyArray<{
  key: AppearanceOpacityKey;
  label: string;
  min: number;
}>;

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
  const currentSettings = settings.data;
  const updateAppearance = (input: UpdateLauncherSettingsInput) => {
    updateSettings.mutate(input);
  };
  const applyAppearancePreset = (preset: AppearancePreset) => {
    const payload: UpdateLauncherSettingsInput = {
      appearancePreset: preset.id as LauncherAppearancePreset,
      backgroundImageOpacity: preset.backgroundImageOpacity,
      sidebarImageOpacity: preset.sidebarImageOpacity,
    };

    for (const item of appearanceColorControls) {
      (payload as Record<string, string | number>)[item.key] = preset[item.key];
    }

    for (const item of appearanceOpacityControls) {
      (payload as Record<string, string | number>)[item.key] = preset[item.key];
    }

    updateAppearance(payload);
  };
  const updateAppearanceColor = (key: AppearanceColorKey, value: string) => {
    updateAppearance({ [key]: value } as UpdateLauncherSettingsInput);
  };
  const updateAppearanceOpacity = (key: AppearanceOpacityKey, value: number) => {
    updateAppearance({ [key]: value } as UpdateLauncherSettingsInput);
  };
  const readAppearanceColor = (key: AppearanceColorKey) =>
    currentSettings?.[key] ?? appearancePresets[0][key];
  const readAppearanceOpacity = (key: AppearanceOpacityKey) =>
    currentSettings?.[key] ?? appearancePresets[0][key];
  const handleAppearanceImage = async (
    event: ChangeEvent<HTMLInputElement>,
    target: AppearanceImageTarget,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      await dialog.alert({
        title: "Imagem nao suportada",
        description: "Use PNG, JPG ou WebP para personalizar o launcher.",
        tone: "danger",
      });
      return;
    }

    if (file.size > maxAppearanceImageBytes) {
      await dialog.alert({
        title: "Imagem muito pesada",
        description: "Escolha uma imagem com ate 5 MB para manter o launcher leve.",
        tone: "danger",
      });
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const payload: UpdateLauncherSettingsInput =
      target === "background"
        ? { backgroundImageDataUrl: dataUrl, backgroundImageName: file.name }
        : { sidebarImageDataUrl: dataUrl, sidebarImageName: file.name };

    updateAppearance(payload);
  };
  const clearAppearanceImage = (target: AppearanceImageTarget) => {
    updateAppearance(
      target === "background"
        ? { backgroundImageDataUrl: null, backgroundImageName: null }
        : { sidebarImageDataUrl: null, sidebarImageName: null },
    );
  };

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

      <Card className="overflow-hidden p-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#60A5FA]/25 bg-[#3B82F6]/12">
                <Palette className="h-5 w-5 text-[#60A5FA]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Aparencia do launcher</h2>
                <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                  Personalize as cores, transparencias e imagens usadas no fundo e na barra lateral.
                </p>
              </div>
            </div>
            <Badge tone="blue">
              {appearancePresets.find((item) => item.id === currentSettings?.appearancePreset)?.label ??
                "Night Dark"}
            </Badge>
          </div>

          <AppearancePreview
            backgroundImageDataUrl={currentSettings?.backgroundImageDataUrl}
            sidebarImageDataUrl={currentSettings?.sidebarImageDataUrl}
          />

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {appearancePresets.map((preset) => {
              const active = (currentSettings?.appearancePreset ?? "night-dark") === preset.id;

              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={settings.isLoading || updateSettings.isPending}
                  onClick={() => applyAppearancePreset(preset)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-[#60A5FA]/60 bg-[#3B82F6]/12"
                      : "border-white/10 bg-[#0D1117]/70 hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ background: preset.primaryColor }}
                    />
                    {preset.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#94A3B8]">
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <PaintBucket className="h-4 w-4 text-[#60A5FA]" />
              Cores por parte do app
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {appearanceColorControls.map((item) => {
                const Icon = item.icon;

                return (
                  <ColorControl
                    key={item.key}
                    label={item.label}
                    description={item.description}
                    icon={Icon}
                    value={readAppearanceColor(item.key)}
                    disabled={settings.isLoading || updateSettings.isPending}
                    onChange={(value) => updateAppearanceColor(item.key, value)}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <SlidersHorizontal className="h-4 w-4 text-[#60A5FA]" />
              Transparencias por parte
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {appearanceOpacityControls.map((item) => (
                <RangeControl
                  key={item.key}
                  label={item.label}
                  value={readAppearanceOpacity(item.key)}
                  min={item.min}
                  max={1}
                  disabled={settings.isLoading || updateSettings.isPending}
                  onChange={(value) => updateAppearanceOpacity(item.key, value)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <ImagePlus className="h-4 w-4 text-[#60A5FA]" />
              Imagens customizadas com preview
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <ImageControl
                label="Fundo total do app"
                sizeHint="Recomendado: 1920x1080 ou 2560x1440, ate 5 MB."
                fileName={currentSettings?.backgroundImageName}
                previewUrl={currentSettings?.backgroundImageDataUrl}
                opacity={currentSettings?.backgroundImageOpacity ?? 0.28}
                disabled={settings.isLoading || updateSettings.isPending}
                onFile={(event) => void handleAppearanceImage(event, "background")}
                onClear={() => clearAppearanceImage("background")}
                onOpacity={(backgroundImageOpacity) => updateAppearance({ backgroundImageOpacity })}
              />
              <ImageControl
                label="Imagem da barra lateral"
                sizeHint="Recomendado: 512x1440, ate 5 MB."
                fileName={currentSettings?.sidebarImageName}
                previewUrl={currentSettings?.sidebarImageDataUrl}
                opacity={currentSettings?.sidebarImageOpacity ?? 0.22}
                disabled={settings.isLoading || updateSettings.isPending}
                onFile={(event) => void handleAppearanceImage(event, "sidebar")}
                onClear={() => clearAppearanceImage("sidebar")}
                onOpacity={(sidebarImageOpacity) => updateAppearance({ sidebarImageOpacity })}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-fit"
            disabled={settings.isLoading || updateSettings.isPending}
            onClick={() => applyAppearancePreset(appearancePresets[0])}
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar visual padrao
          </Button>
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

const AppearancePreview = ({
  backgroundImageDataUrl,
  sidebarImageDataUrl,
}: {
  backgroundImageDataUrl?: string;
  sidebarImageDataUrl?: string;
}) => (
  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1117]/70">
    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">
      <Eye className="h-4 w-4 text-[#60A5FA]" />
      Preview do visual
    </div>
    <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div
        className="relative min-h-48 overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--app-bg-base)]"
        style={{ backgroundImage: backgroundImageDataUrl ? `url(${backgroundImageDataUrl})` : undefined }}
      >
        {backgroundImageDataUrl ? (
          <div className="absolute inset-0" style={{ background: "rgb(var(--app-bg-rgb) / 0.4)" }} />
        ) : null}
        <div className="relative grid min-h-48 grid-cols-[72px_minmax(0,1fr)]">
          <div
            className="border-r border-white/10 bg-[color:var(--app-sidebar-bg)] p-3"
            style={{ backgroundImage: sidebarImageDataUrl ? `url(${sidebarImageDataUrl})` : undefined }}
          >
            <div className="mb-5 h-8 w-8 rounded-xl bg-[color:var(--app-primary)]" />
            <div className="grid gap-2">
              <div className="h-7 rounded-lg bg-[color:var(--app-nav-active-bg)]" />
              <div className="h-7 rounded-lg bg-white/8" />
              <div className="h-7 rounded-lg bg-white/8" />
            </div>
          </div>
          <div className="bg-[color:var(--app-main-overlay)] p-4">
            <div className="mb-3 h-4 w-28 rounded-full bg-[color:var(--app-secondary)]/70" />
            <div className="rounded-2xl border border-white/10 bg-[color:var(--app-card-bg)] p-4">
              <div className="mb-3 h-4 w-40 rounded-full bg-[color:var(--app-text-primary)]/80" />
              <div className="mb-4 h-3 w-full max-w-72 rounded-full bg-[color:var(--app-text-muted)]/50" />
              <div className="flex gap-2">
                <div className="h-9 w-28 rounded-xl bg-[color:var(--app-primary)]" />
                <div className="h-9 w-24 rounded-xl border border-white/10 bg-[color:var(--app-panel-bg)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-[color:var(--app-card-bg)] p-4">
          <p className="text-sm font-semibold text-white">O tema mexe no app todo</p>
          <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
            Fundo, laterais, cards, campos, bordas, textos, botoes e item ativo do menu.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            "var(--app-primary)",
            "var(--app-secondary)",
            "var(--app-card-bg)",
            "var(--app-panel-bg)",
          ].map((color) => (
            <span
              key={color}
              className="h-12 rounded-xl border border-white/10"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ColorControl = ({
  label,
  description,
  icon: Icon,
  value,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) => (
  <label className="group flex min-h-24 items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0D1117]/70 p-4 transition hover:border-[#60A5FA]/35">
    <span className="flex min-w-0 items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/6">
        <Icon className="h-4 w-4 text-[#60A5FA]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#94A3B8]">{description}</span>
        <span className="mt-2 block text-xs font-semibold text-[#D8DEE9]">{value.toUpperCase()}</span>
      </span>
    </span>
    <input
      type="color"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
      className="h-11 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent p-1 disabled:cursor-not-allowed"
    />
  </label>
);

const RangeControl = ({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-white">{label}</span>
      <span className="text-[#94A3B8]">{Math.round(value * 100)}%</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={0.01}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
      className="mt-2 h-2 w-full cursor-pointer accent-[#60A5FA] disabled:cursor-not-allowed"
    />
  </label>
);

const ImageControl = ({
  label,
  sizeHint,
  fileName,
  previewUrl,
  opacity,
  disabled,
  onFile,
  onClear,
  onOpacity,
}: {
  label: string;
  sizeHint: string;
  fileName?: string;
  previewUrl?: string;
  opacity: number;
  disabled: boolean;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onOpacity: (value: number) => void;
}) => (
  <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
    <div
      className="relative grid min-h-40 place-items-center border-b border-white/10 bg-[#0D1117]/70"
      style={{
        backgroundImage: previewUrl ? `url(${previewUrl})` : undefined,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      {previewUrl ? (
        <div className="absolute inset-0 bg-black/25" />
      ) : null}
      <div className="relative rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-center backdrop-blur-md">
        <ImagePlus className="mx-auto h-5 w-5 text-[#60A5FA]" />
        <p className="mt-2 text-sm font-semibold text-white">
          {previewUrl ? "Imagem carregada" : "Nenhuma imagem"}
        </p>
        <p className="mt-1 max-w-72 text-xs leading-5 text-[#94A3B8]">{sizeHint}</p>
      </div>
    </div>

    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          {fileName ? (
            <p className="mt-2 max-w-full truncate text-xs font-medium text-[#D8DEE9]">
              {fileName}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[#94A3B8]">PNG, JPG ou WebP.</p>
          )}
        </div>
        {fileName ? (
          <Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={onClear} title="Remover imagem">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/6 px-3 text-sm font-semibold text-white transition hover:border-[#60A5FA]/50 hover:bg-white/10">
          <ImagePlus className="h-4 w-4" />
          Escolher imagem
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled}
            onChange={onFile}
            className="sr-only"
          />
        </label>
        <div className="min-w-0 flex-1">
          <RangeControl
            label="Transparencia da imagem"
            value={opacity}
            min={0}
            max={1}
            disabled={disabled}
            onChange={onOpacity}
          />
        </div>
      </div>
    </div>
  </div>
);

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
