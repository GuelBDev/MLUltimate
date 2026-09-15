import { useQuery } from "@tanstack/react-query";
import {
  Blocks,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Home,
  UserRound,
  Settings,
  Server,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { useDownloads } from "../../hooks/useDownloads";
import { launcherApi } from "../../services/launcherApi";
import { cn } from "../../utils/cn";

export type PageId =
  | "home"
  | "avatar"
  | "servers"
  | "library"
  | "explore"
  | "downloads"
  | "settings";

type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
};

const mainNavItems: NavItem[] = [
  { id: "home", label: "Launchpad", icon: Home },
  { id: "library", label: "Minhas Instâncias", icon: Blocks },
  { id: "explore", label: "Biblioteca", icon: Compass },
  { id: "servers", label: "Servidores", icon: Server },
  { id: "avatar", label: "Avatar & Skins", icon: UserRound },
  { id: "downloads", label: "Downloads", icon: Download },
];

const settingsNavItem: NavItem = {
  id: "settings",
  label: "Configurações",
  icon: Settings,
};

type SidebarProps = {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export const Sidebar = ({
  activePage,
  onPageChange,
  collapsed: propCollapsed,
  onToggleCollapse,
}: SidebarProps) => {
  const downloads = useDownloads();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: launcherApi.getSettings,
    staleTime: 30_000,
  });

  const isCollapsed = propCollapsed ?? (settings.data?.sidebarCollapsed !== false);

  const activeDownloads = (downloads.data ?? []).filter((item) =>
    item.status === "queued" || item.status === "running",
  ).length;

  const orderedNavItems = useMemo(() => {
    const customOrder = settings.data?.sidebarNavOrder;
    if (!customOrder || !Array.isArray(customOrder) || customOrder.length === 0) {
      return mainNavItems;
    }

    const itemMap = new Map(mainNavItems.map((item) => [item.id, item]));
    const homeItem = itemMap.get("home");
    const result: NavItem[] = homeItem ? [homeItem] : [];

    for (const id of customOrder) {
      if (id === "home" || id === "settings") continue;
      const item = itemMap.get(id as PageId);
      if (item && !result.some((r) => r.id === item.id)) {
        result.push(item);
      }
    }

    for (const item of mainNavItems) {
      if (!result.some((r) => r.id === item.id)) {
        result.push(item);
      }
    }

    return result;
  }, [settings.data?.sidebarNavOrder]);

  const renderNavButton = (item: NavItem) => {
    const Icon = item.icon;
    const active = activePage === item.id;
    const showDownloadCount = item.id === "downloads" && activeDownloads > 0;

    return (
      <div key={item.id} className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={() => onPageChange(item.id)}
          aria-label={
            showDownloadCount
              ? `${item.label}: ${activeDownloads} ativos`
              : item.label
          }
          className={cn(
            "group relative flex min-w-0 items-center rounded-xl text-sm font-medium transition-all duration-200",
            isCollapsed
              ? "h-11 w-11 justify-center"
              : "h-11 w-full justify-start gap-3 px-3",
            "hover:bg-white/10 hover:text-white",
            active
              ? "bg-blue-500/15 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-400/30"
              : "text-[#94A3B8]",
          )}
          data-active={active ? "true" : undefined}
        >
          {/* Active indicator bar */}
          {active && isCollapsed && (
            <span className="absolute -left-2 top-2 h-7 w-1 rounded-r-full bg-[#60A5FA] shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
          )}

          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition duration-200",
              active && "text-[#60A5FA]",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition duration-200 group-hover:scale-110",
                active ? "text-[#60A5FA]" : "text-[#94A3B8] group-hover:text-white",
              )}
            />
          </span>

          {!isCollapsed && <span className="truncate">{item.label}</span>}

          {showDownloadCount && (
            <span
              className={cn(
                "grid h-4 min-w-4 place-items-center rounded-full bg-[#EF4444] px-1 text-[9px] font-bold leading-none text-white shadow-lg shadow-red-500/30",
                isCollapsed ? "absolute -right-0.5 -top-0.5" : "ml-auto",
              )}
            >
              {activeDownloads > 99 ? "99+" : activeDownloads}
            </span>
          )}
        </button>

        {/* Floating Tooltip on Hover in Minimized Mode */}
        {isCollapsed && (
          <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md border border-white/10 bg-[#161B22] px-2.5 py-1 text-xs font-semibold text-white shadow-2xl backdrop-blur group-hover:block hover:hidden whitespace-nowrap">
            {item.label}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "app-sidebar flex h-full min-w-0 flex-col py-4 transition-all duration-300",
        isCollapsed ? "w-[68px] items-center px-2" : "w-[228px] px-4",
      )}
    >
      {/* App Logo */}
      <div
        className={cn(
          "mb-6 flex items-center gap-3",
          isCollapsed ? "justify-center" : "justify-start px-1",
        )}
      >
        <button
          type="button"
          onClick={() => onPageChange("home")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/15 shadow-lg shadow-blue-500/10 transition hover:scale-105 hover:bg-blue-500/25"
          title="MLUltimate Launchpad"
        >
          <img src="icon.png" alt="" className="h-6 w-6 rounded object-contain" />
        </button>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">MLUltimate</p>
            <p className="text-[11px] text-[#94A3B8]">Launcher</p>
          </div>
        )}
      </div>

      {/* Main Navigation Items */}
      <nav className="flex flex-1 flex-col gap-2">
        {orderedNavItems.map(renderNavButton)}
      </nav>

      {/* Pinned Bottom Controls: Collapse Arrow + Settings Item */}
      <div className="flex flex-col gap-1.5 border-t border-white/8 pt-2">
        {/* Toggle Arrow directly above Settings */}
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            className={cn(
              "group relative flex min-w-0 items-center rounded-xl text-xs font-semibold text-[#94A3B8] transition-all duration-200 hover:bg-white/10 hover:text-white",
              isCollapsed
                ? "h-10 w-10 justify-center bg-white/5"
                : "h-10 w-full justify-start gap-2.5 px-3 bg-white/5",
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:translate-x-0.5 group-hover:text-white" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-x-0.5 group-hover:text-white" />
                <span className="truncate">Recolher barra</span>
              </>
            )}
          </button>

          {/* Floating Tooltip in Minimized Mode */}
          {isCollapsed && (
            <div className="pointer-events-none absolute left-full ml-3 z-50 hidden rounded-md border border-white/10 bg-[#161B22] px-2.5 py-1 text-xs font-semibold text-white shadow-2xl backdrop-blur group-hover:block hover:hidden whitespace-nowrap">
              Expandir barra lateral
            </div>
          )}
        </div>

        {/* Settings Item */}
        {renderNavButton(settingsNavItem)}
      </div>
    </aside>
  );
};
