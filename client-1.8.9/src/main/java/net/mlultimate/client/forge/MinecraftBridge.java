package net.mlultimate.client.forge;

import net.minecraftforge.fml.client.FMLClientHandler;
import org.lwjgl.opengl.Display;
import org.lwjgl.opengl.GL11;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * High-performance reflection bridge providing interoperability across
 * Forge MCP, Searge (SRG) and Notch runtime environments in Minecraft 1.8.9.
 */
public class MinecraftBridge {

    private static Method mGetHealth = null;
    private static Method mGetMaxHealth = null;
    private static Method mGetAbsorption = null;
    private static Field fHurtTime = null;
    private static Method mGetFps = null;
    private static Field fDebugFps = null;

    private static Object fontRenderer = null;
    private static Method mDrawStringWithShadow = null;
    private static Method mDrawString = null;
    private static Method mGetStringWidth = null;
    private static Field fFontHeight = null;

    private static Object hudKeyBinding = null;
    private static Method mIsPressed = null;
    private static Method mGetKeyCode = null;

    // GlStateManager reflection methods
    private static Method mGlColor = null;
    private static Method mGlResetColor = null;
    private static Method mGlBindTexture = null;
    private static Method mGlEnableBlend = null;
    private static Method mGlDisableBlend = null;
    private static Method mGlTryBlendFuncSeparate = null;
    private static Method mGlEnableTexture2D = null;
    private static Method mGlDisableTexture2D = null;
    private static Method mGlDisableDepth = null;
    private static Method mGlEnableDepth = null;
    private static Method mGlDepthMask = null;
    private static Method mGlEnableAlpha = null;
    private static Method mGlDisableAlpha = null;
    private static Method mGlDisableLighting = null;
    private static Method mGlEnableLighting = null;
    private static Method mDisplayGuiScreen = null;

    // Camera and Mouse lock fields
    private static Method mSetIngameNotInFocus = null;
    private static Method mSetIngameFocus = null;
    private static Field fInGameHasFocus = null;
    private static Field fMouseHelper = null;
    private static Field fDeltaX = null;
    private static Field fDeltaY = null;
    private static boolean cameraLocked = false;

    private static boolean initialized = false;

    public static void init() {
        if (initialized) return;
        initialized = true;

        initKeyBinding();
        initGlStateManager();

        // Discover player health and damage methods
        try {
            Object player = getPlayer();
            if (player != null) {
                Class<?> pClass = player.getClass();
                mGetHealth = findMethod(pClass, float.class, "getHealth", "func_110143_aJ", "bn");
                mGetMaxHealth = findMethod(pClass, float.class, "getMaxHealth", "func_110138_aP", "bu");
                mGetAbsorption = findMethod(pClass, float.class, "getAbsorptionAmount", "func_110139_bj", "bN");
                fHurtTime = findField(pClass, int.class, "hurtTime", "field_70737_aN", "au", "br");
            }
        } catch (Throwable ignored) {
        }

        // Discover FPS methods / fields
        try {
            Object client = getClient();
            if (client != null) {
                Class<?> cClass = client.getClass();
                mGetFps = findMethod(cClass, int.class, "getDebugFPS", "func_175610_ah");
                fDebugFps = findField(cClass, int.class, "debugFPS", "field_71470_ab", "af");
                fCurrentScreen = findField(cClass, null, "currentScreen", "field_71462_r", "m");
            }
        } catch (Throwable ignored) {
        }
    }

    private static Field fCurrentScreen = null;
    private static Field fPosX = null;
    private static Field fPosY = null;
    private static Field fPosZ = null;
    private static Field fInventory = null;
    private static Field fArmorInventory = null;
    private static Method mGetActivePotionEffects = null;

    public static Object getClient() {
        try {
            return FMLClientHandler.instance().getClient();
        } catch (Throwable t) {
            return null;
        }
    }

    public static Object getPlayer() {
        try {
            return FMLClientHandler.instance().getClientPlayerEntity();
        } catch (Throwable t) {
            return null;
        }
    }

    public static float getPlayerHealth() {
        Object player = getPlayer();
        if (player == null) return 20.0f;
        if (!initialized || mGetHealth == null) init();

        if (mGetHealth != null) {
            try {
                return (Float) mGetHealth.invoke(player);
            } catch (Throwable ignored) {
            }
        }
        return 20.0f;
    }

    public static float getPlayerMaxHealth() {
        Object player = getPlayer();
        if (player == null) return 20.0f;
        if (!initialized || mGetMaxHealth == null) init();

        if (mGetMaxHealth != null) {
            try {
                return (Float) mGetMaxHealth.invoke(player);
            } catch (Throwable ignored) {
            }
        }
        return 20.0f;
    }

    public static float getPlayerAbsorption() {
        Object player = getPlayer();
        if (player == null) return 0.0f;
        if (!initialized || mGetAbsorption == null) init();

        if (mGetAbsorption != null) {
            try {
                return (Float) mGetAbsorption.invoke(player);
            } catch (Throwable ignored) {
            }
        }
        return 0.0f;
    }

    public static boolean isPlayerHurt() {
        Object player = getPlayer();
        if (player == null) return false;
        if (!initialized || fHurtTime == null) init();

        if (fHurtTime != null) {
            try {
                return fHurtTime.getInt(player) > 0;
            } catch (Throwable ignored) {
            }
        }
        return false;
    }

    public static int getFps() {
        if (!initialized) init();

        if (mGetFps != null) {
            try {
                return (Integer) mGetFps.invoke(null);
            } catch (Throwable ignored) {
                try {
                    return (Integer) mGetFps.invoke(getClient());
                } catch (Throwable ignored2) {
                }
            }
        }
        if (fDebugFps != null) {
            try {
                return fDebugFps.getInt(getClient());
            } catch (Throwable ignored) {
            }
        }
        return 120;
    }

    public static Object getCurrentScreen() {
        Object client = getClient();
        if (client == null) return null;
        if (fCurrentScreen == null) {
            fCurrentScreen = findField(client.getClass(), null, "currentScreen", "field_71462_r", "m");
        }
        if (fCurrentScreen != null) {
            try {
                return fCurrentScreen.get(client);
            } catch (Throwable ignored) {
            }
        }
        return null;
    }

    public static boolean isIngameMenuOpen() {
        Object screen = getCurrentScreen();
        if (screen == null) return false;
        String name = screen.getClass().getSimpleName();
        return name.contains("IngameMenu") || name.contains("Options") || name.contains("GameOver")
                || name.equals("axp") || name.equals("bbt") || name.equals("ayb");
    }

    public static double getPlayerX() {
        Object player = getPlayer();
        if (player == null) return 0.0;
        if (fPosX == null) fPosX = findField(player.getClass(), double.class, "posX", "field_70165_t", "s");
        if (fPosX != null) {
            try { return fPosX.getDouble(player); } catch (Throwable ignored) {}
        }
        return 0.0;
    }

    public static double getPlayerY() {
        Object player = getPlayer();
        if (player == null) return 64.0;
        if (fPosY == null) fPosY = findField(player.getClass(), double.class, "posY", "field_70163_u", "t");
        if (fPosY != null) {
            try { return fPosY.getDouble(player); } catch (Throwable ignored) {}
        }
        return 64.0;
    }

    public static double getPlayerZ() {
        Object player = getPlayer();
        if (player == null) return 0.0;
        if (fPosZ == null) fPosZ = findField(player.getClass(), double.class, "posZ", "field_70161_v", "u");
        if (fPosZ != null) {
            try { return fPosZ.getDouble(player); } catch (Throwable ignored) {}
        }
        return 0.0;
    }

    private static Method mGetNetHandler = null;
    private static Field fNetHandler = null;
    private static Method mGetUUID = null;
    private static Method mGetPlayerInfo = null;
    private static Method mGetPlayerInfoMap = null;
    private static Method mGetPing = null;
    private static Field fResponseTime = null;
    private static Method mGetGameProfile = null;
    private static Method mGetProfileId = null;
    private static int lastKnownPing = 0;
    private static Field fThirdPersonView = null;

    public static int getThirdPersonView() {
        Object client = getClient();
        if (client == null) return 0;
        try {
            if (fGameSettings == null) {
                fGameSettings = findField(client.getClass(), null, "gameSettings", "field_71474_y", "u", "t");
            }
            if (fGameSettings != null) {
                Object gs = fGameSettings.get(client);
                if (gs != null) {
                    if (fThirdPersonView == null) {
                        fThirdPersonView = findField(gs.getClass(), int.class, "thirdPersonView", "field_74320_O", "as", "at");
                    }
                    if (fThirdPersonView != null) {
                        return fThirdPersonView.getInt(gs);
                    }
                }
            }
        } catch (Throwable ignored) {}
        return 0;
    }

    public static boolean isCurrentScreenOpen() {
        Object client = getClient();
        if (client == null) return false;
        try {
            if (fCurrentScreen == null) {
                fCurrentScreen = findField(client.getClass(), null, "currentScreen", "field_71462_r", "m");
            }
            if (fCurrentScreen != null) {
                return fCurrentScreen.get(client) != null;
            }
        } catch (Throwable ignored) {}
        return false;
    }

    public static int getPing() {
        Object client = getClient();
        if (client == null) return lastKnownPing;
        try {
            if (mGetNetHandler == null && fNetHandler == null) {
                mGetNetHandler = findMethod(client.getClass(), null, "getNetHandler", "func_147114_u", "v");
                if (mGetNetHandler == null) {
                    fNetHandler = findField(client.getClass(), null, "netHandler", "field_71453_ak", "h");
                }
            }

            Object netHandler = null;
            if (mGetNetHandler != null) {
                netHandler = mGetNetHandler.invoke(client);
            } else if (fNetHandler != null) {
                netHandler = fNetHandler.get(client);
            }

            if (netHandler != null) {
                Object player = getPlayer();
                if (player != null) {
                    java.util.UUID uuid = null;
                    if (mGetUUID == null) {
                        mGetUUID = findMethod(player.getClass(), java.util.UUID.class, "getUniqueID", "func_110124_au", "aK");
                    }
                    if (mGetUUID != null) {
                        try {
                            uuid = (java.util.UUID) mGetUUID.invoke(player);
                        } catch (Throwable ignored) {}
                    }

                    // Fallback to GameProfile UUID
                    if (uuid == null) {
                        if (mGetGameProfile == null) {
                            mGetGameProfile = findMethod(player.getClass(), null, "getGameProfile", "func_146103_bH");
                        }
                        if (mGetGameProfile != null) {
                            Object profile = mGetGameProfile.invoke(player);
                            if (profile != null) {
                                if (mGetProfileId == null) {
                                    mGetProfileId = findMethod(profile.getClass(), java.util.UUID.class, "getId");
                                }
                                if (mGetProfileId != null) {
                                    uuid = (java.util.UUID) mGetProfileId.invoke(profile);
                                }
                            }
                        }
                    }

                    Object playerInfo = null;

                    // 1. Direct getPlayerInfo(UUID) with parameter
                    if (uuid != null) {
                        if (mGetPlayerInfo == null) {
                            mGetPlayerInfo = findMethodWithParams(netHandler.getClass(), null, new Class<?>[]{java.util.UUID.class}, "getPlayerInfo", "func_175102_a", "a");
                            if (mGetPlayerInfo == null) {
                                // Search declared methods for any taking single UUID
                                for (Method m : netHandler.getClass().getDeclaredMethods()) {
                                    if (m.getParameterCount() == 1 && m.getParameterTypes()[0] == java.util.UUID.class) {
                                        m.setAccessible(true);
                                        mGetPlayerInfo = m;
                                        break;
                                    }
                                }
                            }
                        }
                        if (mGetPlayerInfo != null) {
                            try {
                                playerInfo = mGetPlayerInfo.invoke(netHandler, uuid);
                            } catch (Throwable ignored) {}
                        }
                    }

                    // 2. Fallback via getPlayerInfoMap() Collection
                    if (playerInfo == null) {
                        if (mGetPlayerInfoMap == null) {
                            mGetPlayerInfoMap = findMethod(netHandler.getClass(), java.util.Collection.class, "getPlayerInfoMap", "func_175106_d", "d");
                        }
                        if (mGetPlayerInfoMap != null) {
                            Object colObj = mGetPlayerInfoMap.invoke(netHandler);
                            if (colObj instanceof java.util.Collection) {
                                java.util.Collection<?> col = (java.util.Collection<?>) colObj;
                                for (Object item : col) {
                                    if (item == null) continue;
                                    if (uuid != null) {
                                        try {
                                            Method mGp = findMethod(item.getClass(), null, "getGameProfile", "func_178845_a", "a");
                                            if (mGp != null) {
                                                Object gp = mGp.invoke(item);
                                                if (gp != null) {
                                                    Method mId = findMethod(gp.getClass(), java.util.UUID.class, "getId");
                                                    if (mId != null && uuid.equals(mId.invoke(gp))) {
                                                        playerInfo = item;
                                                        break;
                                                    }
                                                }
                                            }
                                        } catch (Throwable ignored) {}
                                    } else {
                                        playerInfo = item;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // 3. Extract ping from playerInfo
                    if (playerInfo != null) {
                        if (mGetPing == null && fResponseTime == null) {
                            mGetPing = findMethod(playerInfo.getClass(), int.class, "getResponseTime", "func_178853_c", "c", "b");
                            if (mGetPing == null) {
                                fResponseTime = findField(playerInfo.getClass(), int.class, "responseTime", "field_178864_e", "e");
                            }
                        }

                        int ping = -1;
                        if (mGetPing != null) {
                            try {
                                ping = (Integer) mGetPing.invoke(playerInfo);
                            } catch (Throwable ignored) {}
                        } else if (fResponseTime != null) {
                            try {
                                ping = fResponseTime.getInt(playerInfo);
                            } catch (Throwable ignored) {}
                        }

                        if (ping >= 0) {
                            lastKnownPing = ping;
                            return ping;
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}
        return lastKnownPing;
    }

    public static class ArmorInfo {
        public final String name;
        public final int damagePercent;
        public final boolean present;

        public ArmorInfo(String name, int damagePercent, boolean present) {
            this.name = name;
            this.damagePercent = damagePercent;
            this.present = present;
        }
    }

    public static ArmorInfo[] getArmorInfo() {
        ArmorInfo[] result = new ArmorInfo[4];
        for (int i = 0; i < 4; i++) {
            result[i] = new ArmorInfo("", 100, false);
        }
        Object player = getPlayer();
        if (player == null) return result;

        try {
            if (fInventory == null) {
                fInventory = findField(player.getClass(), null, "inventory", "field_71071_by", "bi");
            }
            if (fInventory != null) {
                Object inv = fInventory.get(player);
                if (inv != null) {
                    if (fArmorInventory == null) {
                        fArmorInventory = findField(inv.getClass(), null, "armorInventory", "field_70460_b", "b");
                    }
                    if (fArmorInventory != null) {
                        Object[] armorStacks = (Object[]) fArmorInventory.get(inv);
                        if (armorStacks != null && armorStacks.length >= 4) {
                            for (int i = 0; i < 4; i++) {
                                Object stack = armorStacks[i];
                                if (stack != null) {
                                    Method mMax = findMethod(stack.getClass(), int.class, "getMaxDamage", "func_77958_k");
                                    Method mCur = findMethod(stack.getClass(), int.class, "getItemDamage", "func_77952_i");
                                    Method mName = findMethod(stack.getClass(), String.class, "getDisplayName", "func_82833_r");
                                    int max = mMax != null ? (Integer) mMax.invoke(stack) : 0;
                                    int cur = mCur != null ? (Integer) mCur.invoke(stack) : 0;
                                    String name = mName != null ? (String) mName.invoke(stack) : "";
                                    int pct = 100;
                                    if (max > 0) {
                                        pct = Math.max(0, Math.min(100, (max - cur) * 100 / max));
                                    }
                                    result[i] = new ArmorInfo(name, pct, true);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}
        return result;
    }

    public static class PotionInfo {
        public final String name;
        public final int durationSeconds;
        public final int amplifier;

        public PotionInfo(String name, int durationSeconds, int amplifier) {
            this.name = name;
            this.durationSeconds = durationSeconds;
            this.amplifier = amplifier;
        }
    }

    public static java.util.List<PotionInfo> getPotionEffects() {
        java.util.List<PotionInfo> list = new java.util.ArrayList<>();
        Object player = getPlayer();
        if (player == null) return list;

        try {
            if (mGetActivePotionEffects == null) {
                mGetActivePotionEffects = findMethod(player.getClass(), java.util.Collection.class, "getActivePotionEffects", "func_70651_bq", "bk");
            }
            if (mGetActivePotionEffects != null) {
                java.util.Collection<?> effects = (java.util.Collection<?>) mGetActivePotionEffects.invoke(player);
                if (effects != null) {
                    for (Object eff : effects) {
                        Method mDur = findMethod(eff.getClass(), int.class, "getDuration", "func_76459_b", "b");
                        Method mAmp = findMethod(eff.getClass(), int.class, "getAmplifier", "func_76458_c", "c");
                        Method mEffName = findMethod(eff.getClass(), String.class, "getEffectName", "func_76453_d", "d");
                        int dur = mDur != null ? (Integer) mDur.invoke(eff) / 20 : 0;
                        int amp = mAmp != null ? (Integer) mAmp.invoke(eff) : 0;
                        String name = mEffName != null ? (String) mEffName.invoke(eff) : "Potion";
                        if (name.startsWith("potion.")) {
                            name = name.substring(7);
                            if (!name.isEmpty()) {
                                name = Character.toUpperCase(name.charAt(0)) + name.substring(1);
                            }
                        }
                        list.add(new PotionInfo(name, dur, amp));
                    }
                }
            }
        } catch (Throwable ignored) {}
        return list;
    }

    public static int getScaledWidth(Object resolution) {
        if (resolution == null) return Display.getWidth();
        Method m = findMethod(resolution.getClass(), int.class, "getScaledWidth", "func_78326_a", "a");
        if (m != null) {
            try {
                return (Integer) m.invoke(resolution);
            } catch (Throwable ignored) {
            }
        }
        return Display.getWidth();
    }

    public static int getScaledHeight(Object resolution) {
        if (resolution == null) return Display.getHeight();
        Method m = findMethod(resolution.getClass(), int.class, "getScaledHeight", "func_78328_b", "b");
        if (m != null) {
            try {
                return (Integer) m.invoke(resolution);
            } catch (Throwable ignored) {
            }
        }
        return Display.getHeight();
    }

    public static int getScaleFactor(Object resolution) {
        if (resolution == null) return 1;
        Method m = findMethod(resolution.getClass(), int.class, "getScaleFactor", "func_78325_e", "e");
        if (m != null) {
            try {
                return (Integer) m.invoke(resolution);
            } catch (Throwable ignored) {
            }
        }
        return 1;
    }

    public static Object getFontRenderer() {
        if (fontRenderer != null) return fontRenderer;
        Object client = getClient();
        if (client == null) return null;

        Class<?> cClass = client.getClass();
        Field f = findField(cClass, null, "fontRendererObj", "field_71466_p", "k", "fontRenderer");
        if (f != null) {
            try {
                fontRenderer = f.get(client);
            } catch (Throwable ignored) {
            }
        }

        if (fontRenderer == null) {
            for (Field fld : cClass.getDeclaredFields()) {
                if (fld.getType().getSimpleName().equals("avn") || fld.getType().getName().contains("FontRenderer")) {
                    try {
                        fld.setAccessible(true);
                        fontRenderer = fld.get(client);
                        if (fontRenderer != null) break;
                    } catch (Throwable ignored) {
                    }
                }
            }
        }

        if (fontRenderer != null) {
            Class<?> frClass = fontRenderer.getClass();
            for (Method m : frClass.getMethods()) {
                if ((m.getName().equals("drawStringWithShadow") || m.getName().equals("func_175063_a") || m.getName().equals("a"))
                        && m.getParameterCount() == 4) {
                    Class<?>[] p = m.getParameterTypes();
                    if (p[0] == String.class && (p[1] == float.class || p[1] == int.class) && p[3] == int.class) {
                        m.setAccessible(true);
                        mDrawStringWithShadow = m;
                        break;
                    }
                }
            }
            for (Method m : frClass.getMethods()) {
                if ((m.getName().equals("drawString") || m.getName().equals("func_78276_b") || m.getName().equals("a"))
                        && m.getParameterCount() == 4 && m != mDrawStringWithShadow) {
                    Class<?>[] p = m.getParameterTypes();
                    if (p[0] == String.class && (p[1] == int.class || p[1] == float.class) && p[3] == int.class) {
                        m.setAccessible(true);
                        mDrawString = m;
                        break;
                    }
                }
            }
            for (Method m : frClass.getMethods()) {
                if ((m.getName().equals("getStringWidth") || m.getName().equals("func_78256_a") || m.getName().equals("a"))
                        && m.getParameterCount() == 1 && m.getParameterTypes()[0] == String.class && m.getReturnType() == int.class) {
                    m.setAccessible(true);
                    mGetStringWidth = m;
                    break;
                }
            }
            fFontHeight = findField(frClass, int.class, "FONT_HEIGHT", "field_78288_b", "a");
        }
        return fontRenderer;
    }

    public static int drawStringWithShadow(String text, float x, float y, int color) {
        if (text == null || text.isEmpty()) return 0;
        Object fr = getFontRenderer();
        if (fr != null && mDrawStringWithShadow != null) {
            try {
                Class<?>[] p = mDrawStringWithShadow.getParameterTypes();
                if (p[1] == float.class) {
                    return (Integer) mDrawStringWithShadow.invoke(fr, text, x, y, color);
                } else {
                    return (Integer) mDrawStringWithShadow.invoke(fr, text, (int) x, (int) y, color);
                }
            } catch (Throwable ignored) {
            }
        }
        return 0;
    }

    public static int drawString(String text, float x, float y, int color) {
        if (text == null || text.isEmpty()) return 0;
        Object fr = getFontRenderer();
        if (fr != null) {
            Method m = (mDrawString != null) ? mDrawString : mDrawStringWithShadow;
            if (m != null) {
                try {
                    Class<?>[] p = m.getParameterTypes();
                    if (p[1] == float.class) {
                        return (Integer) m.invoke(fr, text, x, y, color);
                    } else {
                        return (Integer) m.invoke(fr, text, (int) x, (int) y, color);
                    }
                } catch (Throwable ignored) {
                }
            }
        }
        return 0;
    }

    public static int getStringWidth(String text) {
        if (text == null || text.isEmpty()) return 0;
        Object fr = getFontRenderer();
        if (fr != null && mGetStringWidth != null) {
            try {
                return (Integer) mGetStringWidth.invoke(fr, text);
            } catch (Throwable ignored) {
            }
        }
        return text.length() * 6;
    }

    public static int getFontHeight() {
        if (fFontHeight != null && fontRenderer != null) {
            try {
                return fFontHeight.getInt(fontRenderer);
            } catch (Throwable ignored) {
            }
        }
        return 9;
    }

    private static Field fLocationFontTexture = null;
    private static Field fRenderEngine = null;
    private static Method mGetTexture = null;
    private static Method mGetGlTextureId = null;
    private static Method mBindTextureResource = null;
    private static int cachedFontTextureId = -1;

    public static int getFontTextureId() {
        if (cachedFontTextureId > 0) return cachedFontTextureId;
        Object fr = getFontRenderer();
        if (fr == null) return -1;
        try {
            if (fLocationFontTexture == null) {
                fLocationFontTexture = findField(fr.getClass(), null, "locationFontTexture", "field_111273_g", "g");
            }
            if (fRenderEngine == null) {
                fRenderEngine = findField(fr.getClass(), null, "renderEngine", "field_78298_g", "h");
            }
            if (fLocationFontTexture != null && fRenderEngine != null) {
                Object loc = fLocationFontTexture.get(fr);
                Object re = fRenderEngine.get(fr);
                if (loc != null && re != null) {
                    if (mGetTexture == null) {
                        mGetTexture = findMethod(re.getClass(), null, "getTexture", "func_110581_b", "b");
                    }
                    if (mGetTexture != null) {
                        Object texObj = mGetTexture.invoke(re, loc);
                        if (texObj != null) {
                            if (mGetGlTextureId == null) {
                                mGetGlTextureId = findMethod(texObj.getClass(), int.class, "getGlTextureId", "func_110552_b", "b");
                            }
                            if (mGetGlTextureId != null) {
                                cachedFontTextureId = (Integer) mGetGlTextureId.invoke(texObj);
                                return cachedFontTextureId;
                            }
                        }
                    }
                }
            }
        } catch (Throwable ignored) {
        }
        return -1;
    }

    public static void bindFontTexture() {
        int id = getFontTextureId();
        if (id > 0) {
            GL11.glBindTexture(GL11.GL_TEXTURE_2D, id);
            bindTexture(id);
        } else {
            Object fr = getFontRenderer();
            if (fr != null) {
                try {
                    if (fLocationFontTexture == null) {
                        fLocationFontTexture = findField(fr.getClass(), null, "locationFontTexture", "field_111273_g", "g");
                    }
                    if (fRenderEngine == null) {
                        fRenderEngine = findField(fr.getClass(), null, "renderEngine", "field_78298_g", "h");
                    }
                    if (fLocationFontTexture != null && fRenderEngine != null) {
                        Object loc = fLocationFontTexture.get(fr);
                        Object re = fRenderEngine.get(fr);
                        if (loc != null && re != null) {
                            if (mBindTextureResource == null) {
                                mBindTextureResource = findMethod(re.getClass(), void.class, "bindTexture", "func_110577_a", "a");
                            }
                            if (mBindTextureResource != null) {
                                mBindTextureResource.invoke(re, loc);
                                int bound = GL11.glGetInteger(GL11.GL_TEXTURE_BINDING_2D);
                                if (bound > 0) {
                                    cachedFontTextureId = bound;
                                    GL11.glBindTexture(GL11.GL_TEXTURE_2D, bound);
                                    bindTexture(bound);
                                }
                            }
                        }
                    }
                } catch (Throwable ignored) {
                }
            }
        }
    }

    public static void initKeyBinding() {
        try {
            Class<?> kbClass = null;
            try {
                kbClass = Class.forName("net.minecraft.client.settings.KeyBinding");
            } catch (ClassNotFoundException e) {
                try {
                    kbClass = Class.forName("avb");
                } catch (ClassNotFoundException ignored) {
                }
            }

            if (kbClass == null) {
                return;
            }

            Constructor<?> ctor = kbClass.getConstructor(String.class, int.class, String.class);
            hudKeyBinding = ctor.newInstance("Abrir Menu MLUltimate", org.lwjgl.input.Keyboard.KEY_RSHIFT, "MLUltimate Client");

            for (Method m : net.minecraftforge.fml.client.registry.ClientRegistry.class.getMethods()) {
                if (m.getName().equals("registerKeyBinding") && m.getParameterCount() == 1) {
                    m.invoke(null, hudKeyBinding);
                    break;
                }
            }

            mIsPressed = findMethod(kbClass, boolean.class, "isPressed", "func_151468_f", "f");
            mGetKeyCode = findMethod(kbClass, int.class, "getKeyCode", "func_151463_i", "i");
        } catch (Throwable ignored) {
        }
    }

    public static boolean isHudKeyPressed() {
        if (hudKeyBinding != null && mIsPressed != null) {
            try {
                return (Boolean) mIsPressed.invoke(hudKeyBinding);
            } catch (Throwable ignored) {
            }
        }
        return false;
    }

    public static int getHudBoundKeyCode() {
        if (hudKeyBinding != null && mGetKeyCode != null) {
            try {
                return (Integer) mGetKeyCode.invoke(hudKeyBinding);
            } catch (Throwable ignored) {
            }
        }
        return org.lwjgl.input.Keyboard.KEY_RSHIFT;
    }

    public static void initGlStateManager() {
        Class<?> glClass = null;
        try {
            glClass = Class.forName("net.minecraft.client.renderer.GlStateManager");
        } catch (ClassNotFoundException e) {
            try {
                glClass = Class.forName("bfl");
            } catch (ClassNotFoundException ignored) {
            }
        }

        if (glClass != null) {
            mGlColor = findMethodWithParams(glClass, void.class, new Class<?>[]{float.class, float.class, float.class, float.class}, "color", "func_179131_c", "func_179124_c", "c");
            mGlResetColor = findMethod(glClass, void.class, "resetColor", "func_179117_G", "G");
            mGlBindTexture = findMethodWithParams(glClass, void.class, new Class<?>[]{int.class}, "bindTexture", "func_179144_i", "p", "i");
            mGlEnableBlend = findMethod(glClass, void.class, "enableBlend", "func_179147_l", "l");
            mGlDisableBlend = findMethod(glClass, void.class, "disableBlend", "func_179084_k", "func_179090_x", "k", "m");
            mGlTryBlendFuncSeparate = findMethodWithParams(glClass, void.class, new Class<?>[]{int.class, int.class, int.class, int.class}, "tryBlendFuncSeparate", "func_179120_a", "a", "b");
            mGlEnableTexture2D = findMethod(glClass, void.class, "enableTexture2D", "func_179098_w", "w");
            mGlDisableTexture2D = findMethod(glClass, void.class, "disableTexture2D", "func_179090_x", "x");
            mGlDisableDepth = findMethod(glClass, void.class, "disableDepth", "func_179097_i", "i");
            mGlEnableDepth = findMethod(glClass, void.class, "enableDepth", "func_179126_j", "j");
            mGlDepthMask = findMethodWithParams(glClass, void.class, new Class<?>[]{boolean.class}, "depthMask", "func_179132_a", "a");
            mGlEnableAlpha = findMethod(glClass, void.class, "enableAlpha", "func_179141_d", "d");
            mGlDisableAlpha = findMethod(glClass, void.class, "disableAlpha", "func_179118_c", "c", "e");
            mGlDisableLighting = findMethod(glClass, void.class, "disableLighting", "func_179140_f", "r");
            mGlEnableLighting = findMethod(glClass, void.class, "enableLighting", "func_179145_e", "q");
        }
    }

    public static void bindTexture(int texture) {
        if (mGlBindTexture != null) {
            try {
                mGlBindTexture.invoke(null, texture);
                return;
            } catch (Throwable ignored) {
            }
        }
        GL11.glBindTexture(GL11.GL_TEXTURE_2D, texture);
    }

    public static void color(float r, float g, float b, float a) {
        if (mGlColor != null) {
            try {
                mGlColor.invoke(null, r, g, b, a);
            } catch (Throwable ignored) {
            }
        }
        GL11.glColor4f(r, g, b, a);
    }

    public static void resetColor() {
        if (mGlResetColor != null) {
            try {
                mGlResetColor.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glColor4f(1.0f, 1.0f, 1.0f, 1.0f);
    }

    public static void enableBlend() {
        if (mGlEnableBlend != null) {
            try {
                mGlEnableBlend.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glEnable(GL11.GL_BLEND);
    }

    public static void disableBlend() {
        if (mGlDisableBlend != null) {
            try {
                mGlDisableBlend.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glDisable(GL11.GL_BLEND);
    }

    public static void tryBlendFuncSeparate(int srcFactor, int dstFactor, int srcFactorAlpha, int dstFactorAlpha) {
        if (mGlTryBlendFuncSeparate != null) {
            try {
                mGlTryBlendFuncSeparate.invoke(null, srcFactor, dstFactor, srcFactorAlpha, dstFactorAlpha);
            } catch (Throwable ignored) {
            }
        }
        GL11.glBlendFunc(srcFactor, dstFactor);
    }

    public static void enableTexture2D() {
        if (mGlEnableTexture2D != null) {
            try {
                mGlEnableTexture2D.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glEnable(GL11.GL_TEXTURE_2D);
    }

    public static void disableTexture2D() {
        if (mGlDisableTexture2D != null) {
            try {
                mGlDisableTexture2D.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glDisable(GL11.GL_TEXTURE_2D);
    }

    public static void disableDepth() {
        if (mGlDisableDepth != null) {
            try {
                mGlDisableDepth.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glDisable(GL11.GL_DEPTH_TEST);
    }

    public static void enableDepth() {
        if (mGlEnableDepth != null) {
            try {
                mGlEnableDepth.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glEnable(GL11.GL_DEPTH_TEST);
    }

    public static void depthMask(boolean flag) {
        if (mGlDepthMask != null) {
            try {
                mGlDepthMask.invoke(null, flag);
            } catch (Throwable ignored) {
            }
        }
        GL11.glDepthMask(flag);
    }

    public static void enableAlpha() {
        if (mGlEnableAlpha != null) {
            try {
                mGlEnableAlpha.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glEnable(GL11.GL_ALPHA_TEST);
    }

    public static void disableAlpha() {
        if (mGlDisableAlpha != null) {
            try {
                mGlDisableAlpha.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glDisable(GL11.GL_ALPHA_TEST);
    }

    public static void disableLighting() {
        if (mGlDisableLighting != null) {
            try {
                mGlDisableLighting.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glDisable(GL11.GL_LIGHTING);
    }

    public static void enableLighting() {
        if (mGlEnableLighting != null) {
            try {
                mGlEnableLighting.invoke(null);
            } catch (Throwable ignored) {
            }
        }
        GL11.glEnable(GL11.GL_LIGHTING);
    }

    public static void cleanGlState() {
        try {
            disableDepth();
            depthMask(true);
            enableTexture2D();
            disableLighting();
            enableAlpha();
            enableBlend();
            tryBlendFuncSeparate(770, 771, 1, 0);
            resetColor();
            color(1.0f, 1.0f, 1.0f, 1.0f);
            bindFontTexture();
        } catch (Throwable ignored) {
        }
        GL11.glDisable(GL11.GL_DEPTH_TEST);
        GL11.glEnable(GL11.GL_TEXTURE_2D);
        GL11.glDisable(GL11.GL_LIGHTING);
        GL11.glEnable(GL11.GL_ALPHA_TEST);
        GL11.glEnable(GL11.GL_BLEND);
        GL11.glBlendFunc(GL11.GL_SRC_ALPHA, GL11.GL_ONE_MINUS_SRC_ALPHA);
        GL11.glColor4f(1.0f, 1.0f, 1.0f, 1.0f);
    }

    public static void displayGuiScreen(Object screen) {
        Object client = getClient();
        if (client == null) return;
        if (mDisplayGuiScreen == null) {
            mDisplayGuiScreen = findMethod(client.getClass(), void.class, "displayGuiScreen", "func_147108_a", "a");
            if (mDisplayGuiScreen == null) {
                for (Method m : client.getClass().getMethods()) {
                    if (m.getParameterCount() == 1 && (m.getName().equals("displayGuiScreen") || m.getName().equals("func_147108_a") || m.getName().equals("a"))) {
                        m.setAccessible(true);
                        mDisplayGuiScreen = m;
                        break;
                    }
                }
            }
        }
        if (mDisplayGuiScreen != null) {
            try {
                mDisplayGuiScreen.invoke(client, screen);
            } catch (Throwable ignored) {
            }
        }
    }

    public static Object createGuiButton(int id, int x, int y, int width, int height, String text) {
        Class<?> clazz = null;
        try {
            clazz = Class.forName("net.minecraft.client.gui.GuiButton");
        } catch (ClassNotFoundException e) {
            try {
                clazz = Class.forName("avs");
            } catch (ClassNotFoundException ignored) {
            }
        }
        if (clazz != null) {
            try {
                Constructor<?> ctor = clazz.getConstructor(int.class, int.class, int.class, int.class, int.class, String.class);
                return ctor.newInstance(id, x, y, width, height, text);
            } catch (Throwable t) {
                try {
                    Constructor<?> ctor = clazz.getConstructor(int.class, int.class, int.class, String.class);
                    return ctor.newInstance(id, x, y, text);
                } catch (Throwable ignored) {
                }
            }
        }
        return null;
    }

    public static int getButtonId(Object button) {
        if (button == null) return -1;
        Field f = findField(button.getClass(), int.class, "id", "field_146127_k", "k");
        if (f != null) {
            try {
                return f.getInt(button);
            } catch (Throwable ignored) {
            }
        }
        return -1;
    }

    public static int getButtonX(Object button) {
        if (button == null) return 0;
        Field f = findField(button.getClass(), int.class, "xPosition", "field_146128_h", "h");
        if (f != null) {
            try {
                return f.getInt(button);
            } catch (Throwable ignored) {
            }
        }
        return 0;
    }

    public static int getButtonY(Object button) {
        if (button == null) return 0;
        Field f = findField(button.getClass(), int.class, "yPosition", "field_146129_i", "i");
        if (f != null) {
            try {
                return f.getInt(button);
            } catch (Throwable ignored) {
            }
        }
        return 0;
    }

    public static int getButtonWidth(Object button) {
        if (button == null) return 0;
        Field f = findField(button.getClass(), int.class, "width", "field_146120_f", "f");
        if (f != null) {
            try {
                return f.getInt(button);
            } catch (Throwable ignored) {
            }
        }
        return 0;
    }

    public static int getButtonHeight(Object button) {
        if (button == null) return 0;
        Field f = findField(button.getClass(), int.class, "height", "field_146121_g", "g");
        if (f != null) {
            try {
                return f.getInt(button);
            } catch (Throwable ignored) {
            }
        }
        return 0;
    }

    public static String getButtonText(Object button) {
        if (button == null) return "";
        Field f = findField(button.getClass(), String.class, "displayString", "field_146126_j", "j");
        if (f != null) {
            try {
                Object s = f.get(button);
                return s != null ? s.toString() : "";
            } catch (Throwable ignored) {
            }
        }
        return "";
    }

    public static void setButtonText(Object button, String text) {
        if (button == null) return;
        Field f = findField(button.getClass(), String.class, "displayString", "field_146126_j", "j");
        if (f != null) {
            try {
                f.set(button, text);
            } catch (Throwable ignored) {
            }
        }
    }

    public static void cleanForgeBrandings() {
        try {
            Class<?> fmlClass = Class.forName("net.minecraftforge.fml.common.FMLCommonHandler");
            Method mInst = fmlClass.getMethod("instance");
            Object fml = mInst.invoke(null);
            if (fml != null) {
                java.util.List<String> list = new java.util.ArrayList<>();
                list.add("§b§lMLUltimate Client §7(1.8.9)");

                Field fBrandings = findField(fml.getClass(), java.util.List.class, "brandings");
                if (fBrandings != null) {
                    fBrandings.set(fml, list);
                }

                Field fBrandingsNoMC = findField(fml.getClass(), java.util.List.class, "brandingsNoMC");
                if (fBrandingsNoMC != null) {
                    fBrandingsNoMC.set(fml, list);
                }
            }
        } catch (Throwable ignored) {
        }
    }

    private static Field fScreenButtonList = null;

    public static java.util.List getScreenButtonList(Object screen) {
        if (screen == null) return null;
        if (fScreenButtonList == null) {
            fScreenButtonList = findField(screen.getClass(), java.util.List.class, "buttonList", "field_146292_n", "n");
        }
        if (fScreenButtonList != null) {
            try {
                return (java.util.List) fScreenButtonList.get(screen);
            } catch (Throwable ignored) {
            }
        }
        return null;
    }

    public static void lockCamera() {
        Object client = getClient();
        if (client == null) return;
        cameraLocked = true;

        if (mSetIngameNotInFocus == null) {
            mSetIngameNotInFocus = findMethod(client.getClass(), void.class, "setIngameNotInFocus", "func_71364_i", "o");
        }
        if (mSetIngameNotInFocus != null) {
            try {
                mSetIngameNotInFocus.invoke(client);
            } catch (Throwable ignored) {
            }
        }

        if (fInGameHasFocus == null) {
            fInGameHasFocus = findField(client.getClass(), boolean.class, "inGameHasFocus", "field_71415_G", "w");
        }
        if (fInGameHasFocus != null) {
            try {
                fInGameHasFocus.setBoolean(client, false);
            } catch (Throwable ignored) {
            }
        }

        if (fMouseHelper == null) {
            fMouseHelper = findField(client.getClass(), null, "mouseHelper", "field_71417_B", "u");
        }
        if (fMouseHelper != null) {
            try {
                Object mh = fMouseHelper.get(client);
                if (mh != null) {
                    if (fDeltaX == null) fDeltaX = findField(mh.getClass(), int.class, "deltaX", "field_74377_a", "a");
                    if (fDeltaY == null) fDeltaY = findField(mh.getClass(), int.class, "deltaY", "field_74375_b", "b");
                    if (fDeltaX != null) fDeltaX.setInt(mh, 0);
                    if (fDeltaY != null) fDeltaY.setInt(mh, 0);
                }
            } catch (Throwable ignored) {
            }
        }

        try {
            if (org.lwjgl.input.Mouse.isGrabbed()) {
                org.lwjgl.input.Mouse.setGrabbed(false);
            }
        } catch (Throwable ignored) {
        }

        unpressAllKeys();
    }

    private static Method mUnpressAllKeys = null;

    public static void unpressAllKeys() {
        if (mUnpressAllKeys == null) {
            Class<?> kbClass = null;
            try {
                kbClass = Class.forName("net.minecraft.client.settings.KeyBinding");
            } catch (ClassNotFoundException e) {
                try {
                    kbClass = Class.forName("avb");
                } catch (ClassNotFoundException ignored) {
                }
            }
            if (kbClass != null) {
                mUnpressAllKeys = findMethod(kbClass, void.class, "unPressAllKeys", "func_74506_a", "a");
            }
        }
        if (mUnpressAllKeys != null) {
            try {
                mUnpressAllKeys.invoke(null);
            } catch (Throwable ignored) {
            }
        }
    }

    public static void unlockCamera() {
        if (!cameraLocked) return;
        cameraLocked = false;
        Object client = getClient();
        if (client == null) return;

        if (mSetIngameFocus == null) {
            mSetIngameFocus = findMethod(client.getClass(), void.class, "setIngameFocus", "func_71381_h", "n");
        }
        if (mSetIngameFocus != null) {
            try {
                mSetIngameFocus.invoke(client);
            } catch (Throwable ignored) {
            }
        }

        if (fInGameHasFocus == null) {
            fInGameHasFocus = findField(client.getClass(), boolean.class, "inGameHasFocus", "field_71415_G", "w");
        }
        if (fInGameHasFocus != null) {
            try {
                fInGameHasFocus.setBoolean(client, true);
            } catch (Throwable ignored) {
            }
        }

        try {
            org.lwjgl.input.Mouse.setGrabbed(true);
        } catch (Throwable ignored) {
        }
    }

    // --- Gamma (Fullbright) Control ---
    private static Field fGameSettings = null;
    private static Field fGammaSetting = null;

    public static float getGamma() {
        Object client = getClient();
        if (client == null) return 1.0f;
        try {
            if (fGameSettings == null) {
                fGameSettings = findField(client.getClass(), null, "gameSettings", "field_71474_y", "t");
            }
            if (fGameSettings != null) {
                Object gs = fGameSettings.get(client);
                if (gs != null) {
                    if (fGammaSetting == null) {
                        fGammaSetting = findField(gs.getClass(), float.class, "gammaSetting", "field_74333_Y", "aE");
                    }
                    if (fGammaSetting != null) {
                        return fGammaSetting.getFloat(gs);
                    }
                }
            }
        } catch (Throwable ignored) {}
        return 1.0f;
    }

    public static void setGamma(float gamma) {
        Object client = getClient();
        if (client == null) return;
        try {
            if (fGameSettings == null) {
                fGameSettings = findField(client.getClass(), null, "gameSettings", "field_71474_y", "t");
            }
            if (fGameSettings != null) {
                Object gs = fGameSettings.get(client);
                if (gs != null) {
                    if (fGammaSetting == null) {
                        fGammaSetting = findField(gs.getClass(), float.class, "gammaSetting", "field_74333_Y", "aE");
                    }
                    if (fGammaSetting != null) {
                        fGammaSetting.setFloat(gs, gamma);
                    }
                }
            }
        } catch (Throwable ignored) {}
    }

    // --- Movement / Sprinting Control ---
    private static Method mSetSprinting = null;
    private static Method mIsSprinting = null;
    private static Field fMovementInput = null;
    private static Field fMoveForward = null;

    public static void setPlayerSprinting(boolean sprinting) {
        Object player = getPlayer();
        if (player == null) return;
        try {
            if (mSetSprinting == null) {
                mSetSprinting = findMethodWithParams(player.getClass(), void.class, new Class<?>[]{boolean.class}, "setSprinting", "func_70031_b", "d");
            }
            if (mSetSprinting != null) {
                mSetSprinting.invoke(player, sprinting);
            }
        } catch (Throwable ignored) {}
    }

    public static boolean isPlayerSprinting() {
        Object player = getPlayer();
        if (player == null) return false;
        try {
            if (mIsSprinting == null) {
                mIsSprinting = findMethod(player.getClass(), boolean.class, "isSprinting", "func_70051_ag", "aw");
            }
            if (mIsSprinting != null) {
                return (Boolean) mIsSprinting.invoke(player);
            }
        } catch (Throwable ignored) {}
        return false;
    }

    public static boolean isMovingForward() {
        Object player = getPlayer();
        if (player == null) return false;
        try {
            if (fMovementInput == null) {
                fMovementInput = findField(player.getClass(), null, "movementInput", "field_71158_b", "b");
            }
            if (fMovementInput != null) {
                Object mi = fMovementInput.get(player);
                if (mi != null) {
                    if (fMoveForward == null) {
                        fMoveForward = findField(mi.getClass(), float.class, "moveForward", "field_78900_b", "b");
                    }
                    if (fMoveForward != null) {
                        return fMoveForward.getFloat(mi) > 0.05f;
                    }
                }
            }
        } catch (Throwable ignored) {}
        return false;
    }

    // --- Server Info ---
    private static Method mGetCurrentServerData = null;
    private static Field fCurrentServerData = null;
    private static Field fServerIP = null;

    public static String getServerIP() {
        Object client = getClient();
        if (client == null) return "Singleplayer";
        try {
            if (mGetCurrentServerData == null) {
                mGetCurrentServerData = findMethod(client.getClass(), null, "getCurrentServerData", "func_147104_D", "C");
            }
            Object data = (mGetCurrentServerData != null) ? mGetCurrentServerData.invoke(client) : null;
            if (data == null) {
                if (fCurrentServerData == null) {
                    fCurrentServerData = findField(client.getClass(), null, "currentServerData", "field_71422_O");
                }
                if (fCurrentServerData != null) {
                    data = fCurrentServerData.get(client);
                }
            }
            if (data != null) {
                if (fServerIP == null) {
                    fServerIP = findField(data.getClass(), String.class, "serverIP", "field_78845_b", "b");
                }
                if (fServerIP != null) {
                    String ip = (String) fServerIP.get(data);
                    if (ip != null && !ip.isEmpty()) return ip;
                }
            }
        } catch (Throwable ignored) {}
        return "Singleplayer";
    }

    // --- Entity Position Helpers ---
    public static double getEntityX(Object entity) {
        if (entity == null) return 0.0;
        try {
            Field f = findField(entity.getClass(), double.class, "posX", "field_70165_t", "s");
            if (f != null) return f.getDouble(entity);
        } catch (Throwable ignored) {}
        return 0.0;
    }

    public static double getEntityY(Object entity) {
        if (entity == null) return 0.0;
        try {
            Field f = findField(entity.getClass(), double.class, "posY", "field_70163_u", "t");
            if (f != null) return f.getDouble(entity);
        } catch (Throwable ignored) {}
        return 0.0;
    }

    public static double getEntityZ(Object entity) {
        if (entity == null) return 0.0;
        try {
            Field f = findField(entity.getClass(), double.class, "posZ", "field_70161_v", "u");
            if (f != null) return f.getDouble(entity);
        } catch (Throwable ignored) {}
        return 0.0;
    }

    private static Method findMethodWithParams(Class<?> clazz, Class<?> returnType, Class<?>[] paramTypes, String... candidateNames) {
        Class<?> current = clazz;
        while (current != null && current != Object.class) {
            for (Method m : current.getDeclaredMethods()) {
                if (returnType != null && !returnType.isAssignableFrom(m.getReturnType())) continue;
                if (paramTypes != null && m.getParameterCount() != paramTypes.length) continue;
                boolean paramsMatch = true;
                if (paramTypes != null) {
                    Class<?>[] p = m.getParameterTypes();
                    for (int i = 0; i < paramTypes.length; i++) {
                        if (!paramTypes[i].isAssignableFrom(p[i])) {
                            paramsMatch = false;
                            break;
                        }
                    }
                }
                if (!paramsMatch) continue;
                for (String name : candidateNames) {
                    if (m.getName().equalsIgnoreCase(name)) {
                        m.setAccessible(true);
                        return m;
                    }
                }
            }
            current = current.getSuperclass();
        }
        return null;
    }

    private static Method findMethod(Class<?> clazz, Class<?> returnType, String... candidateNames) {
        Class<?> current = clazz;
        while (current != null && current != Object.class) {
            for (String name : candidateNames) {
                try {
                    Method m = current.getDeclaredMethod(name);
                    if (returnType == null || returnType.isAssignableFrom(m.getReturnType())) {
                        m.setAccessible(true);
                        return m;
                    }
                } catch (NoSuchMethodException ignored) {
                }
            }
            for (Method m : current.getDeclaredMethods()) {
                for (String name : candidateNames) {
                    if (m.getName().equalsIgnoreCase(name) && m.getParameterCount() == 0) {
                        m.setAccessible(true);
                        return m;
                    }
                }
            }
            current = current.getSuperclass();
        }
        return null;
    }

    private static Field findField(Class<?> clazz, Class<?> fieldType, String... candidateNames) {
        Class<?> current = clazz;
        while (current != null && current != Object.class) {
            for (String name : candidateNames) {
                try {
                    Field f = current.getDeclaredField(name);
                    if (fieldType == null || fieldType.isAssignableFrom(f.getType())) {
                        f.setAccessible(true);
                        return f;
                    }
                } catch (NoSuchFieldException ignored) {
                }
            }
            for (Field f : current.getDeclaredFields()) {
                for (String name : candidateNames) {
                    if (f.getName().equalsIgnoreCase(name)) {
                        f.setAccessible(true);
                        return f;
                    }
                }
            }
            current = current.getSuperclass();
        }
        return null;
    }
}
