package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ModeSetting;

public class ClockModule extends Module {

    private final ModeSetting formatSetting;
    private final BooleanSetting showSecondsSetting;

    public ClockModule() {
        super("clock", "Relógio", "Mostra a hora real no HUD", Category.HUD);
        this.formatSetting = new ModeSetting("format", "Formato", "Padrão de exibição", "24h", "24h", "12h");
        this.showSecondsSetting = new BooleanSetting("seconds", "Segundos", "Exibir segundos no relógio", true);

        registerSetting(formatSetting);
        registerSetting(showSecondsSetting);
        setEnabled(true);
    }

    public String getFormat() {
        return formatSetting.getValue();
    }

    public boolean isShowSeconds() {
        return showSecondsSetting.isEnabled();
    }
}
