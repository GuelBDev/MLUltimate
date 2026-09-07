package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ColorSetting;
import net.mlultimate.client.module.setting.ModeSetting;
import net.mlultimate.client.module.setting.StringSetting;

public class FPSModule extends Module {

    private final StringSetting prefixSetting;
    private final BooleanSetting showMinMaxSetting;
    private final BooleanSetting backgroundSetting;
    private final ColorSetting textColorSetting;
    private final ModeSetting fontSetting;

    public FPSModule() {
        super("fps", "FPS", "Exibe a taxa atual de quadros por segundo", Category.HUD);
        this.prefixSetting = new StringSetting("prefix", "Prefixo", "Texto antes do valor", "FPS: ");
        this.showMinMaxSetting = new BooleanSetting("min_max", "Min/Max", "Exibir FPS mínimo e máximo", false);
        this.backgroundSetting = new BooleanSetting("background", "Fundo", "Desenhar caixa escura de fundo", true);
        this.textColorSetting = new ColorSetting("color", "Cor do Texto", "Cor do contador", 0xFFFFFFFF);
        this.fontSetting = new ModeSetting("font", "Fonte", "Estilo de fonte", "Padrão", "Padrão", "Moderna", "Compacta");

        registerSetting(prefixSetting);
        registerSetting(showMinMaxSetting);
        registerSetting(backgroundSetting);
        registerSetting(textColorSetting);
        registerSetting(fontSetting);
        setEnabled(true);
    }

    public String getPrefix() { return prefixSetting.getValue(); }
    public boolean isShowMinMax() { return showMinMaxSetting.isEnabled(); }
    public boolean hasBackground() { return backgroundSetting.isEnabled(); }
    public int getTextColor() { return textColorSetting.getRgb(); }
}
