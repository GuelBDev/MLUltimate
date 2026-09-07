package net.mlultimate.client.core;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.event.events.Render2DEvent;
import net.mlultimate.client.event.events.Render3DEvent;
import net.mlultimate.client.forge.MinecraftBridge;

/**
 * Central Render Manager for MLUltimate Client.
 * Coordinates 2D overlays, 3D world elements, custom crosshair, notifications and HUD editor.
 */
public class RenderManager {

    private final net.mlultimate.client.render.hud.HudRenderer hudRenderer = new net.mlultimate.client.render.hud.HudRenderer();
    private final net.mlultimate.client.render.font.CustomFontRenderer font = new net.mlultimate.client.render.font.CustomFontRenderer(0.95f);
    private final net.mlultimate.client.render.font.CustomFontRenderer smallFont = new net.mlultimate.client.render.font.CustomFontRenderer(0.80f);

    public void render2D(float partialTicks, int scaledWidth, int scaledHeight) {
        // 1. Dispatch Render2DEvent across event bus
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getEventBus() != null) {
            MLUltimate.getInstance().getEventBus().post(new Render2DEvent(partialTicks, scaledWidth, scaledHeight));
        }

        // 2. Render modules 2D
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getModuleManager() != null) {
            MLUltimate.getInstance().getModuleManager().onRender();
        }

        // 3. Render custom crosshair
        hudRenderer.renderCrosshair(scaledWidth, scaledHeight);

        // 4. Render modern responsive HUD widgets via HudManager
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getHudManager() != null) {
            MLUltimate.getInstance().getHudManager().render(partialTicks, false);
        }

        // 5. Render in-game toast notifications
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getNotificationManager() != null) {
            MLUltimate.getInstance().getNotificationManager().render(
                    scaledWidth,
                    scaledHeight,
                    font,
                    smallFont
            );
        }
    }

    public void render3D(float partialTicks) {
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getEventBus() != null) {
            MLUltimate.getInstance().getEventBus().post(new Render3DEvent(partialTicks));
        }
    }
}
