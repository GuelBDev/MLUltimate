import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  Megaphone,
  Newspaper,
  PackageOpen,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
    title: "Seu Minecraft com visual premium",
    description:
      "Uma central moderna para criar perfis, instalar conteudo e acompanhar as novidades do launcher.",
    image: instanceDefaultImage,
    badge: "Destaque",
  },
  {
    eyebrow: "Biblioteca",
    title: "Mods, shaders e texturas em um so lugar",
    description:
      "A Biblioteca concentra Modrinth e CurseForge para baixar conteudo compativel com seus perfis.",
    image: heroImage,
    badge: "Conteudo",
  },
  {
    eyebrow: "Atualizacoes",
    title: "Launcher preparado para evoluir rapido",
    description:
      "A Home agora mostra changelog e campanhas, deixando o app pronto para anuncios oficiais e pagos.",
    image: instanceDefaultImage,
    badge: "Novidade",
  },
];

const sponsoredSlots = [
  {
    title: "Espaco premium",
    label: "Anuncio pago",
    description: "Area reservada para campanhas de servidores, comunidades ou modpacks parceiros.",
    icon: BadgeDollarSign,
  },
  {
    title: "Campanha oficial",
    label: "MLUltimate",
    description: "Destaques do launcher, novas funcoes, eventos e chamadas importantes do app.",
    icon: Megaphone,
  },
  {
    title: "Vitrine visual",
    label: "Midia",
    description: "Slot preparado para banners com imagem, titulo, botao e periodo de exibicao.",
    icon: Images,
  },
];

const appAnnouncements = [
  {
    title: "Nova Home",
    description: "Tela inicial redesenhada para anuncios, novidades e comunicados oficiais.",
    icon: Newspaper,
  },
  {
    title: "Perfis com conteudo",
    description: "Continue criando instâncias e instalando mods pela aba Minhas Instâncias.",
    icon: PackageOpen,
  },
  {
    title: "Instalador revisado",
    description: "Fluxo do instalador online ajustado para PCs novos e conexoes mais lentas.",
    icon: Download,
  },
];

const changelog = [
  {
    version: appDisplayVersion,
    tag: rawAppVersion,
    date: "Atual",
    changes: [
      "Modpacks agora baixam os arquivos exatos declarados pelo manifesto.",
      "Lista interna do modpack passa a ser restaurada por lockfile local.",
      "Versoes especificas da CurseForge sao baixadas pelo fileID escolhido.",
    ],
  },
  {
    version: "2.0.1",
    tag: "alpha 3",
    date: "Anterior",
    changes: [
      "Biblioteca com instalacao por instancia compativel.",
      "Iris e Iris + Sodium adicionados aos perfis.",
      "Melhorias em shaders, resource packs e verificacao de compatibilidade.",
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
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[370px] overflow-hidden rounded-2xl border border-white/10 bg-[#161B22] shadow-2xl shadow-black/35">
          <img
            src={slide.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117]/98 via-[#0D1117]/78 to-[#0D1117]/35" />
          <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0D1117] to-transparent" />

          <div className="relative flex min-h-[370px] flex-col justify-between p-7">
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
                  <Sparkles className="h-4 w-4" />
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
        </div>

        <Card className="flex min-h-[370px] flex-col justify-between overflow-hidden p-6">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#60A5FA]/25 bg-[#3B82F6]/15 text-[#93C5FD]">
              <Megaphone className="h-5 w-5" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#60A5FA]">
              Painel de anuncios
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Espacos prontos para campanhas</h2>
            <p className="mt-3 text-sm leading-6 text-[#94A3B8]">
              A Home agora pode receber banners oficiais, comunicados do app e anuncios pagos sem
              misturar isso com suas instancias.
            </p>
          </div>
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#22C55E]" />
              <div>
                <p className="text-sm font-semibold text-white">Conteudo separado do launcher</p>
                <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
                  Os anuncios ficam na Home; jogos e perfis continuam em Minhas Instancias.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {sponsoredSlots.map((slot) => {
          const Icon = slot.icon;

          return (
            <Card key={slot.title} className="overflow-hidden p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/7 text-[#60A5FA]">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge tone="slate">{slot.label}</Badge>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{slot.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{slot.description}</p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#60A5FA]">
            Comunicados
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Novidades do app</h2>
          <div className="mt-5 space-y-3">
            {appAnnouncements.map((announcement) => {
              const Icon = announcement.icon;

              return (
                <div
                  key={announcement.title}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-[#0D1117]/70 p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3B82F6]/15 text-[#60A5FA]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{announcement.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
                      {announcement.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#60A5FA]">
                Update log
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Log de atualizacao</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/7 text-[#60A5FA]">
              <Rocket className="h-5 w-5" />
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {changelog.map((release) => (
              <article key={`${release.version}-${release.tag}`} className="grid gap-5 p-6 md:grid-cols-[150px_1fr]">
                <div>
                  <Badge tone={release.date === "Atual" ? "green" : "slate"}>{release.date}</Badge>
                  <p className="mt-3 text-xl font-semibold text-white">{release.version}</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">{release.tag}</p>
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
