package net.mlultimate.client.util;

import net.mlultimate.client.MLUltimate;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * Diagnostic crash reporting utility for MLUltimate Client.
 */
public class CrashReporter {

    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss");

    public static void createCrashReport(Throwable t, String context) {
        try {
            File gameDir = MLUltimate.getInstance() != null ? MLUltimate.getInstance().getGameDir() : new File(".");
            File crashReportsDir = new File(gameDir, "crash-reports");
            if (!crashReportsDir.exists()) {
                crashReportsDir.mkdirs();
            }

            File reportFile = new File(crashReportsDir, "crash-mlultimate-" + DATE_FORMAT.format(new Date()) + ".txt");
            try (PrintWriter writer = new PrintWriter(new FileWriter(reportFile))) {
                writer.println("// MLUltimate Client Diagnostic Crash Report");
                writer.println("// Context: " + context);
                writer.println("// Time: " + new Date());
                writer.println("// Client Version: " + MLUltimate.VERSION);
                writer.println("// Minecraft: " + MLUltimate.MINECRAFT_VERSION);
                writer.println("// Java Version: " + System.getProperty("java.version"));
                writer.println("// OS: " + System.getProperty("os.name") + " (" + System.getProperty("os.arch") + ")");
                writer.println();
                writer.println("Stack Trace:");
                t.printStackTrace(writer);
            }
            Logger.error(Logger.Category.CORE, "Crash report salvo em: " + reportFile.getAbsolutePath());
        } catch (Throwable reportError) {
            Logger.error(Logger.Category.CORE, "Falha ao gerar crash report: " + reportError.getMessage());
        }
    }
}
