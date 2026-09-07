package net.mlultimate.client.core;

import net.mlultimate.client.MLUltimate;

import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * High-precision Tick Manager for MLUltimate Client.
 * Tracks client ticks, render frames, delta times and schedules thread-safe delayed tasks.
 */
public class TickManager {

    private long tickCount = 0;
    private long lastFrameTime = System.nanoTime();
    private float partialTicks = 0.0f;
    private final Queue<Runnable> mainThreadTasks = new ConcurrentLinkedQueue<>();

    public void onClientTick() {
        tickCount++;

        // Execute scheduled main-thread tasks
        Runnable task;
        while ((task = mainThreadTasks.poll()) != null) {
            try {
                task.run();
            } catch (Throwable t) {
                t.printStackTrace();
            }
        }

        // Forward tick to module manager
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getModuleManager() != null) {
            MLUltimate.getInstance().getModuleManager().onTick();
        }

        // Update notifications
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getNotificationManager() != null) {
            MLUltimate.getInstance().getNotificationManager().update();
        }
    }

    public void onRenderTick(float partialTicks) {
        this.partialTicks = partialTicks;
        this.lastFrameTime = System.nanoTime();
    }

    public void runOnNextTick(Runnable task) {
        if (task != null) {
            mainThreadTasks.add(task);
        }
    }

    public long getTickCount() {
        return tickCount;
    }

    public float getPartialTicks() {
        return partialTicks;
    }
}
