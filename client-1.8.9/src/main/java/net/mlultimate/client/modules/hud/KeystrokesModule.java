package net.mlultimate.client.modules.hud;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ColorSetting;

public class KeystrokesModule extends Module {

    private final BooleanSetting showMouseButtonsSetting;
    private final BooleanSetting showSpacebarSetting;
    private final ColorSetting textColorSetting;
    private final ColorSetting pressedColorSetting;
    private final BooleanSetting chromaSetting;

    public KeystrokesModule() {
        super("keystrokes", "Keystrokes", "Teclas W, A, S, D, LMB e RMB na tela", Category.HUD);
        this.showMouseButtonsSetting = new BooleanSetting("show_mouse", "Botões do Mouse", "Exibir LMB e RMB", true);
        this.showSpacebarSetting = new BooleanSetting("show_space", "Barra de Espaço", "Exibir barra de espaço", true);
        this.textColorSetting = new ColorSetting("color", "Cor do Texto", "Cor das teclas", 0xFFFFFFFF);
        this.pressedColorSetting = new ColorSetting("pressed_color", "Cor Pressionado", "Cor quando pressionado", 0x80FFFFFF);
        this.chromaSetting = new BooleanSetting("chroma", "Efeito Chroma", "Cores arco-íris dinâmicas", false);

        registerSetting(showMouseButtonsSetting);
        registerSetting(showSpacebarSetting);
        registerSetting(textColorSetting);
        registerSetting(pressedColorSetting);
        registerSetting(chromaSetting);
        setEnabled(true);
    }

    public boolean isShowMouseButtons() { return showMouseButtonsSetting.isEnabled(); }
    public boolean isShowSpacebar() { return showSpacebarSetting.isEnabled(); }
    public int getTextColor() { return textColorSetting.getRgb(); }
    public int getPressedColor() { return pressedColorSetting.getRgb(); }
}
