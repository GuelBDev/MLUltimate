package net.mlultimate.client.modules.render;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.NumberSetting;

public class MotionBlurModule extends Module {

    private final NumberSetting blurAmountSetting;

    public MotionBlurModule() {
        super("motion_blur", "Motion Blur", "Desfoque de movimento cinemático baseado em acumulação de frames", Category.VISUAL);
        this.blurAmountSetting = new NumberSetting("blur_amount", "Intensidade", "Nível de desfoque", 5.0, 1.0, 10.0, 1.0);
        registerSetting(blurAmountSetting);
        setEnabled(false);
    }
}
