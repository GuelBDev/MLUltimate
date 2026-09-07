# Registro de Alterações (Changelog) — MLUltimate Client

## [1.0.0-FASE1] - 2026-09-05

### Adicionado
- **Arquitetura Oficial**: Estabelecido o pacote raiz `net.mlultimate.client` para unificação de marca e identidade própria MLUltimate.
- **MLUltimateBootstrap**: Inicialização em estágios estruturados (`PRE_INIT`, `INIT`, `POST_INIT`, `READY`, `SHUTDOWN`) com medição de tempo de inicialização.
- **Sistema de Build Gradle**:
  - Configurado Gradle Wrapper (`gradlew.bat` / `./gradlew`) na versão 8.14.3.
  - Adicionada task `setupDecompWorkspace` para preparação de ambiente.
  - Geração automatizada do arquivo JAR `MLUltimate-Client-1.8.9.jar`.
- **EventBus de Alta Performance**: Barramento de eventos baseado em `MethodHandles`, livre de reflexão repetitiva e com suporte a prioridades (`HIGHEST` até `LOWEST`) e cancelamento de eventos.
- **Sistema de Configuração Atômica**:
  - Diretório oficial `config/mlultimate/`.
  - Gravação atômica (`.tmp` -> rename) e geração automática de backups (`*.bak`).
  - Recuperação resiliente automática em caso de arquivos JSON corrompidos.
  - Versionamento de schema com suporte a migrações futuras (`configVersion`).
- **ProfileManager**: Catálogo de perfis com `Default`, `PvP`, `Hypixel`, `BedWars`, `SkyWars`, `SkyBlock`, `Survival`, `Performance`, além de suporte a criação, renomeação, duplicação e exclusão.
- **KeybindManager**: Gerenciador central de atalhos de teclado com detecção automática de conflitos.
- **NotificationManager**: Toasts animados in-game para `SUCCESS`, `INFO`, `WARNING` e `ERROR` com barra de progresso em tempo real.
- **ModuleExceptionHandler**: Isolamento de exceções em tempo de execução para garantir que falhas em módulos nunca derrubem o cliente do Minecraft.
- **Logger Sanitizado**: Registro estruturado em `logs/mlultimate.log` com proteção ativa contra vazamento de credenciais, tokens e senhas.
- **Suíte de Testes Unitários**: Testes automatizados cobrindo `ConfigManagerTest`, `EventBusTest`, `KeybindManagerTest`, `ProfileManagerTest` e `ModuleExceptionHandlerTest`.
