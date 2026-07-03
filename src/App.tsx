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
import type { ContentType } from "./types/launcher";

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
    <div className="h-dvh overflow-hidden bg-[#0D1117] pt-8 text-white">
      <div className="grid h-[calc(100dvh-2rem)] grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[228px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_320px]">
        <Sidebar activePage={activePage} onPageChange={changePage} />

        <main className="min-w-0 overflow-y-auto border-l border-white/8 2xl:border-x">
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

        <aside className="hidden overflow-y-auto bg-[#0B0F15] px-4 py-5 2xl:block 2xl:px-5 2xl:py-6">
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
            className="grid min-h-screen place-items-center bg-[#0D1117] text-sm text-[#94A3B8]"
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
