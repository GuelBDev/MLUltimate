package net.mlultimate.client.test;

import net.mlultimate.client.core.ProfileManager;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;

public class ProfileManagerTest {

    @TempDir
    File tempDir;

    private ProfileManager profileManager;

    @BeforeEach
    public void setup() {
        profileManager = new ProfileManager(tempDir);
    }

    @Test
    public void testDefaultProfilesInitialization() {
        Assertions.assertTrue(profileManager.getAvailableProfiles().contains("Default"));
        Assertions.assertTrue(profileManager.getAvailableProfiles().contains("PvP"));
        Assertions.assertTrue(profileManager.getAvailableProfiles().contains("Hypixel"));
        Assertions.assertTrue(profileManager.getAvailableProfiles().contains("BedWars"));
    }

    @Test
    public void testCreateDuplicateAndDeleteProfile() {
        boolean created = profileManager.createProfile("CustomArena");
        Assertions.assertTrue(created);
        Assertions.assertTrue(profileManager.getAvailableProfiles().contains("CustomArena"));

        boolean duplicated = profileManager.duplicateProfile("CustomArena", "CustomArenaCopy");
        Assertions.assertTrue(duplicated);
        Assertions.assertTrue(profileManager.getAvailableProfiles().contains("CustomArenaCopy"));

        boolean deleted = profileManager.deleteProfile("CustomArenaCopy");
        Assertions.assertTrue(deleted);
        Assertions.assertFalse(profileManager.getAvailableProfiles().contains("CustomArenaCopy"));
    }

    @Test
    public void testDefaultProfileProtection() {
        // Must prevent deleting Default profile
        boolean deleted = profileManager.deleteProfile("Default");
        Assertions.assertFalse(deleted);
        Assertions.assertTrue(profileManager.getAvailableProfiles().contains("Default"));
    }
}
