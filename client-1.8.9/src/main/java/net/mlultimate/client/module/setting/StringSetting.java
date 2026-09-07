package net.mlultimate.client.module.setting;

public class StringSetting extends Setting<String> {

    public StringSetting(String id, String name, String description, String defaultValue) {
        super(id, name, description, defaultValue != null ? defaultValue : "");
    }
}
