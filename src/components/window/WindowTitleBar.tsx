import { useState, useRef, useEffect, type CSSProperties } from "react";
import {
  Bell,
  Boxes,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  LogOut,
  Maximize2,
  Minus,
  Moon,
  Paintbrush,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import appIcon from "../../assets/mlultimate-icon.png";
import { useAuthSession } from "../../hooks/useAuthSession";
import { useRunningInstances } from "../../hooks/useRunningInstances";
import { launcherApi } from "../../services/launcherApi";
import { cn } from "../../utils/cn";
import type { PageId } from "../layout/Sidebar";
import { AccountModal } from "../account/AccountModal";

const hasWindowControls = () =>
  typeof window !== "undefined" && Boolean(window.mlultimate?.window);

const pageBreadcrumbs: Record<PageId, string> = {
  home: "Launchpad",
  library: "Minhas Instâncias",
  explore: "Biblioteca de Mods",
  servers: "Servidores",
  avatar: "Guarda-Roupa & Skins",
  downloads: "Downloads",
  settings: "Configurações",
};

export type UserStatus = "online" | "away" | "busy" | "invisible";

const STATUS_MAP: Record<UserStatus, { label: string; dotClass: string }> = {
  online: {
    label: "Online",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]",
  },
  away: {
    label: "Away",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)]",
  },
  busy: {
    label: "Busy",
    dotClass: "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.85)]",
  },
  invisible: {
    label: "Invisible",
    dotClass: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.85)]",
  },
};

type WindowTitleBarProps = {
  activePage?: PageId;
  onNavigate?: (page: PageId) => void;
  onOpenAccountModal?: () => void;
};

export function WindowTitleBar({
  activePage = "home",
  onNavigate,
  onOpenAccountModal,
}: WindowTitleBarProps) {
  const isWindows =
    typeof window !== "undefined" && window.mlultimate?.platform === "win32";

  const { runningIds } = useRunningInstances();
  const { session, accounts, switchAccount, logout } = useAuthSession();

  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const openAccountManager = () => {
    setAccountMenuOpen(false);
    setActiveSubmenu(null);
    if (onOpenAccountModal) {
      onOpenAccountModal();
    } else {
      setAccountModalOpen(true);
    }
  };

  const [userStatus, setUserStatus] = useState<UserStatus>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mlultimate:user-status");
      if (saved === "online" || saved === "away" || saved === "busy" || saved === "invisible") {
        return saved;
      }
    }
    return "online";
  });

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<"status" | "accounts" | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [runningMenuOpen, setRunningMenuOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef<HTMLDivElement>(null);

  const instancesQuery = useQuery({
    queryKey: ["instances"],
    queryFn: launcherApi.listInstances,
    staleTime: 10_000,
  });

  const activeAccount = session.data?.status === "signed-in" ? session.data.account : null;
  const username = activeAccount?.displayName?.trim() || "Jogador";
  const savedAccounts = accounts.data ?? [];
  const runningList = Array.from(runningIds);
  const runningCount = runningList.length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountMenuOpen(false);
        setActiveSubmenu(null);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (runningRef.current && !runningRef.current.contains(target)) {
        setRunningMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectStatus = (status: UserStatus) => {
    setUserStatus(status);
    try {
      localStorage.setItem("mlultimate:user-status", status);
    } catch {
      // ignore
    }
    setActiveSubmenu(null);
    setAccountMenuOpen(false);
  };

  const handleOpenScreenshots = () => {
    const targetId = runningList[0] || instancesQuery.data?.[0]?.id;
    if (targetId) {
      void launcherApi.openInstanceSubfolder(targetId, "screenshots");
    } else {
      onNavigate?.("library");
    }
    setAccountMenuOpen(false);
    setActiveSubmenu(null);
  };

  const minimize = () => {
    if (!hasWindowControls()) return;
    void window.mlultimate.window.minimize();
  };

  const toggleMaximize = () => {
    if (!hasWindowControls()) return;
    void window.mlultimate.window.toggleMaximize();
  };

  const close = () => {
    if (!hasWindowControls()) return;
    void window.mlultimate.window.close();
  };

  const getInstanceName = (id: string) => {
    const found = instancesQuery.data?.find((item) => item.id === id);
    return found?.name || id;
  };

  const currentStatus = STATUS_MAP[userStatus];

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[80] flex h-8 select-none items-center justify-between border-b border-white/8 bg-[#111820] px-2 text-white shadow-lg shadow-black/20"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      {/* Left side: Breadcrumb navigation */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate?.("home")}
          className="flex items-center gap-2 rounded px-1.5 py-0.5 text-xs font-semibold text-white/90 transition hover:bg-white/5"
          style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          title="Ir para o Launchpad"
        >
          <img src={appIcon} alt="MLUltimate" className="h-4 w-4 rounded object-contain" />
          <span className="tracking-wide">MLUltimate</span>
        </button>

        <ChevronRight className="h-3 w-3 text-white/30" />

        <span className="truncate text-xs font-medium text-[#60A5FA]">
          {pageBreadcrumbs[activePage] || "Launchpad"}
        </span>
      </div>

      {/* Right side: Lunar-style pills + Windows Controls */}
      <div className="flex items-center gap-2">
        {/* Notification Bell Button */}
        <div className="relative" ref={notificationsRef} style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              setAccountMenuOpen(false);
              setRunningMenuOpen(false);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            title="Notificações"
          >
            <Bell className="h-3.5 w-3.5" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-8 z-50 w-64 rounded-xl border border-white/10 bg-[#161B22] p-3 text-xs shadow-2xl shadow-black/70 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <p className="font-semibold text-white">Notificações</p>
                <span className="text-[10px] text-[#94A3B8]">Launcher 4.0.1</span>
              </div>
              <div className="py-3 text-center text-[#94A3B8]">
                <p className="text-xs">Tudo atualizado e pronto para jogar!</p>
              </div>
            </div>
          )}
        </div>

        {/* Account Pill (Lunar Client Style) */}
        <div className="relative" ref={accountRef} style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen((prev) => !prev);
              setActiveSubmenu(null);
              setRunningMenuOpen(false);
              setNotificationsOpen(false);
            }}
            className="flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/10"
            title="Conta de jogo e perfil"
          >
            <div className="h-4 w-4 overflow-hidden rounded border border-white/20 bg-slate-800 flex-shrink-0">
              <img
                src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/24`}
                alt=""
                className="h-full w-full object-cover [image-rendering:pixelated]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <Moon className="h-3 w-3 text-white/80 fill-white/80 flex-shrink-0" />
            <span className="max-w-[100px] truncate font-bold text-white tracking-wide">{username}</span>
            <span className={cn("h-2 w-2 rounded-full flex-shrink-0", currentStatus.dotClass)} />
            {accountMenuOpen ? (
              <ChevronUp className="h-3 w-3 text-white/60" />
            ) : (
              <ChevronDown className="h-3 w-3 text-white/60" />
            )}
          </button>

          {/* Lunar-style Account Tray Dropdown */}
          {accountMenuOpen && (
            <div className="absolute right-0 top-8 z-50 w-56 rounded-2xl border border-white/10 bg-[#121620] p-1.5 text-xs shadow-2xl shadow-black/80 backdrop-blur-xl">
              {/* 1. Change Status */}
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setActiveSubmenu("status")}
                  onClick={() => setActiveSubmenu((prev) => (prev === "status" ? null : "status"))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition",
                    activeSubmenu === "status"
                      ? "bg-white/10 text-white"
                      : "text-white/90 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn("h-3 w-3 rounded-full flex-shrink-0", currentStatus.dotClass)} />
                    <span className="font-semibold">Change Status</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                </button>

                {/* Status Flyout Submenu */}
                {activeSubmenu === "status" && (
                  <div
                    className="absolute right-full top-0 mr-2 w-44 rounded-xl border border-white/10 bg-[#161B24] p-1.5 shadow-2xl backdrop-blur-xl"
                    onMouseEnter={() => setActiveSubmenu("status")}
                  >
                    <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Status do Perfil
                    </p>
                    {(Object.keys(STATUS_MAP) as UserStatus[]).map((st) => {
                      const cfg = STATUS_MAP[st];
                      const isSelected = userStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleSelectStatus(st)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-white/90 transition hover:bg-white/10 hover:text-white"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", cfg.dotClass)} />
                            <span className="font-medium">{cfg.label}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Switch Account */}
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setActiveSubmenu("accounts")}
                  onClick={() => setActiveSubmenu((prev) => (prev === "accounts" ? null : "accounts"))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition",
                    activeSubmenu === "accounts"
                      ? "bg-white/10 text-white"
                      : "text-white/90 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-white/80 flex-shrink-0" />
                    <span className="font-semibold">Switch Account</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-white/40" />
                </button>

                {/* Switch Account Flyout Submenu */}
                {activeSubmenu === "accounts" && (
                  <div
                    className="absolute right-full top-2 mr-2 w-64 rounded-xl border border-white/10 bg-[#161B24] p-1.5 shadow-2xl backdrop-blur-xl"
                    onMouseEnter={() => setActiveSubmenu("accounts")}
                  >
                    <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                      Alternar Conta
                    </p>
                    <div className="max-h-56 overflow-y-auto space-y-0.5">
                      {savedAccounts.map((acc) => {
                        const isActive = acc.id === activeAccount?.id;
                        return (
                          <button
                            key={`${acc.provider}:${acc.id}`}
                            type="button"
                            onClick={() => {
                              switchAccount.mutate({ provider: acc.provider, id: acc.id });
                              setAccountMenuOpen(false);
                              setActiveSubmenu(null);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition",
                              isActive
                                ? "bg-white/10 font-semibold text-white"
                                : "text-white/80 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={`https://mc-heads.net/avatar/${encodeURIComponent(acc.displayName)}/20`}
                                alt=""
                                className="h-4 w-4 rounded [image-rendering:pixelated] flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                              <div className="min-w-0 text-left">
                                <p className="truncate font-medium leading-none">{acc.displayName}</p>
                                <p className="text-[10px] text-[#94A3B8] capitalize mt-0.5">
                                  {acc.provider === "microsoft"
                                    ? "Microsoft"
                                    : acc.provider === "mlultimate"
                                      ? "MLUltimate"
                                      : "Offline / Pirata"}
                                </p>
                              </div>
                            </div>
                            {isActive && <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-1 border-t border-white/10 pt-1">
                      <button
                        type="button"
                        onClick={openAccountManager}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#60A5FA] transition hover:bg-blue-500/10"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Adicionar Conta</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Change Skin / Cape */}
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  onNavigate?.("avatar");
                  setAccountMenuOpen(false);
                  setActiveSubmenu(null);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
              >
                <Paintbrush className="h-4 w-4 text-white/80 flex-shrink-0" />
                <span>Change Skin / Cape</span>
              </button>

              {/* 4. Screenshots */}
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={handleOpenScreenshots}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
                title="Abrir pasta de capturas de tela"
              >
                <Camera className="h-4 w-4 text-white/80 flex-shrink-0" />
                <span>Screenshots</span>
              </button>

              {/* 5. Account Settings / Gerenciar Contas */}
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={openAccountManager}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
              >
                <Settings className="h-4 w-4 text-white/80 flex-shrink-0" />
                <span>Gerenciar Contas</span>
              </button>

              {/* 6. Sign Out */}
              <button
                type="button"
                onMouseEnter={() => setActiveSubmenu(null)}
                onClick={() => {
                  logout.mutate();
                  setAccountMenuOpen(false);
                  setActiveSubmenu(null);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4 text-white/80 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Instances Running Pill */}
        <div className="relative" ref={runningRef} style={{ WebkitAppRegion: "no-drag" } as CSSProperties}>
          <button
            type="button"
            onClick={() => {
              setRunningMenuOpen((prev) => !prev);
              setAccountMenuOpen(false);
            }}
            className={`flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
              runningCount > 0
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-emerald-500/25"
                : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
            }`}
            title="Instâncias do Minecraft em execução"
          >
            <Boxes className={`h-3.5 w-3.5 ${runningCount > 0 ? "text-emerald-400" : "text-white/50"}`} />
            <span>
              {runningCount} {runningCount === 1 ? "Instance Running" : "Instances Running"}
            </span>
            {runningCount > 0 && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
            )}
          </button>

          {/* Running Instances Dropdown */}
          {runningMenuOpen && (
            <div className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-white/10 bg-[#161B22] p-2 text-xs shadow-2xl shadow-black/60 backdrop-blur-md">
              <div className="border-b border-white/8 px-2.5 pb-2 pt-1">
                <p className="font-semibold text-white">Instâncias Abertas</p>
                <p className="text-[11px] text-[#94A3B8]">
                  {runningCount === 0
                    ? "Nenhuma instância aberta no momento."
                    : `${runningCount} processo(s) ativos`}
                </p>
              </div>

              {runningCount > 0 ? (
                <div className="divide-y divide-white/5 py-1">
                  {runningList.map((id) => (
                    <div key={id} className="flex items-center justify-between gap-2 px-2.5 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{getInstanceName(id)}</p>
                        <p className="text-[10px] text-emerald-400">Em execução</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void launcherApi.killInstance(id);
                        }}
                        className="rounded bg-red-500/15 px-2 py-1 text-[11px] font-medium text-red-300 transition hover:bg-red-500/25"
                        title="Finalizar processo"
                      >
                        Encerrar
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-[#94A3B8]">
                  <p>Inicie uma instância pela Home ou pela Biblioteca.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Windows 11 Native Controls Overlay Placeholder or Non-Windows Controls */}
        {isWindows ? (
          <div
            className="h-full w-[138px] flex-shrink-0"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          />
        ) : (
          <div
            className="flex h-full items-center"
            style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
          >
            <button
              type="button"
              aria-label="Minimizar"
              className="grid h-8 w-11 place-items-center text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
              onClick={minimize}
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Maximizar"
              className="grid h-8 w-11 place-items-center text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
              onClick={toggleMaximize}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Fechar"
              className="grid h-8 w-11 place-items-center text-[#94A3B8] transition hover:bg-[#EF4444] hover:text-white"
              onClick={close}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Account Modal (se o parent nao tiver renderizado) */}
      {!onOpenAccountModal && (
        <AccountModal
          open={accountModalOpen}
          onClose={() => setAccountModalOpen(false)}
        />
      )}
    </div>
  );
}
