package net.mlultimate.client.event.events;

import net.mlultimate.client.event.CancellableEvent;

public class KeyEvent extends CancellableEvent {

    private final int key;
    private final boolean state;

    public KeyEvent(int key, boolean state) {
        this.key = key;
        this.state = state;
    }

    public int getKey() {
        return key;
    }

    public boolean getState() {
        return state;
    }
}
