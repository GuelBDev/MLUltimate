# Contrato de Integração: Launcher <-> Sonik Client 1.8.9

Este documento especifica os parâmetros de linha de comando, convenções de diretório e argumentos JVM esperados pelo Sonik Client 1.8.9 ao ser iniciado pelo launcher.

---

## 1. Argumentos de Inicialização do Cliente

O cliente processa os argumentos canônicos fornecidos pelo launcher:

```bash
java -Xmx3G -Xms1G -XX:+UseG1GC \
  -Dminecraft.gameDir="C:\Users\...\instances\sonik-1.8.9" \
  -cp "<classpath_libraries_and_sonik_jar>" \
  net.minecraft.launchwrapper.Launch \
  --username "Player" \
  --uuid "00000000-0000-0000-0000-000000000000" \
  --accessToken "TOKEN" \
  --userType "mojang" \
  --version "Sonik-1.8.9" \
  --gameDir "C:\Users\...\instances\sonik-1.8.9" \
  --assetsDir "C:\Users\...\assets" \
  --assetIndex "1.8" \
  --tweakClass "dev.sonik.client.mixin.SonikTweaker"
```

---

## 2. Estrutura de Diretórios da Instância

```text
instances/
└── sonik-1.8.9/
    ├── assets/
    ├── libraries/
    ├── mods/
    │   └── OptiFine_1.8.9_HD_U_M5.jar (Opcional)
    ├── resourcepacks/
    ├── screenshots/
    ├── logs/
    │   └── sonik-client.log
    └── sonik/
        ├── config/
        │   ├── modules.json
        │   ├── hud.json
        │   └── keybinds.json
        ├── profiles/
        │   ├── default.json
        │   ├── hypixel.json
        │   └── pvp.json
        ├── cosmetics/
        └── cache/
```

---

## 3. Argumentos JVM Recomendados

### Perfil Recomendado (Equilibrado para PvP / Alta Taxa de Quadros)
```text
-Xmx3G -Xms1G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=20 -XX:+UnlockExperimentalVMOptions -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=15 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32
```

### Perfil Low-End (2GB RAM)
```text
-Xmx2G -Xms512M -XX:+UseG1GC -XX:MaxGCPauseMillis=30 -XX:+ParallelRefProcEnabled
```
