import { generatedTemplates, generatedTranslations } from "./generatedTranslations";
import { legacyTranslations } from "./legacyTranslations";
import type { AppLanguage } from "../types/launcher";

export type TranslationMap = Record<string, string>;

const legacyByLanguage =
  legacyTranslations as Partial<Record<AppLanguage, TranslationMap>>;
const legacyPortuguese = legacyByLanguage["pt-BR"] ?? {};
const expandedLegacy = (language: AppLanguage) => {
  if (language !== "pt-BR" && language !== "pt-PT") return {};

  const locale = legacyByLanguage[language];
  if (!locale) return {};

  return Object.fromEntries(
    Object.entries(locale).flatMap(([source, translation]) => {
      const canonical = legacyPortuguese[source];
      return canonical && canonical !== source
        ? [
            [source, translation],
            [canonical, translation],
          ]
        : [[source, translation]];
    }),
  );
};
const technicalOverrides: Partial<Record<AppLanguage, TranslationMap>> = {
  "pt-BR": {
    "Modo da janela do Minecraft": "Modo da janela do Minecraft",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).",
    "Tela cheia": "Tela cheia",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.",
    "Modo Janela": "Modo Janela",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "O Minecraft abre em uma janela padrão ajustável e redimensionável.",
    "Tela Cheia Com Bordas": "Tela Cheia Com Bordas",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.",
    "Ordem das abas da barra lateral": "Ordem das abas da barra lateral",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.",
    "Início fixo do launcher": "Início fixo do launcher",
    "Fixo no topo": "Fixo no topo",
    "Ordem padrão": "Ordem padrão",
    "Mover para cima": "Mover para cima",
    "Mover para baixo": "Mover para baixo",
    "Instância para este servidor": "Instância para este servidor",
    "Skins do NameMC": "Skins do NameMC",
    "Skin manual": "Skin manual",
    "Baixar e usar skin": "Baixar e usar skin",
    "Aplicar skin manual": "Aplicar skin manual",
    "Skins salvas": "Skins salvas",
    "Ao abrir Minecraft": "Ao abrir Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Escolha o que o launcher deve fazer depois que a instância iniciar.",
    "Não fazer nada": "Não fazer nada",
    "O launcher continua aberto normalmente.": "O launcher continua aberto normalmente.",
    "Minimizar launcher": "Minimizar launcher",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.",
    "Fechar para segundo plano": "Fechar para segundo plano",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Quando o Minecraft abrir, a janela do launcher fica escondida.",
    Linguagem: "Linguagem",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Escolha o idioma do app. A preferência fica salva neste computador.",
  },
  "pt-PT": {
    "Modo da janela do Minecraft": "Modo de janela do Minecraft",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Escolha como deseja que o Minecraft abra no ecrã (Ecrã inteiro, Modo Janela ou Ecrã Inteiro Sem Margens).",
    "Tela cheia": "Ecrã inteiro",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "O Minecraft abre ocupando todo o monitor em ecrã inteiro exclusivo.",
    "Modo Janela": "Modo Janela",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "O Minecraft abre numa janela padrão ajustável e redimensionável.",
    "Tela Cheia Com Bordas": "Ecrã Inteiro Sem Margens",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.",
    "Ordem das abas da barra lateral": "Ordem dos separadores da barra lateral",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Personalize a ordem dos botões no menu lateral esquerdo. O Início permanece sempre fixo no topo.",
    "Início fixo do launcher": "Início fixo do launcher",
    "Fixo no topo": "Fixo no topo",
    "Ordem padrão": "Ordem predefinida",
    "Mover para cima": "Mover para cima",
    "Mover para baixo": "Mover para baixo",
    "Instância para este servidor": "Instância para este servidor",
    "Skins do NameMC": "Skins do NameMC",
    "Skin manual": "Skin manual",
    "Baixar e usar skin": "Descarregar e usar skin",
    "Aplicar skin manual": "Aplicar skin manual",
    "Skins salvas": "Skins guardadas",
    "Ao abrir Minecraft": "Ao abrir o Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Escolha o que o launcher deve fazer depois que a instância iniciar.",
    "Não fazer nada": "Não fazer nada",
    "O launcher continua aberto normalmente.": "O launcher continua aberto normalmente.",
    "Minimizar launcher": "Minimizar launcher",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.",
    "Fechar para segundo plano": "Fechar para segundo plano",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Quando o Minecraft abrir, a janela do launcher fica escondida.",
    Linguagem: "Idioma",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Escolha o idioma da aplicação. A preferência fica guardada neste computador.",
  },
  en: {
    "Modo da janela do Minecraft": "Minecraft Window Mode",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Choose how you want Minecraft to open on screen (Fullscreen, Windowed, or Borderless Maximized).",
    "Tela cheia": "Fullscreen",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft opens taking up the entire monitor in exclusive fullscreen.",
    "Modo Janela": "Windowed Mode",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft opens in a standard resizable and adjustable window.",
    "Tela Cheia Com Bordas": "Borderless Maximized",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft opens maximized while keeping the taskbar easily accessible.",
    "Ordem das abas da barra lateral": "Sidebar Tabs Order",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Customize the order of items on the left menu. Home is always fixed at the top.",
    "Início fixo do launcher": "Fixed launcher home",
    "Fixo no topo": "Fixed at top",
    "Ordem padrão": "Default order",
    "Mover para cima": "Move up",
    "Mover para baixo": "Move down",
    "Instância para este servidor": "Instance for this server",
    "Skins do NameMC": "NameMC Skins",
    "Skin manual": "Custom Skin",
    "Baixar e usar skin": "Download and use skin",
    "Aplicar skin manual": "Apply custom skin",
    "Skins salvas": "Saved Skins",
    "Ao abrir Minecraft": "When Opening Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Choose what the launcher should do after the instance starts.",
    "Não fazer nada": "Do nothing",
    "O launcher continua aberto normalmente.": "The launcher remains open normally.",
    "Minimizar launcher": "Minimize launcher",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "When Minecraft opens, the launcher minimizes to the taskbar.",
    "Fechar para segundo plano": "Close to system tray",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "When Minecraft opens, the launcher window hides to tray.",
    Linguagem: "Language",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Choose the app language. Your preference is saved on this computer.",
  },
  es: {
    Mods: "Mods",
    "Mods instalados": "Mods instalados",
    Shaders: "Shaders",
    "Modo da janela do Minecraft": "Modo de ventana de Minecraft",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Elija cómo desea que se abra Minecraft en la pantalla (Pantalla completa, Modo ventana o Sin bordes maximizado).",
    "Tela cheia": "Pantalla completa",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft se abre ocupando todo el monitor en pantalla completa exclusiva.",
    "Modo Janela": "Modo ventana",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft se abre en una ventana estándar ajustable y redimensionable.",
    "Tela Cheia Com Bordas": "Sin bordes maximizado",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft se abre maximizado manteniendo accesible la barra de tareas.",
    "Ordem das abas da barra lateral": "Orden de pestañas de la barra lateral",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Personalice el orden de los botones en el menú lateral izquierdo. Inicio siempre permanece fijo en la parte superior.",
    "Início fixo do launcher": "Inicio fijo del launcher",
    "Fixo no topo": "Fijo en la parte superior",
    "Ordem padrão": "Orden predeterminado",
    "Mover para cima": "Mover hacia arriba",
    "Mover para baixo": "Mover hacia abajo",
    "Instância para este servidor": "Instancia para este servidor",
    "Skins do NameMC": "Skins de NameMC",
    "Skin manual": "Skin manual",
    "Baixar e usar skin": "Descargar y usar skin",
    "Aplicar skin manual": "Aplicar skin manual",
    "Skins salvas": "Skins guardadas",
    "Ao abrir Minecraft": "Al abrir Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Elija qué debe hacer el launcher después de que se inicie la instancia.",
    "Não fazer nada": "No hacer nada",
    "O launcher continua aberto normalmente.": "El launcher permanece abierto normalmente.",
    "Minimizar launcher": "Minimizar launcher",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Cuando se abra Minecraft, el launcher se minimiza en la barra de tareas.",
    "Fechar para segundo plano": "Ocultar en segundo plano",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Cuando se abra Minecraft, la ventana del launcher queda oculta.",
    Linguagem: "Idioma",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Elija el idioma de la aplicación. La preferencia se guarda en este equipo.",
  },
  fr: {
    "Modo da janela do Minecraft": "Mode de fenêtre Minecraft",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Choisissez comment Minecraft doit s'ouvrir à l'écran (Plein écran, Mode fenêtre ou Plein écran sans bordure).",
    "Tela cheia": "Plein écran",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft s'ouvre en occupant tout l'écran en plein écran exclusif.",
    "Modo Janela": "Mode fenêtre",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft s'ouvre dans une fenêtre standard redimensionnable.",
    "Tela Cheia Com Bordas": "Plein écran sans bordure",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft s'ouvre maximisé tout en gardant la barre des tâches accessible.",
    "Ordem das abas da barra lateral": "Ordre des onglets de la barre latérale",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Personnalisez l'ordre du menu latéral. L'accueil reste toujours fixé en haut.",
    "Início fixo do launcher": "Accueil fixe du launcher",
    "Fixo no topo": "Fixé en haut",
    "Ordem padrão": "Ordre par défaut",
    "Mover para cima": "Déplacer vers le haut",
    "Mover para baixo": "Déplacer vers le bas",
    "Instância para este servidor": "Instance pour ce serveur",
    "Skins do NameMC": "Skins NameMC",
    "Skin manual": "Skin personnalisée",
    "Baixar e usar skin": "Télécharger et utiliser le skin",
    "Aplicar skin manual": "Appliquer le skin personnalisé",
    "Skins salvas": "Skins enregistrés",
    "Ao abrir Minecraft": "À l'ouverture de Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Choisissez ce que le launcher doit faire après le lancement du jeu.",
    "Não fazer nada": "Ne rien faire",
    "O launcher continua aberto normalmente.": "Le launcher reste ouvert normalement.",
    "Minimizar launcher": "Minimiser le launcher",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Quand Minecraft s'ouvre, le launcher se réduit dans la barre des tâches.",
    "Fechar para segundo plano": "Fermer en arrière-plan",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Quand Minecraft s'ouvre, la fenêtre du launcher est masquée.",
    Linguagem: "Langue",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Choisissez la langue de l'application. La préférence est enregistrée sur cet ordinateur.",
  },
  de: {
    "Modo da janela do Minecraft": "Minecraft-Fenstermodus",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Wählen Sie, wie Minecraft auf dem Bildschirm geöffnet werden soll (Vollbild, Fenstermodus oder Randlos maximiert).",
    "Tela cheia": "Vollbild",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft öffnet sich im exklusiven Vollbildmodus über den gesamten Monitor.",
    "Modo Janela": "Fenstermodus",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft öffnet sich in einem anpassbaren Standardfenster.",
    "Tela Cheia Com Bordas": "Randlos maximiert",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft öffnet sich maximiert und hält die Taskleiste erreichbar.",
    "Ordem das abas da barra lateral": "Reihenfolge der Seitenleisten-Tabs",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Passen Sie die Reihenfolge der Elemente an. Startseite bleibt immer oben fixiert.",
    "Início fixo do launcher": "Feste Startseite",
    "Fixo no topo": "Oben fixiert",
    "Ordem padrão": "Standardreihenfolge",
    "Mover para cima": "Nach oben verschieben",
    "Mover para baixo": "Nach unten verschieben",
    "Instância para este servidor": "Instanz für diesen Server",
    "Skins do NameMC": "NameMC-Skins",
    "Skin manual": "Eigener Skin",
    "Baixar e usar skin": "Skin herunterladen und verwenden",
    "Aplicar skin manual": "Eigenen Skin anwenden",
    "Skins salvas": "Gespeicherte Skins",
    "Ao abrir Minecraft": "Beim Starten von Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Wählen Sie, was der Launcher nach dem Start der Instanz tun soll.",
    "Não fazer nada": "Nichts tun",
    "O launcher continua aberto normalmente.": "Der Launcher bleibt normal geöffnet.",
    "Minimizar launcher": "Launcher minimieren",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Wenn Minecraft startet, minimiert sich der Launcher in die Taskleiste.",
    "Fechar para segundo plano": "In den Hintergrund schließen",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Wenn Minecraft startet, wird das Launcher-Fenster im Infobereich ausgeblendet.",
    Linguagem: "Sprache",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Wählen Sie die Sprache der App. Die Einstellung wird auf diesem Computer gespeichert.",
  },
  it: {
    "Modo da janela do Minecraft": "Modalità finestra di Minecraft",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Scegli come desideri che Minecraft si apra sullo schermo (Schermo intero, Modalità finestra o Senza bordi massimizzato).",
    "Tela cheia": "Schermo intero",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft si apre occupando l'intero monitor a schermo intero.",
    "Modo Janela": "Modalità finestra",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft si apre in una finestra standard ridimensionabile.",
    "Tela Cheia Com Bordas": "Senza bordi massimizzato",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft si apre massimizzato mantenendo accessibile la barra delle applicazioni.",
    "Ordem das abas da barra lateral": "Ordine schede barra laterale",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Personalizza l'ordine del menu laterale. Home rimane sempre fisso in alto.",
    "Início fixo do launcher": "Home fissa del launcher",
    "Fixo no topo": "Fisso in alto",
    "Ordem padrão": "Ordine predefinito",
    "Mover para cima": "Sposta su",
    "Mover para baixo": "Sposta giù",
    "Instância para este servidor": "Istanza per questo server",
    "Skins do NameMC": "Skin di NameMC",
    "Skin manual": "Skin personalizzata",
    "Baixar e usar skin": "Scarica e usa skin",
    "Aplicar skin manual": "Applica skin personalizzata",
    "Skins salvas": "Skin salvate",
    "Ao abrir Minecraft": "All'avvio di Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Scegli cosa deve fare il launcher dopo l'avvio del gioco.",
    "Não fazer nada": "Non fare nulla",
    "O launcher continua aberto normalmente.": "Il launcher rimane aperto normalmente.",
    "Minimizar launcher": "Riduci a icona launcher",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Quando Minecraft si apre, il launcher si riduce a icona nella barra delle applicazioni.",
    "Fechar para segundo plano": "Chiudi in background",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Quando Minecraft si apre, la finestra del launcher viene nascosta.",
    Linguagem: "Lingua",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Scegli la lingua dell'applicazione. La preferenza viene salvata su questo computer.",
  },
  ru: {
    Loader: "Загрузчик",
    Modpacks: "Модпаки",
    "Minhas Instâncias": "Мои сборки",
    "Minhas Instancias": "Мои сборки",
    Instâncias: "Сборки",
    Instancias: "Сборки",
    "Criar instância": "Создать сборку",
    "Criar instancia": "Создать сборку",
    "Modo da janela do Minecraft": "Режим окна Minecraft",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Выберите режим отображения Minecraft (Полноэкранный, Оконный режим или Без рамок).",
    "Tela cheia": "Полноэкранный режим",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft открывается на весь экран в эксклюзивном полноэкранном режиме.",
    "Modo Janela": "Оконный режим",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft открывается в стандартном изменяемом окне.",
    "Tela Cheia Com Bordas": "Без рамок (развернуто)",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft открывается развернутым, сохраняя доступ к панели задач.",
    "Ordem das abas da barra lateral": "Порядок вкладок боковой панели",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Настройте порядок вкладок в левом меню. Главная всегда закреплена сверху.",
    "Início fixo do launcher": "Главная лаунчера",
    "Fixo no topo": "Закреплено сверху",
    "Ordem padrão": "По умолчанию",
    "Mover para cima": "Вверх",
    "Mover para baixo": "Вниз",
    "Instância para este servidor": "Сборка для этого сервера",
    "Skins do NameMC": "Скины NameMC",
    "Skin manual": "Свой скин",
    "Baixar e usar skin": "Скачать и применить скин",
    "Aplicar skin manual": "Применить свой скин",
    "Skins salvas": "Сохранённые скины",
    "Ao abrir Minecraft": "При запуске Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Выберите действие лаунчера после запуска игры.",
    "Não fazer nada": "Ничего не делать",
    "O launcher continua aberto normalmente.": "Лаунчер остается открытым как обычно.",
    "Minimizar launcher": "Свернуть лаунчер",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "После запуска Minecraft лаунчер сворачивается на панель задач.",
    "Fechar para segundo plano": "Свернуть в трей",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "После запуска Minecraft окно лаунчера скрывается в трей.",
    Linguagem: "Язык",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Выберите язык приложения. Настройки сохраняются на этом компьютере.",
  },
  "zh-CN": {
    Biblioteca: "内容库",
    Loader: "加载器",
    Modpacks: "整合包",
    Jogar: "启动游戏",
    "Modo da janela do Minecraft": "Minecraft 窗口模式",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "选择 Minecraft 在屏幕上的打开方式（全屏、窗口模式或无边框全屏）。",
    "Tela cheia": "全屏模式",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft 以独占全屏模式填满整个显示器。",
    "Modo Janela": "窗口模式",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft 在可自由调整大小的标准窗口中打开。",
    "Tela Cheia Com Bordas": "无边框最大化",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft 最大化打开并保留任务栏访问。",
    "Ordem das abas da barra lateral": "侧边栏标签顺序",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "自定义左侧菜单按钮的顺序。首页始终固定在顶部。",
    "Início fixo do launcher": "固定启动器首页",
    "Fixo no topo": "固定在顶部",
    "Ordem padrão": "默认顺序",
    "Mover para cima": "上移",
    "Mover para baixo": "下移",
    "Instância para este servidor": "此服务器对应的实例",
    "Skins do NameMC": "NameMC 皮肤",
    "Skin manual": "自定义皮肤",
    "Baixar e usar skin": "下载并应用皮肤",
    "Aplicar skin manual": "应用自定义皮肤",
    "Skins salvas": "已保存的皮肤",
    "Ao abrir Minecraft": "启动 Minecraft 时",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "选择游戏启动后启动器的操作。",
    "Não fazer nada": "保持现状",
    "O launcher continua aberto normalmente.": "启动器正常保持打开。",
    "Minimizar launcher": "最小化启动器",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "游戏启动后，启动器最小化到任务栏。",
    "Fechar para segundo plano": "最小化到托盘",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "游戏启动后，启动器窗口隐藏到后台。",
    Linguagem: "语言",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "选择应用程序语言，设置将保存在本机。",
  },
  ja: {
    Biblioteca: "ライブラリ",
    Loader: "ローダー",
    Modpacks: "Modパック",
    Jogar: "プレイ",
    "Minhas Instâncias": "マイインスタンス",
    "Minhas Instancias": "マイインスタンス",
    "Modo da janela do Minecraft": "Minecraft ウィンドウモード",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Minecraft の起動時の画面表示形式を選択します（全画面、ウィンドウ、またはボーダレス最大化）。",
    "Tela cheia": "全画面表示",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft をモニター全体の全画面表示で起動します。",
    "Modo Janela": "ウィンドウモード",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft をサイズ変更可能な標準ウィンドウで起動します。",
    "Tela Cheia Com Bordas": "ボーダレス最大化",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "タスクバーを表示したまま最大化ウィンドウで起動します。",
    "Ordem das abas da barra lateral": "サイドバータブの並び順",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "左側メニューの表示順をカスタマイズします。ホームは常に最上部に固定されます。",
    "Início fixo do launcher": "固定ランチャーホーム",
    "Fixo no topo": "上部に固定",
    "Ordem padrão": "デフォルトの並び順",
    "Mover para cima": "上に移動",
    "Mover para baixo": "下に移動",
    "Instância para este servidor": "このサーバーのインスタンス",
    "Skins do NameMC": "NameMC スキン",
    "Skin manual": "カスタムスキン",
    "Baixar e usar skin": "スキンをダウンロードして適用",
    "Aplicar skin manual": "カスタムスキンを適用",
    "Skins salvas": "保存したスキン",
    "Ao abrir Minecraft": "Minecraft 起動時",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "ゲーム起動後のランチャーの動作を選択します。",
    "Não fazer nada": "何もしない",
    "O launcher continua aberto normalmente.": "ランチャーを開いたままにします。",
    "Minimizar launcher": "ランチャーを最小化",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "ゲーム起動時にタスクバーへ最小化します。",
    "Fechar para segundo plano": "トレイに最小化",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "ゲーム起動時にランチャーをトレイに隠します。",
    Linguagem: "言語",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "アプリの言語を選択します。設定はこのPCに保存されます。",
  },
  ko: {
    Biblioteca: "라이브러리",
    Loader: "로더",
    Modpacks: "모드팩",
    Jogar: "플레이",
    "Modo da janela do Minecraft": "Minecraft 창 모드",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Minecraft가 실행될 화면 모드를 선택하세요(전체 화면, 창 모드 또는 테두리 없는 최대화).",
    "Tela cheia": "전체 화면",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft가 전체 화면으로 실행됩니다.",
    "Modo Janela": "창 모드",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft가 크기 조절이 가능한 기본 창으로 실행됩니다.",
    "Tela Cheia Com Bordas": "테두리 없는 최대화",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "작업 표시줄을 유지하며 최대화된 창으로 실행됩니다.",
    "Ordem das abas da barra lateral": "사이드바 탭 순서",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "사이드바 메뉴 순서를 맞춤 설정합니다. 홈은 항상 상단에 고정됩니다.",
    "Início fixo do launcher": "고정된 홈",
    "Fixo no topo": "상단에 고정",
    "Ordem padrão": "기본 순서",
    "Mover para cima": "위로 이동",
    "Mover para baixo": "아래로 이동",
    "Instância para este servidor": "이 서버용 인스턴스",
    "Skins do NameMC": "NameMC 스킨",
    "Skin manual": "커스텀 스킨",
    "Baixar e usar skin": "스킨 다운로드 및 적용",
    "Aplicar skin manual": "커스텀 스킨 적용",
    "Skins salvas": "저장된 스킨",
    "Ao abrir Minecraft": "Minecraft 실행 시",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "게임 실행 후 런처 동작을 선택하세요.",
    "Não fazer nada": "아무것도 안 함",
    "O launcher continua aberto normalmente.": "런처가 정상적으로 열려 있습니다.",
    "Minimizar launcher": "런처 최소화",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Minecraft 실행 시 런처가 작업 표시줄로 최소화됩니다.",
    "Fechar para segundo plano": "트레이로 최소화",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Minecraft 실행 시 런처 창이 숨겨집니다.",
    Linguagem: "언어",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "앱 언어를 선택하세요. 설정은 이 컴퓨터에 저장됩니다.",
  },
  ar: {
    Mods: "Mods",
    "Mods instalados": "Mods المثبتة",
    Shaders: "Shaders",
    Loader: "مُحمّل المودات",
    Modpacks: "حزم المودات",
    "Modo da janela do Minecraft": "وضع نافذة Minecraft",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "اختر كيفية فتح Minecraft على الشاشة (ملء الشاشة، وضع النافذة، أو تكبير بدون إطار).",
    "Tela cheia": "ملء الشاشة",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "يفتح Minecraft في وضع ملء الشاشة الكامل.",
    "Modo Janela": "وضع النافذة",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "يفتح Minecraft في نافذة عادية قابلة لتغيير الحجم.",
    "Tela Cheia Com Bordas": "تكبير بدون إطار",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "يفتح Minecraft مكبرًا مع سهولة الوصول إلى شريط المهام.",
    "Ordem das abas da barra lateral": "ترتيب علامات التبويب الجانبية",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "خصص ترتيب القائمة الجانبية. تظل الصفحة الرئيسية ثابتة دائمًا في الأعلى.",
    "Início fixo do launcher": "الرئيسية الثابتة",
    "Fixo no topo": "مثبت في الأعلى",
    "Ordem padrão": "الترتيب الافتراضي",
    "Mover para cima": "تحريك لأعلى",
    "Mover para baixo": "تحريك لأسفل",
    "Instância para este servidor": "النسخة المخصصة لهذا السيرفر",
    "Skins do NameMC": "سكنات NameMC",
    "Skin manual": "سكن مخصص",
    "Baixar e usar skin": "تحميل واستخدام السكن",
    "Aplicar skin manual": "تطبيق السكن المخصص",
    "Skins salvas": "السكنات المحفوظة",
    "Ao abrir Minecraft": "عند تشغيل Minecraft",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "اختر ما يفعله المشغل بعد بدء اللعبة.",
    "Não fazer nada": "عدم فعل أي شيء",
    "O launcher continua aberto normalmente.": "يبقى المشغل مفتوحًا بشكل طبيعي.",
    "Minimizar launcher": "تصغير المشغل",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "عند فتح اللعبة، يتم تصغير المشغل إلى شريط المهام.",
    "Fechar para segundo plano": "إخفاء في شريط المهام",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "عند فتح اللعبة، يتم إخفاء نافذة المشغل في الخلفية.",
    Linguagem: "اللغة",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "اختر لغة التطبيق. يتم حفظ الإعداد على هذا الكمبيوتر.",
  },
  hi: {
    Biblioteca: "लाइब्रेरी",
    Loader: "लोडर",
    Modpacks: "मॉडपैक",
    "Minhas Instâncias": "मेरे इंस्टेंस",
    "Minhas Instancias": "मेरे इंस्टेंस",
    Instâncias: "इंस्टेंस",
    Instancias: "इंस्टेंस",
    "Criar instância": "इंस्टेंस बनाएँ",
    "Criar instancia": "इंस्टेंस बनाएँ",
    "Modo da janela do Minecraft": "Minecraft विंडो मोड",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "चुनें कि आप Minecraft को स्क्रीन पर कैसे खोलना चाहते हैं (पूर्ण स्क्रीन, विंडो मोड या बिना बॉर्डर के बड़ा)।",
    "Tela cheia": "पूर्ण स्क्रीन",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft पूरे मॉनिटर पर पूर्ण स्क्रीन में खुलता है।",
    "Modo Janela": "विंडो मोड",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft एक मानक समायोज्य विंडो में खुलता है।",
    "Tela Cheia Com Bordas": "बिना बॉर्डर बड़ा",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft टास्कबार को सुलभ रखते हुए बड़ी विंडो में खुलता है।",
    "Ordem das abas da barra lateral": "साइडबार टैब क्रम",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "बाएँ मेनू में बटन क्रम कस्टमाइज़ करें। होम हमेशा शीर्ष पर तय रहता है।",
    "Início fixo do launcher": "लॉन्चर का तय होम",
    "Fixo no topo": "शीर्ष पर तय",
    "Ordem padrão": "डिफ़ॉल्ट क्रम",
    "Mover para cima": "ऊपर ले जाएँ",
    "Mover para baixo": "नीचे ले जाएँ",
    "Instância para este servidor": "इस सर्वर के लिए इंस्टेंस",
    "Skins do NameMC": "NameMC स्किन",
    "Skin manual": "कस्टम स्किन",
    "Baixar e usar skin": "स्किन डाउनलोड करें और उपयोग करें",
    "Aplicar skin manual": "कस्टम स्किन लागू करें",
    "Skins salvas": "सहेजी गई स्किन",
    "Ao abrir Minecraft": "Minecraft खोलते समय",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "चुनें कि गेम शुरू होने के बाद लॉन्चर को क्या करना चाहिए।",
    "Não fazer nada": "कुछ न करें",
    "O launcher continua aberto normalmente.": "लॉन्चर सामान्य रूप से खुला रहता है।",
    "Minimizar launcher": "लॉन्चर छोटा करें",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "जब Minecraft खुलेगा, तो लॉन्चर टास्कबार में छोटा हो जाएगा।",
    "Fechar para segundo plano": "बैकग्राउंड में छिपाएँ",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "जब Minecraft खुलेगा, लॉन्चर विंडो छिप जाएगी।",
    Linguagem: "भाषा",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "ऐप की भाषा चुनें। यह वरीयता इस कंप्यूटर पर सहेजी जाती है।",
  },
  tr: {
    Loader: "Yükleyici",
    Modpacks: "Mod paketleri",
    "Minhas Instâncias": "Kurulumlarım",
    "Minhas Instancias": "Kurulumlarım",
    Instâncias: "Kurulumlar",
    Instancias: "Kurulumlar",
    "Criar instância": "Kurulum oluştur",
    "Criar instancia": "Kurulum oluştur",
    "Modo da janela do Minecraft": "Minecraft Pencere Modu",
    "Escolha como você deseja que o Minecraft abra na tela (Tela cheia, Modo Janela ou Tela Cheia Com Bordas).":
      "Minecraft'ın ekranda nasıl açılacağını seçin (Tam ekran, Pencere modu veya Çerçevesiz tam ekran).",
    "Tela cheia": "Tam ekran",
    "O Minecraft abre ocupando todo o monitor em tela cheia exclusiva.":
      "Minecraft tüm monitörü kaplayacak şekilde tam ekranda açılır.",
    "Modo Janela": "Pencere Modu",
    "O Minecraft abre em uma janela padrão ajustável e redimensionável.":
      "Minecraft yeniden boyutlandırılabilir standart bir pencerede açılır.",
    "Tela Cheia Com Bordas": "Çerçevesiz Tam Ekran",
    "O Minecraft abre em janela maximizada mantendo a barra de tarefas acessível.":
      "Minecraft görev çubuğuna erişilebilir şekilde ekranı kaplayarak açılır.",
    "Ordem das abas da barra lateral": "Kenar Çubuğu Sekme Sırası",
    "Personalize a ordem dos botões no menu lateral esquerdo. O Início sempre permanece fixo no topo.":
      "Sol menüdeki sekmelerin sırasını özelleştirin. Ana sayfa her zaman en üstte sabit kalır.",
    "Início fixo do launcher": "Sabit ana sayfa",
    "Fixo no topo": "En üstte sabit",
    "Ordem padrão": "Varsayılan sıra",
    "Mover para cima": "Yukarı taşı",
    "Mover para baixo": "Aşağı taşı",
    "Instância para este servidor": "Bu sunucu için kurulum",
    "Skins do NameMC": "NameMC Görünümleri",
    "Skin manual": "Özel Görünüm",
    "Baixar e usar skin": "Görünümü indir ve kullan",
    "Aplicar skin manual": "Özel görünümü uygula",
    "Skins salvas": "Kayıtlı Görünümler",
    "Ao abrir Minecraft": "Minecraft Açılırken",
    "Escolha o que o launcher deve fazer depois que a instância iniciar.":
      "Oyun başladıktan sonra başlatıcının ne yapacağını seçin.",
    "Não fazer nada": "Hiçbir şey yapma",
    "O launcher continua aberto normalmente.": "Başlatıcı normal şekilde açık kalır.",
    "Minimizar launcher": "Başlatıcıyı simge durumuna küçült",
    "Quando o Minecraft abrir, o launcher vai para a barra de tarefas.":
      "Minecraft açıldığında başlatıcı görev çubuğuna küçültülür.",
    "Fechar para segundo plano": "Arka plana gizle",
    "Quando o Minecraft abrir, a janela do launcher fica escondida.":
      "Minecraft açıldığında başlatıcı penceresi sistem tepsisine gizlenir.",
    Linguagem: "Dil",
    "Escolha o idioma do app. A preferência fica salva neste computador.":
      "Uygulama dilini seçin. Tercih bu bilgisayara kaydedilir.",
  },
};

export const translations = Object.fromEntries(
  (Object.keys(generatedTranslations) as AppLanguage[]).map((language) => [
    language,
    {
      ...generatedTranslations[language],
      ...expandedLegacy(language),
      ...(technicalOverrides[language] ?? {}),
    },
  ]),
) as unknown as Record<AppLanguage, TranslationMap>;

const templateMatchers = new Map<
  AppLanguage,
  Array<{ expression: RegExp; translation: string }>
>();

export const translateText = (language: AppLanguage, text: string) => {
  const repaired = repairMojibake(text);
  const dictionary = translations[language];
  const direct =
    dictionary[repaired] ??
    dictionary[withoutDiacritics(repaired)] ??
    dictionary[text] ??
    dictionary[withoutDiacritics(text)];

  if (direct) {
    return direct;
  }

  for (const matcher of getTemplateMatchers(language)) {
    const match = repaired.match(matcher.expression);
    if (!match) continue;

    return matcher.translation.replace(/\{\{(\d+)\}\}/g, (_, index: string) => {
      const capture = match[Number(index) + 1];
      return capture ?? "";
    });
  }

  return repaired;
};

export const repairMojibake = (text: string) => {
  let repaired = text;

  for (let pass = 0; pass < 3 && hasMojibake(repaired); pass += 1) {
    const bytes = toWindows1252Bytes(repaired);
    if (!bytes) break;

    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes,
      );
      if (mojibakeScore(decoded) >= mojibakeScore(repaired)) break;
      repaired = decoded;
    } catch {
      break;
    }
  }

  return repaired;
};

const getTemplateMatchers = (language: AppLanguage) => {
  const cached = templateMatchers.get(language);
  if (cached) return cached;

  const matchers = Object.entries(generatedTemplates[language]).map(
    ([template, translation]) => ({
      expression: templateExpression(template),
      translation,
    }),
  );
  templateMatchers.set(language, matchers);
  return matchers;
};

const templateExpression = (template: string) => {
  const segments = template.split(/\{\{\d+\}\}/g).map(escapeRegExp);
  const placeholders = template.match(/\{\{\d+\}\}/g) ?? [];
  let source = "^";

  placeholders.forEach((_, index) => {
    source += `${segments[index]}(.+?)`;
  });
  source += `${segments.at(-1) ?? ""}$`;

  return new RegExp(source, "u");
};

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const withoutDiacritics = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const hasMojibake = (text: string) =>
  /(?:Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|Ãƒ|â(?:€|€™|€œ|€|€“|€”))/u.test(text);

const mojibakeScore = (text: string) =>
  (
    text.match(
      /(?:Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|Ãƒ|â(?:€|€™|€œ|€|€“|€”)|�)/gu,
    ) ?? []
  ).length;

const windows1252Bytes = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

const toWindows1252Bytes = (text: string) => {
  const bytes: number[] = [];

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const mapped = windows1252Bytes.get(character);
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }

  return Uint8Array.from(bytes);
};
