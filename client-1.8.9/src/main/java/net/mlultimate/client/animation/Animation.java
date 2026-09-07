package net.mlultimate.client.animation;

/**
 * Delta-time driven animation interpolator.
 * Guarantees consistent transition duration regardless of FPS.
 */
public class Animation {

    private long durationMs;
    private long startTime;
    private double startValue;
    private double targetValue;
    private Ease ease;

    public Animation(long durationMs, double initialValue, Ease ease) {
        this.durationMs = Math.max(1, durationMs);
        this.startValue = initialValue;
        this.targetValue = initialValue;
        this.ease = ease != null ? ease : Ease.LINEAR;
        this.startTime = System.currentTimeMillis();
    }

    public void animateTo(double target) {
        if (Math.abs(this.targetValue - target) < 0.0001) return;
        this.startValue = getValue();
        this.targetValue = target;
        this.startTime = System.currentTimeMillis();
    }

    public void reset(double value) {
        this.startValue = value;
        this.targetValue = value;
        this.startTime = System.currentTimeMillis();
    }

    public double getValue() {
        long elapsed = System.currentTimeMillis() - startTime;
        if (elapsed >= durationMs) {
            return targetValue;
        }

        double progress = Math.max(0.0, Math.min(1.0, (double) elapsed / durationMs));
        double eased = ease.ease(progress);
        return startValue + (targetValue - startValue) * eased;
    }

    public float getFloatValue() {
        return (float) getValue();
    }

    public boolean isFinished() {
        return (System.currentTimeMillis() - startTime) >= durationMs;
    }

    public double getTargetValue() {
        return targetValue;
    }

    public void setDuration(long durationMs) {
        this.durationMs = Math.max(1, durationMs);
    }

    public void setEase(Ease ease) {
        this.ease = ease != null ? ease : Ease.LINEAR;
    }
}
