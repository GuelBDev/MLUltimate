import {
  Compass,
  Download,
  Home,
  Library,
  UserRound,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

export type PageId =
  | "home"
  | "avatar"
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
  { id: "library", label: "Biblioteca", icon: Library },
  { id: "explore", label: "Explorar", icon: Compass },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "settings", label: "Configuracoes", icon: Settings },
];

type SidebarProps = {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
};

export const Sidebar = ({ activePage, onPageChange }: SidebarProps) => (
  <aside className="flex h-screen flex-col bg-[#0A0E14] px-4 py-5">
    <div className="mb-7 flex items-center gap-3 px-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/15 shadow-lg shadow-blue-500/10">
        <img src="icon.png" alt="" className="h-7 w-7 rounded-md object-contain" />
      </div>
      <div>
        <p className="text-base font-bold text-white">MLUltimate</p>
        <p className="text-xs text-[#94A3B8]">Launcher</p>
      </div>
    </div>

    <nav className="flex flex-1 flex-col gap-1.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = activePage === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onPageChange(item.id)}
            className={cn(
              "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#94A3B8] transition duration-200",
              "hover:bg-white/7 hover:text-white",
              active &&
                "bg-[#3B82F6]/15 text-white shadow-lg shadow-blue-500/10 ring-1 ring-blue-300/15",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5 text-[#94A3B8] transition group-hover:text-[#60A5FA]",
                active && "text-[#60A5FA]",
              )}
            />
            {item.label}
          </button>
        );
      })}
    </nav>
  </aside>
);
