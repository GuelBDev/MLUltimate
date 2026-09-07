package net.mlultimate.client.modules.render;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.ColorSetting;
import net.mlultimate.client.module.setting.NumberSetting;

public class BlockOutlineModule extends Module {

    private final ColorSetting outlineColorSetting;
    private final NumberSetting thicknessSetting;

    public BlockOutlineModule() {
        super("block_outline", "Contorno de Bloco", "Personaliza a cor e espessura da caixa de seleção de blocos", Category.VISUAL);
        this.outlineColorSetting = new ColorSetting("color", "Cor da Linha", "Cor da borda do bloco focado", 0xFF4A90E2);
        this.thicknessSetting = new NumberSetting("thickness", "Espessura", "Largura da linha de contorno", 2.0, 1.0, 6.0, 0.5);

        registerSetting(outlineColorSetting);
        registerSetting(thicknessSetting);
        setEnabled(true);
    }
}
