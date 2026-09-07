package net.mlultimate.client.modules.movement;

import net.mlultimate.client.event.Subscribe;
import net.mlultimate.client.event.events.ClientTickEvent;
import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.StringSetting;

/**
 * ToggleSprint module automatically maintains sprinting without holding the sprint key.
 */
public class ToggleSprintModule extends Module {

    private final BooleanSetting showTextSetting;
    private final StringSetting customTextSetting;

    public ToggleSprintModule() {
        super("togglesprint", "Toggle Sprint", "Mantém a corrida ativada automaticamente", Category.MOVEMENT);
        this.showTextSetting = new BooleanSetting("show_text", "Mostrar Indicador", "Exibir texto [Sprinting (Toggled)] na tela", true);
        this.customTextSetting = new StringSetting("text", "Texto Customizado", "Texto exibido no HUD", "[Correndo (Ativado)]");

        registerSetting(showTextSetting);
        registerSetting(customTextSetting);
        setEnabled(true);
    }

    @Override
    public void onTick() {
        if (!isEnabled()) return;
        if (net.mlultimate.client.forge.MinecraftBridge.getPlayer() != null) {
            if (net.mlultimate.client.forge.MinecraftBridge.isMovingForward()) {
                net.mlultimate.client.forge.MinecraftBridge.setPlayerSprinting(true);
            }
        }
    }

    public boolean isShowText() {
        return showTextSetting.isEnabled();
    }

    public String getText() {
        return customTextSetting.getValue();
    }
}
