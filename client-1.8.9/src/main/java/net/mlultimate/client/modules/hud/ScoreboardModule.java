package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.NumberSetting;

public class ScoreboardModule extends Module {

    private final BooleanSetting hideScoresSetting;
    private final BooleanSetting removeRedNumbersSetting;
    private final NumberSetting scaleSetting;

    public ScoreboardModule() {
        super("scoreboard", "Scoreboard", "Personalização da tabela lateral do servidor", Category.SERVER);
        this.hideScoresSetting = new BooleanSetting("hide", "Ocultar", "Ocultar tabela completamente", false);
        this.removeRedNumbersSetting = new BooleanSetting("no_red_numbers", "Remover Números Vermelhos", "Oculta a pontuação vermelha lateral", true);
        this.scaleSetting = new NumberSetting("scale", "Escala", "Tamanho do scoreboard", 1.0, 0.5, 1.5, 0.1);

        registerSetting(hideScoresSetting);
        registerSetting(removeRedNumbersSetting);
        registerSetting(scaleSetting);
        setEnabled(true);
    }
}
