package net.mlultimate.client.module.setting;

import org.lwjgl.input.Keyboard;

public class KeybindSetting extends Setting<Integer> {

    public KeybindSetting(String id, String name, String description, int defaultKey) {
        super(id, name, description, defaultKey);
    }

    public int getKey() {
        return getValue();
    }

    public void setKey(int key) {
        setValue(key);
    }

    public String getKeyName() {
        if (getValue() == 0 || getValue() == Keyboard.KEY_NONE) {
            return "NONE";
        }
        String name = Keyboard.getKeyName(getValue());
        return name != null ? name : "KEY_" + getValue();
    }
}
