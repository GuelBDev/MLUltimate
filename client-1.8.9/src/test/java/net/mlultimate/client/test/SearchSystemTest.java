package net.mlultimate.client.test;

import net.mlultimate.client.core.ModuleManager;
import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

public class SearchSystemTest {

    private ModuleManager moduleManager;

    public static class SampleMod extends Module {
        public SampleMod(String id, String name, String desc, Category category) {
            super(id, name, desc, category);
        }
    }

    @BeforeEach
    public void setup() {
        moduleManager = new ModuleManager();
        moduleManager.register(new SampleMod("fps", "FPS Counter", "Mostra o FPS atual", Category.HUD));
        moduleManager.register(new SampleMod("cps", "CPS Counter", "Contador de cliques", Category.HUD));
        moduleManager.register(new SampleMod("togglesprint", "Toggle Sprint", "Mantém a corrida", Category.MOVEMENT));
        moduleManager.register(new SampleMod("zoom", "Smooth Zoom", "Aproximação suave", Category.VISUAL));
    }

    @Test
    public void testSearchByName() {
        List<Module> results = moduleManager.search("Zoom");
        Assertions.assertEquals(1, results.size());
        Assertions.assertEquals("zoom", results.get(0).getId());
    }

    @Test
    public void testSearchByCategory() {
        List<Module> results = moduleManager.search("HUD");
        Assertions.assertEquals(2, results.size());
    }

    @Test
    public void testSearchByDescription() {
        List<Module> results = moduleManager.search("corrida");
        Assertions.assertEquals(1, results.size());
        Assertions.assertEquals("togglesprint", results.get(0).getId());
    }

    @Test
    public void testEmptyQueryReturnsAll() {
        List<Module> results = moduleManager.search("");
        Assertions.assertEquals(4, results.size());
    }
}
