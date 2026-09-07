package net.mlultimate.client.modules.combat;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.ColorSetting;

public class HitColorModule extends Module {

    private final ColorSetting hitColorSetting;

    public HitColorModule() {
        super("hit_color", "Cor de Dano", "Altera a cor avermelhada ao atingir entidades", Category.COMBAT);
        this.hitColorSetting = new ColorSetting("color", "Cor do Flash", "Cor de dano na entidade", 0x80FF0000);
        registerSetting(hitColorSetting);
        setEnabled(true);
    }
}
