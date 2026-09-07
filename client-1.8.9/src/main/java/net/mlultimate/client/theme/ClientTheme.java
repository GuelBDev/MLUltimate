package net.mlultimate.client.theme;

import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ColorSetting;

/**
 * Enterprise Theme System for MLUltimate Client.
 * Mirrors the MLUltimate Launcher App's design tokens and appearance presets.
 * Controls background, card panels, navigation bars, text, borders, accents, and in-game HUD styling.
 */
public class ClientTheme {

    public static class Preset {
        public final String id;
        public final String name;
        public final int primaryColor;
        public final int backgroundColor;
        public final int cardColor;
        public final int sidebarColor;
        public final int topBarColor;
        public final int textColor;
        public final int mutedTextColor;
        public final int borderColor;
        public final int hudPillBg;
        public final int hudBorderColor;
        public final boolean hudBorderEnabled;

        public Preset(String id, String name, int primaryColor, int backgroundColor, int cardColor,
                      int sidebarColor, int topBarColor, int textColor, int mutedTextColor,
                      int borderColor, int hudPillBg, int hudBorderColor, boolean hudBorderEnabled) {
            this.id = id;
            this.name = name;
            this.primaryColor = primaryColor;
            this.backgroundColor = backgroundColor;
            this.cardColor = cardColor;
            this.sidebarColor = sidebarColor;
            this.topBarColor = topBarColor;
            this.textColor = textColor;
            this.mutedTextColor = mutedTextColor;
            this.borderColor = borderColor;
            this.hudPillBg = hudPillBg;
            this.hudBorderColor = hudBorderColor;
            this.hudBorderEnabled = hudBorderEnabled;
        }
    }

    public static final Preset[] PRESETS = new Preset[]{
            new Preset("night-dark", "Night Dark",
                    0xFF3B82F6, 0xFF0D1117, 0xFF161B22, 0xFF0A0E14, 0xFF0D1117,
                    0xFFFFFFFF, 0xFF94A3B8, 0x30FFFFFF, 0xCC11141B, 0x303E485C, true),

            new Preset("blue-sky", "Blue Sky",
                    0xFF0EA5E9, 0xFF07111F, 0xFF0F2335, 0xFF07111F, 0xFF0B1726,
                    0xFFF8FAFC, 0xFFB6CEE3, 0x407DD3FC, 0xCC07111F, 0x400EA5E9, true),

            new Preset("emerald-cave", "Emerald Cave",
                    0xFF10B981, 0xFF07130F, 0xFF10231D, 0xFF06100D, 0xFF081914,
                    0xFFECFDF5, 0xFFA8CDBF, 0x406EE7B7, 0xCC07130F, 0x4010B981, true),

            new Preset("red-velt", "Red Velt",
                    0xFFDC2626, 0xFF150708, 0xFF241011, 0xFF100506, 0xFF17090A,
                    0xFFFFF1F2, 0xFFE3B3B6, 0x40FDA4AF, 0xCC150708, 0x40DC2626, true),

            new Preset("purple-cyberpunk", "Cyberpunk",
                    0xFF9333EA, 0xFF11071F, 0xFF1D1033, 0xFF0C0517, 0xFF140A26,
                    0xFFFAF5FF, 0xFFD3BCEB, 0x40D8B4FE, 0xCC11071F, 0x409333EA, true),

            new Preset("yellow-sun", "Yellow Sun",
                    0xFFF59E0B, 0xFF17120A, 0xFF21190B, 0xFF100D08, 0xFF18130B,
                    0xFFFFF7ED, 0xFFD8C9AE, 0x40FDE68A, 0xCC17120A, 0x40F59E0B, true),

            new Preset("obsidian", "Obsidiana",
                    0xFF5A6478, 0xFF08090C, 0xFF12141A, 0xFF050608, 0xFF08090C,
                    0xFFE2E8F0, 0xFF848E9C, 0x25FFFFFF, 0xE608090C, 0x30FFFFFF, true),

            new Preset("acrylic", "Acrílico",
                    0xFF00E5FF, 0xDD14171E, 0xDD1F242F, 0xDD11141A, 0xDD161A22,
                    0xFFFFFFFF, 0xFFA0AEC0, 0x4000E5FF, 0xAA11141B, 0x4000E5FF, true)
    };

    private String activePresetId = "night-dark";

    // Design Tokens (Directly customizable via ColorPicker)
    public final ColorSetting primaryColor = new ColorSetting("primary_color", "Cor de Destaque", "Cor primária e destaques visuais", 0xFF3B82F6);
    public final ColorSetting backgroundColor = new ColorSetting("background_color", "Cor do Fundo Principal", "Fundo do hub de módulos", 0xFF0D1117);
    public final ColorSetting cardColor = new ColorSetting("card_color", "Fundo dos Cards", "Cor de fundo de cada card de mod", 0xFF161B22);
    public final ColorSetting sidebarColor = new ColorSetting("sidebar_color", "Barra Lateral", "Fundo da barra lateral de categorias", 0xFF0A0E14);
    public final ColorSetting topBarColor = new ColorSetting("topbar_color", "Barra Superior", "Fundo da barra superior de navegação", 0xFF0D1117);
    public final ColorSetting textColor = new ColorSetting("text_color", "Cor do Texto Principal", "Cor dos títulos e nomes", 0xFFFFFFFF);
    public final ColorSetting mutedTextColor = new ColorSetting("muted_text_color", "Texto Secundário", "Cor de descrições e subtítulos", 0xFF94A3B8);
    public final ColorSetting borderColor = new ColorSetting("border_color", "Cor das Bordas", "Bordas dos painéis e separadores", 0x30FFFFFF);
    public final ColorSetting hudPillBg = new ColorSetting("hud_pill_bg", "Fundo dos Widgets HUD", "Cor e transparência dos widgets em jogo", 0xCC11141B);
    public final ColorSetting hudBorderColor = new ColorSetting("hud_border_color", "Cor da Borda do HUD", "Cor da linha de contorno dos widgets HUD", 0x303E485C);
    public final BooleanSetting hudBorderEnabled = new BooleanSetting("hud_border_enabled", "Bordas nos Widgets HUD", "Ativar borda visível no HUD", true);

    public void applyPreset(Preset p) {
        if (p == null) return;
        this.activePresetId = p.id;
        this.primaryColor.setValue(p.primaryColor);
        this.primaryColor.setChroma(false);
        this.backgroundColor.setValue(p.backgroundColor);
        this.cardColor.setValue(p.cardColor);
        this.sidebarColor.setValue(p.sidebarColor);
        this.topBarColor.setValue(p.topBarColor);
        this.textColor.setValue(p.textColor);
        this.mutedTextColor.setValue(p.mutedTextColor);
        this.borderColor.setValue(p.borderColor);
        this.hudPillBg.setValue(p.hudPillBg);
        this.hudBorderColor.setValue(p.hudBorderColor);
        this.hudBorderEnabled.setEnabled(p.hudBorderEnabled);
        syncToHudManager();
    }

    public void applyPresetById(String id) {
        if (id == null) return;
        for (Preset p : PRESETS) {
            if (p.id.equalsIgnoreCase(id) || p.name.equalsIgnoreCase(id) || p.id.contains(id.toLowerCase())) {
                applyPreset(p);
                return;
            }
        }
    }

    public void syncToHudManager() {
        net.mlultimate.client.render.hud.HudManager.setGlobalPillBg(hudPillBg.getRgb());
        net.mlultimate.client.render.hud.HudManager.setGlobalPillBorder(hudBorderColor.getRgb());
        net.mlultimate.client.render.hud.HudManager.setGlobalPillBorderEnabled(hudBorderEnabled.isEnabled());
    }

    public String getActivePresetId() { return activePresetId; }
    public void setActivePresetId(String id) { this.activePresetId = id; }

    public int getPrimaryColor() { return primaryColor.getRgb(); }
    public int getBackgroundColor() { return backgroundColor.getRgb(); }
    public int getCardColor() { return cardColor.getRgb(); }
    public int getSidebarColor() { return sidebarColor.getRgb(); }
    public int getTopBarColor() { return topBarColor.getRgb(); }
    public int getTextColor() { return textColor.getRgb(); }
    public int getMutedTextColor() { return mutedTextColor.getRgb(); }
    public int getBorderColor() { return borderColor.getRgb(); }
    public int getHudPillBg() { return hudPillBg.getRgb(); }
    public int getHudBorderColor() { return hudBorderColor.getRgb(); }
    public boolean isHudBorderEnabled() { return hudBorderEnabled.isEnabled(); }
}
