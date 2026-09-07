package net.mlultimate.client.event.events;

import net.mlultimate.client.event.CancellableEvent;

public class AttackEntityEvent extends CancellableEvent {

    private final Object targetEntity;

    public AttackEntityEvent(Object targetEntity) {
        this.targetEntity = targetEntity;
    }

    public Object getTargetEntity() {
        return targetEntity;
    }
}
