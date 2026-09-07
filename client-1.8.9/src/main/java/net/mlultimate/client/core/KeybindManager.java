package net.mlultimate.client.core;

import net.mlultimate.client.module.Module;
import org.lwjgl.input.Keyboard;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Centralized Keybind Manager for MLUltimate Client.
 * Tracks key assignments, prevents unintended conflicts and alerts the user
 * when keybind overlaps occur.
 */
public class KeybindManager {

    private final Map<Integer, List<Module>> keyBindings = new ConcurrentHashMap<>();

    public void registerKeybind(int key, Module module) {
        if (key == 0 || key == Keyboard.KEY_NONE || module == null) return;
        keyBindings.computeIfAbsent(key, k -> new ArrayList<>()).add(module);
    }

    public void unregisterKeybind(int key, Module module) {
        if (key == 0 || module == null) return;
        List<Module> list = keyBindings.get(key);
        if (list != null) {
            list.remove(module);
            if (list.isEmpty()) {
                keyBindings.remove(key);
            }
        }
    }

    public void updateModuleKeybind(Module module, int oldKey, int newKey) {
        if (module == null) return;
        unregisterKeybind(oldKey, module);
        registerKeybind(newKey, module);
        module.setKeyBind(newKey);
    }

    /**
     * Checks if a key is already mapped to another module.
     * Returns the conflicting modules if any.
     */
    public List<Module> getConflictingModules(int key, Module requestingModule) {
        if (key == 0 || key == Keyboard.KEY_NONE) return Collections.emptyList();
        List<Module> bound = keyBindings.get(key);
        if (bound == null) return Collections.emptyList();

        List<Module> conflicts = new ArrayList<>();
        for (Module m : bound) {
            if (m != requestingModule) {
                conflicts.add(m);
            }
        }
        return conflicts;
    }

    public boolean hasConflict(int key, Module requestingModule) {
        return !getConflictingModules(key, requestingModule).isEmpty();
    }

    public void handleKeyInput(int key, boolean pressed) {
        if (!pressed || key == 0 || key == Keyboard.KEY_NONE) return;

        List<Module> modules = keyBindings.get(key);
        if (modules != null) {
            for (Module m : modules) {
                m.toggle();
            }
        }
    }

    public void clear() {
        keyBindings.clear();
    }
}
