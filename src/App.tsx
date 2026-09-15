import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ServersPage } from "./pages/ServersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { launcherApi } from "./services/launcherApi";
import type { ContentType } from "./types/launcher";
import { cn } from "./utils/cn";
import { AccountModal } from "./components/account/AccountModal";

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

import { applyAppearanceSettings } from "./utils/appearance";

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
  home: "Launchpad",
  avatar: "Avatar & Skins",
  servers: "Servidores",
  library: "Minhas Instâncias",
  explore: "Biblioteca",
  downloads: "Downloads",
  settings: "Configurações",
};

type AppShellProps = {
  activePage: PageId;
  changePage: (page: PageId) => void;
  pageRevision: number;
  refreshActivePage: () => void;
  exploreContext: { type: ContentType; instanceId?: string };
  navigateToExplore: (type: ContentType, instanceId?: string) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenAccountModal?: () => void;
};

function AppShell({
  activePage,
  changePage,
  pageRevision,
  refreshActivePage,
  exploreContext,
  navigateToExplore,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenAccountModal,
}: AppShellProps) {
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
              navigateToExplore(type, instanceId);
            }}
          />
        );
      case "downloads":
        return <DownloadsPage />;
      case "avatar":
        return <AvatarPage />;
      case "servers":
        return <ServersPage />;
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
              navigateToExplore(type, instanceId);
            }}
            onOpenAccountModal={onOpenAccountModal}
          />
        );
    }
  }, [activePage, changePage, exploreContext.instanceId, exploreContext.type, navigateToExplore, onOpenAccountModal]);

  return (
    <div className="app-shell h-dvh overflow-hidden pt-8 text-white">
      <div
        className={cn(
          "grid h-[calc(100dvh-2rem)] transition-[grid-template-columns] duration-300 ease-in-out",
          isSidebarCollapsed
            ? "grid-cols-[68px_minmax(0,1fr)]"
            : "grid-cols-[228px_minmax(0,1fr)]",
        )}
      >
        <Sidebar
          activePage={activePage}
          onPageChange={changePage}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={onToggleSidebar}
        />

        <div className="flex min-w-0 flex-1 overflow-hidden border-l border-white/8">
          <main className={cn("app-main flex-1 min-w-0", activePage === "home" ? "overflow-hidden flex flex-col" : "overflow-y-auto")}>
            <div
              className={cn(
                "mx-auto flex w-full flex-col max-w-[1540px]",
                activePage === "home"
                  ? "h-full flex-1 overflow-hidden px-4 py-3 sm:px-6 lg:px-7 lg:py-3 gap-3"
                  : "min-h-full gap-5 px-4 py-4 sm:px-6 lg:gap-6 lg:px-8 lg:py-5",
              )}
            >
              {activePage !== "home" && (
                <header className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#60A5FA]">
                      MLUltimate Launcher
                    </p>
                    <h1 className="mt-1 text-2xl font-semibold text-white">
                      {pageTitles[activePage]}
                    </h1>
                  </div>
                </header>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${activePage}-${pageRevision}`}
                  initial={{ opacity: 0, y: 10, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.99 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className={activePage === "home" ? "h-full flex flex-col flex-1 overflow-hidden min-h-0" : undefined}
                >
                  {page}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

const settingsKey = ["settings"] as const;

function AppRoot() {
  const queryClient = useQueryClient();
  const [isBooting, setIsBooting] = useState(true);
  const [activePage, setActivePage] = useState<PageId>("home");
  const [pageRevision, setPageRevision] = useState(0);
  const [exploreContext, setExploreContext] = useState<{
    type: ContentType;
    instanceId?: string;
  }>({ type: "mod" });

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

  const refreshActivePage = useCallback(() => {
    void queryClient.invalidateQueries();
    setPageRevision((revision) => revision + 1);
  }, [queryClient]);

  const navigateToExplore = useCallback(
    (type: ContentType, instanceId?: string) => {
      setExploreContext({ type, instanceId });
      setActivePage("explore");
    },
    [],
  );

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

  const [sidebarCollapsedOverride, setSidebarCollapsedOverride] = useState<boolean | null>(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const isSidebarCollapsed =
    sidebarCollapsedOverride ?? (settings.data?.sidebarCollapsed !== false);

  const toggleSidebar = useCallback(() => {
    const next = !isSidebarCollapsed;
    setSidebarCollapsedOverride(next);
    void launcherApi.updateSettings({ sidebarCollapsed: next }).then((updated) => {
      queryClient.setQueryData(settingsKey, updated);
    });
  }, [isSidebarCollapsed, queryClient]);

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
      {showTitleBar ? (
        <WindowTitleBar
          activePage={activePage}
          onNavigate={changePage}
          onOpenAccountModal={() => setAccountModalOpen(true)}
        />
      ) : null}
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
            <AppShell
              activePage={activePage}
              changePage={changePage}
              pageRevision={pageRevision}
              refreshActivePage={refreshActivePage}
              exploreContext={exploreContext}
              navigateToExplore={navigateToExplore}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={toggleSidebar}
              onOpenAccountModal={() => setAccountModalOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AccountModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
      />
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
