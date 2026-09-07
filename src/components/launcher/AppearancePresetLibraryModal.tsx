import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Feather,
  Palette,
  Search,
  Star,
  SunMedium,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  appearancePresets,
  defaultAppearancePreset,
  presetCategoryList,
  presetStyleList,
  type AppearancePreset,
  type PresetColorCategory,
  type PresetStyle,
} from "../../constants/appearancePresets";
import { applyAppearanceSettings } from "../../utils/appearance";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface AppearancePresetLibraryModalProps {
  open: boolean;
  activePresetId?: string;
  favoritePresetIds?: string[];
  onClose: () => void;
  onSelectPreset: (preset: AppearancePreset) => void;
  onToggleFavorite?: (presetId: string) => void;
  disabled?: boolean;
}

export const AppearancePresetLibraryModal = ({
  open,
  activePresetId = "night-dark",
  favoritePresetIds = ["night-dark", "blue-sky", "yellow-sun", "light-mode", "emerald-cave"],
  onClose,
  onSelectPreset,
  onToggleFavorite,
  disabled = false,
}: AppearancePresetLibraryModalProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PresetColorCategory | "all">("all");
  const [selectedStyle, setSelectedStyle] = useState<PresetStyle | "all">("all");
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: "left" | "right") => {
    if (!categoriesScrollRef.current) return;
    const scrollAmount = direction === "left" ? -220 : 220;
    categoriesScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const filteredPresets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return appearancePresets.filter((preset) => {
      // Category filter
      if (selectedCategory !== "all" && preset.category !== selectedCategory) {
        return false;
      }

      // Style filter
      if (selectedStyle !== "all" && preset.style !== selectedStyle) {
        return false;
      }

      // Search query
      if (!query) {
        return true;
      }

      const matchLabel = preset.label.toLowerCase().includes(query);
      const matchDesc = preset.description.toLowerCase().includes(query);
      const matchCat = preset.categoryLabel.toLowerCase().includes(query);
      const matchStyle = preset.styleLabel.toLowerCase().includes(query);

      return matchLabel || matchDesc || matchCat || matchStyle;
    });
  }, [searchQuery, selectedCategory, selectedStyle]);

  const activePreset = useMemo(
    () => appearancePresets.find((p) => p.id === activePresetId) ?? defaultAppearancePreset,
    [activePresetId],
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/75 p-3 sm:p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              onClose();
            }
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-library-title"
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#121720]/98 text-white shadow-2xl shadow-black/70"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="relative border-b border-white/10 bg-gradient-to-r from-[#161F30]/80 via-[#121720]/90 to-[#181E2B]/80 px-5 py-4 sm:px-7 sm:py-5">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-[#94A3B8] transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar biblioteca"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:pr-12">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#60A5FA]/30 bg-[#3B82F6]/15 shadow-inner">
                    <Palette className="h-5 w-5 text-[#60A5FA]" />
                  </div>
                  <div>
                    <h2
                      id="preset-library-title"
                      className="text-lg font-bold tracking-tight text-white sm:text-xl"
                    >
                      Biblioteca de Customização & Temas
                    </h2>
                    <p className="text-xs text-[#94A3B8] sm:text-sm">
                      Escolha entre todas as cores com 3 variações exclusivas:{" "}
                      <span className="font-semibold text-amber-400">Vívido</span>,{" "}
                      <span className="font-semibold text-emerald-400">Matte</span> e{" "}
                      <span className="font-semibold text-sky-400">Clean</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone={favoritePresetIds.length >= 5 ? "slate" : "blue"} className="px-2.5 py-1 text-xs">
                    Favoritos na capa: <span className="font-bold ml-1">{favoritePresetIds.length}/5</span>
                  </Badge>
                  <Badge tone="blue" className="px-3 py-1 text-xs">
                    Tema ativo: <span className="font-bold ml-1">{activePreset.label}</span>
                  </Badge>
                  <span className="text-xs text-[#94A3B8]">
                    ({filteredPresets.length} {filteredPresets.length === 1 ? "tema" : "temas"})
                  </span>
                </div>
              </div>

              {/* Search & Style Filter Tabs */}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Search Bar */}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar tema por cor, nome ou estilo (ex: Azul, Matte, Clean, Cyber)..."
                    className="w-full rounded-xl border border-white/10 bg-[#0A0E17]/80 py-2.5 pl-10 pr-9 text-sm text-white placeholder-[#64748B] outline-none transition focus:border-[#60A5FA]/60 focus:bg-[#0A0E17] focus:ring-2 focus:ring-[#3B82F6]/20"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[#94A3B8] transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Style Segmented Tabs */}
                <div className="flex shrink-0 items-center rounded-xl border border-white/10 bg-[#0A0E17]/80 p-1">
                  {presetStyleList.map((styleItem) => {
                    const active = selectedStyle === styleItem.id;
                    const Icon =
                      styleItem.id === "vivid"
                        ? Zap
                        : styleItem.id === "matte"
                          ? Feather
                          : styleItem.id === "clean"
                            ? SunMedium
                            : Palette;

                    return (
                      <button
                        key={styleItem.id}
                        type="button"
                        onClick={() => setSelectedStyle(styleItem.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/30"
                            : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{styleItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Categories Chips with Left/Right Arrows and Hidden Scrollbar */}
              <div className="mt-3.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scrollCategories("left")}
                  aria-label="Rolar categorias para esquerda"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#0A0E17]/80 text-[#94A3B8] transition hover:border-[#60A5FA]/40 hover:bg-[#3B82F6]/15 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div
                  ref={categoriesScrollRef}
                  className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto scroll-smooth py-0.5"
                >
                  {presetCategoryList.map((cat) => {
                    const active = selectedCategory === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? "border-[#60A5FA]/60 bg-[#3B82F6]/20 font-semibold text-white shadow-sm"
                            : "border-white/10 bg-white/5 text-[#94A3B8] hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {cat.id !== "all" ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
                            style={{ backgroundColor: cat.color }}
                          />
                        ) : null}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => scrollCategories("right")}
                  aria-label="Rolar categorias para direita"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-[#0A0E17]/80 text-[#94A3B8] transition hover:border-[#60A5FA]/40 hover:bg-[#3B82F6]/15 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content Area / Theme Cards Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {filteredPresets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-[#94A3B8]">
                    <Search className="h-8 w-8" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">
                    Nenhum tema encontrado
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-[#94A3B8]">
                    Tente buscar por outro termo ou limpe os filtros de estilo e cor selecionados.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-4 text-xs"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                      setSelectedStyle("all");
                    }}
                  >
                    Limpar todos os filtros
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPresets.map((preset) => {
                    const isActive = activePresetId === preset.id;
                    const isFavorite = favoritePresetIds.includes(preset.id);
                    const styleBadgeTone =
                      preset.style === "vivid"
                        ? "border-amber-400/30 bg-amber-500/15 text-amber-300"
                        : preset.style === "matte"
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                          : "border-sky-400/30 bg-sky-500/15 text-sky-300";

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          applyAppearanceSettings(preset);
                          onSelectPreset(preset);
                        }}
                        className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-150 ${
                          isActive
                            ? "border-[#60A5FA] bg-[#162235] shadow-lg shadow-[#3B82F6]/15 ring-1 ring-[#60A5FA]/40"
                            : "border-white/10 bg-[#0E131C]/90 hover:border-[#60A5FA]/40 hover:bg-[#131924]"
                        }`}
                      >
                        <div>
                          {/* Card Header: Swatches & Style Tag & Favorite Button */}
                          <div className="flex items-center justify-between gap-2">
                            {/* Color Swatch Preview Palette */}
                            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 p-1 shadow-inner">
                              <span
                                className="h-4 w-4 rounded-full shadow-sm"
                                style={{ backgroundColor: preset.primaryColor }}
                                title={`Botão Principal: ${preset.primaryColor}`}
                              />
                              <span
                                className="h-4 w-4 rounded-full shadow-sm"
                                style={{ backgroundColor: preset.secondaryColor }}
                                title={`Acento: ${preset.secondaryColor}`}
                              />
                              <span
                                className="h-4 w-4 rounded-full border border-white/10 shadow-sm"
                                style={{ backgroundColor: preset.cardColor }}
                                title={`Cards: ${preset.cardColor}`}
                              />
                              <span
                                className="h-4 w-4 rounded-full border border-white/10 shadow-sm"
                                style={{ backgroundColor: preset.backgroundColor }}
                                title={`Fundo: ${preset.backgroundColor}`}
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Style Badge */}
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${styleBadgeTone}`}
                              >
                                {preset.style === "vivid" ? (
                                  <Zap className="h-2.5 w-2.5" />
                                ) : preset.style === "matte" ? (
                                  <Feather className="h-2.5 w-2.5" />
                                ) : (
                                  <SunMedium className="h-2.5 w-2.5" />
                                )}
                                {preset.styleLabel}
                              </span>

                              {/* Favorite Toggle Button */}
                              {onToggleFavorite ? (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(preset.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.stopPropagation();
                                      onToggleFavorite(preset.id);
                                    }
                                  }}
                                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${
                                    isFavorite
                                      ? "border-amber-400/60 bg-amber-400/20 text-amber-300 shadow-sm shadow-amber-500/20"
                                      : "border-white/10 bg-white/5 text-[#94A3B8] hover:border-white/25 hover:text-white"
                                  }`}
                                  title={
                                    isFavorite
                                      ? "Remover dos favoritos da capa"
                                      : favoritePresetIds.length >= 5
                                        ? "Limite de 5 favoritos atingido na capa"
                                        : "Favoritar para a capa (máx. 5)"
                                  }
                                >
                                  <Star
                                    className={`h-3 w-3 ${
                                      isFavorite ? "fill-amber-400 text-amber-400" : ""
                                    }`}
                                  />
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Theme Info */}
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-white group-hover:text-[#60A5FA] transition-colors">
                                {preset.label}
                              </h4>
                              {isActive ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#60A5FA]">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Ativo
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
                              {preset.description}
                            </p>
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="mt-3 pt-2.5 border-t border-white/8 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-[#64748B]">
                            {preset.categoryLabel}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              isActive ? "text-[#60A5FA]" : "text-white/70 group-hover:text-white"
                            }`}
                          >
                            {isActive ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Aplicado
                              </>
                            ) : (
                              "Aplicar ›"
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="flex items-center justify-between border-t border-white/10 bg-[#0A0E17]/80 px-5 py-3.5 sm:px-7">
              <p className="text-xs text-[#94A3B8]">
                Dica: Você também pode ajustar detalhes finos em{" "}
                <span className="font-semibold text-white">Customização avançada</span>.
              </p>
              <Button type="button" variant="secondary" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
