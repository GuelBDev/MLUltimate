import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { AccountPanel } from "./components/account/AccountPanel";
import { LanguageSetupScreen } from "./components/language/LanguageSetupScreen";
import { Sidebar, type PageId } from "./components/layout/Sidebar";
import { StartupScreen } from "./components/startup/StartupScreen";
import { WindowTitleBar } from "./components/window/WindowTitleBar";
import { AvatarPage } from "./pages/AvatarPage";
import { DownloadsPage } from "./pages/DownloadsPage";
import { ExplorePage } from "./pages/ExplorePage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { launcherApi } from "./services/launcherApi";
import type { ContentType } from "./types/launcher";

const pageTitles: Record<PageId, string> = {
  home: "Home",
  avatar: "Avatar",
  library: "Biblioteca",
  explore: "Explorar",
  downloads: "Downloads",
  settings: "Configuracoes",
};

function AppShell() {
  const [activePage, setActivePage] = useState<PageId>("home");
  const [exploreContext, setExploreContext] = useState<{
    type: ContentType;
    instanceId?: string;
  }>({ type: "mod" });

  const page = useMemo(() => {
    switch (activePage) {
      case "library":
        return (
          <LibraryPage
            onExploreInstance={(type, instanceId) => {
              setExploreContext({ type, instanceId });
              setActivePage("explore");
            }}
          />
        );
      case "downloads":
        return <DownloadsPage />;
      case "avatar":
        return <AvatarPage />;
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
            onNavigate={setActivePage}
            onExploreInstance={(type, instanceId) => {
              setExploreContext({ type, instanceId });
              setActivePage("explore");
            }}
          />
        );
    }
  }, [activePage, exploreContext.instanceId, exploreContext.type]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#0D1117] pt-8 text-white">
      <div className="grid h-[calc(100vh-2rem)] grid-cols-[248px_minmax(0,1fr)_340px]">
        <Sidebar activePage={activePage} onPageChange={setActivePage} />

        <main className="min-w-0 overflow-y-auto border-x border-white/8">
          <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col gap-6 px-7 py-6">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#60A5FA]">MLUltimate Launcher</p>
                <h1 className="mt-1 text-2xl font-semibold text-white">
                  {pageTitles[activePage]}
                </h1>
              </div>
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
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

        <aside className="overflow-y-auto bg-[#0B0F15] px-5 py-6">
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
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: launcherApi.getSettings,
    enabled: !isBooting,
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
            Carregando preferencias...
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
      <AppRoot />
    </QueryClientProvider>
  );
}

export default App;
