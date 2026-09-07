package net.mlultimate.client.event.events;

import net.mlultimate.client.event.Event;

public class Render3DEvent implements Event {

    private final float partialTicks;

    public Render3DEvent(float partialTicks) {
        this.partialTicks = partialTicks;
    }

    public float getPartialTicks() {
        return partialTicks;
    }
}
