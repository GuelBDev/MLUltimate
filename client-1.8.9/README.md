# MLUltimate Client 1.8.9

**MLUltimate Client** é o núcleo client-side oficial do **MLUltimate Launcher** para Minecraft Java Edition 1.8.9. Projetado como um único mod distribuível (`MLUltimate-Client-1.8.9.jar`) compatível com Minecraft Forge 1.8.9, o cliente oferece um ecossistema completo de utilitários PvP, HUD personalizável, motor de performance, customização visual e QoL.

---

## 🚀 Princípios Fundamentais

1. **Distribuição Única**: Todas as funcionalidades estão empacotadas em um único arquivo JAR instalável.
2. **Clean-Room & Independência**: 100% de código original, utilizando apenas APIs públicas do Forge, LWJGL/OpenGL e bibliotecas de código aberto (GSON). Nenhuma dependência de código proprietário de clientes de terceiros.
3. **Resiliência a Falhas**: Falhas em módulos individuais são contidas pelo `ModuleExceptionHandler`, que desativa o módulo e alerta o usuário sem travar o Minecraft.
4. **Persistência Segura**: Configurações salvas atomicamente em `config/mlultimate/` com cópias de segurança (`*.bak`) e restauração automática contra corrupção.

---

## 🛠️ Stack Tecnológica

- **Minecraft**: 1.8.9
- **Loader**: Minecraft Forge 1.8.9 (11.15.0.1656+)
- **Java**: Java 8 (compilado com target/release 8)
- **Renderização**: OpenGL 1.1 / 2.0 / LWJGL 2.9.4
- **Build System**: Gradle 8.14.3 com Gradle Wrapper (`gradlew.bat` / `./gradlew`)

---

## 📦 Como Compilar

### Opção 1: Via Gradle (Padrão)

Prepare o workspace e compile o JAR final:

```bash
# Preparação do workspace
./gradlew setupDecompWorkspace

# Execução dos testes unitários
./gradlew test

# Compilação e geração do JAR
./gradlew build
```

O arquivo JAR será gerado em:
```
client-1.8.9/build/libs/MLUltimate-Client-1.8.9.jar
```

### Opção 2: Via Script do MLUltimate Launcher

Para desenvolvedores integrando com o ecossistema do launcher:

```bash
node scripts/build-pvp-mod.mjs
node scripts/setup-pvp-instance.mjs
```

O JAR será compilado em `dist-mod/MLUltimate-Client-1.8.9.jar` e sincronizado com a instância dedicada do launcher.

---

## 📂 Arquitetura do Projeto

```
net.mlultimate.client
├── MLUltimate.java               # Singleton central e ponto de entrada da API
├── core
│   ├── MLUltimateBootstrap.java  # Gerenciador de ciclo de vida em fases
│   ├── EventManager.java         # Coordenador de eventos
│   ├── TickManager.java          # Controle de ticks e tarefas agendadas
│   ├── RenderManager.java        # Orquestrador central de renderização 2D/3D
│   ├── InputManager.java         # Roteamento unificado de teclado e mouse
│   ├── ConfigManager.java        # Atomic save, backup e migração em config/mlultimate/
│   ├── ProfileManager.java       # Perfis: Default, PvP, Hypixel, BedWars, etc.
│   ├── KeybindManager.java       # Mapeamento central e detecção de conflitos
│   ├── NotificationManager.java  # Toasts na tela (SUCCESS, INFO, WARNING, ERROR)
│   └── ModuleManager.java        # Registro, busca e despacho de módulos
│
├── module
│   ├── Module.java               # Classe base abstrata protegida contra crash
│   ├── Category.java             # Categorias do menu (ALL, HUD, PVP, VISUAL, etc.)
│   └── setting                   # Boolean, Number, Mode, Color, Keybind, String
│
├── modules
│   ├── movement                  # ToggleSprint, ToggleSneak
│   ├── render                    # Fullbright, Zoom
│   └── performance               # Otimizações de render e memória
│
├── forge
│   ├── MLUltimateMod.java        # Container @Mod do Forge 1.8.9
│   └── MinecraftBridge.java      # Ponte reflexiva segura (MCP, SRG, Notch)
│
├── event                         # EventBus com MethodHandles de alta performance
│   └── events                    # ClientTick, Render2D, Render3D, Key, Mouse, etc.
│
└── util
    ├── Logger.java               # Gravação em logs/mlultimate.log com sanitização
    ├── ModuleExceptionHandler.java # Contenção e proteção contra crash
    └── CrashReporter.java        # Diagnóstico de erros do client
```

---

## ⚙️ Configurações e Diretórios

As configurações do MLUltimate Client são gravadas em:

```
.minecraft/config/mlultimate/
├── config.json          # Opções gerais e perfil ativo
├── modules.json         # Estado e parâmetros de todos os módulos
├── hud.json             # Posições, escalas e cores dos elementos do HUD
├── profiles.json        # Catálogo de perfis
├── waypoints.json       # Coordenadas e marcadores de waypoints
└── profiles/            # Arquivos individuais de perfis customizados
```

---

## 📜 Licença

Desenvolvido para o **MLUltimate Launcher**. Todos os direitos reservados à equipe MLUltimate.
