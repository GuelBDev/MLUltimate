package net.mlultimate.client.render;

import org.lwjgl.opengl.GL11;
import java.awt.Rectangle;
import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Manages nested OpenGL scissor regions for MLUltimate Client UI containers and scroll panels.
 * Transforms screen coordinates into native window scissor bounds.
 */
public class ScissorStack {

    private static final Deque<Rectangle> STACK = new ArrayDeque<>();

    public static void clear() {
        STACK.clear();
        try {
            GL11.glDisable(GL11.GL_SCISSOR_TEST);
        } catch (Throwable ignored) {
        }
    }

    public static void push(int x, int y, int width, int height, int displayWidth, int displayHeight, int screenWidth, int screenHeight) {
        if (width <= 0 || height <= 0) return;

        double scaleX = (double) displayWidth / (double) Math.max(1, screenWidth);
        double scaleY = (double) displayHeight / (double) Math.max(1, screenHeight);

        int realX = (int) Math.round(x * scaleX);
        int realY = (int) Math.round((screenHeight - (y + height)) * scaleY);
        int realW = (int) Math.round(width * scaleX);
        int realH = (int) Math.round(height * scaleY);

        if (realX < 0) {
            realW += realX;
            realX = 0;
        }
        if (realY < 0) {
            realH += realY;
            realY = 0;
        }
        if (realW < 0) realW = 0;
        if (realH < 0) realH = 0;
        if (realX + realW > displayWidth) realW = Math.max(0, displayWidth - realX);
        if (realY + realH > displayHeight) realH = Math.max(0, displayHeight - realY);

        Rectangle newRect = new Rectangle(realX, realY, realW, realH);

        if (!STACK.isEmpty()) {
            Rectangle parent = STACK.peek();
            newRect = parent.intersection(newRect);
            if (newRect.width < 0) newRect.width = 0;
            if (newRect.height < 0) newRect.height = 0;
        } else {
            GL11.glEnable(GL11.GL_SCISSOR_TEST);
        }

        STACK.push(newRect);
        GL11.glScissor(newRect.x, newRect.y, newRect.width, newRect.height);
    }

    public static void push(int x, int y, int width, int height, int displayWidth, int displayHeight, int scaleFactor) {
        int sf = Math.max(1, scaleFactor);
        int screenWidth = displayWidth / sf;
        int screenHeight = displayHeight / sf;
        push(x, y, width, height, displayWidth, displayHeight, screenWidth, screenHeight);
    }

    public static void pop() {
        if (STACK.isEmpty()) return;
        STACK.pop();

        if (STACK.isEmpty()) {
            GL11.glDisable(GL11.GL_SCISSOR_TEST);
        } else {
            Rectangle rect = STACK.peek();
            GL11.glScissor(rect.x, rect.y, rect.width, rect.height);
        }
    }
}
