package net.mlultimate.client.event.events;

import net.mlultimate.client.event.CancellableEvent;

public class MouseEvent extends CancellableEvent {

    private final int button;
    private final boolean state;

    public MouseEvent(int button, boolean state) {
        this.button = button;
        this.state = state;
    }

    public int getButton() {
        return button;
    }

    public boolean getState() {
        return state;
    }
}
