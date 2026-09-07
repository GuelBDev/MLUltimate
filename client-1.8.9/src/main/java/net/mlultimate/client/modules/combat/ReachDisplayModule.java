package net.mlultimate.client.modules.combat;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;

public class ReachDisplayModule extends Module {

    private final BooleanSetting showBlocksTextSetting;
    private double lastReach = 0.0;
    private long lastAttackTime = 0;

    public ReachDisplayModule() {
        super("reach_display", "Alcance do Golpe", "Mede a distância exata em blocos de cada acerto", Category.COMBAT);
        this.showBlocksTextSetting = new BooleanSetting("show_blocks", "Sufixo 'b'", "Exibir 'b' após a distância", true);
        registerSetting(showBlocksTextSetting);
        setEnabled(true);
    }

    public void onAttack(double reach) {
        if (!isEnabled()) return;
        this.lastReach = reach;
        this.lastAttackTime = System.currentTimeMillis();
    }

    public double getLastReach() {
        if (System.currentTimeMillis() - lastAttackTime > 4000) {
            return 0.0;
        }
        return lastReach;
    }

    public boolean isShowBlocks() {
        return showBlocksTextSetting.isEnabled();
    }
}
