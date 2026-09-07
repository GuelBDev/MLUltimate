package net.mlultimate.client.core;

import com.google.gson.*;
import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.module.setting.*;
import net.mlultimate.client.util.Logger;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Map;

/**
 * Enterprise-grade JSON Configuration Engine for MLUltimate Client.
 * Directory: config/mlultimate/
 * Files: config.json, modules.json, hud.json, profiles.json, waypoints.json
 * Features:
 * - Atomic saves (.tmp -> rename)
 * - Automatic backups (*.bak)
 * - Automatic corruption recovery
 * - Versioned schema migration (configVersion)
 * - Zero game crashes on corrupt data
 */
public class ConfigManager {

    public static final int CURRENT_CONFIG_VERSION = 1;

    private final File gameDir;
    private final File configDir;
    private final File profilesDir;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public ConfigManager(File gameDir) {
        this.gameDir = gameDir;
        // Strict directory as requested: config/mlultimate/
        File cfgRoot = new File(gameDir, "config");
        this.configDir = new File(cfgRoot, "mlultimate");
        this.profilesDir = new File(this.configDir, "profiles");

        if (!this.configDir.exists()) {
            this.configDir.mkdirs();
        }
        if (!this.profilesDir.exists()) {
            this.profilesDir.mkdirs();
        }
    }

    public File getConfigDir() {
        return configDir;
    }

    public File getProfilesDir() {
        return profilesDir;
    }

    public void loadAll() {
        Logger.info(Logger.Category.CONFIG, "Carregando configurações do MLUltimate Client...");
        loadCoreConfig();
        loadModules();
        loadHudConfig();
    }

    public void saveAll() {
        Logger.info(Logger.Category.CONFIG, "Salvando configurações do MLUltimate Client atomicamente...");
        saveCoreConfig();
        saveModules();
        saveHudConfig();
    }

    // =========================================================================
    // 1. config.json
    // =========================================================================

    public void saveCoreConfig() {
        JsonObject root = new JsonObject();
        root.addProperty("configVersion", CURRENT_CONFIG_VERSION);
        root.addProperty("clientName", MLUltimate.NAME);
        root.addProperty("clientVersion", MLUltimate.VERSION);
        root.addProperty("debugMode", Logger.isDebugEnabled());

        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getProfileManager() != null) {
            root.addProperty("activeProfile", MLUltimate.getInstance().getProfileManager().getActiveProfileName());
        }

        try {
            JsonObject themeObj = new JsonObject();
            net.mlultimate.client.theme.ClientTheme ct = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme();
            themeObj.addProperty("presetId", ct.getActivePresetId());
            themeObj.addProperty("primaryColor", ct.primaryColor.getValue());
            themeObj.addProperty("primaryChroma", ct.primaryColor.isChroma());
            themeObj.addProperty("backgroundColor", ct.backgroundColor.getValue());
            themeObj.addProperty("cardColor", ct.cardColor.getValue());
            themeObj.addProperty("sidebarColor", ct.sidebarColor.getValue());
            themeObj.addProperty("topBarColor", ct.topBarColor.getValue());
            themeObj.addProperty("textColor", ct.textColor.getValue());
            themeObj.addProperty("mutedTextColor", ct.mutedTextColor.getValue());
            themeObj.addProperty("borderColor", ct.borderColor.getValue());
            themeObj.addProperty("hudPillBg", ct.hudPillBg.getValue());
            themeObj.addProperty("hudBorder", ct.hudBorderEnabled.isEnabled());
            themeObj.addProperty("hudBorderColor", ct.hudBorderColor.getValue());
            // Backwards compatibility keys
            themeObj.addProperty("accentColor", ct.primaryColor.getValue());
            themeObj.addProperty("accentChroma", ct.primaryColor.isChroma());
            root.add("theme", themeObj);
        } catch (Throwable ignored) {}

        atomicSave(new File(configDir, "config.json"), root);
    }

    public void loadCoreConfig() {
        File file = new File(configDir, "config.json");
        if (!file.exists()) {
            saveCoreConfig();
            return;
        }

        JsonObject root = readJsonSafe(file);
        if (root == null) return;

        // Version migration check
        int version = root.has("configVersion") ? root.get("configVersion").getAsInt() : 0;
        if (version < CURRENT_CONFIG_VERSION) {
            Logger.info(Logger.Category.CONFIG, "Migrando config.json da versão " + version + " para " + CURRENT_CONFIG_VERSION);
            migrateConfig(root, version);
        }

        if (root.has("debugMode")) {
            Logger.setDebugEnabled(root.get("debugMode").getAsBoolean());
        }

        if (root.has("theme") && root.get("theme").isJsonObject()) {
            try {
                JsonObject themeObj = root.getAsJsonObject("theme");
                net.mlultimate.client.theme.ClientTheme ct = net.mlultimate.client.theme.ThemeManager.getInstance().getTheme();
                if (themeObj.has("presetId")) ct.setActivePresetId(themeObj.get("presetId").getAsString());
                if (themeObj.has("primaryColor")) ct.primaryColor.setValue(themeObj.get("primaryColor").getAsInt());
                else if (themeObj.has("accentColor")) ct.primaryColor.setValue(themeObj.get("accentColor").getAsInt());
                if (themeObj.has("primaryChroma")) ct.primaryColor.setChroma(themeObj.get("primaryChroma").getAsBoolean());
                else if (themeObj.has("accentChroma")) ct.primaryColor.setChroma(themeObj.get("accentChroma").getAsBoolean());
                if (themeObj.has("backgroundColor")) ct.backgroundColor.setValue(themeObj.get("backgroundColor").getAsInt());
                if (themeObj.has("cardColor")) ct.cardColor.setValue(themeObj.get("cardColor").getAsInt());
                if (themeObj.has("sidebarColor")) ct.sidebarColor.setValue(themeObj.get("sidebarColor").getAsInt());
                if (themeObj.has("topBarColor")) ct.topBarColor.setValue(themeObj.get("topBarColor").getAsInt());
                if (themeObj.has("textColor")) ct.textColor.setValue(themeObj.get("textColor").getAsInt());
                if (themeObj.has("mutedTextColor")) ct.mutedTextColor.setValue(themeObj.get("mutedTextColor").getAsInt());
                if (themeObj.has("borderColor")) ct.borderColor.setValue(themeObj.get("borderColor").getAsInt());
                if (themeObj.has("hudPillBg")) ct.hudPillBg.setValue(themeObj.get("hudPillBg").getAsInt());
                if (themeObj.has("hudBorder")) ct.hudBorderEnabled.setEnabled(themeObj.get("hudBorder").getAsBoolean());
                if (themeObj.has("hudBorderColor")) ct.hudBorderColor.setValue(themeObj.get("hudBorderColor").getAsInt());
                ct.syncToHudManager();
            } catch (Throwable ignored) {}
        }
    }

    private void migrateConfig(JsonObject root, int oldVersion) {
        // Schema migrations handler
        root.addProperty("configVersion", CURRENT_CONFIG_VERSION);
    }

    // =========================================================================
    // 2. modules.json
    // =========================================================================

    public void saveModules() {
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getModuleManager() == null) return;

        JsonObject root = new JsonObject();
        root.addProperty("configVersion", CURRENT_CONFIG_VERSION);
        JsonObject modulesObj = new JsonObject();

        for (Module module : MLUltimate.getInstance().getModuleManager().getModules()) {
            JsonObject modObj = new JsonObject();
            modObj.addProperty("enabled", module.isEnabled());
            modObj.addProperty("keybind", module.getKeyBind());

            JsonObject settingsObj = new JsonObject();
            for (Setting<?> setting : module.getSettings()) {
                if (setting instanceof BooleanSetting) {
                    settingsObj.addProperty(setting.getId(), ((BooleanSetting) setting).isEnabled());
                } else if (setting instanceof NumberSetting) {
                    settingsObj.addProperty(setting.getId(), ((NumberSetting) setting).getDoubleValue());
                } else if (setting instanceof ModeSetting) {
                    settingsObj.addProperty(setting.getId(), ((ModeSetting) setting).getValue());
                } else if (setting instanceof ColorSetting) {
                    ColorSetting cs = (ColorSetting) setting;
                    JsonObject colorObj = new JsonObject();
                    colorObj.addProperty("value", cs.getValue());
                    colorObj.addProperty("chroma", cs.isChroma());
                    colorObj.addProperty("speed", cs.getChromaSpeed());
                    settingsObj.add(setting.getId(), colorObj);
                } else if (setting instanceof KeybindSetting) {
                    settingsObj.addProperty(setting.getId(), ((KeybindSetting) setting).getKey());
                } else if (setting instanceof StringSetting) {
                    settingsObj.addProperty(setting.getId(), ((StringSetting) setting).getValue());
                }
            }
            modObj.add("settings", settingsObj);
            modulesObj.add(module.getId(), modObj);
        }

        root.add("modules", modulesObj);
        atomicSave(new File(configDir, "modules.json"), root);
    }

    public void loadModules() {
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getModuleManager() == null) return;

        File file = new File(configDir, "modules.json");
        if (!file.exists()) {
            saveModules();
            return;
        }

        JsonObject root = readJsonSafe(file);
        if (root == null || !root.has("modules")) return;

        JsonObject modulesObj = root.getAsJsonObject("modules");
        for (Map.Entry<String, JsonElement> entry : modulesObj.entrySet()) {
            Module module = MLUltimate.getInstance().getModuleManager().getModuleById(entry.getKey());
            if (module == null || !entry.getValue().isJsonObject()) continue;

            JsonObject modObj = entry.getValue().getAsJsonObject();
            if (modObj.has("enabled")) {
                module.setEnabled(modObj.get("enabled").getAsBoolean());
            }
            if (modObj.has("keybind")) {
                int key = modObj.get("keybind").getAsInt();
                module.setKeyBind(key);
                if (MLUltimate.getInstance().getKeybindManager() != null) {
                    MLUltimate.getInstance().getKeybindManager().registerKeybind(key, module);
                }
            }

            if (modObj.has("settings")) {
                JsonObject settingsObj = modObj.getAsJsonObject("settings");
                for (Setting<?> setting : module.getSettings()) {
                    if (!settingsObj.has(setting.getId())) continue;
                    JsonElement sElem = settingsObj.get(setting.getId());

                    try {
                        if (setting instanceof BooleanSetting && sElem.isJsonPrimitive()) {
                            ((BooleanSetting) setting).setEnabled(sElem.getAsBoolean());
                        } else if (setting instanceof NumberSetting && sElem.isJsonPrimitive()) {
                            ((NumberSetting) setting).setValue(sElem.getAsDouble());
                        } else if (setting instanceof ModeSetting && sElem.isJsonPrimitive()) {
                            ((ModeSetting) setting).setValue(sElem.getAsString());
                        } else if (setting instanceof ColorSetting) {
                            ColorSetting cs = (ColorSetting) setting;
                            if (sElem.isJsonObject()) {
                                JsonObject cObj = sElem.getAsJsonObject();
                                if (cObj.has("value")) cs.setValue(cObj.get("value").getAsInt());
                                if (cObj.has("chroma")) cs.setChroma(cObj.get("chroma").getAsBoolean());
                                if (cObj.has("speed")) cs.setChromaSpeed(cObj.get("speed").getAsFloat());
                            } else if (sElem.isJsonPrimitive()) {
                                cs.setValue(sElem.getAsInt());
                            }
                        } else if (setting instanceof KeybindSetting && sElem.isJsonPrimitive()) {
                            ((KeybindSetting) setting).setKey(sElem.getAsInt());
                        } else if (setting instanceof StringSetting && sElem.isJsonPrimitive()) {
                            ((StringSetting) setting).setValue(sElem.getAsString());
                        }
                    } catch (Throwable t) {
                        Logger.warn(Logger.Category.CONFIG, "Falha ao carregar setting '" + setting.getId() + "' do módulo '" + module.getId() + "': " + t.getMessage());
                    }
                }
            }
        }
    }

    public void saveHudConfig() {
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getHudManager() == null) return;
        JsonObject hudJson = MLUltimate.getInstance().getHudManager().save();
        atomicSave(new File(configDir, "hud.json"), hudJson);
    }

    public void loadHudConfig() {
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getHudManager() == null) return;
        File file = new File(configDir, "hud.json");
        if (!file.exists()) return;
        JsonObject root = readJsonSafe(file);
        if (root != null) {
            MLUltimate.getInstance().getHudManager().load(root);
        }
    }

    // =========================================================================
    // 3. ATOMIC SAVE & RESILIENT BACKUP RECOVERY
    // =========================================================================

    public synchronized void atomicSave(File targetFile, JsonElement json) {
        if (targetFile == null || json == null) return;

        File tmpFile = new File(targetFile.getParentFile(), targetFile.getName() + ".tmp");
        File bakFile = new File(targetFile.getParentFile(), targetFile.getName() + ".bak");

        try {
            // 1. Write to temporary file with UTF-8
            try (OutputStreamWriter writer = new OutputStreamWriter(new FileOutputStream(tmpFile), StandardCharsets.UTF_8)) {
                gson.toJson(json, writer);
                writer.flush();
            }

            // 2. Create backup of current file before overwriting
            if (targetFile.exists()) {
                try {
                    Files.copy(targetFile.toPath(), bakFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                } catch (Throwable bakEx) {
                    Logger.warn(Logger.Category.CONFIG, "Não foi possível criar backup de " + targetFile.getName() + ": " + bakEx.getMessage());
                }
            }

            // 3. Atomically replace target file
            try {
                Files.move(tmpFile.toPath(), targetFile.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (Throwable atomicEx) {
                // Fallback standard move if ATOMIC_MOVE not supported by filesystem
                Files.move(tmpFile.toPath(), targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }

            Logger.debug(Logger.Category.CONFIG, "Arquivo salvo atomicamente: " + targetFile.getName());
        } catch (Throwable t) {
            Logger.error(Logger.Category.CONFIG, "Erro crítico ao salvar " + targetFile.getName(), t);
            if (tmpFile.exists()) {
                tmpFile.delete();
            }
        }
    }

    public synchronized JsonObject readJsonSafe(File targetFile) {
        if (targetFile == null) return null;

        File bakFile = new File(targetFile.getParentFile(), targetFile.getName() + ".bak");

        // If target file doesn't exist, try restoring backup
        if (!targetFile.exists()) {
            if (bakFile.exists()) {
                Logger.warn(Logger.Category.CONFIG, "Arquivo " + targetFile.getName() + " ausente. Restaurando do backup (.bak)...");
                try {
                    Files.copy(bakFile.toPath(), targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                } catch (Throwable ignored) {
                }
            } else {
                return null;
            }
        }

        // Try parsing target file
        try (InputStreamReader reader = new InputStreamReader(new FileInputStream(targetFile), StandardCharsets.UTF_8)) {
            JsonElement element = new JsonParser().parse(reader);
            if (element != null && element.isJsonObject()) {
                return element.getAsJsonObject();
            }
        } catch (Throwable t) {
            Logger.error(Logger.Category.CONFIG, "Arquivo " + targetFile.getName() + " corrompido! Tentando restaurar do backup (*.bak)...", t);
        }

        // Attempt recovery from .bak
        if (bakFile.exists()) {
            try (InputStreamReader reader = new InputStreamReader(new FileInputStream(bakFile), StandardCharsets.UTF_8)) {
                JsonElement element = new JsonParser().parse(reader);
                if (element != null && element.isJsonObject()) {
                    Logger.info(Logger.Category.CONFIG, "Sucesso ao restaurar " + targetFile.getName() + " a partir do backup!");
                    // Resave recovered json into target
                    Files.copy(bakFile.toPath(), targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    return element.getAsJsonObject();
                }
            } catch (Throwable bakError) {
                Logger.error(Logger.Category.CONFIG, "Backup " + bakFile.getName() + " também corrompido.", bakError);
            }
        }

        Logger.error(Logger.Category.CONFIG, "Não foi possível recuperar " + targetFile.getName() + ". Iniciando com estado vazio sem crashar.");
        return new JsonObject();
    }
}
