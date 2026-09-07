package net.mlultimate.client.event;

/**
 * Base class for cancellable events.
 */
public abstract class CancellableEvent implements Event {

    private boolean cancelled = false;

    public boolean isCancelled() {
        return cancelled;
    }

    public void setCancelled(boolean cancelled) {
        this.cancelled = cancelled;
    }

    public void cancel() {
        this.cancelled = true;
    }
}
