package net.mlultimate.client.event.events;

import net.mlultimate.client.event.CancellableEvent;

public class PacketEvent extends CancellableEvent {

    public enum Direction {
        INBOUND,
        OUTBOUND
    }

    private final Object packet;
    private final Direction direction;

    public PacketEvent(Object packet, Direction direction) {
        this.packet = packet;
        this.direction = direction;
    }

    public Object getPacket() {
        return packet;
    }

    public Direction getDirection() {
        return direction;
    }

    public boolean isInbound() {
        return direction == Direction.INBOUND;
    }

    public boolean isOutbound() {
        return direction == Direction.OUTBOUND;
    }
}
