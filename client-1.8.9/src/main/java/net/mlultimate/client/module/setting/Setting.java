package net.mlultimate.client.module.setting;

import java.util.function.Supplier;

/**
 * Generic base setting for MLUltimate Client modules.
 */
public abstract class Setting<T> {

    private final String id;
    private final String name;
    private final String description;
    protected T value;
    private final T defaultValue;
    private Supplier<Boolean> visibility = () -> true;

    public Setting(String id, String name, String description, T defaultValue) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.defaultValue = defaultValue;
        this.value = defaultValue;
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

    public T getValue() {
        return value;
    }

    public void setValue(T value) {
        this.value = value;
    }

    public T getDefaultValue() {
        return defaultValue;
    }

    public void reset() {
        this.value = defaultValue;
    }

    public boolean isVisible() {
        return visibility.get();
    }

    public Setting<T> setVisibility(Supplier<Boolean> visibility) {
        this.visibility = visibility;
        return this;
    }
}
