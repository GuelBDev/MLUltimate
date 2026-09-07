package net.mlultimate.client.test;

import net.mlultimate.client.module.Category;
import net.mlultimate.client.module.Module;
import net.mlultimate.client.util.ModuleExceptionHandler;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class ModuleExceptionHandlerTest {

    public static class FaultyModule extends Module {
        public FaultyModule() {
            super("faulty", "Faulty Test Module", "Module that throws deliberately", Category.COMBAT);
        }

        @Override
        public void onTick() {
            throw new RuntimeException("Deliberate crash simulation in tick!");
        }
    }

    @Test
    public void testSafeExecutionDisablesModuleOnException() {
        FaultyModule module = new FaultyModule();
        module.setEnabled(true);
        Assertions.assertTrue(module.isEnabled());

        // Calling safeTick should catch exception, disable module, and not throw
        Assertions.assertDoesNotThrow(module::safeTick);

        // Offending module should now be disabled
        Assertions.assertFalse(module.isEnabled(), "Module must be automatically disabled upon throwing exception");
    }
}
