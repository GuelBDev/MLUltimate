package net.mlultimate.client.core;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.util.Logger;

import java.io.File;

/**
 * Clean lifecycle bootstrapper for MLUltimate Client.
 * Coordinates initialization phases with microsecond timing and failure isolation.
 */
public class MLUltimateBootstrap {

    public enum Stage {
        UNINITIALIZED,
        PRE_INIT,
        INIT,
        POST_INIT,
        READY,
        SHUTDOWN
    }

    private Stage currentStage = Stage.UNINITIALIZED;

    public void bootstrap(MLUltimate client, File gameDir) {
        long startTime = System.currentTimeMillis();
        currentStage = Stage.PRE_INIT;

        // 1. Initialize logging subsystem
        Logger.init(gameDir);
        Logger.info(Logger.Category.CORE, "Iniciando bootstrapping do MLUltimate Client v" + MLUltimate.VERSION + "...");

        try {
            // 2. Event System
            client.setEventBus(new net.mlultimate.client.event.EventBus());
            client.setEventManager(new EventManager());

            currentStage = Stage.INIT;

            // 3. Core Managers
            client.setNotificationManager(new NotificationManager());
            client.setKeybindManager(new KeybindManager());
            client.setInputManager(new InputManager());
            client.setTickManager(new TickManager());
            client.setRenderManager(new RenderManager());

            ModuleManager moduleManager = new ModuleManager();
            moduleManager.registerAll(
                    // HUD Modules
                    new net.mlultimate.client.modules.hud.FPSModule(),
                    new net.mlultimate.client.modules.hud.CPSModule(),
                    new net.mlultimate.client.modules.hud.KeystrokesModule(),
                    new net.mlultimate.client.modules.hud.CoordinatesModule(),
                    new net.mlultimate.client.modules.hud.PingModule(),
                    new net.mlultimate.client.modules.hud.ArmorStatusModule(),
                    new net.mlultimate.client.modules.hud.PotionEffectsModule(),
                    new net.mlultimate.client.modules.hud.ClockModule(),
                    new net.mlultimate.client.modules.hud.MemoryModule(),
                    new net.mlultimate.client.modules.hud.ScoreboardModule(),
                    new net.mlultimate.client.modules.hud.ServerInfoModule(),

                    // Combat & PvP Modules
                    new net.mlultimate.client.modules.combat.ComboCounterModule(),
                    new net.mlultimate.client.modules.combat.CrosshairModule(),
                    new net.mlultimate.client.modules.combat.HitColorModule(),
                    new net.mlultimate.client.modules.combat.ReachDisplayModule(),

                    // Movement Modules
                    new net.mlultimate.client.modules.movement.ToggleSprintModule(),
                    new net.mlultimate.client.modules.movement.ToggleSneakModule(),

                    // Render / Visual Modules
                    new net.mlultimate.client.modules.render.FullbrightModule(),
                    new net.mlultimate.client.modules.render.ZoomModule(),
                    new net.mlultimate.client.modules.render.AnimationsModule(),
                    new net.mlultimate.client.modules.render.BlockOutlineModule(),
                    new net.mlultimate.client.modules.render.MotionBlurModule(),
                    new net.mlultimate.client.modules.render.TimeChangerModule(),

                    // Performance Engine
                    new net.mlultimate.client.modules.performance.PerformanceModule()
            );
            client.setModuleManager(moduleManager);

            // 4. Config & Profiles in config/mlultimate/
            ConfigManager configManager = new ConfigManager(gameDir);
            client.setConfigManager(configManager);
            client.setProfileManager(new ProfileManager(configManager.getProfilesDir()));

            currentStage = Stage.POST_INIT;

            // 5. Restore saved configurations
            configManager.loadAll();

            long elapsed = System.currentTimeMillis() - startTime;
            currentStage = Stage.READY;
            Logger.info(Logger.Category.CORE, "MLUltimate Client carregado com sucesso em " + elapsed + "ms!");

            client.getNotificationManager().showSuccess("Bem-vindo ao MLUltimate Client v" + MLUltimate.VERSION);
        } catch (Throwable t) {
            currentStage = Stage.SHUTDOWN;
            Logger.error(Logger.Category.CORE, "Falha crítica durante bootstrap do MLUltimate Client", t);
        }
    }

    public Stage getCurrentStage() {
        return currentStage;
    }
}
