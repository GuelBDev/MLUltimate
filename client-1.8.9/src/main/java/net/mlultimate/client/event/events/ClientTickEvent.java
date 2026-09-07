package net.mlultimate.client.event.events;

import net.mlultimate.client.event.Event;

public class ClientTickEvent implements Event {

    public enum Phase {
        START,
        END
    }

    private final Phase phase;

    public ClientTickEvent(Phase phase) {
        this.phase = phase;
    }

    public Phase getPhase() {
        return phase;
    }
}
