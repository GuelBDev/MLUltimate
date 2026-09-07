package net.mlultimate.client.core;

import net.mlultimate.client.render.ColorUtils;
import net.mlultimate.client.render.DrawHelper;
import net.mlultimate.client.render.font.CustomFontRenderer;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Modern toast notification system for MLUltimate Client.
 * Supports SUCCESS, INFO, WARNING and ERROR with slide-in animations,
 * smooth fades and dynamic progress bars.
 */
public class NotificationManager {

    public enum Type {
        SUCCESS(0xFF2ECC71, "SUCESSO"),
        INFO(0xFF4A90E2, "INFO"),
        WARNING(0xFFF1C40F, "AVISO"),
        ERROR(0xFFE74C3C, "ERRO");

        private final int color;
        private final String label;

        Type(int color, String label) {
            this.color = color;
            this.label = label;
        }

        public int getColor() {
            return color;
        }

        public String getLabel() {
            return label;
        }
    }

    public static class Notification {
        private final Type type;
        private final String title;
        private final String message;
        private final long durationMs;
        private final long startTime;
        private float progress = 1.0f;
        private float animOffset = 1.0f; // 1.0 = offscreen, 0.0 = visible
        private boolean expired = false;

        private long lastUpdateTime = System.currentTimeMillis();

        public Notification(Type type, String title, String message, long durationMs) {
            this.type = type;
            this.title = title;
            this.message = message;
            this.durationMs = durationMs;
            this.startTime = System.currentTimeMillis();
            this.lastUpdateTime = this.startTime;
        }

        public void update() {
            long now = System.currentTimeMillis();
            float dt = Math.min(0.1f, Math.max(0.001f, (now - lastUpdateTime) / 1000.0f));
            lastUpdateTime = now;

            long elapsed = now - startTime;
            progress = Math.max(0.0f, 1.0f - ((float) elapsed / durationMs));
            if (elapsed > durationMs) {
                expired = true;
                animOffset = Math.min(1.0f, animOffset + dt * 5.0f);
            } else {
                animOffset = Math.max(0.0f, animOffset - dt * 6.0f);
            }
        }

        public boolean isFinished() {
            return expired && animOffset >= 0.98f;
        }

        public Type getType() { return type; }
        public String getTitle() { return title; }
        public String getMessage() { return message; }
        public float getProgress() { return progress; }
        public float getAnimOffset() { return animOffset; }
    }

    private final List<Notification> notifications = new CopyOnWriteArrayList<>();

    public void show(Type type, String title, String message, long durationMs) {
        while (notifications.size() >= 2) {
            notifications.remove(0);
        }
        notifications.add(new Notification(type, title, message, durationMs));
    }

    public void showSuccess(String message) {
        show(Type.SUCCESS, "MLUltimate", message, 2200);
    }

    public void showInfo(String message) {
        show(Type.INFO, "MLUltimate", message, 2000);
    }

    public void showWarning(String message) {
        show(Type.WARNING, "MLUltimate", message, 2500);
    }

    public void showError(String message) {
        show(Type.ERROR, "MLUltimate", message, 3000);
    }

    public void clear() {
        notifications.clear();
    }

    public void update() {
        for (Notification n : notifications) {
            n.update();
            if (n.isFinished()) {
                notifications.remove(n);
            }
        }
    }

    public void render(int screenWidth, int screenHeight, CustomFontRenderer titleFont, CustomFontRenderer descFont) {
        if (notifications.isEmpty()) return;

        update();

        float width = 210;
        float height = 48;
        float margin = 12;
        float y = screenHeight - margin - height;

        for (Notification n : notifications) {
            float x = screenWidth - margin - width + (n.getAnimOffset() * (width + margin + 10));

            // Background card with shadow
            DrawHelper.drawDropShadow(x, y, width, height, 8, 0x80000000);
            DrawHelper.drawRoundedRect(x, y, width, height, 6.0f, 0xFF191C22);

            // Left accent bar indicating notification type
            DrawHelper.drawRoundedRect(x, y, 4, height, 2.0f, n.getType().getColor());

            // Notification Header
            int titleColor = n.getType().getColor();
            if (titleFont != null) {
                titleFont.drawStringWithShadow(n.getType().getLabel(), x + 12, y + 8, titleColor);
            } else {
                net.mlultimate.client.forge.MinecraftBridge.drawString(n.getType().getLabel(), x + 12, y + 8, titleColor);
            }

            // Notification Message
            if (descFont != null) {
                descFont.drawStringWithShadow(n.getMessage(), x + 12, y + 22, 0xFFFFFFFF);
            } else {
                net.mlultimate.client.forge.MinecraftBridge.drawString(n.getMessage(), x + 12, y + 22, 0xFFFFFFFF);
            }

            // Bottom Progress Bar
            float progressW = (width - 8) * n.getProgress();
            if (progressW > 0) {
                DrawHelper.drawRect(x + 4, y + height - 2, progressW, 2, n.getType().getColor());
            }

            y -= (height + 8);
        }
    }

    public List<Notification> getNotifications() {
        return notifications;
    }
}
