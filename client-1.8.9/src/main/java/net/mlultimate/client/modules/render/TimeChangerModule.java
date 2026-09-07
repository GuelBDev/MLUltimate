package net.mlultimate.client.modules.render;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.ModeSetting;
import net.mlultimate.client.module.setting.NumberSetting;

public class TimeChangerModule extends Module {

    private final ModeSetting presetSetting;
    private final NumberSetting customTimeSetting;

    public TimeChangerModule() {
        super("time_changer", "Alterador de Tempo", "Muda o horário do dia apenas visualmente no client", Category.VISUAL);
        this.presetSetting = new ModeSetting("preset", "Horário", "Período do dia", "Dia", "Dia", "Meio-Dia", "Pôr do Sol", "Noite", "Customizado");
        this.customTimeSetting = new NumberSetting("custom_time", "Tempo Personalizado", "Hora em ticks (0 - 24000)", 6000.0, 0.0, 24000.0, 1000.0);

        registerSetting(presetSetting);
        registerSetting(customTimeSetting);
        setEnabled(false);
    }
}
