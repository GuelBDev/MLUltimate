package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ColorSetting;
import net.mlultimate.client.module.setting.NumberSetting;

public class CPSModule extends Module {

    private final BooleanSetting showRmbSetting;
    private final BooleanSetting backgroundSetting;
    private final ColorSetting textColorSetting;
    private final NumberSetting windowSetting;

    public CPSModule() {
        super("cps", "CPS", "Contador de cliques por segundo (LMB & RMB)", Category.HUD);
        this.showRmbSetting = new BooleanSetting("show_rmb", "Mostrar RMB", "Exibir cliques do botão direito", true);
        this.backgroundSetting = new BooleanSetting("background", "Fundo", "Desenhar caixa escura de fundo", true);
        this.textColorSetting = new ColorSetting("color", "Cor do Texto", "Cor dos números", 0xFFFFFFFF);
        this.windowSetting = new NumberSetting("window_ms", "Janela (ms)", "Janela de tempo para contagem", 1000.0, 500.0, 2000.0, 100.0);

        registerSetting(showRmbSetting);
        registerSetting(backgroundSetting);
        registerSetting(textColorSetting);
        registerSetting(windowSetting);
        setEnabled(true);
    }

    private final java.util.List<Long> lmbClicks = new java.util.ArrayList<>();
    private final java.util.List<Long> rmbClicks = new java.util.ArrayList<>();

    public void registerClick(int button) {
        long now = System.currentTimeMillis();
        if (button == 0) {
            synchronized (lmbClicks) {
                lmbClicks.add(now);
            }
        } else if (button == 1) {
            synchronized (rmbClicks) {
                rmbClicks.add(now);
            }
        }
    }

    public int getLmbCps() {
        long now = System.currentTimeMillis();
        long window = (long) windowSetting.getDoubleValue();
        synchronized (lmbClicks) {
            lmbClicks.removeIf(t -> now - t > window);
            return lmbClicks.size();
        }
    }

    public int getRmbCps() {
        long now = System.currentTimeMillis();
        long window = (long) windowSetting.getDoubleValue();
        synchronized (rmbClicks) {
            rmbClicks.removeIf(t -> now - t > window);
            return rmbClicks.size();
        }
    }

    public boolean isShowRmb() { return showRmbSetting.isEnabled(); }
    public boolean hasBackground() { return backgroundSetting.isEnabled(); }
    public int getTextColor() { return textColorSetting.getRgb(); }
}
