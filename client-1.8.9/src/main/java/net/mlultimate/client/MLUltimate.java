package net.mlultimate.client;

import net.mlultimate.client.core.*;
import net.mlultimate.client.event.EventBus;
import net.mlultimate.client.util.Logger;

import java.io.File;

/**
 * Main Singleton Core of MLUltimate Client 1.8.9.
 * Bootstraps all client subsystems, managers, event bus, modules, HUD and configs.
 * Central access point for launcher integrations and client modifications.
 */
public class MLUltimate {

    public static final String NAME = "MLUltimate Client";
    public static final String SHORT_NAME = "MLU";
    public static final String VERSION = "1.0.0";
    public static final String MINECRAFT_VERSION = "1.8.9";

    private static MLUltimate instance;

    private File gameDir;
    private final MLUltimateBootstrap bootstrapper = new MLUltimateBootstrap();

    private EventBus eventBus;
    private EventManager eventManager;
    private ModuleManager moduleManager;
    private ConfigManager configManager;
    private ProfileManager profileManager;
    private KeybindManager keybindManager;
    private NotificationManager notificationManager;
    private InputManager inputManager;
    private TickManager tickManager;
    private RenderManager renderManager;
    private final net.mlultimate.client.gui.ModMenuScreen modMenuScreen = new net.mlultimate.client.gui.ModMenuScreen();
    private final net.mlultimate.client.gui.HudEditorScreen hudEditorScreen = new net.mlultimate.client.gui.HudEditorScreen();
    private final net.mlultimate.client.render.hud.HudManager hudManager = new net.mlultimate.client.render.hud.HudManager();

    private boolean modMenuOpen = false;
    private boolean hudEditorOpen = false;

    public net.mlultimate.client.gui.ModMenuScreen getModMenuScreen() {
        return modMenuScreen;
    }

    public net.mlultimate.client.gui.HudEditorScreen getHudEditorScreen() {
        return hudEditorScreen;
    }

    public net.mlultimate.client.render.hud.HudManager getHudManager() {
        return hudManager;
    }

    public boolean isHudEditorOpen() {
        return hudEditorOpen;
    }

    public void setHudEditorOpen(boolean hudEditorOpen) {
        this.hudEditorOpen = hudEditorOpen;
    }

    public static MLUltimate getInstance() {
        return instance;
    }

    public static synchronized void init(File gameDir) {
        if (instance == null) {
            instance = new MLUltimate();
            instance.gameDir = gameDir != null ? gameDir : new File(".");
            instance.bootstrapper.bootstrap(instance, instance.gameDir);
        }
    }

    public static synchronized void init() {
        File dir = new File(System.getProperty("minecraft.gameDir", "."));
        init(dir);
    }

    public void shutdown() {
        Logger.info(Logger.Category.CORE, "Encerrando MLUltimate Client e salvando configurações...");
        if (configManager != null) {
            configManager.saveAll();
        }
        if (eventBus != null) {
            eventBus.clear();
        }
        Logger.close();
    }

    public void toggleModMenu() {
        this.modMenuOpen = !this.modMenuOpen;
        Logger.debug(Logger.Category.CORE, "Mod Menu alternado: " + (modMenuOpen ? "Aberto" : "Fechado"));
    }

    public boolean isModMenuOpen() {
        return modMenuOpen;
    }

    public void setModMenuOpen(boolean open) {
        this.modMenuOpen = open;
    }

    // Getters and Internal Setters for Bootstrapper
    public File getGameDir() {
        return gameDir;
    }

    public EventBus getEventBus() {
        return eventBus;
    }

    public void setEventBus(EventBus eventBus) {
        this.eventBus = eventBus;
    }

    public EventManager getEventManager() {
        return eventManager;
    }

    public void setEventManager(EventManager eventManager) {
        this.eventManager = eventManager;
    }

    public ModuleManager getModuleManager() {
        return moduleManager;
    }

    public void setModuleManager(ModuleManager moduleManager) {
        this.moduleManager = moduleManager;
    }

    public ConfigManager getConfigManager() {
        return configManager;
    }

    public void setConfigManager(ConfigManager configManager) {
        this.configManager = configManager;
    }

    public ProfileManager getProfileManager() {
        return profileManager;
    }

    public void setProfileManager(ProfileManager profileManager) {
        this.profileManager = profileManager;
    }

    public KeybindManager getKeybindManager() {
        return keybindManager;
    }

    public void setKeybindManager(KeybindManager keybindManager) {
        this.keybindManager = keybindManager;
    }

    public NotificationManager getNotificationManager() {
        return notificationManager;
    }

    public void setNotificationManager(NotificationManager notificationManager) {
        this.notificationManager = notificationManager;
    }

    public InputManager getInputManager() {
        return inputManager;
    }

    public void setInputManager(InputManager inputManager) {
        this.inputManager = inputManager;
    }

    public TickManager getTickManager() {
        return tickManager;
    }

    public void setTickManager(TickManager tickManager) {
        this.tickManager = tickManager;
    }

    public RenderManager getRenderManager() {
        return renderManager;
    }

    public void setRenderManager(RenderManager renderManager) {
        this.renderManager = renderManager;
    }

    public MLUltimateBootstrap getBootstrapper() {
        return bootstrapper;
    }

    // Public Integration API
    public static class API {
        public static ModuleManager getModuleManager() {
            return instance != null ? instance.getModuleManager() : null;
        }

        public static ConfigManager getConfigManager() {
            return instance != null ? instance.getConfigManager() : null;
        }

        public static ProfileManager getProfileManager() {
            return instance != null ? instance.getProfileManager() : null;
        }

        public static NotificationManager getNotificationManager() {
            return instance != null ? instance.getNotificationManager() : null;
        }

        public static EventBus getEventBus() {
            return instance != null ? instance.getEventBus() : null;
        }
    }
}
