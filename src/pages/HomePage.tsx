import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Megaphone,
  PackageOpen,
  Rocket,
  Server,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import heroImage from "../assets/launcher-hero.png";
import instanceDefaultImage from "../assets/instance-default.png";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import type { ContentType } from "../types/launcher";
import type { PageId } from "../components/layout/Sidebar";
import { appDisplayVersion, rawAppVersion } from "../utils/version";

type HomePageProps = {
  focus: PageId;
  onNavigate?: (page: PageId) => void;
  onExploreInstance?: (type: ContentType, instanceId: string) => void;
};

const carouselSlides = [
  {
    eyebrow: "MLUltimate Launcher",
    title: "Jogue, ajuste e evolua seu Minecraft",
    description: "Crie instancias, instale conteudo e acompanhe tudo pelo launcher.",
    image: instanceDefaultImage,
    badge: "Destaque",
  },
  {
    eyebrow: "Kit PvP",
    title: "PvP 1.8.9 pronto para treinar",
    description: "Perfil Forge com servidores, mods, skins offline e configuracoes para combate.",
    image: heroImage,
    badge: "PvP",
  },
];

const adSlots: Array<{
  title: string;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Servidor parceiro",
    label: "Banner",
    description: "Arte, IP e botao de entrada.",
    icon: Server,
  },
  {
    title: "Campanha oficial",
    label: "MLUltimate",
    description: "Eventos, skins e chamadas da comunidade.",
    icon: Megaphone,
  },
  {
    title: "Cupom ativo",
    label: "Oferta",
    description: "Loja, codigo e periodo da campanha.",
    icon: Tag,
  },
  {
    title: "Modpack destaque",
    label: "Vitrine",
    description: "Pacote recomendado para baixar.",
    icon: PackageOpen,
  },
  {
    title: "Torneio PvP",
    label: "Evento",
    description: "Data, servidor e premio da rodada.",
    icon: Megaphone,
  },
  {
    title: "Textura patrocinada",
    label: "Pack",
    description: "Imagem, versao e link de instalacao.",
    icon: Compass,
  },
];

const updateLog = [
  {
    version: appDisplayVersion,
    tag: rawAppVersion,
    date: "Atual",
    changes: [
      "Perfis Microsoft e offline salvos com alternancia entre contas.",
      "Kit PvP corrigido para remover mod incompativel e abrir servidores.",
      "Biblioteca marca modpacks baixados e permite baixar uma nova copia.",
      "Downloads mostra apenas downloads reais, sem verificacoes internas.",
    ],
  },
  {
    version: "3.2.0",
    tag: "stable",
    date: "Anterior",
    changes: [
      "Kit PvP Forge 1.8.9 com mods, texturas e servidores.",
      "Aplicacao de skins offline pela aba Avatar.",
      "Melhorias no instalador e no fluxo de atualizacao.",
    ],
  },
];

export const HomePage = ({ onNavigate }: HomePageProps) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = carouselSlides[activeSlide] ?? carouselSlides[0]!;
  const nextSlide = () => setActiveSlide((current) => (current + 1) % carouselSlides.length);
  const previousSlide = () =>
    setActiveSlide((current) => (current - 1 + carouselSlides.length) % carouselSlides.length);

  useEffect(() => {
    const timer = window.setInterval(nextSlide, 7000);

    return () => window.clearInterval(timer);
  }, []);

  const currentVersionLabel = useMemo(
    () => (rawAppVersion === appDisplayVersion ? appDisplayVersion : `${appDisplayVersion} (${rawAppVersion})`),
    [],
  );

  return (
    <div className="space-y-6">
      <section className="relative min-h-[410px] overflow-hidden rounded-2xl border border-white/10 bg-[#161B22] shadow-2xl shadow-black/35">
        <img
          src={slide.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/98 via-[#0D1117]/78 to-[#0D1117]/35" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0D1117] to-transparent" />

        <div className="relative flex min-h-[410px] flex-col justify-between p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="blue">{slide.badge}</Badge>
              <Badge tone="slate">Versao {currentVersionLabel}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white transition hover:border-[#60A5FA]/60 hover:bg-[#3B82F6]/25"
                onClick={previousSlide}
                aria-label="Slide anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white transition hover:border-[#60A5FA]/60 hover:bg-[#3B82F6]/25"
                onClick={nextSlide}
                aria-label="Proximo slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#60A5FA]">
              {slide.eyebrow}
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight text-white md:text-5xl">
              {slide.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#C7D2FE]">
              {slide.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" onClick={() => onNavigate?.("explore")}>
                <Compass className="h-4 w-4" />
                Biblioteca
              </Button>
              <Button type="button" variant="secondary" onClick={() => onNavigate?.("library")}>
                <PackageOpen className="h-4 w-4" />
                Minhas Instancias
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            {carouselSlides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={`h-1.5 rounded-full transition ${
                  activeSlide === index ? "w-10 bg-[#3B82F6]" : "w-5 bg-white/25 hover:bg-white/45"
                }`}
                onClick={() => setActiveSlide(index)}
                aria-label={`Abrir slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adSlots.map((slot) => {
          const Icon = slot.icon;

          return (
            <Card key={slot.title} className="min-h-36 overflow-hidden p-5">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/7 text-[#60A5FA]">
                  <Icon className="h-5 w-5" />
                </span>
                <Badge tone="slate">{slot.label}</Badge>
              </div>
              <h3 className="mt-5 text-base font-semibold text-white">{slot.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{slot.description}</p>
            </Card>
          );
        })}
      </section>

      <section>
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#60A5FA]">
                Update log
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Registro de atualizacao</h2>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/7 text-[#60A5FA]">
              <Rocket className="h-5 w-5" />
            </span>
          </div>

          <div className="divide-y divide-white/10">
            {updateLog.map((release) => (
              <article key={`${release.version}-${release.tag}`} className="grid gap-5 p-6 md:grid-cols-[150px_1fr]">
                <div>
                  <Badge tone={release.date === "Atual" ? "green" : "slate"}>{release.date}</Badge>
                  <p className="mt-3 text-xl font-semibold text-white">{release.version}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {release.tag}
                  </p>
                </div>
                <ul className="space-y-3">
                  {release.changes.map((change) => (
                    <li key={change} className="flex gap-3 text-sm leading-6 text-[#CBD5E1]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
};
