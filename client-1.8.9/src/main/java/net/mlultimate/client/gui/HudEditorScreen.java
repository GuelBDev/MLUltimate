package net.mlultimate.client.gui;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.forge.MinecraftBridge;
import net.mlultimate.client.render.ColorUtils;
import net.mlultimate.client.render.DrawHelper;
import net.mlultimate.client.render.font.CustomFontRenderer;
import net.mlultimate.client.render.hud.HudElement;
import net.mlultimate.client.render.hud.HudManager;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;
import org.lwjgl.opengl.Display;

import java.util.List;

/**
 * Interactive In-Game HUD Layout Editor for MLUltimate Client.
 * Features:
 * - Real-time drag-and-drop repositioning
 * - Magnetic edge & center snapping
 * - Mouse wheel scaling per widget
 * - Subtle background grid
 * - Direct config synchronization
 */
public class HudEditorScreen {

    private int width = 800;
    private int height = 500;

    private boolean snappingEnabled = true;
    private HudElement selectedElement = null;

    private final CustomFontRenderer titleFont = new CustomFontRenderer(1.1f);
    private final CustomFontRenderer smallFont = new CustomFontRenderer(0.85f);
    private final CustomFontRenderer hintFont = new CustomFontRenderer(0.75f);

    public void init(int screenWidth, int screenHeight) {
        this.width = screenWidth;
        this.height = screenHeight;
        this.selectedElement = null;
        net.mlultimate.client.forge.MinecraftBridge.lockCamera();
    }

    public void onClose() {
        this.selectedElement = null;
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getConfigManager() != null) {
            MLUltimate.getInstance().getConfigManager().saveHudConfig();
        }
        if (MLUltimate.getInstance() == null || !MLUltimate.getInstance().isModMenuOpen()) {
            net.mlultimate.client.forge.MinecraftBridge.unlockCamera();
        }
    }

    public void drawScreen(int mouseX, int mouseY, float partialTicks, int screenWidth, int screenHeight) {
        this.width = screenWidth;
        this.height = screenHeight;

        // 1. Dimmer Backdrop (0x50000000)
        DrawHelper.drawRect(0, 0, width, height, 0x50000000);

        // 2. Subtle Alignment Grid
        if (snappingEnabled) {
            drawAlignmentGrid();
        }

        HudManager hudManager = MLUltimate.getInstance() != null ? MLUltimate.getInstance().getHudManager() : null;

        // 3. Update active drag
        if (hudManager != null) {
            for (HudElement el : hudManager.getElements()) {
                if (el.isDragging()) {
                    el.updateDrag(mouseX, mouseY, width, height, snappingEnabled);

                    // Draw center guide crosshairs if aligned
                    float cx = (width - el.getWidth()) / 2.0f;
                    if (Math.abs(el.getX() - cx) < 2.0f) {
                        DrawHelper.drawRect(width / 2.0f - 0.5f, 0, 1.0f, height, 0x8000E5FF);
                    }
                    float cy = (height - el.getHeight()) / 2.0f;
                    if (Math.abs(el.getY() - cy) < 2.0f) {
                        DrawHelper.drawRect(0, height / 2.0f - 0.5f, width, 1.0f, 0x8000E5FF);
                    }
                }
            }

            // 4. Render all HUD elements in edit mode
            hudManager.render(partialTicks, true);
        }

        // 5. Top Floating Toolbar
        renderTopToolbar(mouseX, mouseY);

        // 6. Bottom Helper Hint
        renderBottomHint();
    }

    private void drawAlignmentGrid() {
        int step = 32;
        int gridColor = 0x0DFFFFFF;

        for (int x = step; x < width; x += step) {
            DrawHelper.drawRect(x, 0, 1.0f, height, gridColor);
        }
        for (int y = step; y < height; y += step) {
            DrawHelper.drawRect(0, y, width, 1.0f, gridColor);
        }

        // Subtle center markers
        DrawHelper.drawRect(width / 2.0f - 0.5f, 0, 1.0f, height, 0x1A00E5FF);
        DrawHelper.drawRect(0, height / 2.0f - 0.5f, width, 1.0f, 0x1A00E5FF);
    }

    private void renderTopToolbar(int mouseX, int mouseY) {
        float barW = 380.0f;
        float barH = 34.0f;
        float barX = (width - barW) / 2.0f;
        float barY = 8.0f;

        DrawHelper.drawDropShadow(barX, barY, barW, barH, 10, 0x80000000);
        DrawHelper.drawRoundedRect(barX, barY, barW, barH, 6.0f, 0xEE14171F);
        DrawHelper.drawOutline(barX, barY, barW, barH, 1.0f, 0x403E485C);

        // Brand Logo & Title
        DrawHelper.drawLogo(barX + 8.0f, barY + 7.0f, 20.0f, 20.0f);
        if (titleFont != null) {
            titleFont.drawStringWithShadow("EDITOR DE HUD", barX + 34.0f, barY + 10.0f, 0xFF00E5FF);
        }

        // Action Buttons: [ Imã: On ] | [ Resetar ] | [ Sair (ESC) ]
        float btnY = barY + 6.0f;
        float btnH = 22.0f;

        // Snapping Button
        float snapW = 68.0f;
        float snapX = barX + 160.0f;
        boolean snapHover = mouseX >= snapX && mouseX <= snapX + snapW && mouseY >= btnY && mouseY <= btnY + btnH;
        int snapColor = snappingEnabled ? 0xFF2ECC71 : 0xFF3E485C;
        DrawHelper.drawRoundedRect(snapX, btnY, snapW, btnH, 3.0f, snapHover ? 0xFF2A303E : 0xFF1C202A);
        DrawHelper.drawOutline(snapX, btnY, snapW, btnH, 1.0f, snapColor);
        if (smallFont != null) {
            smallFont.drawCenteredString(snappingEnabled ? "Imã: SIM" : "Imã: NÃO", snapX + snapW / 2.0f, btnY + 6.0f, snapColor);
        }

        // Reset Button
        float resetW = 60.0f;
        float resetX = snapX + snapW + 6.0f;
        boolean resetHover = mouseX >= resetX && mouseX <= resetX + resetW && mouseY >= btnY && mouseY <= btnY + btnH;
        DrawHelper.drawRoundedRect(resetX, btnY, resetW, btnH, 3.0f, resetHover ? 0xFF353C4D : 0xFF1C202A);
        DrawHelper.drawOutline(resetX, btnY, resetW, btnH, 1.0f, 0x303E485C);
        if (smallFont != null) {
            smallFont.drawCenteredString("Resetar", resetX + resetW / 2.0f, btnY + 6.0f, 0xFFE0E6ED);
        }

        // Save & Exit Button
        float exitW = 64.0f;
        float exitX = resetX + resetW + 6.0f;
        boolean exitHover = mouseX >= exitX && mouseX <= exitX + exitW && mouseY >= btnY && mouseY <= btnY + btnH;
        DrawHelper.drawRoundedRect(exitX, btnY, exitW, btnH, 3.0f, exitHover ? 0xFF357ABD : 0xFF4A90E2);
        if (smallFont != null) {
            smallFont.drawCenteredString("Salvar", exitX + exitW / 2.0f, btnY + 6.0f, 0xFFFFFFFF);
        }
    }

    private void renderBottomHint() {
        String hint = "Arraste qualquer elemento • Scroll do mouse ajusta o tamanho (0.6x - 2.0x) • Pressione ESC para concluir";
        float hintW = hintFont != null ? hintFont.getStringWidth(hint) + 20.0f : 280.0f;
        float hintH = 16.0f;
        float hintX = (width - hintW) / 2.0f;
        float hintY = height - hintH - 8.0f;

        DrawHelper.drawRoundedRect(hintX, hintY, hintW, hintH, 4.0f, 0xCC11141B);
        DrawHelper.drawOutline(hintX, hintY, hintW, hintH, 1.0f, 0x303E485C);
        if (hintFont != null) {
            hintFont.drawCenteredString(hint, hintX + hintW / 2.0f, hintY + 4.0f, 0xFFA0AAB8);
        }
    }

    public void mouseClicked(int mouseX, int mouseY, int button) {
        float barW = 340.0f;
        float barH = 32.0f;
        float barX = (width - barW) / 2.0f;
        float barY = 8.0f;
        float btnY = barY + 5.0f;
        float btnH = 22.0f;

        // Snapping Button
        float snapW = 68.0f;
        float snapX = barX + 130.0f;
        if (mouseX >= snapX && mouseX <= snapX + snapW && mouseY >= btnY && mouseY <= btnY + btnH) {
            this.snappingEnabled = !this.snappingEnabled;
            return;
        }

        // Reset Button
        float resetW = 60.0f;
        float resetX = snapX + snapW + 6.0f;
        if (mouseX >= resetX && mouseX <= resetX + resetW && mouseY >= btnY && mouseY <= btnY + btnH) {
            if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getHudManager() != null) {
                MLUltimate.getInstance().getHudManager().resetAllPositions();
                if (MLUltimate.getInstance().getNotificationManager() != null) {
                    MLUltimate.getInstance().getNotificationManager().showInfo("Posições do HUD restauradas para o padrão.");
                }
            }
            return;
        }

        // Exit / Save Button
        float exitW = 64.0f;
        float exitX = resetX + resetW + 6.0f;
        if (mouseX >= exitX && mouseX <= exitX + exitW && mouseY >= btnY && mouseY <= btnY + btnH) {
            exitEditor();
            return;
        }

        // Element Selection and Dragging
        HudManager hudManager = MLUltimate.getInstance() != null ? MLUltimate.getInstance().getHudManager() : null;
        if (hudManager != null) {
            List<HudElement> list = hudManager.getElements();
            for (int i = list.size() - 1; i >= 0; i--) {
                HudElement el = list.get(i);
                if (el.isEnabled() && el.isHovered(mouseX, mouseY)) {
                    el.startDrag(mouseX, mouseY);
                    this.selectedElement = el;
                    return;
                }
            }
        }
        this.selectedElement = null;
    }

    public void mouseReleased(int mouseX, int mouseY, int button) {
        HudManager hudManager = MLUltimate.getInstance() != null ? MLUltimate.getInstance().getHudManager() : null;
        if (hudManager != null) {
            for (HudElement el : hudManager.getElements()) {
                if (el.isDragging()) {
                    el.stopDrag();
                    if (MLUltimate.getInstance().getConfigManager() != null) {
                        MLUltimate.getInstance().getConfigManager().saveHudConfig();
                    }
                }
            }
        }
    }

    public void handleMouseInput() {
        int dWheel = Mouse.getDWheel();
        if (dWheel != 0 && selectedElement != null) {
            float delta = dWheel > 0 ? 0.05f : -0.05f;
            selectedElement.setScale(selectedElement.getScale() + delta);
            if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getConfigManager() != null) {
                MLUltimate.getInstance().getConfigManager().saveHudConfig();
            }
        }
    }

    public void keyTyped(char typedChar, int keyCode) {
        if (keyCode == Keyboard.KEY_ESCAPE) {
            exitEditor();
        }
    }

    private void exitEditor() {
        onClose();
        if (MLUltimate.getInstance() != null) {
            MLUltimate.getInstance().setHudEditorOpen(false);
            MLUltimate.getInstance().setModMenuOpen(true);
            MLUltimate.getInstance().getModMenuScreen().init(width, height);
            try {
                Mouse.setGrabbed(false);
            } catch (Throwable ignored) {
            }
            if (MLUltimate.getInstance().getNotificationManager() != null) {
                MLUltimate.getInstance().getNotificationManager().showSuccess("Layout do HUD salvo com sucesso!");
            }
        }
    }
}
