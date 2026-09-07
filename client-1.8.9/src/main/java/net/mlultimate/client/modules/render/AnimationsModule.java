package net.mlultimate.client.modules.render;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ModeSetting;

public class AnimationsModule extends Module {

    private final BooleanSetting blockHitSetting;
    private final BooleanSetting oldBowSetting;
    private final BooleanSetting oldRodSetting;
    private final ModeSetting styleSetting;

    public AnimationsModule() {
        super("1_7_visuals", "Animações 1.7", "Restaura animações clássicas de espada e itens da versão 1.7", Category.VISUAL);
        this.blockHitSetting = new BooleanSetting("block_hit", "Block Hit 1.7", "Animação clássica ao bater e defender simultaneamente", true);
        this.oldBowSetting = new BooleanSetting("old_bow", "Arco 1.7", "Posicionamento clássico do arco ao puxar", true);
        this.oldRodSetting = new BooleanSetting("old_rod", "Vara de Pesca 1.7", "Posicionamento clássico da vara", true);
        this.styleSetting = new ModeSetting("style", "Modo de Swing", "Estilo de rotação da mão", "1.7 Tradicional", "1.7 Tradicional", "Smooth", "Punch");

        registerSetting(blockHitSetting);
        registerSetting(oldBowSetting);
        registerSetting(oldRodSetting);
        registerSetting(styleSetting);
        setEnabled(true);
    }
}
