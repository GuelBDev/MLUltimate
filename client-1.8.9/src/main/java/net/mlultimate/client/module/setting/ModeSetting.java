package net.mlultimate.client.module.setting;

import java.util.Arrays;
import java.util.List;

public class ModeSetting extends Setting<String> {

    private final List<String> modes;

    public ModeSetting(String id, String name, String description, String defaultMode, String... modes) {
        super(id, name, description, defaultMode);
        this.modes = Arrays.asList(modes);
        if (!this.modes.contains(defaultMode) && !this.modes.isEmpty()) {
            this.value = this.modes.get(0);
        }
    }

    public List<String> getModes() {
        return modes;
    }

    public boolean is(String mode) {
        return getValue().equalsIgnoreCase(mode);
    }

    public void cycle() {
        int currentIndex = modes.indexOf(getValue());
        int nextIndex = (currentIndex + 1) % modes.size();
        setValue(modes.get(nextIndex));
    }

    @Override
    public void setValue(String val) {
        if (modes.contains(val)) {
            super.setValue(val);
        }
    }
}
