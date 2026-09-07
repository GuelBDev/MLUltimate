package net.mlultimate.client.core;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.util.Logger;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Profile Manager for MLUltimate Client.
 * Manages profile catalog: Default, PvP, Hypixel, BedWars, SkyWars, SkyBlock, Survival, Performance.
 * Supports creation, renaming, duplication, deletion, import and export.
 */
public class ProfileManager {

    public static final List<String> DEFAULT_PROFILES = Arrays.asList(
            "Default", "PvP", "Hypixel", "BedWars", "SkyWars", "SkyBlock", "Survival", "Performance"
    );

    private final File profilesDir;
    private final Gson gson = new GsonBuilder().setPrettyPrinting().create();
    private String activeProfileName = "Default";
    private final List<String> availableProfiles = new ArrayList<>();

    public ProfileManager(File profilesDir) {
        this.profilesDir = profilesDir;
        if (!this.profilesDir.exists()) {
            this.profilesDir.mkdirs();
        }
        initProfiles();
    }

    private void initProfiles() {
        // Ensure default profiles exist on disk
        for (String p : DEFAULT_PROFILES) {
            File pFile = new File(profilesDir, p + ".json");
            if (!pFile.exists()) {
                createProfileFile(pFile, p);
            }
        }
        refreshProfiles();
    }

    public void refreshProfiles() {
        availableProfiles.clear();
        File[] files = profilesDir.listFiles((dir, name) -> name.endsWith(".json"));
        if (files != null) {
            for (File f : files) {
                String name = f.getName().substring(0, f.getName().length() - 5);
                availableProfiles.add(name);
            }
        }
        if (availableProfiles.isEmpty()) {
            availableProfiles.add("Default");
        }
    }

    public List<String> getAvailableProfiles() {
        return availableProfiles;
    }

    public String getActiveProfileName() {
        return activeProfileName;
    }

    public void switchProfile(String profileName) {
        if (profileName == null || profileName.trim().isEmpty()) return;
        profileName = profileName.trim();

        File pFile = new File(profilesDir, profileName + ".json");
        if (!pFile.exists()) {
            createProfile(profileName);
        }

        // Save current profile before switching
        saveCurrentProfile();

        this.activeProfileName = profileName;
        loadProfileData(pFile);

        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getNotificationManager() != null) {
            MLUltimate.getInstance().getNotificationManager().showSuccess("Perfil carregado: " + profileName);
        }
    }

    public boolean createProfile(String name) {
        if (name == null || name.trim().isEmpty()) return false;
        name = name.trim();
        File pFile = new File(profilesDir, name + ".json");
        if (pFile.exists()) return false;

        createProfileFile(pFile, name);
        refreshProfiles();
        return true;
    }

    public boolean duplicateProfile(String sourceName, String newName) {
        File src = new File(profilesDir, sourceName + ".json");
        File dst = new File(profilesDir, newName + ".json");
        if (!src.exists() || dst.exists()) return false;

        try {
            Files.copy(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING);
            refreshProfiles();
            return true;
        } catch (IOException e) {
            Logger.error(Logger.Category.CONFIG, "Erro ao duplicar perfil: " + sourceName, e);
            return false;
        }
    }

    public boolean renameProfile(String oldName, String newName) {
        if ("Default".equalsIgnoreCase(oldName)) return false; // Protect Default
        File src = new File(profilesDir, oldName + ".json");
        File dst = new File(profilesDir, newName + ".json");
        if (!src.exists() || dst.exists()) return false;

        boolean ok = src.renameTo(dst);
        if (ok) {
            if (activeProfileName.equalsIgnoreCase(oldName)) {
                activeProfileName = newName;
            }
            refreshProfiles();
        }
        return ok;
    }

    public boolean deleteProfile(String name) {
        if ("Default".equalsIgnoreCase(name)) return false; // Prevent deleting default
        File pFile = new File(profilesDir, name + ".json");
        if (!pFile.exists()) return false;

        boolean ok = pFile.delete();
        if (ok) {
            if (activeProfileName.equalsIgnoreCase(name)) {
                switchProfile("Default");
            }
            refreshProfiles();
        }
        return ok;
    }

    public void saveCurrentProfile() {
        File pFile = new File(profilesDir, activeProfileName + ".json");
        JsonObject root = new JsonObject();
        root.addProperty("profileName", activeProfileName);
        root.addProperty("savedAt", System.currentTimeMillis());

        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getConfigManager() != null) {
            MLUltimate.getInstance().getConfigManager().atomicSave(pFile, root);
        }
    }

    private void loadProfileData(File pFile) {
        if (!pFile.exists()) return;
        try (InputStreamReader reader = new InputStreamReader(new FileInputStream(pFile), StandardCharsets.UTF_8)) {
            JsonObject obj = new JsonParser().parse(reader).getAsJsonObject();
            Logger.info(Logger.Category.CONFIG, "Dados do perfil carregados: " + obj.get("profileName").getAsString());
        } catch (Throwable t) {
            Logger.error(Logger.Category.CONFIG, "Erro ao ler dados do perfil: " + pFile.getName(), t);
        }
    }

    private void createProfileFile(File file, String name) {
        JsonObject obj = new JsonObject();
        obj.addProperty("profileName", name);
        obj.addProperty("createdAt", System.currentTimeMillis());
        try (OutputStreamWriter writer = new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8)) {
            gson.toJson(obj, writer);
        } catch (IOException e) {
            Logger.error(Logger.Category.CONFIG, "Falha ao criar arquivo de perfil: " + file.getName(), e);
        }
    }
}
