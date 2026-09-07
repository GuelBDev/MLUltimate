package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ModeSetting;

public class ArmorStatusModule extends Module {

    private final BooleanSetting showDurabilitySetting;
    private final BooleanSetting showHeldItemSetting;
    private final ModeSetting orientationSetting;

    public ArmorStatusModule() {
        super("armor_status", "Status da Armadura", "Exibe as peças de armadura e durabilidade", Category.HUD);
        this.showDurabilitySetting = new BooleanSetting("show_durability", "Mostrar Durabilidade", "Exibir valor numérico ou percentual", true);
        this.showHeldItemSetting = new BooleanSetting("show_held", "Item em Mãos", "Exibir item segurado atualmente", true);
        this.orientationSetting = new ModeSetting("orientation", "Orientação", "Alinhamento dos ícones", "Vertical", "Vertical", "Horizontal");

        registerSetting(showDurabilitySetting);
        registerSetting(showHeldItemSetting);
        registerSetting(orientationSetting);
        setEnabled(true);
    }

    public boolean isShowDurability() { return showDurabilitySetting.isEnabled(); }
    public boolean isShowHeldItem() { return showHeldItemSetting.isEnabled(); }
    public boolean isVertical() { return orientationSetting.is("Vertical"); }
}
