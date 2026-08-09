import React, { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Code2,
  Download,
  ExternalLink,
  FileDown,
  Github,
  HardDriveDownload,
  Layers3,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Shirt,
  Skull,
  Swords,
  UserCheck
} from "lucide-react";
import "./styles.css";

const RELEASES_URL = "https://github.com/GuelBDev/MLUltimate/releases/latest";
const ALL_RELEASES_URL = "https://github.com/GuelBDev/MLUltimate/releases";
const GITHUB_REPO_URL = "https://github.com/GuelBDev/MLUltimate";
const RELEASE_API_URL = "https://api.github.com/repos/GuelBDev/MLUltimate/releases/latest";

const DOWNLOAD_OPTIONS = [
  {
    platform: "Windows",
    fileName: "MLUltimate-Installer-Windows.exe",
    href: "/downloads/MLUltimate-Installer-Windows.exe",
    logoType: "windows",
    description: "Instalador .exe para Windows"
  },
  {
    platform: "Linux",
    fileName: "MLUltimate-Installer-Linux.sh",
    href: "/downloads/MLUltimate-Installer-Linux.sh",
    logoType: "linux",
    logo: "/assets/logo-linux.svg",
    description: "Instalador .sh para distribuições Linux"
  }
];

const assets = {
  logo: "/assets/mlultimate-logo.png",
  banner: "/assets/banner-mlu-site.png",
  home: "/assets/app-home.png",
  avatar: "/assets/app-avatar.png",
  pvp: "/assets/app-pvp.png",
  library: "/assets/app-library.png",
  settings: "/assets/app-settings.png"
};

const features = [
  {
    icon: UserCheck,
    title: "Login original",
    text: "Acesso Microsoft separado do modo offline, com troca de conta e perfil sempre visíveis."
  },
  {
    icon: Skull,
    title: "Modo offline",
    text: "Crie e use perfis offline em servidores compatíveis, sem misturar com autenticação original."
  },
  {
    icon: Swords,
    title: "Central PvP",
    text: "Ambiente competitivo com Forge 1.8.9, mods leves, HUD e atalhos para servidores."
  },
  {
    icon: Shirt,
    title: "Skins NameMC",
    text: "Pesquise, baixe e organize skins sem depender de sites abertos fora do launcher."
  },
  {
    icon: Layers3,
    title: "Biblioteca",
    text: "Mods, texturas e recursos agrupados por versão, loader e tipo de conteúdo."
  },
  {
    icon: RefreshCw,
    title: "Atualização",
    text: "O launcher consulta releases oficiais e mantém o app alinhado com a versão publicada."
  }
];

function Header({ onDownloadClick }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="MLUltimate Launcher">
        <span className="brand-mark">
          <img src={assets.logo} alt="" />
        </span>
        <span>
          <strong>MLUltimate</strong>
          <small>Minecraft Launcher Ultimate</small>
        </span>
      </a>
      <nav className="nav-links" aria-label="Navegação principal">
        <a href="#features">Recursos</a>
        <a href="#interface">Interface</a>
        <a href="#download">Download</a>
        <a href="#faq">FAQ</a>
      </nav>
      <button className="header-download" type="button" onClick={onDownloadClick}>
        <Download size={18} />
        Baixar
      </button>
    </header>
  );
}

function Hero({ onDownloadClick }) {
  return (
    <section className="hero section-shell" id="top">
      <div className="hero-copy reveal">
        <div className="hero-product">
          <img src={assets.logo} alt="" />
          <span>MLUltimate</span>
        </div>
        <h1>Minecraft aberto do jeito certo.</h1>
        <p className="hero-lead">
          O melhor dos dois mundos CurseForge & Modrinth em um só lugar
        </p>
        <p className="hero-text">
          Launcher de código aberto, com anúncios não abusivos para eu pagar meu café
        </p>
        <div className="hero-actions">
          <button className="button button-primary" type="button" onClick={onDownloadClick}>
            <Download size={21} />
            Baixar para Windows
          </button>
          <a
            className="button button-secondary"
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={20} />
            GitHub oficial
          </a>
        </div>
      </div>
      <HeroShowcase />
    </section>
  );
}

function HeroShowcase() {
  return (
    <div className="hero-showcase banner-showcase reveal reveal-delay">
      <div className="showcase-frame banner-frame">
        <img src={assets.banner} alt="Banner MLUltimate com logo central e integrações" />
      </div>
      <p className="banner-caption">As melhores fontes em um só launcher</p>
      <div className="showcase-strip" aria-label="Módulos do app">
        <span>Original/Pirata</span>
        <span>PVP Launcher</span>
        <span>Modrinth</span>
        <span>CurseForge</span>
      </div>
    </div>
  );
}


function FeatureCard({ feature }) {
  const Icon = feature.icon;
  return (
    <article className="feature-card">
      <div className="feature-icon">
        <Icon size={23} />
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.text}</p>
    </article>
  );
}

function Features() {
  return (
    <section className="feature-section" id="features">
      <div className="section-shell">
        <div className="section-heading">
          <span className="section-kicker">Recursos principais</span>
          <h2>O necessário para entrar no jogo sem rodeio.</h2>
          <p>
            A página explica o que o launcher faz de forma objetiva, sem blocos de marketing
            montados só para convencer.
          </p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <FeatureCard feature={feature} key={feature.title} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowcaseDilemmas({ onDownloadClick }) {
  return (
    <section className="dilemmas-section" id="interface">
      <div className="section-shell">
        <div className="section-heading text-center" style={{ margin: "0 auto 40px", textAlign: "center", maxWidth: "840px" }}>
          <span className="section-kicker" style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
            <Sparkles size={14} /> Solução Definitiva
          </span>
          <h2 style={{ fontSize: "2.5rem", marginTop: "12px", textShadow: "2px 2px 0 #000" }}>
            Tudo em um único lugar — PvP • Mods • Customização
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "1.08rem", lineHeight: "1.6", marginTop: "14px" }}>
            Por que usar múltiplos launchers ou complicar sua experiência? O MLUltimate une o melhor do ecossistema Minecraft em uma única plataforma rápida e sem enrolação.
          </p>
        </div>

        <div className="dilemma-list">
          {/* Dilema 1: Mods & Conteúdo */}
          <article className="dilemma-item">
            <div className="dilemma-media">
              <img src={assets.library} alt="Biblioteca unificada do MLUltimate com CurseForge e Modrinth" />
            </div>
            <div className="dilemma-content">
              <span className="dilemma-tag">Mods & Conteúdo Unificado</span>
              <h3 className="dilemma-title">CurseForge e Modrinth no mesmo lugar</h3>
              <div className="dilemma-question">
                "Por que escolher apenas uma plataforma ou alternar entre sites e pastas manuais?"
              </div>
              <p className="dilemma-text">
                Com o MLUltimate, você pesquisa, baixa e instala mods, modpacks, shaders e texturas diretamente do Modrinth e CurseForge sem precisar de navegador, chaves API ou instalações manuais.
              </p>
              <div className="dilemma-checklist">
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Busca simultânea nas duas maiores plataformas do mundo</span>
                </div>
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Suporte completo a Fabric, Forge, NeoForge, Quilt e Iris/Sodium</span>
                </div>
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Instalação automática em 1 clique direto na sua instância</span>
                </div>
              </div>
            </div>
          </article>

          {/* Dilema 2: Kit PvP */}
          <article className="dilemma-item reverse">
            <div className="dilemma-content">
              <span className="dilemma-tag">Central PvP 1.8.9</span>
              <h3 className="dilemma-title">Kit PvP Otimizado e Pronto para Jogar</h3>
              <div className="dilemma-question">
                "Cansado de perder horas configurando Forge 1.8.9, mods de FPS e IPs de servidores?"
              </div>
              <p className="dilemma-text">
                O launcher já vem com uma aba PvP dedicada contendo um perfil Forge 1.8.9 ultra otimizado, com atalhos diretos para servidores Originais (Hypixel) e Piratas (MushMC).
              </p>
              <div className="dilemma-checklist">
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Mods essenciais inclusos: Keystrokes, contador de CPS e otimização de FPS</span>
                </div>
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Lista de servidores com status de ping ao vivo e entrar rápido</span>
                </div>
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Suporte total a skins offline via NameMC e conta Microsoft</span>
                </div>
              </div>
            </div>
            <div className="dilemma-media">
              <img src={assets.pvp} alt="Central PvP do MLUltimate Launcher com servidores e mods" />
            </div>
          </article>

          {/* Dilema 3: Customização */}
          <article className="dilemma-item">
            <div className="dilemma-media">
              <img src={assets.settings} alt="Painel de personalização de temas e aparência do MLUltimate" />
            </div>
            <div className="dilemma-content">
              <span className="dilemma-tag">Aparência & Personalização</span>
              <h3 className="dilemma-title">Sua Interface, Suas Regras</h3>
              <div className="dilemma-question">
                "Por que aceitar um launcher cinza e genérico se você pode deixar o visual com a sua cara?"
              </div>
              <p className="dilemma-text">
                Alterne entre 6 temas pré-configurados (como Night Dark ou Red Velt) ou crie seu próprio estilo ajustando cores de dormentes, transparência dos painéis e imagens de fundo da sidebar.
              </p>
              <div className="dilemma-checklist">
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>6 Presets visuais marcantes (Night Dark, Red Velt, Blue Sky e mais)</span>
                </div>
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Customização detalhada de cores, bordas e opacidades da interface</span>
                </div>
                <div className="dilemma-check-item">
                  <CheckCircle2 size={18} />
                  <span>Suporte a upload de papéis de parede personalizados no launcher</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function DownloadSection({ onDownloadClick }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="download-section text-center" id="download" style={{ padding: "70px 18px" }}>
      <div className="section-shell" style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <span className="section-kicker" style={{ display: "block", marginBottom: "10px" }}>Tudo pronto para jogar?</span>
        <h2 style={{ fontSize: "2.6rem", textShadow: "2px 2px 0 #000", margin: "10px 0" }}>
          Baixe o MLUltimate Launcher
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "1.1rem", margin: "20px 0 35px", lineHeight: "1.6" }}>
          Garanta o instalador oficial e livre de vírus direto das releases do nosso repositório no GitHub. Clique no botão abaixo para abrir a janela de download primário ou suba a página para o topo.
        </p>
        <div className="download-actions" style={{ display: "flex", justifyContent: "center", gap: "15px", flexWrap: "wrap" }}>
          <button className="button button-primary" type="button" onClick={onDownloadClick}>
            <Download size={21} />
            Baixar agora
          </button>
          <button className="button button-secondary" type="button" onClick={scrollToTop}>
            Voltar ao topo
          </button>
        </div>
      </div>
    </section>
  );
}

function DownloadModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="download-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <span className="section-kicker">Download oficial</span>
            <h2 id="download-modal-title">Escolha sua distribuição</h2>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Fechar popup">
            ×
          </button>
        </div>

        <div className="download-choice-grid">
          {DOWNLOAD_OPTIONS.map((option) => {
            return (
              <article className="download-choice" key={option.platform}>
                <div className="download-choice-logo" aria-hidden="true">
                  {option.logoType === "windows" ? (
                    <span className="windows-logo">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    <img src={option.logo} alt="" />
                  )}
                </div>
                <div className="download-choice-copy">
                  <h3>{option.platform}</h3>
                  <p>{option.description}</p>
                </div>
                <a className="button button-primary full-width" href={option.href} download={option.fileName}>
                  <FileDown size={21} />
                  Baixar {option.platform}
                </a>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const faqItems = [
  {
    question: "Preciso ter Minecraft original?",
    answer:
      "Não obrigatoriamente. O MLUltimate tem acesso Microsoft original e também perfis offline para servidores que aceitam esse tipo de entrada."
  },
  {
    question: "O modo offline entra em qualquer servidor?",
    answer:
      "Não. Servidores que exigem autenticação oficial precisam de uma conta Microsoft válida. O modo offline funciona apenas onde esse acesso é permitido."
  },
  {
    question: "Como o launcher recebe atualizações?",
    answer:
      "O app usa o canal oficial de releases do projeto. O botão desta página também busca a versão pública mais recente."
  },
  {
    question: "O download é para Windows?",
    answer:
      "Sim. O site prioriza o instalador Windows mais recente publicado no GitHub Releases."
  },
  {
    question: "O projeto é afiliado a Minecraft ou Microsoft?",
    answer:
      "Não. MLUltimate é um launcher independente. Minecraft, Mojang e Microsoft pertencem aos respectivos donos."
  }
];

function FAQ() {
  return (
    <section className="faq-section" id="faq">
      <div className="section-shell faq-layout">
        <div className="section-heading">
          <span className="section-kicker">FAQ</span>
          <h2>Informação curta antes do download.</h2>
        </div>
        <div className="faq-list">
          {faqItems.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>
                {item.question}
                <ChevronRight size={19} />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="section-shell footer-inner">
        <div className="footer-brand">
          <img src={assets.logo} alt="" />
          <div>
            <strong>MLUltimate Launcher</strong>
            <span>Download público para Windows.</span>
          </div>
        </div>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
          <Github size={18} />
          GitHub oficial
        </a>
      </div>
    </footer>
  );
}

function AdRail({ side }) {
  return (
    <aside className={`ad-rail ad-rail-${side}`} aria-label={`Espaços de anúncios ${side}`}>
      <div className="ad-slot">
        <span>Anúncio</span>
        <strong>300 x 250</strong>
      </div>
      <div className="ad-slot tall">
        <span>Anúncio</span>
        <strong>160 x 600</strong>
      </div>
    </aside>
  );
}

function App() {
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const openDownloadModal = () => setIsDownloadModalOpen(true);
  const closeDownloadModal = () => setIsDownloadModalOpen(false);

  return (
    <>
      <Header onDownloadClick={openDownloadModal} />
      <main className="page-layout">
        <AdRail side="left" />
        <div className="page-content">
          <Hero onDownloadClick={openDownloadModal} />
          <Features />
          <ShowcaseDilemmas onDownloadClick={openDownloadModal} />
          <DownloadSection onDownloadClick={openDownloadModal} />
          <FAQ />
        </div>
        <AdRail side="right" />
      </main>
      <Footer />
      <DownloadModal isOpen={isDownloadModalOpen} onClose={closeDownloadModal} />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
