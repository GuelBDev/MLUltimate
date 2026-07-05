import {
  Blocks,
  Compass,
  Download,
  Home,
  UserRound,
  Settings,
  Swords,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDownloads } from "../../hooks/useDownloads";
import { cn } from "../../utils/cn";

export type PageId =
  | "home"
  | "avatar"
  | "pvp"
  | "library"
  | "explore"
  | "downloads"
  | "settings";

type NavItem = {
  id: PageId;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "avatar", label: "Avatar", icon: UserRound },
  { id: "pvp", label: "PVP", icon: Swords },
  { id: "library", label: "Minhas Instâncias", icon: Blocks },
  { id: "explore", label: "Biblioteca", icon: Compass },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "settings", label: "Configurações", icon: Settings },
];

type SidebarProps = {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
};

export const Sidebar = ({ activePage, onPageChange }: SidebarProps) => {
  const downloads = useDownloads();
  const activeDownloads = (downloads.data ?? []).filter((item) =>
    item.status === "queued" || item.status === "running",
  ).length;

  return (
    <aside className="app-sidebar flex h-full min-w-0 flex-col px-2 py-4 xl:px-4 xl:py-5">
      <div className="mb-6 flex items-center justify-center gap-3 px-1 xl:mb-7 xl:justify-start xl:px-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/15 shadow-lg shadow-blue-500/10">
          <img src="icon.png" alt="" className="h-7 w-7 rounded-md object-contain" />
        </div>
        <div className="hidden min-w-0 xl:block">
          <p className="text-base font-bold text-white">MLUltimate</p>
          <p className="text-xs text-[#94A3B8]">Launcher</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          const showDownloadCount = item.id === "downloads" && activeDownloads > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPageChange(item.id)}
              title={item.label}
              aria-label={
                showDownloadCount
                  ? `${item.label}: ${activeDownloads} ativos`
                  : item.label
              }
              className={cn(
                "app-nav-item group relative flex h-11 min-w-0 items-center justify-center gap-3 rounded-xl px-3 text-sm font-medium text-[#94A3B8] transition duration-200 xl:justify-start",
                "hover:bg-white/7 hover:text-white",
                active &&
                  "text-white shadow-lg ring-1 ring-blue-300/15",
              )}
              data-active={active ? "true" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 text-[#94A3B8] transition group-hover:text-[#60A5FA]",
                  active && "text-[#60A5FA]",
                )}
              />
              <span className="hidden truncate xl:inline">{item.label}</span>
              {showDownloadCount ? (
                <span className="absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white shadow-lg shadow-red-500/25 xl:static xl:ml-auto">
                  {activeDownloads > 99 ? "99+" : activeDownloads}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
