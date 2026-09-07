package net.mlultimate.client.core;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.event.events.KeyEvent;
import net.mlultimate.client.event.events.MouseEvent;
import org.lwjgl.input.Keyboard;

/**
 * Input Manager for MLUltimate Client.
 * Intercepts keyboard and mouse inputs, manages keybinds and delegates events.
 */
public class InputManager {

    public void onKey(int key, boolean state) {
        // 1. Post to EventBus
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getEventBus() != null) {
            KeyEvent event = MLUltimate.getInstance().getEventBus().post(new KeyEvent(key, state));
            if (event != null && event.isCancelled()) {
                return;
            }
        }

        // 2. Dispatch to KeybindManager
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getKeybindManager() != null) {
            MLUltimate.getInstance().getKeybindManager().handleKeyInput(key, state);
        }

        // 3. Dispatch to all active modules
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getModuleManager() != null) {
            MLUltimate.getInstance().getModuleManager().onKeyInput();
        }
    }

    public void onMouse(int button, boolean state) {
        if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getEventBus() != null) {
            MLUltimate.getInstance().getEventBus().post(new MouseEvent(button, state));
        }
    }
}
