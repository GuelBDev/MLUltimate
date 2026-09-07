package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ColorSetting;

public class CoordinatesModule extends Module {

    private final BooleanSetting showBiomeSetting;
    private final BooleanSetting showDirectionSetting;
    private final ColorSetting textColorSetting;

    public CoordinatesModule() {
        super("coordinates", "Coordenadas", "Exibe X, Y, Z, Direção e Bioma atual", Category.HUD);
        this.showBiomeSetting = new BooleanSetting("show_biome", "Mostrar Bioma", "Exibe nome do bioma", true);
        this.showDirectionSetting = new BooleanSetting("show_direction", "Mostrar Direção", "Exibe direção cardeal (Norte, Sul, etc.)", true);
        this.textColorSetting = new ColorSetting("color", "Cor do Texto", "Cor dos valores", 0xFFFFFFFF);

        registerSetting(showBiomeSetting);
        registerSetting(showDirectionSetting);
        registerSetting(textColorSetting);
        setEnabled(true);
    }

    public boolean isShowBiome() { return showBiomeSetting.isEnabled(); }
    public boolean isShowDirection() { return showDirectionSetting.isEnabled(); }
    public int getTextColor() { return textColorSetting.getRgb(); }
}
