package net.mlultimate.client.modules.render;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.NumberSetting;

/**
 * Fullbright module providing high ambient gamma without altering server-side lighting.
 */
public class FullbrightModule extends Module {

    private final NumberSetting brightnessSetting;
    private float previousGamma = 1.0f;

    public FullbrightModule() {
        super("fullbright", "Fullbright", "Iluminação clara em ambientes escuros e cavernas", Category.VISUAL);
        this.brightnessSetting = new NumberSetting("gamma", "Brilho", "Nível de gamma aplicado", 10.0, 1.0, 15.0, 0.5);
        registerSetting(brightnessSetting);
    }

    @Override
    public void onEnable() {
        this.previousGamma = net.mlultimate.client.forge.MinecraftBridge.getGamma();
        net.mlultimate.client.forge.MinecraftBridge.setGamma(brightnessSetting.getFloatValue());
    }

    @Override
    public void onDisable() {
        net.mlultimate.client.forge.MinecraftBridge.setGamma(previousGamma > 0.0f ? previousGamma : 1.0f);
    }

    @Override
    public void onTick() {
        if (isEnabled()) {
            net.mlultimate.client.forge.MinecraftBridge.setGamma(brightnessSetting.getFloatValue());
        }
    }

    public float getGamma() {
        return brightnessSetting.getFloatValue();
    }
}
