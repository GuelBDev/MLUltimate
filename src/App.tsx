import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AccountPanel } from "./components/account/AccountPanel";
import { RuntimeTranslator } from "./components/i18n/RuntimeTranslator";
import { LanguageSetupScreen } from "./components/language/LanguageSetupScreen";
import { Sidebar, type PageId } from "./components/layout/Sidebar";
import { StartupScreen } from "./components/startup/StartupScreen";
import { AppDialogProvider } from "./components/ui/AppDialog";
import { WindowTitleBar } from "./components/window/WindowTitleBar";
import { AvatarPage } from "./pages/AvatarPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { ExplorePage } from "./pages/ExplorePage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { PvpPage } from "./pages/PvpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { launcherApi } from "./services/launcherApi";
import type { ContentType, LauncherSettings } from "./types/launcher";

const HUD_SCALE_STORAGE_KEY = "mlultimate:hud-scale";
const HUD_SCALE_MIN = 0.75;
const HUD_SCALE_MAX = 1.35;
const HUD_SCALE_STEP = 0.05;

const clampHudScale = (scale: number) =>
  Math.min(HUD_SCALE_MAX, Math.max(HUD_SCALE_MIN, Number(scale.toFixed(2))));

const readHudScale = () => {
  if (typeof localStorage === "undefined") {
    return 1;
  }

  const stored = Number(localStorage.getItem(HUD_SCALE_STORAGE_KEY));
  return Number.isFinite(stored) ? clampHudScale(stored) : 1;
};

const saveHudScale = (scale: number) => {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(HUD_SCALE_STORAGE_KEY, scale.toFixed(2));
};

const fallbackAppearance = {
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
};

const readAppearanceColor = (value: string | undefined, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value ?? "") ? value ?? fallback : fallback;

const hexToRgb = (hex: string | undefined, fallback = "#3B82F6") => {
  const normalized = readAppearanceColor(hex, fallback);
  const value = Number.parseInt(normalized.slice(1), 16);

  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

const clampAppearanceNumber = (value: number | undefined, fallback: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Number((value as number).toFixed(2))));
};

const cssUrl = (value?: string) => (value ? `url("${value.replace(/"/g, '\\"')}")` : "none");

const applyAppearanceSettings = (settings: LauncherSettings) => {
  const root = document.documentElement;
  const primary = readAppearanceColor(settings.primaryColor, fallbackAppearance.primaryColor);
  const secondary = readAppearanceColor(settings.secondaryColor, fallbackAppearance.secondaryColor);
  const background = readAppearanceColor(settings.backgroundColor, fallbackAppearance.backgroundColor);
  const main = readAppearanceColor(settings.mainColor, fallbackAppearance.mainColor);
  const sidebar = readAppearanceColor(settings.sidebarColor, fallbackAppearance.sidebarColor);
  const rightPanel = readAppearanceColor(settings.rightPanelColor, fallbackAppearance.rightPanelColor);
  const card = readAppearanceColor(settings.cardColor, fallbackAppearance.cardColor);
  const panel = readAppearanceColor(settings.panelColor, fallbackAppearance.panelColor);
  const input = readAppearanceColor(settings.inputColor, fallbackAppearance.inputColor);
  const border = readAppearanceColor(settings.borderColor, fallbackAppearance.borderColor);
  const text = readAppearanceColor(settings.textColor, fallbackAppearance.textColor);
  const mutedText = readAppearanceColor(settings.mutedTextColor, fallbackAppearance.mutedTextColor);
  const navActive = readAppearanceColor(settings.navActiveColor, fallbackAppearance.navActiveColor);
  const buttonText = readAppearanceColor(settings.buttonTextColor, fallbackAppearance.buttonTextColor);
  const backgroundOpacity = clampAppearanceNumber(
    settings.backgroundOpacity,
    fallbackAppearance.backgroundOpacity,
    0.35,
    1,
  );
  const mainOpacity = clampAppearanceNumber(settings.mainOpacity, fallbackAppearance.mainOpacity, 0, 1);
  const surfaceOpacity = clampAppearanceNumber(
    settings.surfaceOpacity,
    fallbackAppearance.surfaceOpacity,
    0.25,
    1,
  );
  const panelOpacity = clampAppearanceNumber(settings.panelOpacity, fallbackAppearance.panelOpacity, 0, 1);
  const inputOpacity = clampAppearanceNumber(settings.inputOpacity, fallbackAppearance.inputOpacity, 0, 1);
  const sidebarOpacity = clampAppearanceNumber(
    settings.sidebarOpacity,
    fallbackAppearance.sidebarOpacity,
    0.25,
    1,
  );
  const rightPanelOpacity = clampAppearanceNumber(
    settings.rightPanelOpacity,
    fallbackAppearance.rightPanelOpacity,
    0.25,
    1,
  );
  const navActiveOpacity = clampAppearanceNumber(
    settings.navActiveOpacity,
    fallbackAppearance.navActiveOpacity,
    0,
    1,
  );
  const borderOpacity = clampAppearanceNumber(settings.borderOpacity, fallbackAppearance.borderOpacity, 0, 1);

  root.dataset.appearancePreset = settings.appearancePreset;
  root.style.setProperty("--app-primary", primary);
  root.style.setProperty("--app-secondary", secondary);
  root.style.setProperty("--app-primary-rgb", hexToRgb(primary));
  root.style.setProperty("--app-secondary-rgb", hexToRgb(secondary));
  root.style.setProperty("--app-bg-rgb", hexToRgb(background, fallbackAppearance.backgroundColor));
  root.style.setProperty("--app-main-rgb", hexToRgb(main, fallbackAppearance.mainColor));
  root.style.setProperty("--app-sidebar-rgb", hexToRgb(sidebar, fallbackAppearance.sidebarColor));
  root.style.setProperty("--app-right-panel-rgb", hexToRgb(rightPanel, fallbackAppearance.rightPanelColor));
  root.style.setProperty("--app-card-rgb", hexToRgb(card, fallbackAppearance.cardColor));
  root.style.setProperty("--app-panel-rgb", hexToRgb(panel, fallbackAppearance.panelColor));
  root.style.setProperty("--app-input-rgb", hexToRgb(input, fallbackAppearance.inputColor));
  root.style.setProperty("--app-border-rgb", hexToRgb(border, fallbackAppearance.borderColor));
  root.style.setProperty("--app-nav-active-rgb", hexToRgb(navActive, fallbackAppearance.navActiveColor));
  root.style.setProperty("--app-bg-base", `rgb(var(--app-bg-rgb) / ${backgroundOpacity})`);
  root.style.setProperty("--app-main-overlay", `rgb(var(--app-main-rgb) / ${mainOpacity})`);
  root.style.setProperty("--app-card-bg", `rgb(var(--app-card-rgb) / ${surfaceOpacity})`);
  root.style.setProperty("--app-panel-bg", `rgb(var(--app-panel-rgb) / ${panelOpacity})`);
  root.style.setProperty("--app-input-bg", `rgb(var(--app-input-rgb) / ${inputOpacity})`);
  root.style.setProperty("--app-sidebar-bg", `rgb(var(--app-sidebar-rgb) / ${sidebarOpacity})`);
  root.style.setProperty("--app-account-bg", `rgb(var(--app-right-panel-rgb) / ${rightPanelOpacity})`);
  root.style.setProperty("--app-nav-active-bg", `rgb(var(--app-nav-active-rgb) / ${navActiveOpacity})`);
  root.style.setProperty("--app-border-color", `rgb(var(--app-border-rgb) / ${borderOpacity})`);
  root.style.setProperty("--app-text-primary", text);
  root.style.setProperty("--app-text-muted", mutedText);
  root.style.setProperty("--app-button-text", buttonText);
  root.style.setProperty(
    "--app-bg-image-opacity",
    String(clampAppearanceNumber(settings.backgroundImageOpacity, fallbackAppearance.backgroundImageOpacity, 0, 1)),
  );
  root.style.setProperty(
    "--app-sidebar-image-opacity",
    String(clampAppearanceNumber(settings.sidebarImageOpacity, fallbackAppearance.sidebarImageOpacity, 0, 1)),
  );
  root.style.setProperty("--app-bg-image", cssUrl(settings.backgroundImageDataUrl));
  root.style.setProperty("--app-sidebar-image", cssUrl(settings.sidebarImageDataUrl));
};

const useHudScaleControls = () => {
  useEffect(() => {
    let currentScale = readHudScale();
    void launcherApi.setHudScale(currentScale);

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();

      const direction = event.deltaY < 0 ? 1 : -1;
      currentScale = clampHudScale(currentScale + direction * HUD_SCALE_STEP);
      saveHudScale(currentScale);
      void launcherApi.setHudScale(currentScale);
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel);
    };
  }, []);
};

const pageTitles: Record<PageId, string> = {
  home: "Home",
  avatar: "Avatar",
  pvp: "PVP",
  library: "Minhas Instâncias",
  explore: "Biblioteca",
  downloads: "Downloads",
  settings: "Configurações",
};

function AppShell() {
  const queryClient = useQueryClient();
  const [activePage, setActivePage] = useState<PageId>("home");
  const [pageRevision, setPageRevision] = useState(0);
  const [exploreContext, setExploreContext] = useState<{
    type: ContentType;
    instanceId?: string;
  }>({ type: "mod" });
  const refreshActivePage = useCallback(() => {
    void queryClient.invalidateQueries();
    setPageRevision((revision) => revision + 1);
  }, [queryClient]);
  const changePage = useCallback(
    (page: PageId) => {
      if (page === activePage) {
        refreshActivePage();
        return;
      }

      setActivePage(page);
    },
    [activePage, refreshActivePage],
  );

  useEffect(() => {
    const refreshOnShortcut = (event: KeyboardEvent) => {
      const isRefresh =
        event.key === "F5" ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r");

      if (!isRefresh) {
        return;
      }

      event.preventDefault();
      refreshActivePage();
    };

    window.addEventListener("keydown", refreshOnShortcut);
    return () => window.removeEventListener("keydown", refreshOnShortcut);
  }, [refreshActivePage]);

  const page = useMemo(() => {
    switch (activePage) {
      case "library":
        return (
          <LibraryPage
            onExploreInstance={(type, instanceId) => {
              setExploreContext({ type, instanceId });
              changePage("explore");
            }}
          />
        );
      case "downloads":
        return <DownloadsPage />;
      case "avatar":
        return <AvatarPage />;
      case "pvp":
        return <PvpPage />;
      case "settings":
        return <SettingsPage />;
      case "explore":
        return (
          <ExplorePage
            key={`${exploreContext.type}-${exploreContext.instanceId ?? "default"}`}
            initialType={exploreContext.type}
            initialInstanceId={exploreContext.instanceId}
          />
        );
      case "home":
      default:
        return (
          <HomePage
            focus={activePage}
            onNavigate={changePage}
            onExploreInstance={(type, instanceId) => {
              setExploreContext({ type, instanceId });
              changePage("explore");
            }}
          />
        );
    }
  }, [activePage, changePage, exploreContext.instanceId, exploreContext.type]);

  return (
    <div className="app-shell h-dvh overflow-hidden pt-8 text-white">
      <div className="grid h-[calc(100dvh-2rem)] grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[228px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_320px]">
        <Sidebar activePage={activePage} onPageChange={changePage} />

        <main className="app-main min-w-0 overflow-y-auto border-l border-white/8 2xl:border-x">
          <div className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col gap-5 px-3 py-4 sm:px-5 lg:gap-6 lg:px-7 lg:py-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#60A5FA]">MLUltimate Launcher</p>
                <h1 className="mt-1 text-2xl font-semibold text-white">
                  {pageTitles[activePage]}
                </h1>
              </div>
            </header>

            <div className="2xl:hidden">
              <AccountPanel />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activePage}-${pageRevision}`}
                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {page}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        <aside className="app-account-aside hidden overflow-y-auto px-4 py-5 2xl:block 2xl:px-5 2xl:py-6">
          <AccountPanel />
        </aside>
      </div>
    </div>
  );
}

const settingsKey = ["settings"] as const;

function AppRoot() {
  const queryClient = useQueryClient();
  const [isBooting, setIsBooting] = useState(true);
  useHudScaleControls();
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: launcherApi.getSettings,
  });
  const saveLanguage = useMutation({
    mutationFn: launcherApi.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKey, data);
    },
  });

  const needsLanguageSetup = !isBooting && settings.data && !settings.data.languageSelected;
  const isLoadingSettings = !isBooting && settings.isLoading;
  const showTitleBar = !isBooting && !isLoadingSettings && !needsLanguageSetup;
  const handleStartupComplete = useCallback(() => setIsBooting(false), []);

  useEffect(() => {
    if (!settings.data) {
      return;
    }

    applyAppearanceSettings(settings.data);
  }, [settings.data]);

  return (
    <>
      {settings.data ? <RuntimeTranslator language={settings.data.language} /> : null}
      {showTitleBar ? <WindowTitleBar /> : null}
      <AnimatePresence mode="wait">
        {isBooting ? (
          <StartupScreen key="startup" onComplete={handleStartupComplete} />
        ) : isLoadingSettings ? (
          <motion.div
            key="settings-loading"
            className="app-loading grid min-h-screen place-items-center text-sm text-[#94A3B8]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Carregando preferências...
          </motion.div>
        ) : needsLanguageSetup ? (
          <motion.div
            key="language"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <LanguageSetupScreen
              currentLanguage={settings.data.language}
              saving={saveLanguage.isPending}
              onSave={(language) => saveLanguage.mutate({ language, languageSelected: true })}
            />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <AppShell />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppDialogProvider>
        <AppRoot />
      </AppDialogProvider>
    </QueryClientProvider>
  );
}

export default App;
