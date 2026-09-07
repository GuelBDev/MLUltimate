package net.mlultimate.client.module.setting;

import java.awt.Color;

public class ColorSetting extends Setting<Integer> {

    private boolean chroma = false;
    private float chromaSpeed = 2.0f;

    public ColorSetting(String id, String name, String description, int defaultRgba) {
        super(id, name, description, defaultRgba);
    }

    public int getRgb() {
        if (chroma) {
            float hue = (System.currentTimeMillis() % (int)(10000 / chromaSpeed)) / (10000 / chromaSpeed);
            int rgb = Color.HSBtoRGB(hue, 0.8f, 1.0f);
            int alpha = (value >> 24) & 0xFF;
            return (alpha << 24) | (rgb & 0x00FFFFFF);
        }
        return getValue();
    }

    public boolean isChroma() {
        return chroma;
    }

    public void setChroma(boolean chroma) {
        this.chroma = chroma;
    }

    public float getChromaSpeed() {
        return chromaSpeed;
    }

    public void setChromaSpeed(float chromaSpeed) {
        this.chromaSpeed = chromaSpeed;
    }

    public int getRed() {
        return (getValue() >> 16) & 0xFF;
    }

    public int getGreen() {
        return (getValue() >> 8) & 0xFF;
    }

    public int getBlue() {
        return getValue() & 0xFF;
    }

    public int getAlpha() {
        return (getValue() >> 24) & 0xFF;
    }
}
