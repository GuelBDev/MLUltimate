package net.mlultimate.client.core;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Module Manager for MLUltimate Client.
 * Handles lifecycle execution, module registration, search indexing and safe dispatch.
 */
public class ModuleManager {

    private final Map<String, Module> moduleMap = new ConcurrentHashMap<>();
    private final List<Module> modules = new ArrayList<>();

    public void register(Module module) {
        if (module == null) return;
        moduleMap.put(module.getId().toLowerCase(Locale.ROOT), module);
        if (!modules.contains(module)) {
            modules.add(module);
        }
    }

    public void registerAll(Module... mods) {
        if (mods == null) return;
        for (Module m : mods) {
            register(m);
        }
    }

    public Module getModuleById(String id) {
        if (id == null) return null;
        return moduleMap.get(id.toLowerCase(Locale.ROOT));
    }

    @SuppressWarnings("unchecked")
    public <T extends Module> T getModuleByClass(Class<T> clazz) {
        if (clazz == null) return null;
        for (Module m : modules) {
            if (clazz.isInstance(m)) {
                return (T) m;
            }
        }
        return null;
    }

    public List<Module> getModules() {
        return Collections.unmodifiableList(modules);
    }

    public List<Module> getModulesByCategory(Category category) {
        if (category == null || category == Category.ALL) {
            return Collections.unmodifiableList(modules);
        }
        return modules.stream()
                .filter(m -> m.getCategory() == category)
                .collect(Collectors.toList());
    }

    public List<Module> search(String query) {
        if (query == null || query.trim().isEmpty()) {
            return Collections.unmodifiableList(modules);
        }
        String lower = query.trim().toLowerCase(Locale.ROOT);
        return modules.stream()
                .filter(m -> m.getName().toLowerCase(Locale.ROOT).contains(lower)
                        || m.getDescription().toLowerCase(Locale.ROOT).contains(lower)
                        || m.getCategory().getDisplayName().toLowerCase(Locale.ROOT).contains(lower)
                        || m.getId().toLowerCase(Locale.ROOT).contains(lower))
                .collect(Collectors.toList());
    }

    public void onTick() {
        for (Module m : modules) {
            if (m.isEnabled()) {
                m.safeTick();
            }
        }
    }

    public void onRender() {
        for (Module m : modules) {
            if (m.isEnabled()) {
                m.safeRender();
            }
        }
    }

    public void onKeyInput() {
        for (Module m : modules) {
            if (m.isEnabled()) {
                m.safeKeyInput();
            }
        }
    }
}
