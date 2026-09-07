package net.mlultimate.client.render.hud;

import net.mlultimate.client.render.DrawHelper;
import net.mlultimate.client.render.font.CustomFontRenderer;
import org.lwjgl.opengl.GL11;

import java.util.Locale;

/**
 * Base class for all modular and interactive HUD elements in MLUltimate Client.
 * Supports freeform drag-and-drop, screen snapping, individual scaling and config persistence.
 */
public abstract class HudElement {

    private final String id;
    private final String name;

    protected float x;
    protected float y;
    protected float width;
    protected float height;
    protected float scale = 1.0f;

    protected final float defaultX;
    protected final float defaultY;

    private boolean dragging = false;
    private float dragOffsetX = 0.0f;
    private float dragOffsetY = 0.0f;

    private final CustomFontRenderer font = new CustomFontRenderer(0.85f);

    public HudElement(String id, String name, float defaultX, float defaultY, float defaultW, float defaultH) {
        this.id = id;
        this.name = name;
        this.defaultX = defaultX;
        this.defaultY = defaultY;
        this.x = defaultX;
        this.y = defaultY;
        this.width = defaultW;
        this.height = defaultH;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public float getX() {
        return x;
    }

    public void setX(float x) {
        this.x = x;
    }

    public float getY() {
        return y;
    }

    public void setY(float y) {
        this.y = y;
    }

    public float getWidth() {
        return width * scale;
    }

    public void setWidth(float width) {
        this.width = width;
    }

    public float getHeight() {
        return height * scale;
    }

    public void setHeight(float height) {
        this.height = height;
    }

    public float getScale() {
        return scale;
    }

    public void setScale(float scale) {
        this.scale = Math.max(0.6f, Math.min(2.0f, scale));
    }

    public void resetPosition() {
        this.x = defaultX;
        this.y = defaultY;
        this.scale = 1.0f;
    }

    public boolean isHovered(int mouseX, int mouseY) {
        float w = getWidth();
        float h = getHeight();
        return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    }

    public void startDrag(int mouseX, int mouseY) {
        this.dragging = true;
        this.dragOffsetX = mouseX - this.x;
        this.dragOffsetY = mouseY - this.y;
    }

    public void updateDrag(int mouseX, int mouseY, int screenWidth, int screenHeight, boolean snapping) {
        if (!dragging) return;

        float targetX = mouseX - dragOffsetX;
        float targetY = mouseY - dragOffsetY;
        float w = getWidth();
        float h = getHeight();

        // Edge snapping (6 pixels threshold)
        if (snapping) {
            float snapDist = 8.0f;
            if (Math.abs(targetX - 6.0f) < snapDist) targetX = 6.0f;
            if (Math.abs(targetX + w - (screenWidth - 6.0f)) < snapDist) targetX = screenWidth - 6.0f - w;
            if (Math.abs(targetY - 6.0f) < snapDist) targetY = 6.0f;
            if (Math.abs(targetY + h - (screenHeight - 6.0f)) < snapDist) targetY = screenHeight - 6.0f - h;

            // Center snapping
            float centerX = (screenWidth - w) / 2.0f;
            if (Math.abs(targetX - centerX) < snapDist) targetX = centerX;
        }

        // Clamp inside screen bounds
        this.x = Math.max(0.0f, Math.min(screenWidth - w, targetX));
        this.y = Math.max(0.0f, Math.min(screenHeight - h, targetY));
    }

    public void stopDrag() {
        this.dragging = false;
    }

    public boolean isDragging() {
        return dragging;
    }

    public void render(float partialTicks, boolean inEditor) {
        if (!isEnabled()) return;

        GL11.glPushMatrix();
        GL11.glTranslatef(x, y, 0.0f);
        if (Math.abs(scale - 1.0f) > 0.01f) {
            GL11.glScalef(scale, scale, 1.0f);
        }

        renderContent(partialTicks, inEditor);

        GL11.glPopMatrix();

        if (inEditor) {
            renderEditorBox();
        }
    }

    protected void renderEditorBox() {
        float w = getWidth();
        float h = getHeight();

        // Glowing boundary box
        int borderColor = dragging ? 0xFF00E5FF : 0xFF4A90E2;
        int fill = dragging ? 0x2500E5FF : 0x154A90E2;

        DrawHelper.drawRect(x, y, w, h, fill);
        DrawHelper.drawOutline(x, y, w, h, 1.5f, borderColor);

        // Header label with scale
        String label = String.format(Locale.ROOT, "%s (%.1fx)", name, scale);
        float badgeW = font.getStringWidth(label) + 8.0f;
        float badgeH = 12.0f;
        float badgeY = y - badgeH - 2.0f;
        if (badgeY < 2.0f) badgeY = y + h + 2.0f;

        DrawHelper.drawRoundedRect(x, badgeY, badgeW, badgeH, 3.0f, 0xCC11141B);
        DrawHelper.drawOutline(x, badgeY, badgeW, badgeH, 1.0f, borderColor);
        font.drawStringWithShadow(label, x + 4.0f, badgeY + 2.0f, 0xFFFFFFFF);
    }

    public abstract boolean isEnabled();

    public abstract void renderContent(float partialTicks, boolean inEditor);
}
