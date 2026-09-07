package net.mlultimate.client.module;

/**
 * Official Categories for MLUltimate Client modules.
 */
public enum Category {
    ALL("Todos", "Todos os módulos disponíveis", "grid"),
    NEW("Novos", "Módulos adicionados recentemente", "sparkles"),
    HUD("HUD", "Elementos de interface na tela (FPS, CPS, Coords, etc.)", "layout"),
    PVP("PvP", "Otimizações e utilitários para combate competitivo", "sword"),
    COMBAT("Combate", "Módulos de ataque, mira e hit color", "crosshair"),
    MOVEMENT("Movimento", "Toggle Sprint, Sneak e controle de locomoção", "zap"),
    VISUAL("Visual", "Customizações estéticas, partículas, animações e iluminação", "eye"),
    PLAYER("Jogador", "Indicadores de status, armadura e poções", "user"),
    SERVER("Servidor", "Conexão, ping, scoreboard, tab e reconexão", "server"),
    WORLD("Mundo", "Waypoints, relógio e controle de iluminação/tempo", "globe"),
    PERFORMANCE("Performance", "Estabilização de FPS, otimização de render e memória", "activity"),
    UTILITY("Utilitários", "Atalhos rápidos, auto-text, chat e screenshots", "tool"),
    SKYBLOCK("SkyBlock", "Auxiliares e overlays dedicados a modos de ilha", "box"),
    MISC("Diversos", "Configurações gerais e integrações", "more-horizontal");

    private final String displayName;
    private final String description;
    private final String iconName;

    Category(String displayName, String description, String iconName) {
        this.displayName = displayName;
        this.description = description;
        this.iconName = iconName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    public String getIconName() {
        return iconName;
    }
}
