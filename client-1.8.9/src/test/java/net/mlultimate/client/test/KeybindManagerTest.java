package net.mlultimate.client.test;

import net.mlultimate.client.core.KeybindManager;
import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.lwjgl.input.Keyboard;

public class KeybindManagerTest {

    public static class DummyModule extends Module {
        public DummyModule(String id, String name, int key) {
            super(id, name, "Dummy module for keybind test", Category.UTILITY, key);
        }
    }

    @Test
    public void testConflictDetection() {
        KeybindManager manager = new KeybindManager();

        DummyModule modA = new DummyModule("mod_a", "Module A", Keyboard.KEY_R);
        DummyModule modB = new DummyModule("mod_b", "Module B", Keyboard.KEY_R);
        DummyModule modC = new DummyModule("mod_c", "Module C", Keyboard.KEY_G);

        manager.registerKeybind(Keyboard.KEY_R, modA);

        // Asking if modB would conflict on KEY_R
        Assertions.assertTrue(manager.hasConflict(Keyboard.KEY_R, modB));
        Assertions.assertEquals(1, manager.getConflictingModules(Keyboard.KEY_R, modB).size());

        // Asking if modA conflicts with itself
        Assertions.assertFalse(manager.hasConflict(Keyboard.KEY_R, modA));

        // Asking about an unused key
        Assertions.assertFalse(manager.hasConflict(Keyboard.KEY_G, modC));
    }
}
