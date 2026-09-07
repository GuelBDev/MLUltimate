package net.mlultimate.client.test;

import net.mlultimate.client.animation.Animation;
import net.mlultimate.client.animation.Ease;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class AnimationTest {

    @Test
    public void testEaseLinearProgression() {
        Assertions.assertEquals(0.0, Ease.LINEAR.ease(0.0), 0.0001);
        Assertions.assertEquals(0.5, Ease.LINEAR.ease(0.5), 0.0001);
        Assertions.assertEquals(1.0, Ease.LINEAR.ease(1.0), 0.0001);
    }

    @Test
    public void testEaseOutCubicCurve() {
        Assertions.assertEquals(0.0, Ease.EASE_OUT_CUBIC.ease(0.0), 0.0001);
        Assertions.assertEquals(1.0, Ease.EASE_OUT_CUBIC.ease(1.0), 0.0001);
        // Eased out value at 0.5 must be greater than linear 0.5
        Assertions.assertTrue(Ease.EASE_OUT_CUBIC.ease(0.5) > 0.5);
    }

    @Test
    public void testAnimationInterpolation() throws InterruptedException {
        Animation anim = new Animation(100, 0.0, Ease.LINEAR);
        anim.animateTo(100.0);

        Assertions.assertEquals(0.0, anim.getValue(), 1.0);

        // Sleep to let time elapse
        Thread.sleep(110);

        Assertions.assertTrue(anim.isFinished(), "Animation must be marked finished after duration");
        Assertions.assertEquals(100.0, anim.getValue(), 0.001);
    }
}
