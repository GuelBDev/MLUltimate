package net.mlultimate.client.core;

import net.mlultimate.client.event.Event;
import net.mlultimate.client.event.EventBus;

/**
 * Event Manager coordinating event dispatching across MLUltimate Client.
 */
public class EventManager {

    private final EventBus eventBus;

    public EventManager() {
        this.eventBus = new EventBus();
    }

    public EventBus getEventBus() {
        return eventBus;
    }

    public void register(Object listener) {
        eventBus.register(listener);
    }

    public void unregister(Object listener) {
        eventBus.unregister(listener);
    }

    public <T extends Event> T post(T event) {
        return eventBus.post(event);
    }

    public void clear() {
        eventBus.clear();
    }
}
