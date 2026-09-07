package net.mlultimate.client.render;

import java.awt.Color;

/**
 * Color utility methods for UI rendering, chroma generation, and alpha manipulation.
 */
public class ColorUtils {

    public static int getChroma(float speed, int offset) {
        float hue = ((System.currentTimeMillis() + offset) % (int) (10000 / speed)) / (10000 / speed);
        return Color.HSBtoRGB(hue, 0.8f, 1.0f);
    }

    public static int rgba(int r, int g, int b, int a) {
        return ((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
    }

    public static int withAlpha(int rgb, int alpha) {
        return ((alpha & 0xFF) << 24) | (rgb & 0x00FFFFFF);
    }

    public static int interpolateColor(int color1, int color2, float factor) {
        factor = Math.max(0.0f, Math.min(1.0f, factor));

        int a1 = (color1 >> 24) & 0xFF;
        int r1 = (color1 >> 16) & 0xFF;
        int g1 = (color1 >> 8) & 0xFF;
        int b1 = color1 & 0xFF;

        int a2 = (color2 >> 24) & 0xFF;
        int r2 = (color2 >> 16) & 0xFF;
        int g2 = (color2 >> 8) & 0xFF;
        int b2 = color2 & 0xFF;

        int a = (int) (a1 + (a2 - a1) * factor);
        int r = (int) (r1 + (r2 - r1) * factor);
        int g = (int) (g1 + (g2 - g1) * factor);
        int b = (int) (b1 + (b2 - b1) * factor);
        return rgba(r, g, b, a);
    }

    public static int blend(int color1, int color2, float factor) {
        return interpolateColor(color1, color2, factor);
    }
}
