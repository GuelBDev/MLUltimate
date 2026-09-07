package net.mlultimate.client.util;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.regex.Pattern;

/**
 * Thread-safe logging engine for MLUltimate Client.
 * Writes formatted log entries to logs/mlultimate.log and console.
 * Strictly sanitizes sensitive information (tokens, passwords, session credentials).
 */
public class Logger {

    public enum Level {
        DEBUG,
        INFO,
        WARN,
        ERROR
    }

    public enum Category {
        CORE,
        CONFIG,
        MODULE,
        HUD,
        RENDER,
        NETWORK,
        FORGE,
        PERFORMANCE
    }

    private static File logFile;
    private static PrintWriter writer;
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");
    private static boolean debugEnabled = false;

    // Sanitization patterns for sensitive credentials
    private static final Pattern TOKEN_PATTERN = Pattern.compile("(?i)(token|password|session|secret|credential|cookie|auth)\\s*[:=]\\s*([^\\s,;]+)");

    public static synchronized void init(File gameDir) {
        try {
            File logsDir = new File(gameDir, "logs");
            if (!logsDir.exists()) {
                logsDir.mkdirs();
            }
            logFile = new File(logsDir, "mlultimate.log");
            writer = new PrintWriter(new FileWriter(logFile, true), true);

            logRaw("================================================================================");
            logRaw(" MLUltimate Client 1.8.9 Session Started at " + DATE_FORMAT.format(new Date()));
            logRaw("================================================================================");
        } catch (Throwable t) {
            System.err.println("[MLUltimate Logger] Failed to initialize log file: " + t.getMessage());
        }
    }

    public static void setDebugEnabled(boolean enabled) {
        debugEnabled = enabled;
    }

    public static boolean isDebugEnabled() {
        return debugEnabled;
    }

    public static void debug(Category cat, String message) {
        if (debugEnabled) {
            log(Level.DEBUG, cat, message, null);
        }
    }

    public static void info(Category cat, String message) {
        log(Level.INFO, cat, message, null);
    }

    public static void warn(Category cat, String message) {
        log(Level.WARN, cat, message, null);
    }

    public static void warn(Category cat, String message, Throwable throwable) {
        log(Level.WARN, cat, message, throwable);
    }

    public static void error(Category cat, String message) {
        log(Level.ERROR, cat, message, null);
    }

    public static void error(Category cat, String message, Throwable throwable) {
        log(Level.ERROR, cat, message, throwable);
    }

    private static synchronized void log(Level level, Category cat, String message, Throwable throwable) {
        String sanitized = sanitize(message);
        String timestamp = DATE_FORMAT.format(new Date());
        String formatted = String.format("[%s] [%s/%s] [MLUltimate]: %s",
                timestamp, level.name(), cat.name(), sanitized);

        if (level == Level.ERROR || level == Level.WARN) {
            System.err.println(formatted);
            if (throwable != null) {
                throwable.printStackTrace(System.err);
            }
        } else {
            System.out.println(formatted);
        }

        if (writer != null) {
            try {
                writer.println(formatted);
                if (throwable != null) {
                    throwable.printStackTrace(writer);
                }
                writer.flush();
            } catch (Throwable ignored) {
            }
        }
    }

    private static synchronized void logRaw(String line) {
        System.out.println(line);
        if (writer != null) {
            try {
                writer.println(line);
                writer.flush();
            } catch (Throwable ignored) {
            }
        }
    }

    /**
     * Masks any sensitive tokens, passwords or secrets before logging.
     */
    public static String sanitize(String input) {
        if (input == null) return "null";
        return TOKEN_PATTERN.matcher(input).replaceAll("$1=********");
    }

    public static synchronized void close() {
        if (writer != null) {
            try {
                logRaw("MLUltimate Client Session Closed at " + DATE_FORMAT.format(new Date()));
                writer.close();
            } catch (Throwable ignored) {
            }
            writer = null;
        }
    }
}
