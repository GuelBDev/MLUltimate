package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ModeSetting;

public class PotionEffectsModule extends Module {

    private final BooleanSetting showDurationSetting;
    private final BooleanSetting showAmplifierSetting;
    private final ModeSetting styleSetting;

    public PotionEffectsModule() {
        super("potion_effects", "Efeitos de Poção", "Lista de efeitos ativos com tempo restante", Category.HUD);
        this.showDurationSetting = new BooleanSetting("show_duration", "Mostrar Duração", "Exibir cronômetro do efeito", true);
        this.showAmplifierSetting = new BooleanSetting("show_amplifier", "Mostrar Nível", "Exibir nível (ex: Força II)", true);
        this.styleSetting = new ModeSetting("style", "Estilo", "Aparência da lista", "Compacto", "Compacto", "Completo", "Ícones");

        registerSetting(showDurationSetting);
        registerSetting(showAmplifierSetting);
        registerSetting(styleSetting);
        setEnabled(true);
    }

    public boolean isShowDuration() { return showDurationSetting.isEnabled(); }
    public boolean isShowAmplifier() { return showAmplifierSetting.isEnabled(); }
}
