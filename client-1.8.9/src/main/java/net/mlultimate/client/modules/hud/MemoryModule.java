package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;

public class MemoryModule extends Module {

    private final BooleanSetting showPercentageSetting;

    public MemoryModule() {
        super("memory", "Memória RAM", "Monitoramento de uso de RAM e alocações", Category.HUD);
        this.showPercentageSetting = new BooleanSetting("percentage", "Percentual", "Exibir percentual de memória", true);
        registerSetting(showPercentageSetting);
        setEnabled(true);
    }

    public boolean isShowPercentage() {
        return showPercentageSetting.isEnabled();
    }
}
