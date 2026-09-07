package net.mlultimate.client.test;

import net.mlultimate.client.theme.ClientTheme;
import net.mlultimate.client.theme.ThemeManager;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class ThemeSystemTest {

    @Test
    public void testPresetsIntegrity() {
        ClientTheme theme = new ClientTheme();
        Assertions.assertEquals(8, ClientTheme.PRESETS.length, "Must have exactly 8 predefined launcher presets");

        for (ClientTheme.Preset preset : ClientTheme.PRESETS) {
            Assertions.assertNotNull(preset.id, "Preset ID must not be null");
            Assertions.assertNotNull(preset.name, "Preset name must not be null");
            Assertions.assertNotEquals(0, preset.primaryColor, "Preset primaryColor must not be 0");
            Assertions.assertNotEquals(0, preset.backgroundColor, "Preset backgroundColor must not be 0");
            Assertions.assertNotEquals(0, preset.cardColor, "Preset cardColor must not be 0");

            theme.applyPreset(preset);
            Assertions.assertEquals(preset.id, theme.getActivePresetId());
            Assertions.assertEquals(preset.primaryColor, theme.getPrimaryColor());
            Assertions.assertEquals(preset.backgroundColor, theme.getBackgroundColor());
            Assertions.assertEquals(preset.cardColor, theme.getCardColor());
            Assertions.assertEquals(preset.sidebarColor, theme.getSidebarColor());
            Assertions.assertEquals(preset.topBarColor, theme.getTopBarColor());
            Assertions.assertEquals(preset.textColor, theme.getTextColor());
            Assertions.assertEquals(preset.mutedTextColor, theme.getMutedTextColor());
            Assertions.assertEquals(preset.borderColor, theme.getBorderColor());
            Assertions.assertEquals(preset.hudPillBg, theme.getHudPillBg());
            Assertions.assertEquals(preset.hudBorderColor, theme.getHudBorderColor());
            Assertions.assertEquals(preset.hudBorderEnabled, theme.isHudBorderEnabled());
        }
    }

    @Test
    public void testPresetByIdLookup() {
        ClientTheme theme = new ClientTheme();
        theme.applyPresetById("cyberpunk");
        Assertions.assertEquals("purple-cyberpunk", theme.getActivePresetId());
        Assertions.assertEquals(0xFF9333EA, theme.getPrimaryColor());

        theme.applyPresetById("emerald-cave");
        Assertions.assertEquals("emerald-cave", theme.getActivePresetId());
        Assertions.assertEquals(0xFF10B981, theme.getPrimaryColor());

        theme.applyPresetById("acrylic");
        Assertions.assertEquals("acrylic", theme.getActivePresetId());
        Assertions.assertEquals(0xFF00E5FF, theme.getPrimaryColor());
    }

    @Test
    public void testIndividualColorCustomization() {
        ClientTheme theme = new ClientTheme();
        theme.applyPresetById("night-dark");

        // Customize individual tokens (cor de tudo)
        theme.primaryColor.setValue(0xFFFF5555);
        theme.backgroundColor.setValue(0xFF001122);
        theme.cardColor.setValue(0xFF112233);
        theme.topBarColor.setValue(0xFF223344);
        theme.sidebarColor.setValue(0xFF334455);
        theme.textColor.setValue(0xFFEEFFEE);
        theme.mutedTextColor.setValue(0xFFAABBCC);
        theme.borderColor.setValue(0x55FFFFFF);
        theme.hudPillBg.setValue(0x88000000);
        theme.hudBorderColor.setValue(0xFF4488FF);
        theme.hudBorderEnabled.setEnabled(false);

        Assertions.assertEquals(0xFFFF5555, theme.getPrimaryColor());
        Assertions.assertEquals(0xFF001122, theme.getBackgroundColor());
        Assertions.assertEquals(0xFF112233, theme.getCardColor());
        Assertions.assertEquals(0xFF223344, theme.getTopBarColor());
        Assertions.assertEquals(0xFF334455, theme.getSidebarColor());
        Assertions.assertEquals(0xFFEEFFEE, theme.getTextColor());
        Assertions.assertEquals(0xFFAABBCC, theme.getMutedTextColor());
        Assertions.assertEquals(0x55FFFFFF, theme.getBorderColor());
        Assertions.assertEquals(0x88000000, theme.getHudPillBg());
        Assertions.assertEquals(0xFF4488FF, theme.getHudBorderColor());
        Assertions.assertFalse(theme.isHudBorderEnabled());
    }

    @Test
    public void testThemeManagerSingleton() {
        ThemeManager tm1 = ThemeManager.getInstance();
        ThemeManager tm2 = ThemeManager.getInstance();
        Assertions.assertSame(tm1, tm2, "ThemeManager must be a singleton");
        Assertions.assertNotNull(tm1.getTheme(), "Theme instance must not be null");
    }
}
