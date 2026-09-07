package net.mlultimate.client.module;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.module.setting.KeybindSetting;
import net.mlultimate.client.module.setting.Setting;
import net.mlultimate.client.util.ModuleExceptionHandler;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Base abstract class for all MLUltimate Client modules.
 * Implements complete lifecycle management, settings registry, event bus binding
 * and automatic crash protection via ModuleExceptionHandler.
 */
public abstract class Module {

    private final String id;
    private final String name;
    private final String description;
    private final Category category;
    private boolean enabled;
    private final KeybindSetting keyBindSetting;
    private final List<Setting<?>> settings = new ArrayList<>();

    public Module(String id, String name, String description, Category category) {
        this(id, name, description, category, 0);
    }

    public Module(String id, String name, String description, Category category, int defaultKeyBind) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.keyBindSetting = new KeybindSetting("keybind", "Keybind", "Atalho de ativação", defaultKeyBind);
        registerSetting(this.keyBindSetting);
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public Category getCategory() {
        return category;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        if (this.enabled == enabled) return;
        this.enabled = enabled;

        if (this.enabled) {
            ModuleExceptionHandler.executeSafe(this, "onEnable", () -> {
                if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getEventBus() != null) {
                    MLUltimate.getInstance().getEventBus().register(this);
                }
                onEnable();
            });
        } else {
            ModuleExceptionHandler.executeSafe(this, "onDisable", () -> {
                if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getEventBus() != null) {
                    MLUltimate.getInstance().getEventBus().unregister(this);
                }
                onDisable();
            });
        }
    }

    public void toggle() {
        setEnabled(!isEnabled());
    }

    public int getKeyBind() {
        return keyBindSetting.getKey();
    }

    public void setKeyBind(int keyBind) {
        this.keyBindSetting.setKey(keyBind);
    }

    public KeybindSetting getKeybindSetting() {
        return keyBindSetting;
    }

    public void registerSetting(Setting<?> setting) {
        if (setting != null && !settings.contains(setting)) {
            settings.add(setting);
        }
    }

    public List<Setting<?>> getSettings() {
        return Collections.unmodifiableList(settings);
    }

    public Setting<?> getSetting(String id) {
        for (Setting<?> setting : settings) {
            if (setting.getId().equalsIgnoreCase(id)) {
                return setting;
            }
        }
        return null;
    }

    public void safeTick() {
        if (!enabled) return;
        ModuleExceptionHandler.executeSafe(this, "onTick", this::onTick);
    }

    public void safeRender() {
        if (!enabled) return;
        ModuleExceptionHandler.executeSafe(this, "onRender", this::onRender);
    }

    public void safeKeyInput() {
        if (!enabled) return;
        ModuleExceptionHandler.executeSafe(this, "onKeyInput", this::onKeyInput);
    }

    // Lifecycle hooks implemented by concrete modules
    public void onEnable() {}
    public void onDisable() {}
    public void onTick() {}
    public void onRender() {}
    public void onKeyInput() {}
}
