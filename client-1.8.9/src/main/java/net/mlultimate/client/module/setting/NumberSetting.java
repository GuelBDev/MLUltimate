package net.mlultimate.client.module.setting;

public class NumberSetting extends Setting<Double> {

    private final double min;
    private final double max;
    private final double step;

    public NumberSetting(String id, String name, String description, double defaultValue, double min, double max, double step) {
        super(id, name, description, defaultValue);
        this.min = min;
        this.max = max;
        this.step = step;
        clampValue();
    }

    public double getMin() {
        return min;
    }

    public double getMax() {
        return max;
    }

    public double getStep() {
        return step;
    }

    public float getFloatValue() {
        return getValue().floatValue();
    }

    public int getIntValue() {
        return getValue().intValue();
    }

    public double getDoubleValue() {
        return getValue();
    }

    @Override
    public void setValue(Double val) {
        if (val == null) val = getDefaultValue();
        double clamped = Math.max(min, Math.min(max, val));
        if (step > 0.0) {
            clamped = Math.round(clamped / step) * step;
        }
        super.setValue(clamped);
    }

    private void clampValue() {
        setValue(getValue());
    }
}
