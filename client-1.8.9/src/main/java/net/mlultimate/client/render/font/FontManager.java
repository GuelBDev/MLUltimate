package net.mlultimate.client.render.font;

import java.util.HashMap;
import java.util.Map;

/**
 * Typography manager for MLUltimate Client.
 */
public class FontManager {

    private final Map<String, CustomFontRenderer> fonts = new HashMap<>();

    public void init() {
        fonts.put("regular", new CustomFontRenderer(1.0f));
        fonts.put("bold", new CustomFontRenderer(1.0f));
        fonts.put("title", new CustomFontRenderer(1.25f));
        fonts.put("small", new CustomFontRenderer(0.85f));
        fonts.put("hud", new CustomFontRenderer(1.0f));
    }

    public CustomFontRenderer getFont(String name) {
        CustomFontRenderer fr = fonts.get(name);
        if (fr != null) return fr;
        fr = fonts.get("regular");
        if (fr != null) return fr;
        return new CustomFontRenderer(1.0f);
    }

    public CustomFontRenderer getRegular() {
        return getFont("regular");
    }

    public CustomFontRenderer getBold() {
        return getFont("bold");
    }

    public CustomFontRenderer getTitle() {
        return getFont("title");
    }

    public CustomFontRenderer getSmall() {
        return getFont("small");
    }

    public CustomFontRenderer getHud() {
        return getFont("hud");
    }
}
