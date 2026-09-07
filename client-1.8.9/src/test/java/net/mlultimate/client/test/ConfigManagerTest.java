package net.mlultimate.client.test;

import com.google.gson.JsonObject;
import net.mlultimate.client.core.ConfigManager;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

public class ConfigManagerTest {

    @TempDir
    File tempDir;

    private ConfigManager configManager;

    @BeforeEach
    public void setUp() {
        configManager = new ConfigManager(tempDir);
    }

    @Test
    public void testAtomicSaveAndBackupCreation() {
        File configFile = new File(configManager.getConfigDir(), "test_config.json");
        File bakFile = new File(configManager.getConfigDir(), "test_config.json.bak");

        JsonObject v1 = new JsonObject();
        v1.addProperty("key", "value1");
        configManager.atomicSave(configFile, v1);

        Assertions.assertTrue(configFile.exists(), "Target file must exist after atomicSave");

        // Second save should create .bak backup
        JsonObject v2 = new JsonObject();
        v2.addProperty("key", "value2");
        configManager.atomicSave(configFile, v2);

        Assertions.assertTrue(bakFile.exists(), "Backup .bak file must be created on update");

        JsonObject readBack = configManager.readJsonSafe(configFile);
        Assertions.assertNotNull(readBack);
        Assertions.assertEquals("value2", readBack.get("key").getAsString());
    }

    @Test
    public void testCorruptionRecoveryFromBackup() throws IOException {
        File configFile = new File(configManager.getConfigDir(), "corrupt_test.json");

        // 1. Initial valid save
        JsonObject v1 = new JsonObject();
        v1.addProperty("state", "healthy");
        configManager.atomicSave(configFile, v1);

        // 2. Second valid save (creates .bak with "healthy")
        JsonObject v2 = new JsonObject();
        v2.addProperty("state", "healthy_v2");
        configManager.atomicSave(configFile, v2);

        // 3. Deliberately corrupt the primary json file with broken syntax
        try (FileWriter writer = new FileWriter(configFile)) {
            writer.write("{ broken json syntax :::: invalid [}");
        }

        // 4. readJsonSafe should catch syntax exception and recover from .bak
        JsonObject recovered = configManager.readJsonSafe(configFile);
        Assertions.assertNotNull(recovered, "Must not return null on corruption");
        Assertions.assertTrue(recovered.has("state"), "Must restore content from backup");
        Assertions.assertEquals("healthy", recovered.get("state").getAsString());
    }

    @Test
    public void testSafeFallbackWhenBothMissing() {
        File nonExistent = new File(configManager.getConfigDir(), "does_not_exist.json");
        JsonObject result = configManager.readJsonSafe(nonExistent);
        Assertions.assertNull(result, "Non existent file with no backup returns null without error");
    }
}
