package net.mlultimate.client.test;

import net.mlultimate.client.modules.combat.CrosshairModule;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.InputStream;

public class ResourceAndCrosshairTest {

    @Test
    public void testLogoResourceAvailableAndValid() throws Exception {
        InputStream in = getClass().getResourceAsStream("/assets/mlultimate/logo.png");
        Assertions.assertNotNull(in, "Logo resource /assets/mlultimate/logo.png must be present on classpath");

        BufferedImage img = ImageIO.read(in);
        in.close();
        Assertions.assertNotNull(img, "Logo image must decode successfully");
        Assertions.assertTrue(img.getWidth() > 0, "Logo image width must be positive");
        Assertions.assertTrue(img.getHeight() > 0, "Logo image height must be positive");
    }

    @Test
    public void testCrosshairModuleDefaults() {
        CrosshairModule mod = new CrosshairModule();
        Assertions.assertTrue(mod.isEnabled(), "Crosshair module must be enabled by default");
        Assertions.assertEquals("Cruz (Padrão)", mod.getShape());
        Assertions.assertEquals(7.0, mod.getSize(), 0.001);
        Assertions.assertEquals(1.5, mod.getThickness(), 0.001);
        Assertions.assertEquals(1.0, mod.getGap(), 0.001);
        Assertions.assertTrue(mod.isOutline());
        Assertions.assertTrue(mod.isDynamicHitColor());

        // Test onHit state
        Assertions.assertFalse(mod.isHitActive());
        mod.onHit();
        Assertions.assertTrue(mod.isHitActive());
        Assertions.assertEquals(0xFFFF3333, mod.getColor());
    }
}
