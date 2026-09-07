package net.mlultimate.client.gui;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.animation.Animation;
import net.mlultimate.client.animation.Ease;
import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.*;
import net.mlultimate.client.render.ColorUtils;
import net.mlultimate.client.render.DrawHelper;
import net.mlultimate.client.render.ScissorStack;
import net.mlultimate.client.render.font.CustomFontRenderer;
import net.mlultimate.client.forge.MinecraftBridge;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;
import org.lwjgl.opengl.Display;

import java.util.*;

/**
 * Modern Mod Menu & Hub for MLUltimate Client.
 * Features:
 * - Top tab navigation (MODS, SETTINGS, WAYPOINTS)
 * - Category sidebar with active pill highlight
 * - Real-time search with interactive text input
 * - Card grid with responsive columns, category badges, OPTIONS button and ENABLED/DISABLED toggles
 * - Interactive Settings Modal for individual module customization (Sliders, Switches, Modes, Colors, Keybinds)
 * - Full-Spectrum Color Picker with RGBA sliders, Hue wheel, presets, and live RGB/Chroma support
 * - Mod Hub & Client Theme Customization (Accent color, dark themes, acrylic glass, HUD styling)
 * - Scissor-clipped smooth mouse wheel scrolling
 * - Delta-time animations
 */
public class ModMenuScreen {

    public enum Tab {
        MODS("MODS"),
        SETTINGS("CONFIGURAÇÕES"),
        WAYPOINTS("WAYPOINTS");

        private final String label;
        Tab(String label) { this.label = label; }
        public String getLabel() { return label; }
    }

    // Hub Customization Settings linked to ClientTheme
    public static final ColorSetting hubAccentColor = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().primaryColor;
    public static final ColorSetting hudGlobalPillBgSetting = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().hudPillBg;
    public static final BooleanSetting hudGlobalBorderSetting = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().hudBorderEnabled;
    public static final ColorSetting hudGlobalBorderColorSetting = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().hudBorderColor;

    public static int getAccentColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getPrimaryColor();
    }

    public static int getMenuBgColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getBackgroundColor();
    }

    public static int getCardColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getCardColor();
    }

    public static int getSidebarColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getSidebarColor();
    }

    public static int getTopBarColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getTopBarColor();
    }

    public static int getTextColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getTextColor();
    }

    public static int getMutedTextColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getMutedTextColor();
    }

    public static int getBorderColor() {
        return net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().getBorderColor();
    }

    private int width = 800;
    private int height = 500;

    private Tab activeTab = Tab.MODS;
    private Category selectedCategory = null; // null = ALL
    private String searchQuery = "";
    private boolean searchFocused = false;

    // Scrolling
    private float scrollOffset = 0.0f;
    private float targetScroll = 0.0f;
    private float maxScroll = 0.0f;

    // Settings Modal
    private Module selectedModuleForOptions = null;
    private Setting<?> draggingSlider = null;
    private KeybindSetting listeningKeybind = null;

    // Color Picker Modal
    private ColorSetting activeColorPickerSetting = null;
    private int draggingColorSlider = 0; // 0=none, 1=hue, 2=red, 3=green, 4=blue, 5=alpha, 6=chromaSpeed

    // Animations
    private final Animation openAnim = new Animation(220, 0.0, Ease.EASE_OUT_CUBIC);
    private final Map<String, Animation> toggleAnimations = new HashMap<>();

    public void init(int screenWidth, int screenHeight) {
        this.width = screenWidth;
        this.height = screenHeight;
        this.openAnim.animateTo(1.0);
        this.searchFocused = false;
        this.listeningKeybind = null;
        this.activeColorPickerSetting = null;
        this.draggingColorSlider = 0;
        this.scrollOffset = 0.0f;
        this.targetScroll = 0.0f;
        net.mlultimate.client.forge.MinecraftBridge.lockCamera();
    }

    public void onClose() {
        this.openAnim.reset(0.0);
        this.selectedModuleForOptions = null;
        this.listeningKeybind = null;
        this.draggingSlider = null;
        this.activeColorPickerSetting = null;
        this.draggingColorSlider = 0;
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getConfigManager() != null) {
            MLUltimate.getInstance().getConfigManager().saveModules();
            MLUltimate.getInstance().getConfigManager().saveCoreConfig();
        }
        net.mlultimate.client.forge.MinecraftBridge.unlockCamera();
    }

    public float getDialogW() {
        return Math.min(720.0f, Math.max(340.0f, width - 24.0f));
    }

    public float getDialogH() {
        return Math.min(450.0f, Math.max(220.0f, height - 24.0f));
    }

    public float getDialogX() {
        return (width - getDialogW()) / 2.0f;
    }

    public float getDialogY() {
        return (height - getDialogH()) / 2.0f;
    }

    public float getSidebarW() {
        return Math.min(145.0f, Math.max(110.0f, getDialogW() * 0.28f));
    }

    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        drawScreen(mouseX, mouseY, partialTicks, this.width, this.height);
    }

    public void drawScreen(int mouseX, int mouseY, float partialTicks, int screenWidth, int screenHeight) {
        this.width = screenWidth;
        this.height = screenHeight;

        float anim = openAnim.getFloatValue();
        if (anim <= 0.01f) return;

        // Smooth scroll interpolation
        scrollOffset += (targetScroll - scrollOffset) * 0.25f;
        MinecraftBridge.bindFontTexture();

        // 1. Full Screen Backdrop Dim
        DrawHelper.drawRect(0, 0, width, height, (int) (0x60 * anim) << 24);

        // 2. Main Dialog Geometry
        float dialogW = getDialogW();
        float dialogH = getDialogH();
        float dialogX = getDialogX();
        float dialogY = getDialogY() + (1.0f - anim) * 16;

        // Dialog Drop Shadow and Background
        DrawHelper.drawDropShadow(dialogX, dialogY, dialogW, dialogH, 16, 0xA0000000);
        DrawHelper.drawRoundedRect(dialogX, dialogY, dialogW, dialogH, 8.0f, getMenuBgColor());
        DrawHelper.drawOutline(dialogX, dialogY, dialogW, dialogH, 1.0f, getBorderColor());

        CustomFontRenderer titleFont = getTitleFont();
        CustomFontRenderer regularFont = getRegularFont();
        CustomFontRenderer boldFont = getBoldFont();
        CustomFontRenderer smallFont = getSmallFont();

        // 3. Top Navigation Bar
        float topBarH = 44;
        DrawHelper.drawRoundedRect(dialogX, dialogY, dialogW, topBarH, 8.0f, getTopBarColor());
        DrawHelper.drawRect(dialogX, dialogY + topBarH - 8, dialogW, 8, getTopBarColor()); // square off bottom corners
        DrawHelper.drawRect(dialogX, dialogY + topBarH - 1, dialogW, 1, getBorderColor());

        // Brand: MLUltimate Logo & Title
        DrawHelper.drawLogo(dialogX + 12, dialogY + 10, 24, 24);
        MinecraftBridge.bindFontTexture();
        if (boldFont != null) {
            boldFont.drawStringWithShadow("MLU Config", dialogX + 42, dialogY + 17, getTextColor());
        }

        // Navigation Tabs in Center: MODS | SETTINGS | WAYPOINTS
        float tabsStartX = dialogX + Math.min(180.0f, dialogW * 0.32f);
        int tabW = Math.min(90, (int) ((dialogW - tabsStartX + dialogX - 50) / 3.0f));
        for (Tab tab : Tab.values()) {
            boolean isTabActive = (activeTab == tab);
            boolean tabHover = mouseX >= tabsStartX && mouseX <= tabsStartX + tabW && mouseY >= dialogY + 10 && mouseY <= dialogY + 34;

            if (isTabActive) {
                DrawHelper.drawRoundedRect(tabsStartX, dialogY + 11, tabW, 22, 4.0f, ColorUtils.blend(getTopBarColor(), 0xFFFFFFFF, 0.12f));
                DrawHelper.drawRect(tabsStartX + 6, dialogY + 31, tabW - 12, 2, getAccentColor());
            } else if (tabHover) {
                DrawHelper.drawRoundedRect(tabsStartX, dialogY + 11, tabW, 22, 4.0f, ColorUtils.blend(getTopBarColor(), 0xFFFFFFFF, 0.06f));
            }

            int tabTextColor = isTabActive ? getTextColor() : (tabHover ? ColorUtils.blend(getTextColor(), 0xFFFFFFFF, 0.2f) : getMutedTextColor());
            if (smallFont != null) {
                smallFont.drawCenteredString(tab.getLabel(), tabsStartX + tabW / 2.0f, dialogY + 17, tabTextColor);
            }
            tabsStartX += tabW + 6;
        }

        // Close Button [X] at Top Right
        float closeX = dialogX + dialogW - 30;
        float closeY = dialogY + 12;
        boolean closeHover = mouseX >= closeX && mouseX <= closeX + 20 && mouseY >= closeY && mouseY <= closeY + 20;
        DrawHelper.drawRoundedRect(closeX, closeY, 20, 20, 4.0f, closeHover ? 0xFFE74C3C : ColorUtils.blend(getTopBarColor(), 0xFFFFFFFF, 0.10f));
        if (boldFont != null) {
            boldFont.drawCenteredString("X", closeX + 10, closeY + 5, 0xFFFFFFFF);
        }

        // 4. Left Sidebar: Categories & Action Buttons
        float sidebarW = getSidebarW();
        float sidebarX = dialogX;
        float sidebarY = dialogY + topBarH;
        float sidebarH = dialogH - topBarH;

        DrawHelper.drawRect(sidebarX, sidebarY, sidebarW, sidebarH, getSidebarColor());
        DrawHelper.drawRect(sidebarX + sidebarW - 1, sidebarY, 1, sidebarH, getBorderColor());

        // Sidebar Header: Current Profile badge
        float profY = sidebarY + 8;
        DrawHelper.drawRoundedRect(sidebarX + 8, profY, sidebarW - 16, 24, 4.0f, getCardColor());
        DrawHelper.drawOutline(sidebarX + 8, profY, sidebarW - 16, 24, 1.0f, getBorderColor());
        if (smallFont != null) {
            String profName = MLUltimate.getInstance() != null && MLUltimate.getInstance().getProfileManager() != null
                    ? MLUltimate.getInstance().getProfileManager().getActiveProfileName() : "Default";
            smallFont.drawString("Perfil: " + profName, sidebarX + 14, profY + 7, getAccentColor());
        }

        // Sidebar Categories List
        float catY = profY + 30;
        int totalMods = (MLUltimate.getInstance() != null && MLUltimate.getInstance().getModuleManager() != null)
                ? MLUltimate.getInstance().getModuleManager().getModules().size() : 24;
        renderCategoryPill("TODOS (" + totalMods + ")", null, sidebarX + 8, catY, sidebarW - 16, mouseX, mouseY, smallFont);
        catY += 22;

        Category[] cats = new Category[] {
                Category.HUD, Category.COMBAT, Category.MOVEMENT, Category.VISUAL, Category.SERVER, Category.PERFORMANCE
        };

        for (Category cat : cats) {
            if (catY + 20 > sidebarY + sidebarH - 56) break; // Leave room for bottom buttons
            int count = (MLUltimate.getInstance() != null && MLUltimate.getInstance().getModuleManager() != null)
                    ? MLUltimate.getInstance().getModuleManager().getModulesByCategory(cat).size() : 0;
            String label = cat.getDisplayName().toUpperCase(Locale.ROOT) + " (" + count + ")";
            renderCategoryPill(label, cat, sidebarX + 8, catY, sidebarW - 16, mouseX, mouseY, smallFont);
            catY += 20;
        }

        // Sidebar Bottom Buttons: EDIT HUD & SAVE PROFILE
        float bottomBtnY = sidebarY + sidebarH - 52;
        boolean hudBtnHover = mouseX >= sidebarX + 8 && mouseX <= sidebarX + sidebarW - 8 && mouseY >= bottomBtnY && mouseY <= bottomBtnY + 20;
        DrawHelper.drawRoundedRect(sidebarX + 8, bottomBtnY, sidebarW - 16, 20, 4.0f, hudBtnHover ? 0xFF357ABD : getAccentColor());
        if (smallFont != null) {
            smallFont.drawCenteredString("EDITAR HUD", sidebarX + sidebarW / 2.0f, bottomBtnY + 5, 0xFFFFFFFF);
        }

        float profileBtnY = bottomBtnY + 24;
        boolean profBtnHover = mouseX >= sidebarX + 8 && mouseX <= sidebarX + sidebarW - 8 && mouseY >= profileBtnY && mouseY <= profileBtnY + 20;
        DrawHelper.drawRoundedRect(sidebarX + 8, profileBtnY, sidebarW - 16, 20, 4.0f, profBtnHover ? ColorUtils.blend(getSidebarColor(), 0xFFFFFFFF, 0.12f) : ColorUtils.blend(getSidebarColor(), 0xFFFFFFFF, 0.06f));
        if (smallFont != null) {
            smallFont.drawCenteredString("NOVO PERFIL", sidebarX + sidebarW / 2.0f, profileBtnY + 5, getMutedTextColor());
        }

        // 5. Content Area (Right Side)
        float contentX = sidebarX + sidebarW + 10;
        float contentY = sidebarY + 8;
        float contentW = dialogW - sidebarW - 18;
        float contentH = sidebarH - 16;

        if (activeTab == Tab.SETTINGS) {
            renderSettingsTab(contentX, contentY, contentW, contentH, mouseX, mouseY, boldFont, regularFont, smallFont);
        } else if (activeTab == Tab.WAYPOINTS) {
            if (regularFont != null) {
                regularFont.drawCenteredString("Waypoints em breve...", contentX + contentW / 2.0f, contentY + 60.0f, getMutedTextColor());
            }
        } else {
            // Subheader: Category Title & Search Bar
            String catHeader = selectedCategory == null ? "TODOS OS MÓDULOS" : selectedCategory.getDisplayName().toUpperCase(Locale.ROOT);
            if (boldFont != null) {
                boldFont.drawStringWithShadow(catHeader, contentX + 4, contentY + 5, getTextColor());
            }

            // Search Box in Top Right of content
            float searchW = Math.min(160.0f, contentW * 0.45f);
            float searchH = 24;
            float searchX = contentX + contentW - searchW;
            float searchY = contentY;

            int searchBorder = searchFocused ? getAccentColor() : getBorderColor();
            DrawHelper.drawBorderedRect(searchX, searchY, searchW, searchH, 1.0f, getCardColor(), searchBorder);
            if (smallFont != null) {
                String displaySearch = searchQuery.isEmpty() ? (searchFocused ? "" : "Pesquisar módulo...") : searchQuery;
                int searchColor = searchQuery.isEmpty() ? getMutedTextColor() : getTextColor();
                smallFont.drawString(displaySearch, searchX + 6, searchY + 7, searchColor);
                if (searchFocused && (System.currentTimeMillis() / 500) % 2 == 0) {
                    float cursorX = searchX + 6 + (searchQuery.isEmpty() ? 0 : smallFont.getStringWidth(searchQuery));
                    DrawHelper.drawRect(cursorX, searchY + 5, 1.5f, 13, getAccentColor());
                }
            }

            // 6. Scrollable Module Cards Grid
            float gridY = contentY + 32;
            float gridH = contentH - 32;

            List<Module> filteredModules = getFilteredModules();
            int cols = contentW >= 380 ? 3 : (contentW >= 240 ? 2 : 1);
            float cardSpacing = 8.0f;
            float cardW = (contentW - (cardSpacing * (cols - 1))) / (float) cols;
            float cardH = 92.0f;

            int rows = (int) Math.ceil((double) filteredModules.size() / cols);
            float totalContentH = rows * (cardH + cardSpacing);
            this.maxScroll = Math.max(0.0f, totalContentH - gridH);

            // Clamp scroll
            if (targetScroll < 0) targetScroll = 0;
            if (targetScroll > maxScroll) targetScroll = maxScroll;

            // Scissor Clipping for clean card scroll container with exact screen dimensions
            ScissorStack.clear();
            ScissorStack.push((int) contentX, (int) gridY, (int) contentW, (int) gridH, Display.getWidth(), Display.getHeight(), width, height);

            try {
                if (filteredModules.isEmpty()) {
                    if (regularFont != null) {
                        regularFont.drawCenteredString("Nenhum módulo encontrado nesta categoria.", contentX + contentW / 2.0f, gridY + 40.0f, 0xFF8A93A4);
                    }
                } else {
                    for (int i = 0; i < filteredModules.size(); i++) {
                        Module module = filteredModules.get(i);
                        int col = i % cols;
                        int row = i / cols;

                        float cx = contentX + col * (cardW + cardSpacing);
                        float cy = gridY + row * (cardH + cardSpacing) - scrollOffset;

                        // Skip rendering out of visible screen bounds
                        if (cy + cardH < gridY || cy > gridY + gridH) continue;

                        renderModuleCard(module, cx, cy, cardW, cardH, mouseX, mouseY, boldFont, regularFont, smallFont);
                    }
                }
            } finally {
                ScissorStack.pop();
            }
        }

        // 7. Settings Modal Overlay (if open)
        if (selectedModuleForOptions != null) {
            renderSettingsModal(dialogX, dialogY, dialogW, dialogH, mouseX, mouseY, boldFont, smallFont);
        }

        // 8. Color Picker Modal Overlay (if open on top of everything)
        if (activeColorPickerSetting != null) {
            renderColorPickerModal(mouseX, mouseY);
        }
    }

    private void renderSettingsTab(float contentX, float contentY, float contentW, float contentH,
                                   int mouseX, int mouseY, CustomFontRenderer boldFont, CustomFontRenderer regFont, CustomFontRenderer smallFont) {
        net.mlultimate.client.theme.ClientTheme theme = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme();

        float totalContentH = 680.0f;
        this.maxScroll = Math.max(0.0f, totalContentH - contentH);
        if (targetScroll < 0) targetScroll = 0;
        if (targetScroll > maxScroll) targetScroll = maxScroll;

        ScissorStack.clear();
        ScissorStack.push((int) contentX, (int) contentY, (int) contentW, (int) contentH, Display.getWidth(), Display.getHeight(), width, height);

        try {
            float y = contentY - scrollOffset;

            // Header
            if (boldFont != null) {
                boldFont.drawStringWithShadow("TEMAS & PERSONALIZAÇÃO COMPLETA", contentX + 4, y + 2, getTextColor());
            }
            if (smallFont != null) {
                smallFont.drawString("Escolha um tema pré-definido igual ao launcher ou ajuste cada cor individualmente:", contentX + 4, y + 16, getMutedTextColor());
            }
            y += 34;

            // SECTION 1: PREDEFINIÇÕES DE TEMA (APP PRESETS)
            float sec1H = 166.0f;
            DrawHelper.drawRoundedRect(contentX, y, contentW, sec1H, 6.0f, getCardColor());
            DrawHelper.drawOutline(contentX, y, contentW, sec1H, 1.0f, getBorderColor());

            if (boldFont != null) {
                boldFont.drawStringWithShadow("PREDEFINIÇÕES DO LAUNCHER (1-CLIQUE)", contentX + 10, y + 8, getAccentColor());
            }
            if (smallFont != null) {
                smallFont.drawString("Temas oficiais idênticos aos do aplicativo MLUltimate:", contentX + 10, y + 21, getMutedTextColor());
            }

            float presetStartY = y + 36;
            int pCols = contentW >= 320 ? 2 : 1;
            float pGap = 6.0f;
            float pW = (contentW - 20 - (pCols > 1 ? pGap : 0)) / (float) pCols;
            float pH = 26.0f;

            net.mlultimate.client.theme.ClientTheme.Preset[] presets = net.mlultimate.client.theme.ClientTheme.PRESETS;
            for (int i = 0; i < presets.length; i++) {
                net.mlultimate.client.theme.ClientTheme.Preset p = presets[i];
                int col = i % pCols;
                int row = i / pCols;
                float px = contentX + 10 + col * (pW + pGap);
                float py = presetStartY + row * (pH + pGap);

                boolean isActive = p.id.equalsIgnoreCase(theme.getActivePresetId());
                boolean pHover = mouseX >= px && mouseX <= px + pW && mouseY >= py && mouseY <= py + pH && mouseY >= contentY && mouseY <= contentY + contentH;

                int cardBg = isActive ? ColorUtils.blend(p.primaryColor, 0xFF000000, 0.75f) : (pHover ? ColorUtils.blend(getCardColor(), 0xFFFFFFFF, 0.08f) : ColorUtils.blend(getCardColor(), 0xFF000000, 0.2f));
                DrawHelper.drawRoundedRect(px, py, pW, pH, 4.0f, cardBg);
                DrawHelper.drawOutline(px, py, pW, pH, 1.0f, isActive ? p.primaryColor : (pHover ? 0x80FFFFFF : getBorderColor()));

                // Swatch preview dots
                DrawHelper.drawRoundedRect(px + 6, py + 7, 12, 12, 3.0f, p.primaryColor);
                DrawHelper.drawRoundedRect(px + 22, py + 7, 12, 12, 3.0f, p.cardColor);

                if (smallFont != null) {
                    smallFont.drawStringWithShadow(p.name, px + 38, py + 8, isActive ? 0xFFFFFFFF : getTextColor());
                    if (isActive) {
                        smallFont.drawString("✓ ATIVO", px + pW - 46, py + 8, p.primaryColor);
                    }
                }
            }

            y += sec1H + 12;

            // SECTION 2: PERSONALIZAÇÃO INDIVIDUAL ("COR DE TUDO")
            ColorSetting[] tokens = new ColorSetting[] {
                    theme.primaryColor,
                    theme.backgroundColor,
                    theme.cardColor,
                    theme.topBarColor,
                    theme.sidebarColor,
                    theme.textColor,
                    theme.mutedTextColor,
                    theme.borderColor,
                    theme.hudPillBg,
                    theme.hudBorderColor
            };

            float tokenRowH = 24.0f;
            float tokenRowGap = 3.0f;
            float sec2H = 38.0f + tokens.length * (tokenRowH + tokenRowGap) + 6.0f;
            DrawHelper.drawRoundedRect(contentX, y, contentW, sec2H, 6.0f, getCardColor());
            DrawHelper.drawOutline(contentX, y, contentW, sec2H, 1.0f, getBorderColor());

            if (boldFont != null) {
                boldFont.drawStringWithShadow("CUSTOMIZAÇÃO INDIVIDUAL (\"COR DE TUDO\")", contentX + 10, y + 8, getAccentColor());
            }
            if (smallFont != null) {
                smallFont.drawString("Clique na caixa de cor para abrir o seletor RGBA e alternar RGB Chroma:", contentX + 10, y + 21, getMutedTextColor());
            }

            float tokenStartY = y + 36;
            for (int i = 0; i < tokens.length; i++) {
                ColorSetting cs = tokens[i];
                float ry = tokenStartY + i * (tokenRowH + tokenRowGap);
                boolean rHover = mouseX >= contentX + 8 && mouseX <= contentX + contentW - 8 && mouseY >= ry && mouseY <= ry + tokenRowH && mouseY >= contentY && mouseY <= contentY + contentH;

                if (rHover) {
                    DrawHelper.drawRoundedRect(contentX + 8, ry, contentW - 16, tokenRowH, 3.0f, ColorUtils.blend(getCardColor(), 0xFFFFFFFF, 0.05f));
                }

                if (smallFont != null) {
                    smallFont.drawStringWithShadow(cs.getName(), contentX + 12, ry + 7, getTextColor());
                    String desc = cs.getDescription();
                    if (contentW > 380 && desc != null && !desc.isEmpty()) {
                        smallFont.drawString("— " + desc, contentX + 12 + smallFont.getStringWidth(cs.getName()) + 8, ry + 7, getMutedTextColor());
                    }
                }

                // Swatch Box on Right
                float swW = 58;
                float swH = 16;
                float swX = contentX + contentW - swW - 12;
                DrawHelper.drawRoundedRect(swX, ry + 4, swW, swH, 3.0f, cs.getRgb());
                DrawHelper.drawOutline(swX, ry + 4, swW, swH, 1.0f, 0xFFFFFFFF);

                if (smallFont != null) {
                    String label = cs.isChroma() ? "RGB" : String.format(Locale.ROOT, "#%06X", (cs.getValue() & 0x00FFFFFF));
                    smallFont.drawCenteredString(label, swX + swW / 2.0f, ry + 7, 0xFFFFFFFF);
                }
            }

            y += sec2H + 12;

            // SECTION 3: AJUSTES DO HUD EM JOGO
            float sec3H = 84;
            DrawHelper.drawRoundedRect(contentX, y, contentW, sec3H, 6.0f, getCardColor());
            DrawHelper.drawOutline(contentX, y, contentW, sec3H, 1.0f, getBorderColor());

            if (boldFont != null) {
                boldFont.drawStringWithShadow("AJUSTES DOS WIDGETS DO HUD", contentX + 10, y + 8, getAccentColor());
            }

            // Row 1: Borda HUD Switch
            float hRowY = y + 26;
            if (smallFont != null) {
                smallFont.drawString("Contorno visível ao redor dos widgets do HUD", contentX + 12, hRowY + 5, getTextColor());
            }
            float swW = 34;
            float swH = 16;
            float swX = contentX + contentW - swW - 12;
            DrawHelper.drawSwitch(swX, hRowY + 1, swW, swH, theme.hudBorderEnabled.isEnabled(), theme.hudBorderEnabled.isEnabled() ? 1.0f : 0.0f);

            // Row 2: Botão ABRIR EDITOR DE HUD
            float btnY = y + 50;
            float btnH = 24;
            boolean hBtnHover = mouseX >= contentX + 10 && mouseX <= contentX + contentW - 10 && mouseY >= btnY && mouseY <= btnY + btnH && mouseY >= contentY && mouseY <= contentY + contentH;
            DrawHelper.drawRoundedRect(contentX + 10, btnY, contentW - 20, btnH, 4.0f, hBtnHover ? 0xFF357ABD : getAccentColor());
            if (boldFont != null) {
                boldFont.drawCenteredString("✦ ABRIR EDITOR DE POSIÇÃO DO HUD ✦", contentX + contentW / 2.0f, btnY + 7, 0xFFFFFFFF);
            }

        } finally {
            ScissorStack.pop();
        }
    }

    private void renderColorPickerModal(int mouseX, int mouseY) {
        float pickerW = 260.0f;
        float pickerH = 270.0f;
        float pickerX = (width - pickerW) / 2.0f;
        float pickerY = (height - pickerH) / 2.0f;

        // Dim backdrop
        DrawHelper.drawRect(0, 0, width, height, 0x80000000);

        // Card shadow and panel
        DrawHelper.drawDropShadow(pickerX, pickerY, pickerW, pickerH, 16, 0xA0000000);
        DrawHelper.drawRoundedRect(pickerX, pickerY, pickerW, pickerH, 6.0f, 0xFF181B22);
        DrawHelper.drawOutline(pickerX, pickerY, pickerW, pickerH, 1.0f, getAccentColor());

        CustomFontRenderer boldFont = getBoldFont();
        CustomFontRenderer smallFont = getSmallFont();

        // Header
        if (boldFont != null) {
            String title = activeColorPickerSetting.getName();
            if (title.length() > 22) title = title.substring(0, 20) + "...";
            boldFont.drawStringWithShadow(title, pickerX + 12, pickerY + 12, 0xFFFFFFFF);
        }

        // Close button [X]
        float closeBtnX = pickerX + pickerW - 24;
        float closeBtnY = pickerY + 8;
        boolean closeHover = mouseX >= closeBtnX && mouseX <= closeBtnX + 16 && mouseY >= closeBtnY && mouseY <= closeBtnY + 16;
        DrawHelper.drawRoundedRect(closeBtnX, closeBtnY, 16, 16, 3.0f, closeHover ? 0xFFE74C3C : 0xFF252A34);
        if (smallFont != null) {
            smallFont.drawCenteredString("X", closeBtnX + 8, closeBtnY + 3, 0xFFFFFFFF);
        }

        float curY = pickerY + 34;

        // 1. Color Preview Box & Hex String & Chroma Indicator
        int currentRgb = activeColorPickerSetting.getRgb();
        float previewW = 56.0f;
        float previewH = 22.0f;
        DrawHelper.drawRoundedRect(pickerX + 12, curY, previewW, previewH, 4.0f, currentRgb);
        DrawHelper.drawOutline(pickerX + 12, curY, previewW, previewH, 1.0f, 0xFFFFFFFF);

        String hexStr = String.format(Locale.ROOT, "#%06X", (activeColorPickerSetting.getValue() & 0x00FFFFFF));
        if (smallFont != null) {
            smallFont.drawStringWithShadow(hexStr, pickerX + 12 + previewW + 8, curY + 2, 0xFFFFFFFF);
            String chromaLabel = activeColorPickerSetting.isChroma() ? "§aRGB Chroma ATIVO" : "§7RGB Desativado";
            smallFont.drawString(chromaLabel, pickerX + 12 + previewW + 8, curY + 12, 0xFFA8ADB7);
        }

        curY += 28;

        // 2. Preset Colors Palette (10 swatches)
        int[] presets = new int[]{
                0xFFFFFFFF, 0xFFFF3B30, 0xFFFF9500, 0xFFFFCC00, 0xFF34C759,
                0xFF00C7BE, 0xFF007AFF, 0xFFAF52DE, 0xFFFF2D55, 0xFF14171D
        };
        float swatchSize = 18.0f;
        float swatchGap = 4.0f;
        float startSwatchX = pickerX + 12;
        for (int i = 0; i < presets.length; i++) {
            float sx = startSwatchX + i * (swatchSize + swatchGap);
            float sy = curY;
            boolean sHover = mouseX >= sx && mouseX <= sx + swatchSize && mouseY >= sy && mouseY <= sy + swatchSize;
            DrawHelper.drawRoundedRect(sx, sy, swatchSize, swatchSize, 3.0f, presets[i]);
            DrawHelper.drawOutline(sx, sy, swatchSize, swatchSize, 1.0f, sHover ? 0xFFFFFFFF : 0x50FFFFFF);
        }

        curY += 26;

        // 3. Hue Slider (Full spectrum 0-360)
        if (smallFont != null) {
            smallFont.drawString("Espectro de Cores (Hue):", pickerX + 12, curY, 0xFFA8ADB7);
        }
        curY += 12;

        float barW = pickerW - 24;
        float barH = 10;
        int steps = 24;
        float stepW = barW / (float) steps;
        for (int i = 0; i < steps; i++) {
            float hue1 = (float) i / steps;
            int col = java.awt.Color.HSBtoRGB(hue1, 0.9f, 1.0f);
            DrawHelper.drawRect(pickerX + 12 + i * stepW, curY, stepW + 1.0f, barH, col);
        }
        DrawHelper.drawOutline(pickerX + 12, curY, barW, barH, 1.0f, 0x80FFFFFF);

        curY += 16;

        // 4. RGBA Sliders
        curY = renderRgbaSlider("R", activeColorPickerSetting.getRed(), 255, pickerX + 12, curY, barW, 0xFFFF5555, smallFont);
        curY = renderRgbaSlider("G", activeColorPickerSetting.getGreen(), 255, pickerX + 12, curY, barW, 0xFF55FF55, smallFont);
        curY = renderRgbaSlider("B", activeColorPickerSetting.getBlue(), 255, pickerX + 12, curY, barW, 0xFF5599FF, smallFont);
        curY = renderRgbaSlider("A", activeColorPickerSetting.getAlpha(), 255, pickerX + 12, curY, barW, 0xFFAAAAAA, smallFont);

        // 5. RGB / Chroma Mode Button
        float chromaBtnW = 110;
        float chromaBtnH = 20;
        float chromaBtnX = pickerX + 12;
        float chromaBtnY = curY + 2;
        boolean chromaHover = mouseX >= chromaBtnX && mouseX <= chromaBtnX + chromaBtnW && mouseY >= chromaBtnY && mouseY <= chromaBtnY + chromaBtnH;
        int btnCol = activeColorPickerSetting.isChroma() ? 0xFF2ECC71 : (chromaHover ? 0xFF353D4C : 0xFF232833);
        DrawHelper.drawRoundedRect(chromaBtnX, chromaBtnY, chromaBtnW, chromaBtnH, 4.0f, btnCol);
        if (smallFont != null) {
            smallFont.drawCenteredString(activeColorPickerSetting.isChroma() ? "RGB: LIGADO" : "RGB: DESLIGADO", chromaBtnX + chromaBtnW / 2.0f, chromaBtnY + 5, 0xFFFFFFFF);
        }

        // 6. Concluir Button
        float doneBtnW = 90;
        float doneBtnH = 20;
        float doneBtnX = pickerX + pickerW - doneBtnW - 12;
        float doneBtnY = curY + 2;
        boolean doneHover = mouseX >= doneBtnX && mouseX <= doneBtnX + doneBtnW && mouseY >= doneBtnY && mouseY <= doneBtnY + doneBtnH;
        DrawHelper.drawRoundedRect(doneBtnX, doneBtnY, doneBtnW, doneBtnH, 4.0f, doneHover ? 0xFF357ABD : getAccentColor());
        if (smallFont != null) {
            smallFont.drawCenteredString("Concluir", doneBtnX + doneBtnW / 2.0f, doneBtnY + 5, 0xFFFFFFFF);
        }
    }

    private float renderRgbaSlider(String channel, int val, int max, float x, float y, float barW, int channelColor, CustomFontRenderer smallFont) {
        if (smallFont != null) {
            smallFont.drawString(channel, x, y + 1, channelColor);
        }
        float sliderX = x + 18;
        float sliderW = barW - 18 - 32;
        float progress = Math.max(0.0f, Math.min(1.0f, (float) val / max));
        DrawHelper.drawSlider(sliderX, y + 2, sliderW, 8, progress, channelColor, 0xFFFFFFFF);
        if (smallFont != null) {
            smallFont.drawString(String.valueOf(val), sliderX + sliderW + 6, y + 1, 0xFFE0E0E0);
        }
        return y + 15;
    }

    private void renderCategoryPill(String name, Category cat, float x, float y, float w, int mouseX, int mouseY, CustomFontRenderer font) {
        boolean active = (selectedCategory == cat);
        boolean hover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + 20;

        int bgColor = active ? getAccentColor() : (hover ? ColorUtils.blend(getSidebarColor(), 0xFFFFFFFF, 0.08f) : 0x00000000);
        int textColor = active ? 0xFFFFFFFF : (hover ? getTextColor() : getMutedTextColor());

        if (active || hover) {
            DrawHelper.drawRoundedRect(x, y, w, 20, 4.0f, bgColor);
        }

        if (font != null) {
            font.drawString(name, x + 8, y + 5, textColor);
        }
    }

    private void renderModuleCard(Module module, float x, float y, float w, float h, int mouseX, int mouseY,
                                  CustomFontRenderer boldFont, CustomFontRenderer regFont, CustomFontRenderer smallFont) {
        boolean cardHover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;

        // Card Panel with subtle shadow and border
        int panelColor = cardHover ? ColorUtils.blend(getCardColor(), 0xFFFFFFFF, 0.08f) : getCardColor();
        DrawHelper.drawDropShadow(x, y, w, h, 4, 0x30000000);
        DrawHelper.drawRoundedRect(x, y, w, h, 6.0f, panelColor);
        DrawHelper.drawOutline(x, y, w, h, 1.0f, getBorderColor());

        // Module Icon Badge
        int iconColor = module.isEnabled() ? getAccentColor() : ColorUtils.blend(getCardColor(), 0xFF000000, 0.25f);
        DrawHelper.drawRoundedRect(x + 8, y + 8, 20, 20, 4.0f, iconColor);
        if (boldFont != null) {
            String initial = module.getName().substring(0, Math.min(1, module.getName().length()));
            boldFont.drawCenteredString(initial, x + 18, y + 12, 0xFFFFFFFF);
        }

        // Module Title
        if (boldFont != null) {
            boldFont.drawStringWithShadow(module.getName(), x + 34, y + 12, getTextColor());
        }

        // Toggle Switch on top-right
        float swW = 32;
        float swH = 16;
        float swX = x + w - swW - 8;
        float swY = y + 10;
        DrawHelper.drawSwitch(swX, swY, swW, swH, module.isEnabled(), module.isEnabled() ? 1.0f : 0.0f);

        // Short Description
        if (smallFont != null) {
            String desc = module.getDescription();
            if (desc.length() > 30) desc = desc.substring(0, 28) + "...";
            smallFont.drawString(desc, x + 8, y + 36, getMutedTextColor());
        }

        // Bottom Action Button: [ CONFIGURAÇÕES ⚙ ]
        float optX = x + 8;
        float optY = y + h - 26;
        float optW = w - 16;
        float optH = 18;
        boolean optHover = mouseX >= optX && mouseX <= optX + optW && mouseY >= optY && mouseY <= optY + optH;
        DrawHelper.drawRoundedRect(optX, optY, optW, optH, 3.0f, optHover ? ColorUtils.blend(getCardColor(), 0xFFFFFFFF, 0.12f) : ColorUtils.blend(getCardColor(), 0xFF000000, 0.15f));
        DrawHelper.drawOutline(optX, optY, optW, optH, 1.0f, getBorderColor());
        if (smallFont != null) {
            smallFont.drawCenteredString("CONFIGURAÇÕES ⚙", optX + optW / 2.0f, optY + 4, getTextColor());
        }
    }

    private void renderSettingsModal(float dialogX, float dialogY, float dialogW, float dialogH,
                                     int mouseX, int mouseY, CustomFontRenderer boldFont, CustomFontRenderer smallFont) {
        // Modal Dimmer Backdrop
        DrawHelper.drawRect(dialogX, dialogY, dialogW, dialogH, 0xCC0E1015);

        // Modal Dialog Box
        float modalW = Math.min(380.0f, dialogW - 32.0f);
        float modalH = Math.min(320.0f, dialogH - 32.0f);
        float modalX = dialogX + (dialogW - modalW) / 2.0f;
        float modalY = dialogY + (dialogH - modalH) / 2.0f;

        DrawHelper.drawDropShadow(modalX, modalY, modalW, modalH, 18, 0xC0000000);
        DrawHelper.drawRoundedRect(modalX, modalY, modalW, modalH, 8.0f, 0xFF1C2028);

        // Modal Header
        DrawHelper.drawRoundedRect(modalX, modalY, modalW, 40, 8.0f, 0xFF161920);
        if (boldFont != null) {
            boldFont.drawStringWithShadow(selectedModuleForOptions.getName() + " — Configurações", modalX + 14, modalY + 14, 0xFFFFFFFF);
        }

        // Close Modal [X]
        float closeBtnX = modalX + modalW - 28;
        float closeBtnY = modalY + 10;
        boolean closeHover = mouseX >= closeBtnX && mouseX <= closeBtnX + 20 && mouseY >= closeBtnY && mouseY <= closeBtnY + 20;
        DrawHelper.drawRoundedRect(closeBtnX, closeBtnY, 20, 20, 4.0f, closeHover ? 0xFFE74C3C : 0xFF2A2E3A);
        if (boldFont != null) {
            boldFont.drawCenteredString("X", closeBtnX + 10, closeBtnY + 4, 0xFFFFFFFF);
        }

        // Settings Items Container
        float itemY = modalY + 48;
        List<Setting<?>> settings = selectedModuleForOptions.getSettings();

        for (Setting<?> setting : settings) {
            if (!setting.isVisible()) continue;
            float itemH = 32;

            DrawHelper.drawRoundedRect(modalX + 12, itemY, modalW - 24, itemH, 4.0f, 0xFF222631);

            // Setting Name
            if (smallFont != null) {
                smallFont.drawStringWithShadow(setting.getName(), modalX + 18, itemY + 10, 0xFFFFFFFF);
            }

            // Setting Control Renderers
            if (setting instanceof BooleanSetting) {
                BooleanSetting bs = (BooleanSetting) setting;
                float swW = 34;
                float swH = 18;
                float swX = modalX + modalW - swW - 20;
                float swY = itemY + 7;
                DrawHelper.drawSwitch(swX, swY, swW, swH, bs.isEnabled(), bs.isEnabled() ? 1.0f : 0.0f);
            } else if (setting instanceof NumberSetting) {
                NumberSetting ns = (NumberSetting) setting;
                float sliderW = 90;
                float sliderX = modalX + modalW - sliderW - 20;
                float sliderY = itemY + 11;
                float progress = (float) ((ns.getDoubleValue() - ns.getMin()) / (ns.getMax() - ns.getMin()));
                DrawHelper.drawSlider(sliderX, sliderY, sliderW, 10, progress, getAccentColor(), 0xFFFFFFFF);

                if (smallFont != null) {
                    String valStr = String.format(Locale.ROOT, "%.1f", ns.getDoubleValue());
                    smallFont.drawString(valStr, sliderX - 30, itemY + 10, 0xFFA8ADB7);
                }
            } else if (setting instanceof ModeSetting) {
                ModeSetting ms = (ModeSetting) setting;
                float modeW = 84;
                float modeX = modalX + modalW - modeW - 20;
                float modeY = itemY + 6;
                boolean modeHover = mouseX >= modeX && mouseX <= modeX + modeW && mouseY >= modeY && mouseY <= modeY + 20;
                DrawHelper.drawRoundedRect(modeX, modeY, modeW, 20, 3.0f, modeHover ? 0xFF353C4C : 0xFF2C3240);
                if (smallFont != null) {
                    smallFont.drawCenteredString(ms.getValue(), modeX + modeW / 2.0f, modeY + 5, getAccentColor());
                }
            } else if (setting instanceof ColorSetting) {
                ColorSetting cs = (ColorSetting) setting;
                float colX = modalX + modalW - 60;
                float colY = itemY + 6;
                DrawHelper.drawRoundedRect(colX, colY, 40, 20, 3.0f, cs.getRgb());
                DrawHelper.drawOutline(colX, colY, 40, 20, 1.0f, 0xFFFFFFFF);
                if (smallFont != null) {
                    smallFont.drawCenteredString(cs.isChroma() ? "RGB" : "Cor", colX + 20, colY + 5, 0xFFFFFFFF);
                }
            } else if (setting instanceof KeybindSetting) {
                KeybindSetting ks = (KeybindSetting) setting;
                float kbW = 76;
                float kbX = modalX + modalW - kbW - 20;
                float kbY = itemY + 6;
                boolean listening = (listeningKeybind == ks);
                String kbText = listening ? "Pressione..." : ks.getKeyName();
                int btnCol = listening ? 0xFFE67E22 : 0xFF2C3240;
                DrawHelper.drawRoundedRect(kbX, kbY, kbW, 20, 3.0f, btnCol);
                if (smallFont != null) {
                    smallFont.drawCenteredString(kbText, kbX + kbW / 2.0f, kbY + 5, 0xFFFFFFFF);
                }
            }

            itemY += itemH + 5;
            if (itemY + itemH > modalY + modalH - 10) break;
        }
    }

    // =========================================================================
    // INPUT HANDLING
    // =========================================================================

    public void mouseClicked(int mouseX, int mouseY, int mouseButton) {
        float anim = openAnim.getFloatValue();
        if (anim <= 0.5f) return;

        // 0. If Color Picker is active, intercept clicks first
        if (activeColorPickerSetting != null) {
            handleColorPickerClick(mouseX, mouseY, mouseButton);
            return;
        }

        float dialogW = getDialogW();
        float dialogH = getDialogH();
        float dialogX = getDialogX();
        float dialogY = getDialogY();

        // 1. If Settings Modal is open, intercept input
        if (selectedModuleForOptions != null) {
            handleSettingsModalClick(dialogX, dialogY, dialogW, dialogH, mouseX, mouseY, mouseButton);
            return;
        }

        // Close Button [X]
        float closeX = dialogX + dialogW - 30;
        float closeY = dialogY + 12;
        if (mouseX >= closeX && mouseX <= closeX + 20 && mouseY >= closeY && mouseY <= closeY + 20) {
            if (MLUltimate.getInstance() != null) {
                MLUltimate.getInstance().setModMenuOpen(false);
            }
            onClose();
            return;
        }

        // Top Navigation Tabs
        float topBarH = 44;
        float tabsStartX = dialogX + Math.min(180.0f, dialogW * 0.32f);
        int tabW = Math.min(90, (int) ((dialogW - tabsStartX + dialogX - 50) / 3.0f));
        for (Tab tab : Tab.values()) {
            if (mouseX >= tabsStartX && mouseX <= tabsStartX + tabW && mouseY >= dialogY + 10 && mouseY <= dialogY + 34) {
                this.activeTab = tab;
                return;
            }
            tabsStartX += tabW + 6;
        }

        // Left Sidebar: Categories
        float sidebarW = getSidebarW();
        float sidebarX = dialogX;
        float sidebarY = dialogY + topBarH;
        float sidebarH = dialogH - topBarH;

        float profY = sidebarY + 8;
        float catY = profY + 30;

        // "TODOS"
        if (mouseX >= sidebarX + 8 && mouseX <= sidebarX + sidebarW - 8 && mouseY >= catY && mouseY <= catY + 20) {
            this.selectedCategory = null;
            this.activeTab = Tab.MODS;
            this.targetScroll = 0;
            return;
        }
        catY += 22;

        Category[] cats = new Category[] {
                Category.HUD, Category.COMBAT, Category.MOVEMENT, Category.VISUAL, Category.SERVER, Category.PERFORMANCE
        };

        for (Category cat : cats) {
            if (catY + 20 > sidebarY + sidebarH - 56) break;
            if (mouseX >= sidebarX + 8 && mouseX <= sidebarX + sidebarW - 8 && mouseY >= catY && mouseY <= catY + 20) {
                this.selectedCategory = cat;
                this.activeTab = Tab.MODS;
                this.targetScroll = 0;
                return;
            }
            catY += 20;
        }

        // Bottom Sidebar: EDIT HUD LAYOUT
        float bottomBtnY = sidebarY + sidebarH - 52;
        if (mouseX >= sidebarX + 8 && mouseX <= sidebarX + sidebarW - 8 && mouseY >= bottomBtnY && mouseY <= bottomBtnY + 20) {
            this.onClose();
            if (MLUltimate.getInstance() != null) {
                MLUltimate.getInstance().setModMenuOpen(false);
                MLUltimate.getInstance().setHudEditorOpen(true);
                MLUltimate.getInstance().getHudEditorScreen().init(width, height);
                try {
                    Mouse.setGrabbed(false);
                } catch (Throwable ignored) {
                }
            }
            return;
        }

        // Content Area Click Handling
        float contentX = sidebarX + sidebarW + 10;
        float contentY = sidebarY + 8;
        float contentW = dialogW - sidebarW - 18;
        float contentH = sidebarH - 16;

        if (activeTab == Tab.SETTINGS) {
            handleSettingsTabClick(contentX, contentY, contentW, contentH, mouseX, mouseY, mouseButton);
            return;
        }

        // Search Bar Click Focus
        float searchW = Math.min(160.0f, contentW * 0.45f);
        float searchH = 24;
        float searchX = contentX + contentW - searchW;
        float searchY = contentY;

        if (mouseX >= searchX && mouseX <= searchX + searchW && mouseY >= searchY && mouseY <= searchY + searchH) {
            this.searchFocused = true;
            return;
        } else {
            this.searchFocused = false;
        }

        // Cards Grid Interaction
        float gridY = contentY + 32;
        float gridH = contentH - 32;

        if (mouseX >= contentX && mouseX <= contentX + contentW && mouseY >= gridY && mouseY <= gridY + gridH) {
            List<Module> modules = getFilteredModules();
            int cols = contentW >= 380 ? 3 : (contentW >= 240 ? 2 : 1);
            float cardSpacing = 8.0f;
            float cardW = (contentW - (cardSpacing * (cols - 1))) / (float) cols;
            float cardH = 92.0f;

            for (int i = 0; i < modules.size(); i++) {
                Module module = modules.get(i);
                int col = i % cols;
                int row = i / cols;

                float cx = contentX + col * (cardW + cardSpacing);
                float cy = gridY + row * (cardH + cardSpacing) - scrollOffset;

                if (cy + cardH < gridY || cy > gridY + gridH) continue;

                // Clicked Toggle Switch on Top Right
                float swW = 32;
                float swH = 16;
                float swX = cx + cardW - swW - 8;
                float swY = cy + 10;
                if (mouseX >= swX - 4 && mouseX <= swX + swW + 4 && mouseY >= swY - 4 && mouseY <= swY + swH + 4) {
                    module.toggle();
                    return;
                }

                // Clicked anywhere on card or Options button
                if (mouseX >= cx && mouseX <= cx + cardW && mouseY >= cy && mouseY <= cy + cardH) {
                    this.selectedModuleForOptions = module;
                    return;
                }
            }
        }
    }

    private void handleSettingsTabClick(float contentX, float contentY, float contentW, float contentH,
                                        int mouseX, int mouseY, int mouseButton) {
        if (mouseX < contentX || mouseX > contentX + contentW || mouseY < contentY || mouseY > contentY + contentH) {
            return;
        }

        net.mlultimate.client.theme.ClientTheme theme = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme();
        float y = contentY - scrollOffset;
        y += 34; // past header

        // SECTION 1: PREDEFINIÇÕES DE TEMA (APP PRESETS)
        float sec1H = 166.0f;
        float presetStartY = y + 36;
        int pCols = contentW >= 320 ? 2 : 1;
        float pGap = 6.0f;
        float pW = (contentW - 20 - (pCols > 1 ? pGap : 0)) / (float) pCols;
        float pH = 26.0f;

        net.mlultimate.client.theme.ClientTheme.Preset[] presets = net.mlultimate.client.theme.ClientTheme.PRESETS;
        for (int i = 0; i < presets.length; i++) {
            net.mlultimate.client.theme.ClientTheme.Preset p = presets[i];
            int col = i % pCols;
            int row = i / pCols;
            float px = contentX + 10 + col * (pW + pGap);
            float py = presetStartY + row * (pH + pGap);

            if (mouseX >= px && mouseX <= px + pW && mouseY >= py && mouseY <= py + pH) {
                theme.applyPreset(p);
                if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getConfigManager() != null) {
                    MLUltimate.getInstance().getConfigManager().saveCoreConfig();
                }
                return;
            }
        }

        y += sec1H + 12;

        // SECTION 2: PERSONALIZAÇÃO INDIVIDUAL ("COR DE TUDO")
        ColorSetting[] tokens = new ColorSetting[] {
                theme.primaryColor,
                theme.backgroundColor,
                theme.cardColor,
                theme.topBarColor,
                theme.sidebarColor,
                theme.textColor,
                theme.mutedTextColor,
                theme.borderColor,
                theme.hudPillBg,
                theme.hudBorderColor
        };

        float tokenRowH = 24.0f;
        float tokenRowGap = 3.0f;
        float sec2H = 38.0f + tokens.length * (tokenRowH + tokenRowGap) + 6.0f;
        float tokenStartY = y + 36;
        for (int i = 0; i < tokens.length; i++) {
            ColorSetting cs = tokens[i];
            float ry = tokenStartY + i * (tokenRowH + tokenRowGap);

            // Click on row or swatch to open color picker
            if (mouseX >= contentX + 8 && mouseX <= contentX + contentW - 8 && mouseY >= ry && mouseY <= ry + tokenRowH) {
                this.activeColorPickerSetting = cs;
                return;
            }
        }

        y += sec2H + 12;

        // SECTION 3: AJUSTES DO HUD EM JOGO
        float hRowY = y + 26;
        float swW = 34;
        float swH = 16;
        float swX = contentX + contentW - swW - 12;
        if (mouseX >= swX && mouseX <= swX + swW && mouseY >= hRowY && mouseY <= hRowY + swH) {
            theme.hudBorderEnabled.toggle();
            theme.syncToHudManager();
            if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getConfigManager() != null) {
                MLUltimate.getInstance().getConfigManager().saveCoreConfig();
            }
            return;
        }

        float btnY = y + 50;
        float btnH = 24;
        if (mouseX >= contentX + 10 && mouseX <= contentX + contentW - 10 && mouseY >= btnY && mouseY <= btnY + btnH) {
            this.onClose();
            if (MLUltimate.getInstance() != null) {
                MLUltimate.getInstance().setModMenuOpen(false);
                MLUltimate.getInstance().setHudEditorOpen(true);
                MLUltimate.getInstance().getHudEditorScreen().init(width, height);
                try {
                    Mouse.setGrabbed(false);
                } catch (Throwable ignored) {
                }
            }
        }
    }

    private void handleColorPickerClick(int mouseX, int mouseY, int mouseButton) {
        float pickerW = 260.0f;
        float pickerH = 270.0f;
        float pickerX = (width - pickerW) / 2.0f;
        float pickerY = (height - pickerH) / 2.0f;

        // Close [X] button
        float closeBtnX = pickerX + pickerW - 24;
        float closeBtnY = pickerY + 8;
        if (mouseX >= closeBtnX && mouseX <= closeBtnX + 16 && mouseY >= closeBtnY && mouseY <= closeBtnY + 16) {
            this.activeColorPickerSetting = null;
            return;
        }

        float curY = pickerY + 34;
        curY += 28; // past preview

        // Preset Colors (10 dots)
        int[] presets = new int[]{
                0xFFFFFFFF, 0xFFFF3B30, 0xFFFF9500, 0xFFFFCC00, 0xFF34C759,
                0xFF00C7BE, 0xFF007AFF, 0xFFAF52DE, 0xFFFF2D55, 0xFF14171D
        };
        float swatchSize = 18.0f;
        float swatchGap = 4.0f;
        float startSwatchX = pickerX + 12;
        for (int i = 0; i < presets.length; i++) {
            float sx = startSwatchX + i * (swatchSize + swatchGap);
            float sy = curY;
            if (mouseX >= sx && mouseX <= sx + swatchSize && mouseY >= sy && mouseY <= sy + swatchSize) {
                activeColorPickerSetting.setValue(presets[i]);
                activeColorPickerSetting.setChroma(false);
                syncColorToHudManager();
                return;
            }
        }

        curY += 26;
        curY += 12; // past hue label

        // Hue Slider
        float barW = pickerW - 24;
        float barH = 10;
        if (mouseX >= pickerX + 12 && mouseX <= pickerX + 12 + barW && mouseY >= curY - 2 && mouseY <= curY + barH + 2) {
            this.draggingColorSlider = 1;
            updateHueFromMouse(pickerX + 12, barW, mouseX);
            return;
        }

        curY += 16;

        // RGBA Sliders
        float sliderX = pickerX + 12 + 18;
        float sliderW = barW - 18 - 32;

        // Red
        if (mouseX >= sliderX - 4 && mouseX <= sliderX + sliderW + 4 && mouseY >= curY - 2 && mouseY <= curY + 14) {
            this.draggingColorSlider = 2;
            updateRgbaFromMouse(2, sliderX, sliderW, mouseX);
            return;
        }
        curY += 15;

        // Green
        if (mouseX >= sliderX - 4 && mouseX <= sliderX + sliderW + 4 && mouseY >= curY - 2 && mouseY <= curY + 14) {
            this.draggingColorSlider = 3;
            updateRgbaFromMouse(3, sliderX, sliderW, mouseX);
            return;
        }
        curY += 15;

        // Blue
        if (mouseX >= sliderX - 4 && mouseX <= sliderX + sliderW + 4 && mouseY >= curY - 2 && mouseY <= curY + 14) {
            this.draggingColorSlider = 4;
            updateRgbaFromMouse(4, sliderX, sliderW, mouseX);
            return;
        }
        curY += 15;

        // Alpha
        if (mouseX >= sliderX - 4 && mouseX <= sliderX + sliderW + 4 && mouseY >= curY - 2 && mouseY <= curY + 14) {
            this.draggingColorSlider = 5;
            updateRgbaFromMouse(5, sliderX, sliderW, mouseX);
            return;
        }
        curY += 15;

        // RGB Chroma Mode Button
        float chromaBtnW = 110;
        float chromaBtnH = 20;
        float chromaBtnX = pickerX + 12;
        float chromaBtnY = curY + 2;
        if (mouseX >= chromaBtnX && mouseX <= chromaBtnX + chromaBtnW && mouseY >= chromaBtnY && mouseY <= chromaBtnY + chromaBtnH) {
            activeColorPickerSetting.setChroma(!activeColorPickerSetting.isChroma());
            return;
        }

        // Concluir Button
        float doneBtnW = 90;
        float doneBtnH = 20;
        float doneBtnX = pickerX + pickerW - doneBtnW - 12;
        float doneBtnY = curY + 2;
        if (mouseX >= doneBtnX && mouseX <= doneBtnX + doneBtnW && mouseY >= doneBtnY && mouseY <= doneBtnY + doneBtnH) {
            this.activeColorPickerSetting = null;
            return;
        }

        // Click outside picker dismisses it
        if (mouseX < pickerX || mouseX > pickerX + pickerW || mouseY < pickerY || mouseY > pickerY + pickerH) {
            this.activeColorPickerSetting = null;
        }
    }

    private void updateHueFromMouse(float barX, float barW, int mouseX) {
        if (activeColorPickerSetting == null) return;
        float prog = Math.max(0.0f, Math.min(1.0f, (mouseX - barX) / barW));
        int rgb = java.awt.Color.HSBtoRGB(prog, 0.85f, 1.0f);
        int alpha = activeColorPickerSetting.getAlpha();
        activeColorPickerSetting.setValue((alpha << 24) | (rgb & 0x00FFFFFF));
        activeColorPickerSetting.setChroma(false);
        syncColorToHudManager();
    }

    private void updateRgbaFromMouse(int channel, float sliderX, float sliderW, int mouseX) {
        if (activeColorPickerSetting == null) return;
        float prog = Math.max(0.0f, Math.min(1.0f, (mouseX - sliderX) / sliderW));
        int val = (int) (prog * 255.0f);

        int a = activeColorPickerSetting.getAlpha();
        int r = activeColorPickerSetting.getRed();
        int g = activeColorPickerSetting.getGreen();
        int b = activeColorPickerSetting.getBlue();

        if (channel == 2) r = val;
        else if (channel == 3) g = val;
        else if (channel == 4) b = val;
        else if (channel == 5) a = val;

        activeColorPickerSetting.setValue((a << 24) | (r << 16) | (g << 8) | b);
        activeColorPickerSetting.setChroma(false);
        syncColorToHudManager();
    }

    private void syncColorToHudManager() {
        net.mlultimate.client.theme.ThemeManager.getInstance().getTheme().syncToHudManager();
    }

    private void handleSettingsModalClick(float dialogX, float dialogY, float dialogW, float dialogH,
                                          int mouseX, int mouseY, int mouseButton) {
        float modalW = Math.min(380.0f, dialogW - 32.0f);
        float modalH = Math.min(320.0f, dialogH - 32.0f);
        float modalX = dialogX + (dialogW - modalW) / 2.0f;
        float modalY = dialogY + (dialogH - modalH) / 2.0f;

        // Close button [X]
        float closeBtnX = modalX + modalW - 28;
        float closeBtnY = modalY + 10;
        if (mouseX >= closeBtnX && mouseX <= closeBtnX + 20 && mouseY >= closeBtnY && mouseY <= closeBtnY + 20) {
            this.selectedModuleForOptions = null;
            this.listeningKeybind = null;
            return;
        }

        // Settings items
        float itemY = modalY + 48;
        for (Setting<?> setting : selectedModuleForOptions.getSettings()) {
            if (!setting.isVisible()) continue;
            float itemH = 32;

            if (setting instanceof BooleanSetting) {
                float swW = 34;
                float swH = 18;
                float swX = modalX + modalW - swW - 20;
                float swY = itemY + 7;
                if (mouseX >= swX && mouseX <= swX + swW && mouseY >= swY && mouseY <= swY + swH) {
                    ((BooleanSetting) setting).toggle();
                    return;
                }
            } else if (setting instanceof NumberSetting) {
                float sliderW = 90;
                float sliderX = modalX + modalW - sliderW - 20;
                float sliderY = itemY + 11;
                if (mouseX >= sliderX - 8 && mouseX <= sliderX + sliderW + 8 && mouseY >= sliderY - 4 && mouseY <= sliderY + 16) {
                    this.draggingSlider = setting;
                    updateSliderValue((NumberSetting) setting, sliderX, sliderW, mouseX);
                    return;
                }
            } else if (setting instanceof ModeSetting) {
                float modeW = 84;
                float modeX = modalX + modalW - modeW - 20;
                float modeY = itemY + 6;
                if (mouseX >= modeX && mouseX <= modeX + modeW && mouseY >= modeY && mouseY <= modeY + 20) {
                    ((ModeSetting) setting).cycle();
                    return;
                }
            } else if (setting instanceof ColorSetting) {
                float colX = modalX + modalW - 60;
                float colY = itemY + 6;
                if (mouseX >= colX && mouseX <= colX + 40 && mouseY >= colY && mouseY <= colY + 20) {
                    this.activeColorPickerSetting = (ColorSetting) setting;
                    return;
                }
            } else if (setting instanceof KeybindSetting) {
                float kbW = 76;
                float kbX = modalX + modalW - kbW - 20;
                float kbY = itemY + 6;
                if (mouseX >= kbX && mouseX <= kbX + kbW && mouseY >= kbY && mouseY <= kbY + 20) {
                    this.listeningKeybind = (KeybindSetting) setting;
                    return;
                }
            }

            itemY += itemH + 5;
        }

        // Click outside modal dismisses it
        if (mouseX < modalX || mouseX > modalX + modalW || mouseY < modalY || mouseY > modalY + modalH) {
            this.selectedModuleForOptions = null;
            this.listeningKeybind = null;
        }
    }

    public void mouseReleased(int mouseX, int mouseY, int state) {
        this.draggingSlider = null;
        this.draggingColorSlider = 0;
    }

    public void handleMouseInput() {
        int dWheel = Mouse.getDWheel();
        if (dWheel != 0 && activeColorPickerSetting == null) {
            if (dWheel > 0) {
                this.targetScroll -= 36;
            } else {
                this.targetScroll += 36;
            }
            if (this.targetScroll < 0) this.targetScroll = 0;
            if (this.targetScroll > this.maxScroll) this.targetScroll = this.maxScroll;
        }

        // Dragging Color Picker Sliders
        if (activeColorPickerSetting != null && draggingColorSlider > 0 && Mouse.isButtonDown(0)) {
            float pickerW = 260.0f;
            float pickerX = (width - pickerW) / 2.0f;
            int mouseX = (int) (Mouse.getX() * (double) width / Math.max(1, Display.getWidth()));

            if (draggingColorSlider == 1) {
                updateHueFromMouse(pickerX + 12, pickerW - 24, mouseX);
            } else {
                float sliderX = pickerX + 12 + 18;
                float sliderW = (pickerW - 24) - 18 - 32;
                updateRgbaFromMouse(draggingColorSlider, sliderX, sliderW, mouseX);
            }
            return;
        }

        if (draggingSlider instanceof NumberSetting && Mouse.isButtonDown(0)) {
            float dialogW = getDialogW();
            float modalW = Math.min(380.0f, dialogW - 32.0f);
            float modalX = getDialogX() + (dialogW - modalW) / 2.0f;
            float sliderW = 90;
            float sliderX = modalX + modalW - sliderW - 20;

            int mouseX = (int) (Mouse.getX() * (double) width / Math.max(1, Display.getWidth()));
            updateSliderValue((NumberSetting) draggingSlider, sliderX, sliderW, mouseX);
        }
    }

    private void updateSliderValue(NumberSetting ns, float sliderX, float sliderW, int mouseX) {
        float progress = Math.max(0.0f, Math.min(1.0f, (mouseX - sliderX) / sliderW));
        double val = ns.getMin() + (ns.getMax() - ns.getMin()) * progress;
        ns.setValue(val);
    }

    public void keyTyped(char typedChar, int keyCode) {
        // Color Picker close on ESC
        if (activeColorPickerSetting != null) {
            if (keyCode == Keyboard.KEY_ESCAPE) {
                this.activeColorPickerSetting = null;
                return;
            }
        }

        // 1. If listening for keybind remapping
        if (listeningKeybind != null) {
            if (keyCode == Keyboard.KEY_ESCAPE) {
                listeningKeybind.setKey(Keyboard.KEY_NONE);
            } else {
                listeningKeybind.setKey(keyCode);
            }
            this.listeningKeybind = null;
            return;
        }

        // Close on ESC
        if (keyCode == Keyboard.KEY_ESCAPE) {
            if (selectedModuleForOptions != null) {
                selectedModuleForOptions = null;
                return;
            }
            if (searchFocused) {
                searchFocused = false;
                return;
            }
            if (MLUltimate.getInstance() != null) {
                MLUltimate.getInstance().setModMenuOpen(false);
            }
            onClose();
            return;
        }

        // 2. Search typing
        if (searchFocused && activeTab == Tab.MODS) {
            if (keyCode == Keyboard.KEY_BACK) {
                if (!searchQuery.isEmpty()) {
                    searchQuery = searchQuery.substring(0, searchQuery.length() - 1);
                    targetScroll = 0;
                }
            } else if (keyCode == Keyboard.KEY_RETURN) {
                searchFocused = false;
            } else if (typedChar >= 32 && typedChar != 127) {
                searchQuery += typedChar;
                targetScroll = 0;
            }
        }
    }

    private List<Module> getFilteredModules() {
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getModuleManager() == null) {
            return Collections.emptyList();
        }

        List<Module> baseList;
        if (selectedCategory == null) {
            baseList = MLUltimate.getInstance().getModuleManager().getModules();
        } else {
            baseList = MLUltimate.getInstance().getModuleManager().getModulesByCategory(selectedCategory);
        }

        if (searchQuery == null || searchQuery.trim().isEmpty()) {
            return baseList;
        }

        String q = searchQuery.trim().toLowerCase(Locale.ROOT);
        List<Module> result = new ArrayList<>();
        for (Module m : baseList) {
            if (m.getName().toLowerCase(Locale.ROOT).contains(q)
                    || m.getDescription().toLowerCase(Locale.ROOT).contains(q)
                    || m.getId().toLowerCase(Locale.ROOT).contains(q)
                    || m.getCategory().getDisplayName().toLowerCase(Locale.ROOT).contains(q)) {
                result.add(m);
            }
        }
        return result;
    }

    private CustomFontRenderer getTitleFont() {
        return new CustomFontRenderer(1.25f);
    }

    private CustomFontRenderer getBoldFont() {
        return new CustomFontRenderer(1.0f);
    }

    private CustomFontRenderer getRegularFont() {
        return new CustomFontRenderer(1.0f);
    }

    private CustomFontRenderer getSmallFont() {
        return new CustomFontRenderer(0.85f);
    }

    private int getScaleFactor() {
        int scale = 1;
        int dW = Display.getWidth();
        int dH = Display.getHeight();
        while (scale < 1000 && dW / (scale + 1) >= 320 && dH / (scale + 1) >= 240) {
            scale++;
        }
        return scale;
    }

    public boolean isOpen() {
        return openAnim.getFloatValue() > 0.05f;
    }
}
