package net.mlultimate.client.modules.movement;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;

public class ToggleSneakModule extends Module {

    private final BooleanSetting showTextSetting;

    public ToggleSneakModule() {
        super("togglesneak", "Toggle Sneak", "Mantém o agachamento ativado sem segurar a tecla", Category.MOVEMENT);
        this.showTextSetting = new BooleanSetting("show_text", "Mostrar Indicador", "Exibir texto [Sneaking (Toggled)]", true);
        registerSetting(showTextSetting);
        setEnabled(false);
    }
}
