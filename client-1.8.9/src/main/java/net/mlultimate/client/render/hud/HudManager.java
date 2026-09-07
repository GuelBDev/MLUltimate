package net.mlultimate.client.render.hud;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.forge.MinecraftBridge;
import net.mlultimate.client.modules.hud.*;
import net.mlultimate.client.modules.combat.*;
import net.mlultimate.client.modules.movement.*;
import net.mlultimate.client.render.ColorUtils;
import net.mlultimate.client.render.DrawHelper;
import net.mlultimate.client.render.font.CustomFontRenderer;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;

import java.util.*;

/**
 * Enterprise HUD Manager for MLUltimate Client.
 * Manages all draggable HUD widgets, layout calculations, magnetic snapping,
 * and JSON persistence.
 */
public class HudManager {

    private final List<HudElement> elements = new ArrayList<>();
    private final CustomFontRenderer font = new CustomFontRenderer(1.0f);
    private final CustomFontRenderer smallFont = new CustomFontRenderer(0.85f);
    private final CustomFontRenderer tinyFont = new CustomFontRenderer(0.72f);

    public HudManager() {
        registerElements();
    }

    private void registerElements() {
        // 1. FPS Widget (Top-Left default)
        elements.add(new HudElement("fps", "FPS", 6.0f, 6.0f, 64.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                FPSModule m = getModule(FPSModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                FPSModule m = getModule(FPSModule.class);
                int fps = inEditor ? 144 : MinecraftBridge.getFps();
                String prefix = m != null ? m.getPrefix() : "FPS: ";
                String valStr = String.valueOf(fps);

                float preW = font.getStringWidth(prefix);
                float valW = font.getStringWidth(valStr);
                float pillW = preW + valW + 12.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                font.drawStringWithShadow(prefix, 6.0f, 4.0f, 0xFF4A90E2);
                font.drawStringWithShadow(valStr, 6.0f + preW, 4.0f, 0xFFFFFFFF);
            }
        });

        // 2. CPS Widget
        elements.add(new HudElement("cps", "CPS", 6.0f, 25.0f, 68.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                CPSModule m = getModule(CPSModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                CPSModule m = getModule(CPSModule.class);
                int lmb = inEditor ? 12 : (m != null ? m.getLmbCps() : 0);
                int rmb = inEditor ? 8 : (m != null ? m.getRmbCps() : 0);
                boolean showRmb = m == null || m.isShowRmb();

                String text = showRmb ? ("CPS: " + lmb + " | " + rmb) : ("CPS: " + lmb);
                float textW = font.getStringWidth(text);
                float pillW = textW + 12.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                font.drawStringWithShadow("CPS: ", 6.0f, 4.0f, 0xFF4A90E2);
                float preW = font.getStringWidth("CPS: ");
                String numbers = showRmb ? (lmb + " | " + rmb) : String.valueOf(lmb);
                font.drawStringWithShadow(numbers, 6.0f + preW, 4.0f, 0xFFFFFFFF);
            }
        });

        // 3. Ping Widget
        elements.add(new HudElement("ping", "Ping", 6.0f, 44.0f, 60.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                PingModule m = getModule(PingModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                PingModule m = getModule(PingModule.class);
                int ping = inEditor ? 24 : MinecraftBridge.getPing();
                int dotColor = (m != null && !m.isDynamicColor()) ? m.getTextColor() : 0xFF2ECC71;
                if (m == null || m.isDynamicColor()) {
                    if (ping > 120) dotColor = 0xFFE74C3C;
                    else if (ping > 60) dotColor = 0xFFF39C12;
                }

                String val = ping + " ms";
                float textW = font.getStringWidth(val);
                float pillW = textW + 20.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                DrawHelper.drawCircle(8.0f, 8.0f, 3.0f, dotColor);
                int textCol = (m != null) ? m.getTextColor() : 0xFFFFFFFF;
                font.drawStringWithShadow(val, 15.0f, 4.0f, textCol);
            }
        });

        // 4. Coordinates & Compass Widget
        elements.add(new HudElement("coordinates", "Coordenadas", 6.0f, 63.0f, 120.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                CoordinatesModule m = getModule(CoordinatesModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                int px = inEditor ? 120 : (int) Math.floor(MinecraftBridge.getPlayerX());
                int py = inEditor ? 64 : (int) Math.floor(MinecraftBridge.getPlayerY());
                int pz = inEditor ? -340 : (int) Math.floor(MinecraftBridge.getPlayerZ());

                String text = String.format(Locale.ROOT, "XYZ: %d, %d, %d", px, py, pz);
                float textW = font.getStringWidth(text);
                float pillW = textW + 12.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                font.drawStringWithShadow("XYZ: ", 6.0f, 4.0f, 0xFF4A90E2);
                float preW = font.getStringWidth("XYZ: ");
                font.drawStringWithShadow(px + ", " + py + ", " + pz, 6.0f + preW, 4.0f, 0xFFFFFFFF);
            }
        });

        // 5. Lunar-Style Keystrokes Widget
        elements.add(new HudElement("keystrokes", "Keystrokes", 6.0f, 86.0f, 74.0f, 78.0f) {
            @Override
            public boolean isEnabled() {
                KeystrokesModule m = getModule(KeystrokesModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                KeystrokesModule mod = getModule(KeystrokesModule.class);
                boolean showMouse = mod == null || mod.isShowMouseButtons();
                boolean showSpace = mod == null || mod.isShowSpacebar();

                float keySize = 22.0f;
                float gap = 3.0f;

                boolean wDown = !inEditor && isKeyDown(Keyboard.KEY_W);
                boolean aDown = !inEditor && isKeyDown(Keyboard.KEY_A);
                boolean sDown = !inEditor && isKeyDown(Keyboard.KEY_S);
                boolean dDown = !inEditor && isKeyDown(Keyboard.KEY_D);

                // Row 1: W
                renderKeyCap(keySize + gap, 0.0f, keySize, keySize, "W", wDown, null, mod);

                // Row 2: A, S, D
                float row2Y = keySize + gap;
                renderKeyCap(0.0f, row2Y, keySize, keySize, "A", aDown, null, mod);
                renderKeyCap(keySize + gap, row2Y, keySize, keySize, "S", sDown, null, mod);
                renderKeyCap((keySize + gap) * 2, row2Y, keySize, keySize, "D", dDown, null, mod);

                float nextY = row2Y + keySize + gap;

                // Row 3: LMB & RMB with integrated CPS
                if (showMouse) {
                    float mouseW = (keySize * 3 + gap * 2 - gap) / 2.0f;
                    float mouseH = 22.0f;
                    boolean lmbDown = !inEditor && Mouse.isButtonDown(0);
                    boolean rmbDown = !inEditor && Mouse.isButtonDown(1);

                    CPSModule cps = getModule(CPSModule.class);
                    int lmbCps = inEditor ? 12 : (cps != null ? cps.getLmbCps() : 0);
                    int rmbCps = inEditor ? 0 : (cps != null ? cps.getRmbCps() : 0);

                    renderKeyCap(0.0f, nextY, mouseW, mouseH, "LMB", lmbDown, lmbCps + " CPS", mod);
                    renderKeyCap(mouseW + gap, nextY, mouseW, mouseH, "RMB", rmbDown, rmbCps + " CPS", mod);
                    nextY += mouseH + gap;
                }

                // Row 4: Spacebar
                if (showSpace) {
                    float spaceW = keySize * 3 + gap * 2;
                    float spaceH = 10.0f;
                    boolean spaceDown = !inEditor && isKeyDown(Keyboard.KEY_SPACE);
                    renderKeyCap(0.0f, nextY, spaceW, spaceH, "━━━━━━", spaceDown, null, mod);
                    nextY += spaceH;
                }

                this.width = keySize * 3 + gap * 2;
                this.height = nextY;
            }

            private void renderKeyCap(float kx, float ky, float kw, float kh, String mainLabel, boolean pressed, String subLabel, KeystrokesModule mod) {
                int defaultPressedBg = 0x664A90E2;
                int pressedBg = (mod != null) ? mod.getPressedColor() : defaultPressedBg;
                if ((pressedBg & 0xFFFFFF) == 0xFFFFFF && ((pressedBg >> 24) & 0xFF) > 0x80) {
                    pressedBg = 0x664A90E2;
                }
                int normalBg = 0xCC141720;
                int bg = pressed ? pressedBg : normalBg;
                int border = pressed ? 0xFF4A90E2 : 0x403E485C;
                int textC = (mod != null) ? mod.getTextColor() : 0xFFFFFFFF;
                int subC = pressed ? 0xFFFFFFFF : 0xFFA0AAB8;

                DrawHelper.drawRoundedRect(kx, ky, kw, kh, 4.0f, bg);
                DrawHelper.drawOutline(kx, ky, kw, kh, 1.0f, border);

                if (subLabel != null) {
                    if (smallFont != null) smallFont.drawCenteredString(mainLabel, kx + kw / 2.0f, ky + 3.0f, textC);
                    if (tinyFont != null) tinyFont.drawCenteredString(subLabel, kx + kw / 2.0f, ky + 12.0f, subC);
                } else {
                    if (smallFont != null) smallFont.drawCenteredString(mainLabel, kx + kw / 2.0f, ky + (kh - 8.0f) / 2.0f, textC);
                }
            }
        });

        // 6. Graphical ArmorStatus Widget
        elements.add(new HudElement("armor_status", "Armadura", 6.0f, 220.0f, 80.0f, 76.0f) {
            @Override
            public boolean isEnabled() {
                ArmorStatusModule m = getModule(ArmorStatusModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                MinecraftBridge.ArmorInfo[] armors = inEditor
                        ? new MinecraftBridge.ArmorInfo[] {
                        new MinecraftBridge.ArmorInfo("Bota", 100, true),
                        new MinecraftBridge.ArmorInfo("Calça", 85, true),
                        new MinecraftBridge.ArmorInfo("Peitoral", 65, true),
                        new MinecraftBridge.ArmorInfo("Capacete", 92, true)
                }
                        : MinecraftBridge.getArmorInfo();

                float rowH = 17.0f;
                float spacing = 2.0f;
                float yOff = 0.0f;
                float cardW = 84.0f;

                for (int i = 3; i >= 0; i--) {
                    MinecraftBridge.ArmorInfo info = armors[i];
                    if (info == null || !info.present) continue;

                    int pct = Math.max(0, Math.min(100, info.damagePercent));
                    int col = 0xFF2ECC71;
                    if (pct <= 25) col = 0xFFE74C3C;
                    else if (pct <= 50) col = 0xFFF39C12;

                    renderAcrylicPill(0, yOff, cardW, rowH);

                    // Icon tag
                    String slotTag = getSlotTag(i);
                    font.drawStringWithShadow(slotTag, 5.0f, yOff + 4.0f, 0xFF4A90E2);

                    // Mini Durability Bar
                    float barX = 26.0f;
                    float barY = yOff + 6.0f;
                    float barW = 28.0f;
                    float barH = 5.0f;
                    DrawHelper.drawRoundedRect(barX, barY, barW, barH, 2.0f, 0xFF232834);
                    float fillW = Math.max(2.0f, barW * (pct / 100.0f));
                    DrawHelper.drawRoundedRect(barX, barY, fillW, barH, 2.0f, col);

                    // Percent text
                    String pctStr = pct + "%";
                    smallFont.drawStringWithShadow(pctStr, barX + barW + 4.0f, yOff + 4.0f, col);

                    yOff += rowH + spacing;
                }

                this.width = cardW;
                this.height = Math.max(18.0f, yOff);
            }

            private String getSlotTag(int slot) {
                switch (slot) {
                    case 3: return "CAP";
                    case 2: return "PEIT";
                    case 1: return "CAL";
                    case 0: return "BOT";
                    default: return "ARM";
                }
            }
        });

        // 7. Potion Effects Widget (Top-Right default)
        elements.add(new HudElement("potion_effects", "Efeitos de Poção", 560.0f, 6.0f, 110.0f, 50.0f) {
            @Override
            public boolean isEnabled() {
                PotionEffectsModule m = getModule(PotionEffectsModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                List<MinecraftBridge.PotionInfo> list = inEditor
                        ? Arrays.asList(
                        new MinecraftBridge.PotionInfo("Velocidade", 85, 1),
                        new MinecraftBridge.PotionInfo("Força", 45, 0)
                )
                        : MinecraftBridge.getPotionEffects();

                if (list.isEmpty()) {
                    this.width = 100.0f;
                    this.height = 18.0f;
                    return;
                }

                float rowH = 18.0f;
                float spacing = 3.0f;
                float yOff = 0.0f;
                float maxW = 100.0f;

                for (MinecraftBridge.PotionInfo p : list) {
                    String durStr = formatTime(p.durationSeconds);
                    String name = p.name;
                    if (p.amplifier > 0) name += " " + (p.amplifier + 1);

                    float textW = font.getStringWidth(name) + smallFont.getStringWidth(durStr) + 24.0f;
                    float cardW = Math.max(105.0f, textW);
                    if (cardW > maxW) maxW = cardW;

                    renderAcrylicPill(0, yOff, cardW, rowH);

                    // Accent indicator bar
                    int accent = getPotionColor(p.name);
                    DrawHelper.drawRoundedRect(2.0f, yOff + 3.0f, 3.0f, rowH - 6.0f, 1.5f, accent);

                    font.drawStringWithShadow(name, 9.0f, yOff + 5.0f, 0xFFFFFFFF);
                    smallFont.drawStringWithShadow(durStr, cardW - smallFont.getStringWidth(durStr) - 6.0f, yOff + 5.0f, 0xFFF1C40F);

                    yOff += rowH + spacing;
                }

                this.width = maxW;
                this.height = Math.max(18.0f, yOff);
            }

            private int getPotionColor(String name) {
                String n = name.toLowerCase(Locale.ROOT);
                if (n.contains("speed") || n.contains("velo")) return 0xFF3498DB;
                if (n.contains("strength") || n.contains("forç")) return 0xFFE74C3C;
                if (n.contains("fire") || n.contains("fogo")) return 0xFFE67E22;
                if (n.contains("regen")) return 0xFFE84393;
                if (n.contains("jump") || n.contains("pulo")) return 0xFF2ECC71;
                return 0xFF9B59B6;
            }
        });

        // 8. Clock Widget
        elements.add(new HudElement("clock", "Relógio", 6.0f, 170.0f, 74.0f, 16.0f) {
            private final java.text.SimpleDateFormat sdf24Sec = new java.text.SimpleDateFormat("HH:mm:ss");
            private final java.text.SimpleDateFormat sdf24NoSec = new java.text.SimpleDateFormat("HH:mm");
            private final java.text.SimpleDateFormat sdf12Sec = new java.text.SimpleDateFormat("hh:mm:ss a");
            private final java.text.SimpleDateFormat sdf12NoSec = new java.text.SimpleDateFormat("hh:mm a");

            @Override
            public boolean isEnabled() {
                ClockModule m = getModule(ClockModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                ClockModule m = getModule(ClockModule.class);
                boolean is24 = m == null || !"12h".equalsIgnoreCase(m.getFormat());
                boolean showSec = m == null || m.isShowSeconds();

                java.util.Date now = new java.util.Date();
                String timeStr;
                if (is24) {
                    timeStr = showSec ? sdf24Sec.format(now) : sdf24NoSec.format(now);
                } else {
                    timeStr = showSec ? sdf12Sec.format(now) : sdf12NoSec.format(now);
                }

                float timeW = font.getStringWidth(timeStr);
                float pillW = timeW + 14.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                font.drawStringWithShadow(timeStr, 7.0f, 4.0f, 0xFFFFFFFF);
            }
        });

        // 9. Memory (RAM) Widget
        elements.add(new HudElement("memory", "Memória RAM", 6.0f, 190.0f, 96.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                MemoryModule m = getModule(MemoryModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                MemoryModule m = getModule(MemoryModule.class);
                Runtime rt = Runtime.getRuntime();
                long total = rt.totalMemory() / (1024 * 1024);
                long free = rt.freeMemory() / (1024 * 1024);
                long max = rt.maxMemory() / (1024 * 1024);
                long used = total - free;
                int pct = (int) Math.min(100, Math.max(0, (used * 100) / Math.max(1, max)));

                boolean showPct = m == null || m.isShowPercentage();
                String ramText = showPct ? (used + "MB (" + pct + "%)") : (used + "MB / " + max + "MB");

                int col = 0xFF2ECC71;
                if (pct > 85) col = 0xFFE74C3C;
                else if (pct > 70) col = 0xFFF39C12;

                float preW = font.getStringWidth("RAM: ");
                float valW = font.getStringWidth(ramText);
                float pillW = preW + valW + 12.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                font.drawStringWithShadow("RAM: ", 6.0f, 4.0f, 0xFF4A90E2);
                font.drawStringWithShadow(ramText, 6.0f + preW, 4.0f, col);
            }
        });

        // 10. Server Info Widget
        elements.add(new HudElement("server_info", "Info do Servidor", 6.0f, 210.0f, 90.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                ServerInfoModule m = getModule(ServerInfoModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                String ip = inEditor ? "hypixel.net" : MinecraftBridge.getServerIP();
                String text = ip;
                float textW = font.getStringWidth(text);
                float pillW = textW + 20.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                DrawHelper.drawCircle(8.0f, 8.0f, 3.0f, 0xFF4A90E2);
                font.drawStringWithShadow(text, 15.0f, 4.0f, 0xFFFFFFFF);
            }
        });

        // 11. Combo Counter Widget
        elements.add(new HudElement("combo_counter", "Contador de Combo", 260.0f, 6.0f, 74.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                ComboCounterModule m = getModule(ComboCounterModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                ComboCounterModule m = getModule(ComboCounterModule.class);
                int combo = inEditor ? 4 : (m != null ? m.getCombo() : 0);
                if (!inEditor && combo == 0) {
                    this.width = 60.0f;
                    this.height = 16.0f;
                    return;
                }

                String pre = (m == null || m.isShowText()) ? "Combo: " : "";
                String val = combo + " Hits";
                float preW = font.getStringWidth(pre);
                float valW = font.getStringWidth(val);
                float pillW = preW + valW + 12.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                if (!pre.isEmpty()) {
                    font.drawStringWithShadow(pre, 6.0f, 4.0f, 0xFF4A90E2);
                }
                font.drawStringWithShadow(val, 6.0f + preW, 4.0f, 0xFFFFFFFF);
            }
        });

        // 12. Reach Display Widget
        elements.add(new HudElement("reach_display", "Alcance do Golpe", 340.0f, 6.0f, 74.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                ReachDisplayModule m = getModule(ReachDisplayModule.class);
                return m != null && m.isEnabled();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                ReachDisplayModule m = getModule(ReachDisplayModule.class);
                double reach = inEditor ? 2.98 : (m != null ? m.getLastReach() : 0.0);
                if (!inEditor && reach <= 0.05) {
                    this.width = 60.0f;
                    this.height = 16.0f;
                    return;
                }

                boolean suffix = m == null || m.isShowBlocks();
                String reachStr = String.format(Locale.ROOT, "%.2f%s", reach, suffix ? "b" : "");
                String pre = "Alcance: ";
                float preW = font.getStringWidth(pre);
                float valW = font.getStringWidth(reachStr);
                float pillW = preW + valW + 12.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                font.drawStringWithShadow(pre, 6.0f, 4.0f, 0xFF4A90E2);
                font.drawStringWithShadow(reachStr, 6.0f + preW, 4.0f, 0xFFFFFFFF);
            }
        });

        // 13. Toggle Sprint Indicator Widget
        elements.add(new HudElement("togglesprint", "Toggle Sprint", 6.0f, 310.0f, 100.0f, 16.0f) {
            @Override
            public boolean isEnabled() {
                ToggleSprintModule m = getModule(ToggleSprintModule.class);
                return m != null && m.isEnabled() && m.isShowText();
            }

            @Override
            public void renderContent(float partialTicks, boolean inEditor) {
                ToggleSprintModule m = getModule(ToggleSprintModule.class);
                String text = (m != null) ? m.getText() : "[Correndo (Ativado)]";
                float textW = smallFont.getStringWidth(text);
                float pillW = textW + 12.0f;
                this.width = pillW;
                this.height = 16.0f;

                renderAcrylicPill(0, 0, pillW, 16.0f);
                smallFont.drawStringWithShadow(text, 6.0f, 4.0f, 0xFF2ECC71);
            }
        });
    }

    public void render(float partialTicks, boolean inEditor) {
        for (HudElement el : elements) {
            el.render(partialTicks, inEditor);
        }
    }

    public List<HudElement> getElements() {
        return elements;
    }

    public HudElement getElementById(String id) {
        for (HudElement el : elements) {
            if (el.getId().equalsIgnoreCase(id)) return el;
        }
        return null;
    }

    public void resetAllPositions() {
        for (HudElement el : elements) {
            el.resetPosition();
        }
    }

    public void load(JsonObject root) {
        if (root == null) return;
        for (HudElement el : elements) {
            if (root.has(el.getId()) && root.get(el.getId()).isJsonObject()) {
                JsonObject obj = root.getAsJsonObject(el.getId());
                if (obj.has("x")) el.setX(obj.get("x").getAsFloat());
                if (obj.has("y")) el.setY(obj.get("y").getAsFloat());
                if (obj.has("scale")) el.setScale(obj.get("scale").getAsFloat());
            }
        }
    }

    public JsonObject save() {
        JsonObject root = new JsonObject();
        for (HudElement el : elements) {
            JsonObject obj = new JsonObject();
            obj.addProperty("x", el.getX());
            obj.addProperty("y", el.getY());
            obj.addProperty("scale", el.getScale());
            root.add(el.getId(), obj);
        }
        return root;
    }

    private static int globalPillBg = 0xCC11141B;
    private static int globalPillBorder = 0x303E485C;
    private static boolean globalPillBorderEnabled = true;

    public static void setGlobalPillBg(int bg) { globalPillBg = bg; }
    public static int getGlobalPillBg() { return globalPillBg; }
    public static void setGlobalPillBorder(int border) { globalPillBorder = border; }
    public static int getGlobalPillBorder() { return globalPillBorder; }
    public static void setGlobalPillBorderEnabled(boolean enabled) { globalPillBorderEnabled = enabled; }
    public static boolean isGlobalPillBorderEnabled() { return globalPillBorderEnabled; }

    public static void renderAcrylicPill(float x, float y, float w, float h) {
        DrawHelper.drawDropShadow(x, y, w, h, 4, 0x40000000);
        DrawHelper.drawRoundedRect(x, y, w, h, 5.0f, globalPillBg);
        if (globalPillBorderEnabled) {
            DrawHelper.drawOutline(x, y, w, h, 1.0f, globalPillBorder);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T extends net.mlultimate.client.module.Module> T getModule(Class<T> clazz) {
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getModuleManager() == null) return null;
        return MLUltimate.getInstance().getModuleManager().getModuleByClass(clazz);
    }

    private static boolean isKeyDown(int key) {
        try {
            return Keyboard.isKeyDown(key);
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static String formatTime(int seconds) {
        int m = seconds / 60;
        int s = seconds % 60;
        return String.format(Locale.ROOT, "%02d:%02d", m, s);
    }
}
