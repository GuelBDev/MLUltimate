package net.mlultimate.client.render.font;

import net.mlultimate.client.forge.MinecraftBridge;
import org.lwjgl.opengl.GL11;

import java.awt.Font;

/**
 * High-performance Font Renderer wrapping Minecraft 1.8.9 native font engine.
 * Supports scaling, drop shadows, color formatting (§) and centered drawing.
 */
public class CustomFontRenderer {

    private final float scale;

    public CustomFontRenderer(Font font, boolean antiAlias, boolean fractionalMetrics) {
        float s = 1.0f;
        if (font != null) {
            int size = font.getSize();
            if (size >= 22) s = 1.25f;
            else if (size <= 14) s = 0.85f;
            else s = 1.0f;
        }
        this.scale = s;
    }

    public CustomFontRenderer(float scale) {
        this.scale = scale;
    }

    public float drawString(String text, float x, float y, int color) {
        if (text == null || text.isEmpty()) return 0;
        MinecraftBridge.enableTexture2D();
        MinecraftBridge.enableAlpha();
        MinecraftBridge.enableBlend();
        MinecraftBridge.bindFontTexture();
        if (Math.abs(scale - 1.0f) > 0.01f) {
            GL11.glPushMatrix();
            GL11.glTranslatef(x, y, 0);
            GL11.glScalef(scale, scale, 1.0f);
            MinecraftBridge.drawString(text, 0, 0, color);
            GL11.glPopMatrix();
            return x + getStringWidth(text);
        }
        return MinecraftBridge.drawString(text, x, y, color);
    }

    public float drawStringWithShadow(String text, float x, float y, int color) {
        if (text == null || text.isEmpty()) return 0;
        MinecraftBridge.enableTexture2D();
        MinecraftBridge.enableAlpha();
        MinecraftBridge.enableBlend();
        MinecraftBridge.bindFontTexture();
        if (Math.abs(scale - 1.0f) > 0.01f) {
            GL11.glPushMatrix();
            GL11.glTranslatef(x, y, 0);
            GL11.glScalef(scale, scale, 1.0f);
            MinecraftBridge.drawStringWithShadow(text, 0, 0, color);
            GL11.glPopMatrix();
            return x + getStringWidth(text);
        }
        return MinecraftBridge.drawStringWithShadow(text, x, y, color);
    }

    public float drawCenteredString(String text, float x, float y, int color) {
        return drawString(text, x - (getStringWidth(text) / 2.0f), y, color);
    }

    public float drawCenteredStringWithShadow(String text, float x, float y, int color) {
        return drawStringWithShadow(text, x - (getStringWidth(text) / 2.0f), y, color);
    }

    public int getStringWidth(String text) {
        if (text == null || text.isEmpty()) return 0;
        int w = MinecraftBridge.getStringWidth(text);
        return Math.round(w * scale);
    }

    public int getFontHeight() {
        return Math.round(MinecraftBridge.getFontHeight() * scale);
    }
}
