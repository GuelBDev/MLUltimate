package net.mlultimate.client.theme;

public class ThemeManager {

    private static ThemeManager instance;
    private final ClientTheme currentTheme;

    public ThemeManager() {
        this.currentTheme = new ClientTheme();
        this.currentTheme.applyPresetById("night-dark");
    }

    public static synchronized ThemeManager getInstance() {
        if (instance == null) {
            instance = new ThemeManager();
        }
        return instance;
    }

    public ClientTheme getTheme() {
        return currentTheme;
    }
}
