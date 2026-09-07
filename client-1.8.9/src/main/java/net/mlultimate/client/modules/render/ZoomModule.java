package net.mlultimate.client.modules.render;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.NumberSetting;
import org.lwjgl.input.Keyboard;

/**
 * Smooth optical zoom module for MLUltimate Client.
 */
public class ZoomModule extends Module {

    private final NumberSetting zoomFactorSetting;
    private final BooleanSetting smoothZoomSetting;
    private final BooleanSetting scrollZoomSetting;
    private boolean zooming = false;

    public ZoomModule() {
        super("zoom", "Zoom", "Aproximação suave da visão", Category.VISUAL, Keyboard.KEY_C);
        this.zoomFactorSetting = new NumberSetting("factor", "Fator de Zoom", "Multiplicador de proximidade", 4.0, 2.0, 10.0, 0.5);
        this.smoothZoomSetting = new BooleanSetting("smooth", "Transição Suave", "Animação cinematográfica de aproximação", true);
        this.scrollZoomSetting = new BooleanSetting("scroll", "Zoom por Scroll", "Ajusta aproximação pela roda do mouse", true);

        registerSetting(zoomFactorSetting);
        registerSetting(smoothZoomSetting);
        registerSetting(scrollZoomSetting);
        setEnabled(true);
    }

    private float currentZoomMultiplier = 1.0f;
    private long lastTime = System.currentTimeMillis();

    public float getActiveZoomFactor() {
        if (!isEnabled()) {
            currentZoomMultiplier = 1.0f;
            return 1.0f;
        }

        int key = getKeyBind();
        boolean keyHeld = (key != Keyboard.KEY_NONE) && Keyboard.isKeyDown(key);
        this.zooming = keyHeld;

        float target = keyHeld ? (float) zoomFactorSetting.getDoubleValue() : 1.0f;
        long now = System.currentTimeMillis();
        float dt = Math.min(0.1f, Math.max(0.001f, (now - lastTime) / 1000.0f));
        lastTime = now;

        if (smoothZoomSetting.isEnabled()) {
            currentZoomMultiplier += (target - currentZoomMultiplier) * Math.min(1.0f, dt * 16.0f);
        } else {
            currentZoomMultiplier = target;
        }

        return currentZoomMultiplier;
    }

    public boolean isZooming() {
        return zooming;
    }

    public void setZooming(boolean zooming) {
        this.zooming = zooming;
    }

    public double getZoomFactor() {
        return zoomFactorSetting.getDoubleValue();
    }

    public boolean isSmoothZoom() {
        return smoothZoomSetting.isEnabled();
    }

    public boolean isScrollZoom() {
        return scrollZoomSetting.isEnabled();
    }
}
