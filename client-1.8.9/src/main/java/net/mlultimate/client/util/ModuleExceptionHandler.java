package net.mlultimate.client.util;

import net.mlultimate.client.MLUltimate;
import net.mlultimate.client.module.Module;

/**
 * Robust exception handler for MLUltimate Client modules.
 * Prevents game crashes when a module throws an unhandled runtime error.
 * Automatically disables the faulty module, logs the root cause to logs/mlultimate.log
 * and alerts the user with an in-game notification.
 */
public class ModuleExceptionHandler {

    public interface ModuleAction {
        void execute() throws Throwable;
    }

    public static boolean executeSafe(Module module, String actionName, ModuleAction action) {
        if (module == null) return false;
        try {
            action.execute();
            return true;
        } catch (Throwable t) {
            handleException(module, actionName, t);
            return false;
        }
    }

    public static void handleException(Module module, String actionName, Throwable t) {
        String moduleName = module != null ? module.getName() : "Unknown Module";
        String msg = "Erro no módulo '" + moduleName + "' durante '" + actionName + "': " + t.getMessage();

        // 1. Log detailed stacktrace
        Logger.error(Logger.Category.MODULE, msg, t);

        // 2. Safely disable the offending module to protect game loop
        if (module != null && module.isEnabled()) {
            try {
                module.setEnabled(false);
            } catch (Throwable disableError) {
                Logger.error(Logger.Category.MODULE, "Falha ao desabilitar módulo com erro: " + moduleName, disableError);
            }
        }

        // 3. Show in-game notification to user
        try {
            if (MLUltimate.getInstance() != null && MLUltimate.getInstance().getNotificationManager() != null) {
                MLUltimate.getInstance().getNotificationManager().showError("Módulo desabilitado por erro: " + moduleName);
            }
        } catch (Throwable ignored) {
        }
    }
}
