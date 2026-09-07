package net.mlultimate.client.event;

/**
 * Execution priority for event subscribers in descending order.
 */
public enum Priority {
    HIGHEST(100),
    HIGH(50),
    NORMAL(0),
    LOW(-50),
    LOWEST(-100);

    private final int value;

    Priority(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }
}
