package net.mlultimate.client.event.events;

import net.mlultimate.client.event.CancellableEvent;

public class ChatEvent extends CancellableEvent {

    private String message;

    public ChatEvent(String message) {
        this.message = message;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
