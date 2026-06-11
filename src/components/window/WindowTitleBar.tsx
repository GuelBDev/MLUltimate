import { Maximize2, Minus, X } from "lucide-react";
import type { CSSProperties } from "react";
import appIcon from "../../assets/mlultimate-icon.png";

const hasWindowControls = () =>
  typeof window !== "undefined" && Boolean(window.mlultimate?.window);

export function WindowTitleBar() {
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

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[80] flex h-8 select-none items-center border-b border-white/8 bg-[#111820]/92 text-white shadow-lg shadow-black/20 backdrop-blur-xl"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <img src={appIcon} alt="" className="h-4 w-4 rounded object-contain" />
        <span className="truncate text-xs font-medium text-white/90">MLUltimate Launcher</span>
      </div>

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
    </div>
  );
}
