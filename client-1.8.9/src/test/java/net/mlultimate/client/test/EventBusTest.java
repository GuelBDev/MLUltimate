package net.mlultimate.client.test;

import net.mlultimate.client.event.*;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

public class EventBusTest {

    private EventBus eventBus;

    public static class SampleEvent extends CancellableEvent {
        private final String message;

        public SampleEvent(String message) {
            this.message = message;
        }

        public String getMessage() {
            return message;
        }
    }

    public static class TestListener {
        final List<String> calls = new ArrayList<>();

        @Subscribe(priority = Priority.NORMAL)
        public void onNormal(SampleEvent event) {
            calls.add("NORMAL:" + event.getMessage());
        }

        @Subscribe(priority = Priority.HIGHEST)
        public void onHighest(SampleEvent event) {
            calls.add("HIGHEST:" + event.getMessage());
        }

        @Subscribe(priority = Priority.LOW)
        public void onLow(SampleEvent event) {
            calls.add("LOW:" + event.getMessage());
        }
    }

    public static class CancellingListener {
        @Subscribe(priority = Priority.HIGH)
        public void onCancel(SampleEvent event) {
            event.cancel();
        }
    }

    public static class IgnoreCancelledListener {
        boolean invoked = false;

        @Subscribe(priority = Priority.LOW, ignoreCancelled = true)
        public void onIgnored(SampleEvent event) {
            invoked = true;
        }
    }

    @BeforeEach
    public void setup() {
        eventBus = new EventBus();
    }

    @Test
    public void testPriorityOrdering() {
        TestListener listener = new TestListener();
        eventBus.register(listener);

        eventBus.post(new SampleEvent("order"));

        Assertions.assertEquals(3, listener.calls.size());
        Assertions.assertEquals("HIGHEST:order", listener.calls.get(0));
        Assertions.assertEquals("NORMAL:order", listener.calls.get(1));
        Assertions.assertEquals("LOW:order", listener.calls.get(2));
    }

    @Test
    public void testEventCancellationAndIgnoreCancelled() {
        CancellingListener canceller = new CancellingListener();
        IgnoreCancelledListener ignoreListener = new IgnoreCancelledListener();

        eventBus.register(canceller);
        eventBus.register(ignoreListener);

        SampleEvent event = eventBus.post(new SampleEvent("cancel_test"));

        Assertions.assertTrue(event.isCancelled());
        Assertions.assertFalse(ignoreListener.invoked, "Subscribers with ignoreCancelled must be skipped when event is cancelled");
    }

    @Test
    public void testUnregister() {
        TestListener listener = new TestListener();
        eventBus.register(listener);
        eventBus.unregister(listener);

        eventBus.post(new SampleEvent("test"));
        Assertions.assertEquals(0, listener.calls.size());
    }
}
