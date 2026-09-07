package net.mlultimate.client.module.setting;

public class BooleanSetting extends Setting<Boolean> {

    public BooleanSetting(String id, String name, String description, boolean defaultValue) {
        super(id, name, description, defaultValue);
    }

    public boolean isEnabled() {
        return getValue();
    }

    public void setEnabled(boolean enabled) {
        setValue(enabled);
    }

    public void toggle() {
        setValue(!getValue());
    }
}
