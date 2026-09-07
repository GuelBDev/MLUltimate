package net.mlultimate.client.modules.combat;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.NumberSetting;

public class ComboCounterModule extends Module {

    private final NumberSetting resetTimeSetting;
    private final BooleanSetting showTextSetting;

    public ComboCounterModule() {
        super("combo_counter", "Contador de Combo", "Exibe sequência de acertos consecutivos sem sofrer dano", Category.COMBAT);
        this.resetTimeSetting = new NumberSetting("reset_time", "Tempo de Reset (s)", "Segundos sem bater para zerar combo", 2.0, 1.0, 5.0, 0.5);
        this.showTextSetting = new BooleanSetting("show_text", "Exibir Prefixo", "Mostrar 'Combo:' antes do número", true);

        registerSetting(resetTimeSetting);
        registerSetting(showTextSetting);
        setEnabled(true);
    }

    private int combo = 0;
    private long lastHitTime = 0;

    public void onHit() {
        if (!isEnabled()) return;
        long now = System.currentTimeMillis();
        long resetMs = (long) (resetTimeSetting.getDoubleValue() * 1000.0);
        if (now - lastHitTime > resetMs) {
            combo = 1;
        } else {
            combo++;
        }
        lastHitTime = now;
    }

    public int getCombo() {
        long now = System.currentTimeMillis();
        long resetMs = (long) (resetTimeSetting.getDoubleValue() * 1000.0);
        if (now - lastHitTime > resetMs) {
            combo = 0;
        }
        if (net.mlultimate.client.forge.MinecraftBridge.isPlayerHurt()) {
            combo = 0;
        }
        return combo;
    }

    public boolean isShowText() {
        return showTextSetting.isEnabled();
    }
}
