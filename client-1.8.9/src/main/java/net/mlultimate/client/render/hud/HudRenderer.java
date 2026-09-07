package net.mlultimate.client.render.hud;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.forge.MinecraftBridge;
import net.mlultimate.client.modules.combat.CrosshairModule;
import net.mlultimate.client.modules.hud.*;
import net.mlultimate.client.render.ColorUtils;
import net.mlultimate.client.render.DrawHelper;
import net.mlultimate.client.render.font.CustomFontRenderer;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;
import org.lwjgl.opengl.GL11;

import java.util.List;
import java.util.Locale;

/**
 * Modern Responsive HUD Renderer for MLUltimate Client.
 * Dynamically scales, aligns and renders all active HUD modules (FPS, CPS, Ping, Coords,
 * Keystrokes, ArmorStatus, PotionEffects, Custom Crosshair) with clean semi-transparent pill backdrops.
 */
public class HudRenderer {

    private final CustomFontRenderer font = new CustomFontRenderer(1.0f);
    private final CustomFontRenderer smallFont = new CustomFontRenderer(0.85f);

    public void render(int scaledWidth, int scaledHeight, float partialTicks) {
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getModuleManager() == null) {
            return;
        }

        // 1. Top-Left Cluster (FPS, CPS, Ping, Coordinates)
        renderTopLeftCluster(scaledWidth, scaledHeight);

        // 2. Keystrokes Widget (Middle-Left)
        renderKeystrokes(scaledWidth, scaledHeight);

        // 3. Armor Status Widget (Bottom-Left)
        renderArmorStatus(scaledWidth, scaledHeight);

        // 4. Potion Effects (Top-Right)
        renderPotionEffects(scaledWidth, scaledHeight);

        // 5. Custom Crosshair (Screen Center)
        renderCrosshair(scaledWidth, scaledHeight);
    }

    private void renderTopLeftCluster(int sw, int sh) {
        float x = 6.0f;
        float y = 6.0f;
        float pillH = 16.0f;
        float spacing = 3.0f;

        // FPS Module
        FPSModule fpsMod = MLUltimate.getInstance().getModuleManager().getModuleByClass(FPSModule.class);
        if (fpsMod != null && fpsMod.isEnabled()) {
            int fps = MinecraftBridge.getFps();
            String text = fpsMod.getPrefix() + fps;
            float textW = font.getStringWidth(text);
            float pillW = textW + 10.0f;

            renderPill(x, y, pillW, pillH, 0xB014171D);
            font.drawStringWithShadow(text, x + 5.0f, y + 4.0f, fpsMod.getTextColor());
            y += pillH + spacing;
        }

        // CPS Module
        CPSModule cpsMod = MLUltimate.getInstance().getModuleManager().getModuleByClass(CPSModule.class);
        if (cpsMod != null && cpsMod.isEnabled()) {
            int lmb = cpsMod.getLmbCps();
            int rmb = cpsMod.getRmbCps();
            String text = cpsMod.isShowRmb() ? ("CPS: " + lmb + " | " + rmb) : ("CPS: " + lmb);
            float textW = font.getStringWidth(text);
            float pillW = textW + 10.0f;

            renderPill(x, y, pillW, pillH, 0xB014171D);
            font.drawStringWithShadow(text, x + 5.0f, y + 4.0f, cpsMod.getTextColor());
            y += pillH + spacing;
        }

        // Ping Module
        PingModule pingMod = MLUltimate.getInstance().getModuleManager().getModuleByClass(PingModule.class);
        if (pingMod != null && pingMod.isEnabled()) {
            int ping = MinecraftBridge.getPing();
            String text = "Ping: " + ping + "ms";
            float textW = font.getStringWidth(text);
            float pillW = textW + 10.0f;

            int col = pingMod.getTextColor();
            if (pingMod.isDynamicColor()) {
                if (ping <= 60) col = 0xFF2ECC71;
                else if (ping <= 120) col = 0xFFF39C12;
                else col = 0xFFE74C3C;
            }

            renderPill(x, y, pillW, pillH, 0xB014171D);
            font.drawStringWithShadow(text, x + 5.0f, y + 4.0f, col);
            y += pillH + spacing;
        }

        // Coordinates Module
        CoordinatesModule coordsMod = MLUltimate.getInstance().getModuleManager().getModuleByClass(CoordinatesModule.class);
        if (coordsMod != null && coordsMod.isEnabled()) {
            int posX = (int) Math.floor(MinecraftBridge.getPlayerX());
            int posY = (int) Math.floor(MinecraftBridge.getPlayerY());
            int posZ = (int) Math.floor(MinecraftBridge.getPlayerZ());
            String text = String.format(Locale.ROOT, "XYZ: %d, %d, %d", posX, posY, posZ);
            float textW = font.getStringWidth(text);
            float pillW = textW + 10.0f;

            renderPill(x, y, pillW, pillH, 0xB014171D);
            font.drawStringWithShadow(text, x + 5.0f, y + 4.0f, coordsMod.getTextColor());
        }
    }

    private void renderKeystrokes(int sw, int sh) {
        KeystrokesModule mod = MLUltimate.getInstance().getModuleManager().getModuleByClass(KeystrokesModule.class);
        if (mod == null || !mod.isEnabled()) return;

        float kx = 6.0f;
        float ky = 76.0f;
        float keySize = 20.0f;
        float keyGap = 2.0f;

        boolean wDown = isKeyDown(Keyboard.KEY_W);
        boolean aDown = isKeyDown(Keyboard.KEY_A);
        boolean sDown = isKeyDown(Keyboard.KEY_S);
        boolean dDown = isKeyDown(Keyboard.KEY_D);

        int textCol = mod.getTextColor();
        int pressedBg = mod.getPressedColor();
        int normalBg = 0xB014171D;

        // W key
        renderKeyBox(kx + keySize + keyGap, ky, keySize, keySize, "W", wDown, normalBg, pressedBg, textCol);

        // A, S, D keys
        float row2Y = ky + keySize + keyGap;
        renderKeyBox(kx, row2Y, keySize, keySize, "A", aDown, normalBg, pressedBg, textCol);
        renderKeyBox(kx + keySize + keyGap, row2Y, keySize, keySize, "S", sDown, normalBg, pressedBg, textCol);
        renderKeyBox(kx + (keySize + keyGap) * 2, row2Y, keySize, keySize, "D", dDown, normalBg, pressedBg, textCol);

        float nextY = row2Y + keySize + keyGap;

        // Mouse buttons (LMB & RMB)
        if (mod.isShowMouseButtons()) {
            float mouseBtnW = (keySize * 3 + keyGap * 2 - keyGap) / 2.0f;
            float mouseBtnH = 16.0f;
            boolean lmbDown = Mouse.isButtonDown(0);
            boolean rmbDown = Mouse.isButtonDown(1);

            renderKeyBox(kx, nextY, mouseBtnW, mouseBtnH, "LMB", lmbDown, normalBg, pressedBg, textCol);
            renderKeyBox(kx + mouseBtnW + keyGap, nextY, mouseBtnW, mouseBtnH, "RMB", rmbDown, normalBg, pressedBg, textCol);
            nextY += mouseBtnH + keyGap;
        }

        // Spacebar
        if (mod.isShowSpacebar()) {
            float spaceW = keySize * 3 + keyGap * 2;
            float spaceH = 10.0f;
            boolean spaceDown = isKeyDown(Keyboard.KEY_SPACE);
            renderKeyBox(kx, nextY, spaceW, spaceH, "—", spaceDown, normalBg, pressedBg, textCol);
        }
    }

    private void renderKeyBox(float x, float y, float w, float h, String label, boolean pressed, int normalBg, int pressedBg, int textColor) {
        int bg = pressed ? pressedBg : normalBg;
        DrawHelper.drawRoundedRect(x, y, w, h, 3.0f, bg);
        DrawHelper.drawOutline(x, y, w, h, 1.0f, pressed ? 0x804A90E2 : 0x302E3544);

        int textC = pressed ? 0xFFFFFFFF : textColor;
        if (smallFont != null) {
            smallFont.drawCenteredString(label, x + w / 2.0f, y + (h - 8.0f) / 2.0f, textC);
        }
    }

    private void renderArmorStatus(int sw, int sh) {
        ArmorStatusModule mod = MLUltimate.getInstance().getModuleManager().getModuleByClass(ArmorStatusModule.class);
        if (mod == null || !mod.isEnabled()) return;

        MinecraftBridge.ArmorInfo[] armors = MinecraftBridge.getArmorInfo();
        float x = 6.0f;
        float y = sh - 68.0f;
        float slotH = 14.0f;
        float spacing = 2.0f;

        // Display in order: Helmet (slot 3), Chest (2), Legs (1), Boots (0)
        for (int i = 3; i >= 0; i--) {
            MinecraftBridge.ArmorInfo info = armors[i];
            if (info == null || !info.present) continue;

            String label = getArmorSlotName(i) + ": " + info.damagePercent + "%";
            float textW = smallFont.getStringWidth(label);
            float pillW = textW + 8.0f;

            int col = 0xFF2ECC71;
            if (info.damagePercent <= 25) col = 0xFFE74C3C;
            else if (info.damagePercent <= 50) col = 0xFFF39C12;

            renderPill(x, y, pillW, slotH, 0xB014171D);
            smallFont.drawStringWithShadow(label, x + 4.0f, y + 3.0f, col);
            y += slotH + spacing;
        }
    }

    private String getArmorSlotName(int slot) {
        switch (slot) {
            case 3: return "Cap";
            case 2: return "Peit";
            case 1: return "Calç";
            case 0: return "Bota";
            default: return "Arm";
        }
    }

    private void renderPotionEffects(int sw, int sh) {
        PotionEffectsModule mod = MLUltimate.getInstance().getModuleManager().getModuleByClass(PotionEffectsModule.class);
        if (mod == null || !mod.isEnabled()) return;

        List<MinecraftBridge.PotionInfo> list = MinecraftBridge.getPotionEffects();
        if (list.isEmpty()) return;

        float y = 6.0f;
        float pillH = 15.0f;
        float spacing = 3.0f;

        for (MinecraftBridge.PotionInfo p : list) {
            String durStr = formatTime(p.durationSeconds);
            String label = p.name;
            if (mod.isShowAmplifier() && p.amplifier > 0) {
                label += " " + (p.amplifier + 1);
            }
            if (mod.isShowDuration()) {
                label += " (" + durStr + ")";
            }

            float textW = font.getStringWidth(label);
            float pillW = textW + 10.0f;
            float x = sw - pillW - 6.0f;

            renderPill(x, y, pillW, pillH, 0xB014171D);
            font.drawStringWithShadow(label, x + 5.0f, y + 4.0f, 0xFFFFFFFF);
            y += pillH + spacing;
        }
    }

    public void renderCrosshair(int sw, int sh) {
        CrosshairModule mod = MLUltimate.getInstance().getModuleManager().getModuleByClass(CrosshairModule.class);
        if (mod == null || !mod.isEnabled()) return;
        if (MinecraftBridge.getThirdPersonView() != 0) return;
        if (MinecraftBridge.isCurrentScreenOpen()) return;

        float cx = sw / 2.0f;
        float cy = sh / 2.0f;
        String shape = mod.getShape();
        float size = (float) mod.getSize();
        float gap = (float) mod.getGap();
        float thickness = (float) mod.getThickness();
        int color = mod.getColor();
        boolean outline = mod.isOutline();
        int outlineColor = mod.getOutlineColor();
        boolean hasDot = mod.hasDot();
        float dotSize = (float) mod.getDotSize();

        GL11.glPushMatrix();
        if (mod.isVanillaBlend()) {
            MinecraftBridge.enableBlend();
            GL11.glBlendFunc(GL11.GL_ONE_MINUS_DST_COLOR, GL11.GL_ONE_MINUS_SRC_COLOR);
        }

        switch (shape) {
            case "Ponto":
                // Handled in dot rendering below
                break;

            case "Círculo":
            case "Círculo com Ponto": {
                float rad = gap + size;
                if (outline) {
                    DrawHelper.drawCircle(cx, cy, rad + thickness / 2.0f + 0.8f, outlineColor);
                }
                DrawHelper.drawCircle(cx, cy, rad + thickness / 2.0f, color);
                DrawHelper.drawCircle(cx, cy, Math.max(0.0f, rad - thickness / 2.0f), 0x00000000);
                break;
            }

            case "Quadrado": {
                float boxSize = (gap + size) * 2.0f;
                float bx = cx - boxSize / 2.0f;
                float by = cy - boxSize / 2.0f;
                if (outline) {
                    DrawHelper.drawOutline(bx - 0.8f, by - 0.8f, boxSize + 1.6f, boxSize + 1.6f, thickness + 1.6f, outlineColor);
                }
                DrawHelper.drawOutline(bx, by, boxSize, boxSize, thickness, color);
                break;
            }

            case "Forma T": {
                // T-Shape: Bottom, Left, Right (no top)
                if (outline) {
                    DrawHelper.drawRect(cx - thickness / 2.0f - 0.8f, cy + gap - 0.8f, thickness + 1.6f, size + 1.6f, outlineColor);
                    DrawHelper.drawRect(cx - gap - size - 0.8f, cy - thickness / 2.0f - 0.8f, size + 1.6f, thickness + 1.6f, outlineColor);
                    DrawHelper.drawRect(cx + gap - 0.8f, cy - thickness / 2.0f - 0.8f, size + 1.6f, thickness + 1.6f, outlineColor);
                }
                DrawHelper.drawRect(cx - thickness / 2.0f, cy + gap, thickness, size, color);
                DrawHelper.drawRect(cx - gap - size, cy - thickness / 2.0f, size, thickness, color);
                DrawHelper.drawRect(cx + gap, cy - thickness / 2.0f, size, thickness, color);
                break;
            }

            case "Seta": {
                // Chevron Arrow ^
                float arrowW = size;
                float arrowH = size;
                if (outline) {
                    DrawHelper.drawRect(cx - arrowW - 0.8f, cy + arrowH / 2.0f - 0.8f, thickness + 1.6f, arrowH + 1.6f, outlineColor);
                    DrawHelper.drawRect(cx + arrowW - thickness - 0.8f, cy + arrowH / 2.0f - 0.8f, thickness + 1.6f, arrowH + 1.6f, outlineColor);
                }
                DrawHelper.drawRect(cx - thickness / 2.0f, cy - gap - arrowH, thickness, arrowH, color);
                DrawHelper.drawRect(cx - arrowW, cy - gap - thickness / 2.0f, arrowW * 2.0f, thickness, color);
                break;
            }

            case "Cruz (Padrão)":
            case "Cruz com Ponto":
            default: {
                // Vanilla-style crosshair (+), default identical to Minecraft
                if (outline) {
                    DrawHelper.drawRect(cx - thickness / 2.0f - 0.8f, cy - gap - size - 0.8f, thickness + 1.6f, size + 1.6f, outlineColor);
                    DrawHelper.drawRect(cx - thickness / 2.0f - 0.8f, cy + gap - 0.8f, thickness + 1.6f, size + 1.6f, outlineColor);
                    DrawHelper.drawRect(cx - gap - size - 0.8f, cy - thickness / 2.0f - 0.8f, size + 1.6f, thickness + 1.6f, outlineColor);
                    DrawHelper.drawRect(cx + gap - 0.8f, cy - thickness / 2.0f - 0.8f, size + 1.6f, thickness + 1.6f, outlineColor);
                }
                // Top
                DrawHelper.drawRect(cx - thickness / 2.0f, cy - gap - size, thickness, size, color);
                // Bottom
                DrawHelper.drawRect(cx - thickness / 2.0f, cy + gap, thickness, size, color);
                // Left
                DrawHelper.drawRect(cx - gap - size, cy - thickness / 2.0f, size, thickness, color);
                // Right
                DrawHelper.drawRect(cx + gap, cy - thickness / 2.0f, size, thickness, color);
                break;
            }
        }

        // Center Dot if requested
        if (hasDot) {
            if (outline) {
                DrawHelper.drawRect(cx - dotSize / 2.0f - 0.8f, cy - dotSize / 2.0f - 0.8f, dotSize + 1.6f, dotSize + 1.6f, outlineColor);
            }
            DrawHelper.drawRect(cx - dotSize / 2.0f, cy - dotSize / 2.0f, dotSize, dotSize, color);
        }

        if (mod.isVanillaBlend()) {
            MinecraftBridge.tryBlendFuncSeparate(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA, 1, 0);
        }
        GL11.glPopMatrix();
    }

    private void renderPill(float x, float y, float w, float h, int color) {
        DrawHelper.drawRoundedRect(x, y, w, h, 4.0f, color);
        DrawHelper.drawOutline(x, y, w, h, 1.0f, 0x402A303D);
    }

    private String formatTime(int seconds) {
        int m = seconds / 60;
        int s = seconds % 60;
        return String.format(Locale.ROOT, "%02d:%02d", m, s);
    }

    private boolean isKeyDown(int key) {
        try {
            return Keyboard.isKeyDown(key);
        } catch (Throwable t) {
            return false;
        }
    }
}
