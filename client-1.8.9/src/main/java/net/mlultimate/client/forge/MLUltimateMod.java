package net.mlultimate.client.forge;

import net.minecraftforge.client.event.GuiScreenEvent;
import net.minecraftforge.client.event.MouseEvent;
import net.minecraftforge.client.event.RenderGameOverlayEvent;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.FMLCommonHandler;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;
import net.minecraftforge.fml.common.eventhandler.SubscribeEvent;
import net.minecraftforge.fml.common.gameevent.InputEvent;
import net.minecraftforge.fml.common.gameevent.TickEvent;
import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.util.Logger;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;
import org.lwjgl.opengl.Display;
import org.lwjgl.opengl.GL11;

import java.io.File;

/**
 * Official Minecraft Forge 1.8.9 Entry Point for MLUltimate Client.
 * Manages lifecycle callbacks and dispatches Forge bus events to MLUltimate subsystems.
 */
@Mod(modid = MLUltimateMod.MODID, name = MLUltimateMod.NAME, version = MLUltimateMod.VERSION, clientSideOnly = true)
public class MLUltimateMod {

    public static final String MODID = "mlultimate";
    public static final String NAME = "MLUltimate Client";
    public static final String VERSION = "1.0.0";
    public static final int MLULTIMATE_MENU_BUTTON_ID = 8999;

    @Mod.Instance(MODID)
    public static MLUltimateMod instance;

    private int lastScaledWidth = 800;
    private int lastScaledHeight = 500;
    private boolean wasFullscreen = false;

    @Mod.EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        System.out.println("================================================================================");
        System.out.println("  Iniciando " + NAME + " v" + VERSION + " (Minecraft 1.8.9 / Forge)");
        System.out.println("================================================================================");

        File mcDir = event.getModConfigurationDirectory() != null
                ? event.getModConfigurationDirectory().getParentFile()
                : new File(".");

        // Bootstrap the MLUltimate Client Singleton
        MLUltimate.init(mcDir);
        MinecraftBridge.init();

        // Register to Forge & FML event buses
        MinecraftForge.EVENT_BUS.register(this);
        FMLCommonHandler.instance().bus().register(this);
    }

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        MinecraftBridge.cleanForgeBrandings();
        Logger.info(Logger.Category.FORGE, "MLUltimate Client Forge inicializado com sucesso.");
    }

    @SubscribeEvent
    public void onRenderGameOverlayPre(RenderGameOverlayEvent.Pre event) {
        if (event.type == RenderGameOverlayEvent.ElementType.CROSSHAIRS) {
            if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getModuleManager() != null) {
                net.mlultimate.client.modules.combat.CrosshairModule crosshairMod =
                        MLUltimate.getInstance().getModuleManager().getModuleByClass(net.mlultimate.client.modules.combat.CrosshairModule.class);
                if (crosshairMod != null && crosshairMod.isEnabled()) {
                    event.setCanceled(true);
                }
            }
        }
    }

    @SubscribeEvent
    public void onRenderGameOverlayPost(RenderGameOverlayEvent.Post event) {
        if (event.type != RenderGameOverlayEvent.ElementType.ALL) {
            return;
        }

        int sw = MinecraftBridge.getScaledWidth(event.resolution);
        int sh = MinecraftBridge.getScaledHeight(event.resolution);
        this.lastScaledWidth = sw;
        this.lastScaledHeight = sh;

        if (MLUltimate.getInstance() != null) {
            boolean menuOpen = MLUltimate.getInstance().isModMenuOpen();
            boolean editorOpen = MLUltimate.getInstance().isHudEditorOpen();
            boolean ingameMenu = MinecraftBridge.isIngameMenuOpen();

            if (menuOpen || editorOpen) {
                MinecraftBridge.lockCamera();
            }

            GL11.glPushAttrib(GL11.GL_ALL_ATTRIB_BITS);
            GL11.glPushMatrix();
            try {
                MinecraftBridge.bindFontTexture();
                // Render interactive HUD Editor
                if (editorOpen) {
                    int mouseX = (int) (Mouse.getX() * (double) sw / Math.max(1, Display.getWidth()));
                    int mouseY = (int) (sh - Mouse.getY() * (double) sh / Math.max(1, Display.getHeight()) - 1);

                    net.mlultimate.client.gui.HudEditorScreen editor = MLUltimate.getInstance().getHudEditorScreen();
                    editor.drawScreen(mouseX, mouseY, event.partialTicks, sw, sh);
                } else if (!ingameMenu && !menuOpen && MLUltimate.getInstance().getRenderManager() != null) {
                    // Render HUD overlay only when in active gameplay
                    MLUltimate.getInstance().getRenderManager().render2D(event.partialTicks, sw, sh);
                }

                // Draw interactive Mod Menu Screen
                if (menuOpen) {
                    int mouseX = (int) (Mouse.getX() * (double) sw / Math.max(1, Display.getWidth()));
                    int mouseY = (int) (sh - Mouse.getY() * (double) sh / Math.max(1, Display.getHeight()) - 1);

                    net.mlultimate.client.gui.ModMenuScreen menu = MLUltimate.getInstance().getModMenuScreen();
                    menu.drawScreen(mouseX, mouseY, event.partialTicks, sw, sh);
                }
            } finally {
                GL11.glPopMatrix();
                GL11.glPopAttrib();
                MinecraftBridge.cleanGlState();
            }
        }
    }

    @SubscribeEvent
    public void onKeyInput(InputEvent.KeyInputEvent event) {
        if (!Keyboard.getEventKeyState()) return;

        int key = Keyboard.getEventKey();
        char typedChar = Keyboard.getEventCharacter();
        int boundKey = MinecraftBridge.getHudBoundKeyCode();

        // Handle F11 fullscreen toggle fix for window maximization and resizing
        if (key == Keyboard.KEY_F11) {
            if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getTickManager() != null) {
                MLUltimate.getInstance().getTickManager().runOnNextTick(this::fixWindowResizable);
            }
        }

        // Forward to HudEditorScreen if open
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().isHudEditorOpen()) {
            if (key == Keyboard.KEY_ESCAPE) {
                MLUltimate.getInstance().setHudEditorOpen(false);
                MLUltimate.getInstance().getHudEditorScreen().onClose();
                MLUltimate.getInstance().setModMenuOpen(true);
                MinecraftBridge.lockCamera();
                MLUltimate.getInstance().getModMenuScreen().init(
                        lastScaledWidth > 0 ? lastScaledWidth : 800,
                        lastScaledHeight > 0 ? lastScaledHeight : 500
                );
                return;
            }
            MLUltimate.getInstance().getHudEditorScreen().keyTyped(typedChar, key);
            return;
        }

        // Default open keys: RIGHT SHIFT or custom binding (removed KEY_H as requested)
        if (key == boundKey || key == Keyboard.KEY_RSHIFT) {
            if (MLUltimate.getInstance() != null) {
                boolean nextOpen = !MLUltimate.getInstance().isModMenuOpen();
                MLUltimate.getInstance().setModMenuOpen(nextOpen);
                MinecraftBridge.unpressAllKeys();
                if (nextOpen) {
                    MinecraftBridge.lockCamera();
                    MLUltimate.getInstance().getModMenuScreen().init(
                            lastScaledWidth > 0 ? lastScaledWidth : 800,
                            lastScaledHeight > 0 ? lastScaledHeight : 500
                    );
                } else {
                    MLUltimate.getInstance().getModMenuScreen().onClose();
                    MinecraftBridge.unlockCamera();
                }
            }
            return;
        }

        // Forward to ModMenuScreen if open
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().isModMenuOpen()) {
            if (key == Keyboard.KEY_ESCAPE) {
                MLUltimate.getInstance().setModMenuOpen(false);
                MLUltimate.getInstance().getModMenuScreen().onClose();
                MinecraftBridge.unpressAllKeys();
                MinecraftBridge.unlockCamera();
                return;
            }
            MLUltimate.getInstance().getModMenuScreen().keyTyped(typedChar, key);
            return;
        }

        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getInputManager() != null) {
            MLUltimate.getInstance().getInputManager().onKey(key, true);
        }
    }

    @SubscribeEvent
    public void onMouseEvent(MouseEvent event) {
        if (MLUltimate.getInstance() == null) return;
        boolean menuOpen = MLUltimate.getInstance().isModMenuOpen();
        boolean editorOpen = MLUltimate.getInstance().isHudEditorOpen();

        if (menuOpen || editorOpen) {
            // Cancel mouse event immediately so Minecraft doesn't process it,
            // never takes focus, never moves camera, and never attacks/mines in world.
            try {
                event.setCanceled(true);
            } catch (Throwable ignored) {
            }

            int sw = lastScaledWidth > 0 ? lastScaledWidth : 800;
            int sh = lastScaledHeight > 0 ? lastScaledHeight : 500;
            int mouseX = (int) (Mouse.getX() * (double) sw / Math.max(1, Display.getWidth()));
            int mouseY = (int) (sh - Mouse.getY() * (double) sh / Math.max(1, Display.getHeight()) - 1);

            if (editorOpen) {
                net.mlultimate.client.gui.HudEditorScreen editor = MLUltimate.getInstance().getHudEditorScreen();
                if (event.button != -1) {
                    if (event.buttonstate) {
                        editor.mouseClicked(mouseX, mouseY, event.button);
                    } else {
                        editor.mouseReleased(mouseX, mouseY, event.button);
                    }
                }
                editor.handleMouseInput();
            } else if (menuOpen) {
                net.mlultimate.client.gui.ModMenuScreen menu = MLUltimate.getInstance().getModMenuScreen();
                if (event.button != -1) {
                    if (event.buttonstate) {
                        menu.mouseClicked(mouseX, mouseY, event.button);
                    } else {
                        menu.mouseReleased(mouseX, mouseY, event.button);
                    }
                }
                menu.handleMouseInput();
            }
        }
    }

    @SubscribeEvent
    public void onMouseInput(InputEvent.MouseInputEvent event) {
        if (MLUltimate.getInstance() != null) {
            boolean menuOpen = MLUltimate.getInstance().isModMenuOpen();
            boolean editorOpen = MLUltimate.getInstance().isHudEditorOpen();
            if (menuOpen || editorOpen) {
                return;
            }
        }

        int btn = Mouse.getEventButton();
        boolean state = Mouse.getEventButtonState();

        // Track clicks for CPSModule
        if (btn != -1 && state && MLUltimate.getInstance() != null && MLUltimate.getInstance().getModuleManager() != null) {
            net.mlultimate.client.modules.hud.CPSModule cps = MLUltimate.getInstance().getModuleManager().getModuleByClass(net.mlultimate.client.modules.hud.CPSModule.class);
            if (cps != null) {
                cps.registerClick(btn);
            }
        }

        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getInputManager() != null) {
            MLUltimate.getInstance().getInputManager().onMouse(btn, state);
        }
    }

    @SubscribeEvent
    public void onAttackEntity(net.minecraftforge.event.entity.player.AttackEntityEvent event) {
        if (event == null || event.target == null) return;
        if (MLUltimate.getInstance() == null || MLUltimate.getInstance().getModuleManager() == null) return;

        double reach = 0.0;
        try {
            double dx = MinecraftBridge.getPlayerX() - MinecraftBridge.getEntityX(event.target);
            double dy = MinecraftBridge.getPlayerY() - MinecraftBridge.getEntityY(event.target);
            double dz = MinecraftBridge.getPlayerZ() - MinecraftBridge.getEntityZ(event.target);
            reach = Math.sqrt(dx * dx + dy * dy + dz * dz);
        } catch (Throwable ignored) {
        }

        net.mlultimate.client.modules.combat.ReachDisplayModule reachMod =
                MLUltimate.getInstance().getModuleManager().getModuleByClass(net.mlultimate.client.modules.combat.ReachDisplayModule.class);
        if (reachMod != null) {
            reachMod.onAttack(reach);
        }

        net.mlultimate.client.modules.combat.ComboCounterModule comboMod =
                MLUltimate.getInstance().getModuleManager().getModuleByClass(net.mlultimate.client.modules.combat.ComboCounterModule.class);
        if (comboMod != null) {
            comboMod.onHit();
        }

        net.mlultimate.client.modules.combat.CrosshairModule crosshairMod =
                MLUltimate.getInstance().getModuleManager().getModuleByClass(net.mlultimate.client.modules.combat.CrosshairModule.class);
        if (crosshairMod != null) {
            crosshairMod.onHit();
        }
    }

    @SubscribeEvent
    public void onFOVUpdate(net.minecraftforge.client.event.FOVUpdateEvent event) {
        if (event == null || MLUltimate.getInstance() == null || MLUltimate.getInstance().getModuleManager() == null) return;
        net.mlultimate.client.modules.render.ZoomModule zoomMod =
                MLUltimate.getInstance().getModuleManager().getModuleByClass(net.mlultimate.client.modules.render.ZoomModule.class);
        if (zoomMod != null && zoomMod.isEnabled()) {
            float factor = zoomMod.getActiveZoomFactor();
            if (factor > 1.01f) {
                event.newfov = event.newfov / factor;
            }
        }
    }

    @SubscribeEvent
    public void onRenderTick(TickEvent.RenderTickEvent event) {
        if (event.phase == TickEvent.Phase.START) {
            if (MLUltimate.getInstance() != null) {
                boolean isMenu = MLUltimate.getInstance().isModMenuOpen();
                boolean isEditor = MLUltimate.getInstance().isHudEditorOpen();
                if (isMenu || isEditor) {
                    MinecraftBridge.lockCamera();
                }
            }
        }
    }

    @SubscribeEvent
    public void onClientTick(TickEvent.ClientTickEvent event) {
        if (MLUltimate.getInstance() != null) {
            boolean isMenu = MLUltimate.getInstance().isModMenuOpen();
            boolean isEditor = MLUltimate.getInstance().isHudEditorOpen();
            if (isMenu || isEditor) {
                MinecraftBridge.lockCamera();
            }
        }

        if (event.phase == TickEvent.Phase.END) {
            boolean currentFullscreen = Display.isFullscreen();
            if (wasFullscreen && !currentFullscreen) {
                fixWindowResizable();
            }
            wasFullscreen = currentFullscreen;

            if (!currentFullscreen && !Display.isResizable()) {
                fixWindowResizable();
            }

            if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getTickManager() != null) {
                MLUltimate.getInstance().getTickManager().onClientTick();
            }
        }
    }

    public void fixWindowResizable() {
        try {
            if (!Display.isFullscreen()) {
                Display.setResizable(false);
                Display.setResizable(true);
            }
        } catch (Throwable ignored) {
        }
    }

    public void openClientMenu() {
        if (MLUltimate.getInstance() != null) {
            MinecraftBridge.unpressAllKeys();
            MinecraftBridge.lockCamera();
            MLUltimate.getInstance().setModMenuOpen(true);
            MLUltimate.getInstance().getModMenuScreen().init(
                    lastScaledWidth > 0 ? lastScaledWidth : 800,
                    lastScaledHeight > 0 ? lastScaledHeight : 500
            );
        }
    }

    @SubscribeEvent
    public void onInitGui(GuiScreenEvent.InitGuiEvent.Post event) {
        if (event.gui == null) return;
        String name = event.gui.getClass().getSimpleName();

        // 1. Clean Title Screen (GuiMainMenu): Remove Forge mod counters and "Mods" button
        if (name.equals("GuiMainMenu") || name.equals("aye")) {
            MinecraftBridge.cleanForgeBrandings();
            if (event.buttonList != null) {
                for (int i = event.buttonList.size() - 1; i >= 0; i--) {
                    Object b = event.buttonList.get(i);
                    int id = MinecraftBridge.getButtonId(b);
                    String txt = MinecraftBridge.getButtonText(b);
                    if (id == 6 || txt.toLowerCase(java.util.Locale.ROOT).contains("mods")) {
                        event.buttonList.remove(i);
                    }
                }
            }
            return;
        }

        // 2. Pause Menu (GuiIngameMenu)
        if (!name.equals("GuiIngameMenu") && !name.equals("axp")) {
            return;
        }

        if (event.buttonList != null) {
            int backBtnX = -1;
            int backBtnY = -1;
            int backBtnW = 200;
            int backBtnH = 20;

            for (Object btn : event.buttonList) {
                int id = MinecraftBridge.getButtonId(btn);
                String txt = MinecraftBridge.getButtonText(btn);
                if (id == 4 || txt.toLowerCase(java.util.Locale.ROOT).contains("return to game")
                        || txt.toLowerCase(java.util.Locale.ROOT).contains("voltar ao jogo")
                        || txt.toLowerCase(java.util.Locale.ROOT).contains("back to game")) {
                    backBtnX = MinecraftBridge.getButtonX(btn);
                    backBtnY = MinecraftBridge.getButtonY(btn);
                    backBtnW = MinecraftBridge.getButtonWidth(btn);
                    backBtnH = MinecraftBridge.getButtonHeight(btn);
                }

                // Replace "Mod Options..." with launcher mod menu button
                if (id == 12 || txt.toLowerCase(java.util.Locale.ROOT).contains("mod options")
                        || txt.toLowerCase(java.util.Locale.ROOT).contains("opções de mod")) {
                    MinecraftBridge.setButtonText(btn, "§b§lMLUltimate Client");
                }
            }

            int sw = lastScaledWidth > 0 ? lastScaledWidth : 800;
            int sh = lastScaledHeight > 0 ? lastScaledHeight : 500;
            int targetX = (backBtnX > 0) ? (backBtnX + backBtnW + 4) : (sw / 2 + 104);
            int targetY = (backBtnY > 0) ? backBtnY : (sh / 4 + 8);
            int targetW = (backBtnH > 0) ? backBtnH : 20;
            int targetH = (backBtnH > 0) ? backBtnH : 20;

            for (int i = event.buttonList.size() - 1; i >= 0; i--) {
                Object b = event.buttonList.get(i);
                if (MinecraftBridge.getButtonId(b) == MLULTIMATE_MENU_BUTTON_ID) {
                    event.buttonList.remove(i);
                }
            }

            // Create cube button without text so only the 3D logo is drawn
            Object customButton = MinecraftBridge.createGuiButton(
                    MLULTIMATE_MENU_BUTTON_ID,
                    targetX,
                    targetY,
                    targetW,
                    targetH,
                    ""
            );

            if (customButton != null) {
                try {
                    ((java.util.List) event.buttonList).add(customButton);
                } catch (Throwable ignored) {
                }
            }
        }
    }

    @SubscribeEvent
    public void onDrawScreenPost(GuiScreenEvent.DrawScreenEvent.Post event) {
        if (event.gui == null) return;
        String name = event.gui.getClass().getSimpleName();
        if (!name.equals("GuiIngameMenu") && !name.equals("axp")) {
            return;
        }

        java.util.List buttons = MinecraftBridge.getScreenButtonList(event.gui);
        if (buttons != null) {
            for (Object btn : buttons) {
                if (MinecraftBridge.getButtonId(btn) == MLULTIMATE_MENU_BUTTON_ID) {
                    int bx = MinecraftBridge.getButtonX(btn);
                    int by = MinecraftBridge.getButtonY(btn);
                    int bw = MinecraftBridge.getButtonWidth(btn);
                    int bh = MinecraftBridge.getButtonHeight(btn);

                    // Render small crisp MLUltimate logo centered inside the cube
                    int logoSize = Math.max(14, bh - 4);
                    float lx = bx + (bw - logoSize) / 2.0f;
                    float ly = by + (bh - logoSize) / 2.0f;
                    net.mlultimate.client.render.DrawHelper.drawLogo(lx, ly, logoSize, logoSize);
                    break;
                }
            }
        }
    }

    @SubscribeEvent
    public void onActionPerformed(GuiScreenEvent.ActionPerformedEvent.Pre event) {
        if (event.button != null) {
            int id = MinecraftBridge.getButtonId(event.button);
            String txt = MinecraftBridge.getButtonText(event.button);
            if (id == MLULTIMATE_MENU_BUTTON_ID || id == 12 || txt.contains("MLUltimate") || txt.contains("Mod Options")) {
                try {
                    event.setCanceled(true);
                } catch (Throwable ignored) {
                }
                MinecraftBridge.unpressAllKeys();
                MinecraftBridge.displayGuiScreen(null);
                openClientMenu();
            }
        }
    }

    public int getLastScaledWidth() {
        return lastScaledWidth;
    }

    public int getLastScaledHeight() {
        return lastScaledHeight;
    }
}
