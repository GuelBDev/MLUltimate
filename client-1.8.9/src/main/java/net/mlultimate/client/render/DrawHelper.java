package net.mlultimate.client.render;

import net.mlultimate.client.forge.MinecraftBridge;
import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.GL11;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.nio.ByteBuffer;

/**
 * OpenGL 2D Drawing Helper for MLUltimate Client UI cards, shapes, shadows and rounded rectangles.
 */
public class DrawHelper {

    public static void setColor(int color) {
        float a = ((color >> 24) & 0xFF) / 255.0f;
        float r = ((color >> 16) & 0xFF) / 255.0f;
        float g = ((color >> 8) & 0xFF) / 255.0f;
        float b = (color & 0xFF) / 255.0f;
        MinecraftBridge.color(r, g, b, a);
    }

    private static void begin2D() {
        MinecraftBridge.enableBlend();
        MinecraftBridge.tryBlendFuncSeparate(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA, 1, 0);
        MinecraftBridge.disableTexture2D();
        MinecraftBridge.disableLighting();
        MinecraftBridge.disableDepth();
        MinecraftBridge.depthMask(false);
        GL11.glDisable(GL11.GL_CULL_FACE);
        GL11.glAlphaFunc(GL11.GL_GREATER, 0.1f);
        MinecraftBridge.enableAlpha();
    }

    private static void end2D() {
        MinecraftBridge.enableTexture2D();
        MinecraftBridge.disableDepth();
        MinecraftBridge.depthMask(true);
        GL11.glEnable(GL11.GL_CULL_FACE);
        MinecraftBridge.enableAlpha();
        MinecraftBridge.enableBlend();
        MinecraftBridge.tryBlendFuncSeparate(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA, 1, 0);
        MinecraftBridge.resetColor();
        MinecraftBridge.color(1.0f, 1.0f, 1.0f, 1.0f);
    }

    public static void drawRect(float x, float y, float width, float height, int color) {
        begin2D();
        setColor(color);

        GL11.glBegin(GL11.GL_QUADS);
        GL11.glVertex2f(x, y);
        GL11.glVertex2f(x + width, y);
        GL11.glVertex2f(x + width, y + height);
        GL11.glVertex2f(x, y + height);
        GL11.glEnd();

        end2D();
    }

    public static void drawBorderedRect(float x, float y, float width, float height, float borderWidth, int fillColor, int borderColor) {
        drawRect(x, y, width, height, fillColor);
        drawOutline(x, y, width, height, borderWidth, borderColor);
    }

    public static void drawOutline(float x, float y, float width, float height, float lineWidth, int color) {
        begin2D();
        GL11.glLineWidth(Math.max(1.0f, lineWidth));
        setColor(color);

        GL11.glBegin(GL11.GL_LINE_LOOP);
        GL11.glVertex2f(x, y);
        GL11.glVertex2f(x + width, y);
        GL11.glVertex2f(x + width, y + height);
        GL11.glVertex2f(x, y + height);
        GL11.glEnd();

        end2D();
    }

    public static void drawRoundedRect(float x, float y, float width, float height, float radius, int color) {
        if (radius <= 0.5f) {
            drawRect(x, y, width, height, color);
            return;
        }

        radius = Math.min(radius, Math.min(width / 2.0f, height / 2.0f));

        begin2D();
        setColor(color);

        // Center body quad
        GL11.glBegin(GL11.GL_QUADS);
        GL11.glVertex2f(x + radius, y);
        GL11.glVertex2f(x + width - radius, y);
        GL11.glVertex2f(x + width - radius, y + height);
        GL11.glVertex2f(x + radius, y + height);

        // Left wing quad
        GL11.glVertex2f(x, y + radius);
        GL11.glVertex2f(x + radius, y + radius);
        GL11.glVertex2f(x + radius, y + height - radius);
        GL11.glVertex2f(x, y + height - radius);

        // Right wing quad
        GL11.glVertex2f(x + width - radius, y + radius);
        GL11.glVertex2f(x + width, y + radius);
        GL11.glVertex2f(x + width, y + height - radius);
        GL11.glVertex2f(x + width - radius, y + height - radius);
        GL11.glEnd();

        // 4 smooth rounded corners using triangle fans
        drawCorner(x + radius, y + radius, radius, 180, 270);
        drawCorner(x + width - radius, y + radius, radius, 270, 360);
        drawCorner(x + width - radius, y + height - radius, radius, 0, 90);
        drawCorner(x + radius, y + height - radius, radius, 90, 180);

        end2D();
    }

    private static void drawCorner(float cx, float cy, float radius, int startAngle, int endAngle) {
        GL11.glBegin(GL11.GL_TRIANGLE_FAN);
        GL11.glVertex2f(cx, cy);
        for (int i = startAngle; i <= endAngle; i += 15) {
            double rad = Math.toRadians(i);
            GL11.glVertex2d(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
        }
        GL11.glEnd();
    }

    public static void drawGradientRect(float x, float y, float width, float height, int startColor, int endColor, boolean vertical) {
        begin2D();
        GL11.glShadeModel(GL11.GL_SMOOTH);

        GL11.glBegin(GL11.GL_QUADS);
        if (vertical) {
            setColor(startColor);
            GL11.glVertex2f(x, y);
            GL11.glVertex2f(x + width, y);
            setColor(endColor);
            GL11.glVertex2f(x + width, y + height);
            GL11.glVertex2f(x, y + height);
        } else {
            setColor(startColor);
            GL11.glVertex2f(x, y);
            GL11.glVertex2f(x + width, y);
            setColor(endColor);
            GL11.glVertex2f(x + width, y + height);
            GL11.glVertex2f(x, y + height);
        }
        GL11.glEnd();

        GL11.glShadeModel(GL11.GL_FLAT);
        end2D();
    }

    public static void drawDropShadow(float x, float y, float width, float height, float blurRadius, int shadowColor) {
        for (int i = 1; i <= blurRadius; i++) {
            float alphaFactor = (1.0f - (float) i / blurRadius) * 0.4f;
            int alpha = (int) (((shadowColor >> 24) & 0xFF) * alphaFactor);
            int col = ColorUtils.withAlpha(shadowColor, alpha);
            drawRoundedRect(x - i, y - i + 1, width + (i * 2), height + (i * 2), 4, col);
        }
    }

    public static void drawCircle(float cx, float cy, float radius, int color) {
        begin2D();
        setColor(color);
        GL11.glBegin(GL11.GL_TRIANGLE_FAN);
        GL11.glVertex2f(cx, cy);
        for (int i = 0; i <= 360; i += 12) {
            double rad = Math.toRadians(i);
            GL11.glVertex2d(cx + Math.cos(rad) * radius, cy + Math.sin(rad) * radius);
        }
        GL11.glEnd();
        end2D();
    }

    public static void drawSwitch(float x, float y, float width, float height, boolean enabled, float animProgress) {
        int trackColor = enabled ? 0xFF2ECC71 : 0xFF353C48;
        drawRoundedRect(x, y, width, height, height / 2.0f, trackColor);

        float knobRadius = (height - 4) / 2.0f;
        float knobX = x + 2 + knobRadius + (width - height) * animProgress;
        float knobY = y + height / 2.0f;
        drawCircle(knobX, knobY, knobRadius, 0xFFFFFFFF);
    }

    public static void drawSlider(float x, float y, float width, float height, float progress, int barColor, int knobColor) {
        // Background track
        drawRoundedRect(x, y + height / 2.0f - 2, width, 4, 2.0f, 0xFF222733);
        // Active filled track
        float fillW = Math.max(4, width * progress);
        drawRoundedRect(x, y + height / 2.0f - 2, fillW, 4, 2.0f, barColor);
        // Knob
        float knobX = x + width * progress;
        float knobY = y + height / 2.0f;
        drawCircle(knobX, knobY, 5.0f, knobColor);
    }

    private static int logoTextureId = -1;
    private static long lastLogoAttempt = 0;

    public static synchronized void ensureLogoLoaded() {
        if (logoTextureId > 0) return;
        long now = System.currentTimeMillis();
        if (now - lastLogoAttempt < 1500) return; // cooldown to prevent per-frame overhead
        lastLogoAttempt = now;

        try {
            InputStream in = null;
            String[] candidatePaths = new String[]{
                    "/assets/mlultimate/logo.png",
                    "assets/mlultimate/logo.png",
                    "/logo.png",
                    "logo.png"
            };

            for (String p : candidatePaths) {
                in = DrawHelper.class.getResourceAsStream(p);
                if (in != null) break;
                if (DrawHelper.class.getClassLoader() != null) {
                    in = DrawHelper.class.getClassLoader().getResourceAsStream(p.startsWith("/") ? p.substring(1) : p);
                    if (in != null) break;
                }
                if (Thread.currentThread().getContextClassLoader() != null) {
                    in = Thread.currentThread().getContextClassLoader().getResourceAsStream(p.startsWith("/") ? p.substring(1) : p);
                    if (in != null) break;
                }
            }

            // Fallback via Minecraft IResourceManager reflection
            if (in == null) {
                try {
                    Object client = MinecraftBridge.getClient();
                    if (client != null) {
                        java.lang.reflect.Method mGetRM = null;
                        for (java.lang.reflect.Method m : client.getClass().getMethods()) {
                            if ((m.getName().equals("getResourceManager") || m.getName().equals("func_110442_L") || m.getName().equals("O")) && m.getParameterCount() == 0) {
                                mGetRM = m;
                                break;
                            }
                        }
                        if (mGetRM != null) {
                            Object rm = mGetRM.invoke(client);
                            if (rm != null) {
                                Class<?> rlClass = null;
                                try {
                                    rlClass = Class.forName("net.minecraft.util.ResourceLocation");
                                } catch (ClassNotFoundException e) {
                                    try { rlClass = Class.forName("jy"); } catch (ClassNotFoundException ignored) {}
                                }
                                if (rlClass != null) {
                                    java.lang.reflect.Constructor<?> ctor = rlClass.getConstructor(String.class, String.class);
                                    Object resLoc = ctor.newInstance("mlultimate", "logo.png");
                                    java.lang.reflect.Method mGetRes = null;
                                    for (java.lang.reflect.Method m : rm.getClass().getMethods()) {
                                        if (m.getParameterCount() == 1 && m.getParameterTypes()[0] == rlClass) {
                                            mGetRes = m;
                                            break;
                                        }
                                    }
                                    if (mGetRes != null) {
                                        Object res = mGetRes.invoke(rm, resLoc);
                                        if (res != null) {
                                            java.lang.reflect.Method mGetIn = null;
                                            for (java.lang.reflect.Method m : res.getClass().getMethods()) {
                                                if (m.getParameterCount() == 0 && InputStream.class.isAssignableFrom(m.getReturnType())) {
                                                    mGetIn = m;
                                                    break;
                                                }
                                            }
                                            if (mGetIn != null) {
                                                in = (InputStream) mGetIn.invoke(res);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (Throwable ignored) {}
            }

            // Fallback to local workspace files
            if (in == null) {
                String[] diskPaths = new String[]{
                        "client-1.8.9/src/main/resources/assets/mlultimate/logo.png",
                        "assets/mlultimate/logo.png",
                        "src/main/resources/assets/mlultimate/logo.png"
                };
                for (String dp : diskPaths) {
                    java.io.File f = new java.io.File(dp);
                    if (f.exists() && f.isFile()) {
                        try {
                            in = new java.io.FileInputStream(f);
                            break;
                        } catch (Throwable ignored) {}
                    }
                }
            }

            if (in == null) return;

            BufferedImage img = ImageIO.read(in);
            in.close();
            if (img == null) return;

            int w = img.getWidth();
            int h = img.getHeight();
            int[] pixels = new int[w * h];
            img.getRGB(0, 0, w, h, pixels, 0, w);

            ByteBuffer buffer = BufferUtils.createByteBuffer(w * h * 4);
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int pixel = pixels[y * w + x];
                    buffer.put((byte) ((pixel >> 16) & 0xFF));
                    buffer.put((byte) ((pixel >> 8) & 0xFF));
                    buffer.put((byte) (pixel & 0xFF));
                    buffer.put((byte) ((pixel >> 24) & 0xFF));
                }
            }
            buffer.flip();

            logoTextureId = GL11.glGenTextures();
            GL11.glBindTexture(GL11.GL_TEXTURE_2D, logoTextureId);
            MinecraftBridge.bindTexture(logoTextureId);
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_S, 0x812F); // GL_CLAMP_TO_EDGE
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_T, 0x812F); // GL_CLAMP_TO_EDGE
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, GL11.GL_LINEAR);

            boolean mipmapsBuilt = false;
            try {
                org.lwjgl.util.glu.GLU.gluBuild2DMipmaps(GL11.GL_TEXTURE_2D, GL11.GL_RGBA8, w, h, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, buffer);
                GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_LINEAR_MIPMAP_LINEAR);
                mipmapsBuilt = true;
            } catch (Throwable ignored) {}

            if (!mipmapsBuilt) {
                buffer.rewind();
                GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_LINEAR);
                GL11.glTexImage2D(GL11.GL_TEXTURE_2D, 0, GL11.GL_RGBA8, w, h, 0, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, buffer);
            }
            MinecraftBridge.bindFontTexture();
        } catch (Throwable t) {
            logoTextureId = -1;
        }
    }

    public static boolean isLogoLoaded() {
        if (logoTextureId <= 0) {
            ensureLogoLoaded();
        }
        return logoTextureId > 0;
    }

    public static void drawLogo(float x, float y, float width, float height) {
        if (logoTextureId <= 0) {
            ensureLogoLoaded();
        }

        if (logoTextureId <= 0) {
            // High-end branded fallback badge
            drawRoundedRect(x, y, width, height, 4.0f, 0xFF1488CC);
            drawOutline(x, y, width, height, 1.0f, 0xFF2B32B2);
            float fontScale = width / 24.0f;
            int textY = (int) (y + height / 2.0f - 4.0f * fontScale);
            int textX = (int) (x + width / 2.0f - 5.0f * fontScale);
            MinecraftBridge.drawString("§f§lML", textX, textY, 0xFFFFFFFF);
            return;
        }

        MinecraftBridge.enableBlend();
        MinecraftBridge.tryBlendFuncSeparate(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA, 1, 0);
        MinecraftBridge.enableTexture2D();
        MinecraftBridge.disableDepth();
        MinecraftBridge.depthMask(false);
        MinecraftBridge.disableLighting();
        MinecraftBridge.enableAlpha();
        GL11.glDisable(GL11.GL_CULL_FACE);

        GL11.glBindTexture(GL11.GL_TEXTURE_2D, logoTextureId);
        MinecraftBridge.bindTexture(logoTextureId);
        MinecraftBridge.color(1.0f, 1.0f, 1.0f, 1.0f);

        GL11.glBegin(GL11.GL_QUADS);
        GL11.glTexCoord2f(0.0f, 0.0f);
        GL11.glVertex2f(x, y);

        GL11.glTexCoord2f(1.0f, 0.0f);
        GL11.glVertex2f(x + width, y);

        GL11.glTexCoord2f(1.0f, 1.0f);
        GL11.glVertex2f(x + width, y + height);

        GL11.glTexCoord2f(0.0f, 1.0f);
        GL11.glVertex2f(x, y + height);
        GL11.glEnd();

        GL11.glEnable(GL11.GL_CULL_FACE);
        MinecraftBridge.resetColor();
        MinecraftBridge.color(1.0f, 1.0f, 1.0f, 1.0f);
        MinecraftBridge.bindFontTexture();
    }
}
