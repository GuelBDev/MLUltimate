package net.mlultimate.client.modules.combat;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.BooleanSetting;
import net.mlultimate.client.module.setting.ColorSetting;
import net.mlultimate.client.module.setting.ModeSetting;
import net.mlultimate.client.module.setting.NumberSetting;

public class CrosshairModule extends Module {

    private final ModeSetting shapeSetting;
    private final NumberSetting sizeSetting;
    private final NumberSetting thicknessSetting;
    private final NumberSetting gapSetting;
    private final ColorSetting colorSetting;
    private final BooleanSetting outlineSetting;
    private final ColorSetting outlineColorSetting;
    private final BooleanSetting dotSetting;
    private final NumberSetting dotSizeSetting;
    private final BooleanSetting dynamicHitColorSetting;
    private final ColorSetting hitColorSetting;
    private final BooleanSetting vanillaBlendSetting;

    private long lastHitTime = 0;

    public CrosshairModule() {
        super("crosshair", "Mira Customizada", "Personalização avançada da mira central", Category.COMBAT);

        this.shapeSetting = new ModeSetting("shape", "Forma Geométrica", "Estilo visual da retícula",
                "Cruz (Padrão)",
                new String[]{"Cruz (Padrão)", "Cruz com Ponto", "Ponto", "Círculo", "Círculo com Ponto", "Quadrado", "Forma T", "Seta"});
        this.sizeSetting = new NumberSetting("size", "Tamanho", "Comprimento dos braços / raio", 7.0, 1.0, 18.0, 0.5);
        this.thicknessSetting = new NumberSetting("thickness", "Espessura", "Largura das linhas", 1.5, 0.5, 6.0, 0.5);
        this.gapSetting = new NumberSetting("gap", "Abertura Central", "Espaço no centro da mira", 1.0, 0.0, 12.0, 0.5);
        this.colorSetting = new ColorSetting("color", "Cor da Mira", "Cor principal da retícula", 0xFFFFFFFF);
        this.outlineSetting = new BooleanSetting("outline", "Contorno", "Borda escura para alto contraste", true);
        this.outlineColorSetting = new ColorSetting("outline_color", "Cor do Contorno", "Cor da borda da retícula", 0xB0000000);
        this.dotSetting = new BooleanSetting("dot", "Ponto Central", "Ponto no centro exato da mira", false);
        this.dotSizeSetting = new NumberSetting("dot_size", "Tamanho do Ponto", "Diâmetro do ponto central", 1.5, 0.5, 5.0, 0.5);
        this.dynamicHitColorSetting = new BooleanSetting("hit_color", "Cor ao Acertar", "Muda cor da mira temporariamente ao acertar inimigo", true);
        this.hitColorSetting = new ColorSetting("hit_color_val", "Cor do Hit", "Cor aplicada no momento do ataque", 0xFFFF3333);
        this.vanillaBlendSetting = new BooleanSetting("vanilla_blend", "Inversão Vanilla", "Modo de inversão de cores estilo Minecraft puro", false);

        registerSetting(shapeSetting);
        registerSetting(sizeSetting);
        registerSetting(thicknessSetting);
        registerSetting(gapSetting);
        registerSetting(colorSetting);
        registerSetting(outlineSetting);
        registerSetting(outlineColorSetting);
        registerSetting(dotSetting);
        registerSetting(dotSizeSetting);
        registerSetting(dynamicHitColorSetting);
        registerSetting(hitColorSetting);
        registerSetting(vanillaBlendSetting);

        setEnabled(true);
    }

    public void onHit() {
        this.lastHitTime = System.currentTimeMillis();
    }

    public boolean isHitActive() {
        return dynamicHitColorSetting.isEnabled() && (System.currentTimeMillis() - lastHitTime < 220);
    }

    public String getShape() { return shapeSetting.getValue(); }
    public double getSize() { return sizeSetting.getDoubleValue(); }
    public double getThickness() { return thicknessSetting.getDoubleValue(); }
    public double getGap() { return gapSetting.getDoubleValue(); }
    public int getColor() {
        if (isHitActive()) {
            return hitColorSetting.getRgb();
        }
        return colorSetting.getRgb();
    }
    public boolean isOutline() { return outlineSetting.isEnabled(); }
    public int getOutlineColor() { return outlineColorSetting.getRgb(); }
    public boolean hasDot() {
        String shape = getShape();
        return dotSetting.isEnabled() || shape.equals("Cruz com Ponto") || shape.equals("Círculo com Ponto") || shape.equals("Ponto");
    }
    public double getDotSize() { return dotSizeSetting.getDoubleValue(); }
    public boolean isDynamicHitColor() { return dynamicHitColorSetting.isEnabled(); }
    public boolean isVanillaBlend() { return vanillaBlendSetting.isEnabled(); }
}
