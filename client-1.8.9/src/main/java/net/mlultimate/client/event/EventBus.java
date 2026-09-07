package net.mlultimate.client.event;

import net.mlultimate.client.util.Logger;

import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.Method;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Ultra high-performance, low-latency, thread-safe EventBus for MLUltimate Client.
 * Uses MethodHandles to invoke subscribers with minimal overhead and zero garbage allocations.
 */
public class EventBus {

    private final Map<Class<? extends Event>, List<SubscriberMethod>> subscriberMap = new ConcurrentHashMap<>();
    private final Set<Object> registeredListeners = Collections.newSetFromMap(new ConcurrentHashMap<>());
    private final MethodHandles.Lookup lookup = MethodHandles.lookup();

    /**
     * Registers all @Subscribe annotated methods of an object.
     */
    public void register(Object listener) {
        if (listener == null) return;
        if (!registeredListeners.add(listener)) {
            return; // Already registered
        }

        for (Method method : listener.getClass().getDeclaredMethods()) {
            if (!method.isAnnotationPresent(Subscribe.class)) continue;
            if (method.getParameterCount() != 1) continue;

            Class<?> paramType = method.getParameterTypes()[0];
            if (!Event.class.isAssignableFrom(paramType)) continue;

            @SuppressWarnings("unchecked")
            Class<? extends Event> eventClass = (Class<? extends Event>) paramType;
            Subscribe annotation = method.getAnnotation(Subscribe.class);

            method.setAccessible(true);
            try {
                MethodHandle handle = lookup.unreflect(method);
                SubscriberMethod subscriberMethod = new SubscriberMethod(
                        listener,
                        handle,
                        annotation.priority(),
                        annotation.ignoreCancelled()
                );

                List<SubscriberMethod> list = subscriberMap.computeIfAbsent(eventClass, k -> new CopyOnWriteArrayList<>());
                list.add(subscriberMethod);
                list.sort((a, b) -> Integer.compare(b.priority.getValue(), a.priority.getValue()));
            } catch (IllegalAccessException e) {
                Logger.error(Logger.Category.CORE, "Falha ao vincular método de evento: " + method.getName() + " em " + listener.getClass().getName(), e);
            }
        }
    }

    /**
     * Unregisters all subscribers belonging to the listener object.
     */
    public void unregister(Object listener) {
        if (listener == null) return;
        if (!registeredListeners.remove(listener)) {
            return;
        }

        for (List<SubscriberMethod> list : subscriberMap.values()) {
            list.removeIf(sub -> sub.target == listener);
        }
    }

    /**
     * Posts an event to all registered subscribers in priority order.
     */
    public <T extends Event> T post(T event) {
        if (event == null) return null;

        List<SubscriberMethod> subscribers = subscriberMap.get(event.getClass());
        if (subscribers == null || subscribers.isEmpty()) {
            return event;
        }

        boolean isCancellable = event instanceof CancellableEvent;

        for (SubscriberMethod subscriber : subscribers) {
            if (isCancellable && ((CancellableEvent) event).isCancelled() && subscriber.ignoreCancelled) {
                continue;
            }

            try {
                subscriber.handle.invoke(subscriber.target, event);
            } catch (Throwable t) {
                Logger.error(Logger.Category.CORE, "Erro ao despachar evento " + event.getClass().getSimpleName() + " para " + subscriber.target.getClass().getSimpleName(), t);
            }
        }

        return event;
    }

    public boolean isRegistered(Object listener) {
        return registeredListeners.contains(listener);
    }

    public void clear() {
        subscriberMap.clear();
        registeredListeners.clear();
    }

    private static class SubscriberMethod {
        final Object target;
        final MethodHandle handle;
        final Priority priority;
        final boolean ignoreCancelled;

        SubscriberMethod(Object target, MethodHandle handle, Priority priority, boolean ignoreCancelled) {
            this.target = target;
            this.handle = handle;
            this.priority = priority;
            this.ignoreCancelled = ignoreCancelled;
        }
    }
}
