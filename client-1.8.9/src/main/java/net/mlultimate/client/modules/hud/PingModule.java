package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ColorSetting;

public class PingModule extends Module {

    private final BooleanSetting dynamicColorSetting;
    private final ColorSetting textColorSetting;

    public PingModule() {
        super("ping", "Ping", "Exibe a latência atual com o servidor em ms", Category.HUD);
        this.dynamicColorSetting = new BooleanSetting("dynamic_color", "Cor Dinâmica", "Muda cor de verde para vermelho dependendo do ms", true);
        this.textColorSetting = new ColorSetting("color", "Cor do Texto", "Cor padrão do ping", 0xFF2ECC71);

        registerSetting(dynamicColorSetting);
        registerSetting(textColorSetting);
        setEnabled(true);
    }

    public boolean isDynamicColor() { return dynamicColorSetting.isEnabled(); }
    public int getTextColor() { return textColorSetting.getRgb(); }
}
