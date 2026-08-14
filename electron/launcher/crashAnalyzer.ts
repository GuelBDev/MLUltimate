import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { CrashReportDetails } from "../../src/types/launcher";

export type CrashAnalysisResult = {
  hasCrash: boolean;
  crashReport?: CrashReportDetails;
};

type ModFingerprint = {
  packageName: string;
  modName: string;
  modId?: string;
  friendlyAdvice?: string;
};

const knownModFingerprints: ModFingerprint[] = [
  {
    packageName: "net.xolt.xcam",
    modName: "FreeCam",
    modId: "freecam",
    friendlyAdvice:
      "O mod FreeCam causou uma falha. Se o erro ocorreu ao usar follow player ou com Sodium/Iris ativo, há uma incompatibilidade de renderização de câmera. Se ocorreu ao abrir opções/keybind, o Cloth Config interno do mod precisa ser atualizado.",
  },
  {
    packageName: "me.shedaniel.clothconfig",
    modName: "Cloth Config",
    modId: "cloth-config",
    friendlyAdvice:
      "A biblioteca de configurações Cloth Config falhou ao acessar classes do Minecraft. Isso geralmente ocorre em versões recentes do jogo (1.21.4+) onde classes antigas como 'Tuple' foram descontinuadas pela Mojang.",
  },
  {
    packageName: "net.irisshaders.iris",
    modName: "Iris Shaders",
    modId: "iris",
    friendlyAdvice:
      "O shader engine Iris encontrou um erro na pipeline gráfica. Verifique se o shaderpack em uso é compatível com a sua placa de vídeo ou desative shaders temporariamente.",
  },
  {
    packageName: "me.jellysquid.mods.sodium",
    modName: "Sodium",
    modId: "sodium",
    friendlyAdvice:
      "O mod de renderização Sodium encontrou um conflito gráfico com outros mods ou com o driver de vídeo.",
  },
  {
    packageName: "net.optifine",
    modName: "OptiFine",
    modId: "optifine",
    friendlyAdvice:
      "O OptiFine causou incompatibilidade com o loader ou outros mods instalados.",
  },
  {
    packageName: "org.embeddedt.embeddium",
    modName: "Embeddium",
    modId: "embeddium",
    friendlyAdvice:
      "O renderizador Embeddium encontrou um conflito gráfico no Forge/NeoForge.",
  },
  {
    packageName: "com.replaymod",
    modName: "Replay Mod",
    modId: "replaymod",
    friendlyAdvice:
      "O Replay Mod encontrou um erro ao tentar gravar ou renderizar a câmera do mundo.",
  },
  {
    packageName: "com.github.vini2003.barium",
    modName: "Barium",
    modId: "barium",
  },
  {
    packageName: "xaero.common",
    modName: "Xaero's Minimap / WorldMap",
    modId: "xaeros-minimap",
  },
  {
    packageName: "journeymap",
    modName: "JourneyMap",
    modId: "journeymap",
  },
];

/**
 * Analisa os arquivos da instância após o fechamento do processo para determinar
 * se houve um crash e identificar a causa raiz, mod culpado e recomendação.
 */
export const analyzeInstanceCrash = (
  gameDir: string,
  sessionStartedAt?: number,
  outputTail: string[] = [],
): CrashAnalysisResult => {
  const minMtime = sessionStartedAt ? sessionStartedAt - 5_000 : Date.now() - 30_000;

  // 1. Procurar crash reports recentes em crash-reports/
  const crashReportsDir = path.join(gameDir, "crash-reports");
  let newestCrashFile: { filePath: string; fileName: string; mtime: number } | null = null;

  if (existsSync(crashReportsDir)) {
    try {
      const files = readdirSync(crashReportsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
        .map((entry) => {
          const filePath = path.join(crashReportsDir, entry.name);
          try {
            const stat = statSync(filePath);
            return { filePath, fileName: entry.name, mtime: stat.mtimeMs };
          } catch {
            return null;
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => item.mtime >= minMtime)
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0 && files[0]) {
        newestCrashFile = files[0];
      }
    } catch {
      // Ignora falha de listagem
    }
  }

  // 2. Procurar arquivos de erro fatal do Java (hs_err_pid*.log)
  let newestHsErrFile: { filePath: string; fileName: string; mtime: number } | null = null;
  if (!newestCrashFile) {
    try {
      const hsFiles = readdirSync(gameDir, { withFileTypes: true })
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.toLowerCase().startsWith("hs_err_pid") &&
            entry.name.toLowerCase().endsWith(".log"),
        )
        .map((entry) => {
          const filePath = path.join(gameDir, entry.name);
          try {
            const stat = statSync(filePath);
            return { filePath, fileName: entry.name, mtime: stat.mtimeMs };
          } catch {
            return null;
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => item.mtime >= minMtime)
        .sort((a, b) => b.mtime - a.mtime);

      if (hsFiles.length > 0 && hsFiles[0]) {
        newestHsErrFile = hsFiles[0];
      }
    } catch {
      // Ignora falha de listagem
    }
  }

  // Se encontrou um crash report oficial do Minecraft
  if (newestCrashFile) {
    try {
      const content = readFileSync(newestCrashFile.filePath, "utf8");
      const parsed = parseMinecraftCrashReport(content, newestCrashFile.filePath, newestCrashFile.fileName, gameDir);
      return {
        hasCrash: true,
        crashReport: parsed,
      };
    } catch (e) {
      console.warn("Falha ao ler crash report:", e);
    }
  }

  // Se encontrou um log de erro fatal da JVM
  if (newestHsErrFile) {
    try {
      const content = readFileSync(newestHsErrFile.filePath, "utf8");
      const parsed = parseJavaFatalError(content, newestHsErrFile.filePath, newestHsErrFile.fileName);
      return {
        hasCrash: true,
        crashReport: parsed,
      };
    } catch (e) {
      console.warn("Falha ao ler hs_err log:", e);
    }
  }

  // 3. Verificar se as últimas linhas de console ou latest.log indicam um crash não capturado
  const outputText = outputTail.join("\n");
  const unhandledException = extractExceptionFromLogText(outputText);
  if (unhandledException) {
    return {
      hasCrash: true,
      crashReport: {
        description: "Falha de execução durante a sessão do Minecraft",
        exceptionType: unhandledException.type,
        exceptionMessage: unhandledException.message,
        culpritModName: unhandledException.culpritModName,
        culpritModId: unhandledException.culpritModId,
        recommendation: unhandledException.recommendation,
        fullContent: outputTail.slice(-40).join("\n"),
      },
    };
  }

  return { hasCrash: false };
};

/**
 * Extrai detalhes estruturados de um arquivo de crash report padrão do Minecraft.
 */
const parseMinecraftCrashReport = (
  content: string,
  filePath: string,
  fileName: string,
  gameDir: string,
): CrashReportDetails => {
  const lines = content.split(/\r?\n/);
  
  // Extrair Descrição
  let description = "Erro inesperado durante a execução do jogo";
  const descLine = lines.find((line) => line.startsWith("Description:"));
  if (descLine) {
    description = descLine.replace("Description:", "").trim();
  }

  // Extrair Exceção e Mensagem
  let exceptionType = "Exception";
  let exceptionMessage = "";
  
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i]?.trim() || "";
    if (
      line.includes("Exception") ||
      line.includes("Error") ||
      line.startsWith("java.lang.") ||
      line.startsWith("java.io.")
    ) {
      if (!line.startsWith("//") && !line.startsWith("----") && !line.startsWith("Time:")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx !== -1) {
          exceptionType = line.slice(0, colonIdx).trim();
          exceptionMessage = line.slice(colonIdx + 1).trim();
        } else {
          exceptionType = line.trim();
        }
        break;
      }
    }
  }

  // Identificar mod culpado pelo stack trace e pacotes
  let culpritModName: string | undefined;
  let culpritModId: string | undefined;
  let recommendation: string | undefined;

  // Análise específica de casos conhecidos
  if (content.includes("net/minecraft/util/Tuple") && (content.includes("me.shedaniel.clothconfig") || content.includes("net.xolt.xcam"))) {
    culpritModName = "FreeCam / Cloth Config";
    culpritModId = "freecam";
    recommendation =
      "O mod FreeCam possui uma versão interna do Cloth Config que depende da classe 'Tuple' (removida pela Mojang no Minecraft moderno). Ao acionar keybinds ou configurações, o jogo fecha. Atualize o mod ou remova-o.";
  } else if (
    content.includes("repositionCamera") &&
    (content.includes("this.viewArea") || content.includes("ViewArea"))
  ) {
    culpritModName = "FreeCam";
    culpritModId = "freecam";
    recommendation =
      "O mod FreeCam tentou usar 'follow player' ou reposicionar a câmera invocando a pipeline padrão do Minecraft, que entra em conflito com o motor gráfico do Sodium/Iris. Para usar follow player, desative o Sodium/Iris ou use uma versão do mod compatível.";
  } else if (content.includes("OutOfMemoryError") || content.includes("Java heap space")) {
    culpritModName = "Memória Insuficiente (RAM)";
    recommendation =
      "O Minecraft atingiu o limite de memória RAM alocada. Aumente a quantidade de RAM nas configurações da instância no launcher.";
  } else {
    // Procura por fingerprints de mods conhecidos no stacktrace
    for (const fp of knownModFingerprints) {
      if (content.includes(fp.packageName)) {
        culpritModName = fp.modName;
        culpritModId = fp.modId;
        recommendation = fp.friendlyAdvice;
        break;
      }
    }
  }

  // Se ainda não identificou mod específico, tenta localizar arquivos de mod correspondentes
  let culpritFilePath: string | undefined;
  if (culpritModId) {
    const modsDir = path.join(gameDir, "mods");
    if (existsSync(modsDir)) {
      try {
        const found = readdirSync(modsDir).find((file) => {
          const lower = file.toLowerCase();
          return lower.includes(culpritModId!.toLowerCase()) && lower.endsWith(".jar");
        });
        if (found) {
          culpritFilePath = path.join("mods", found);
        }
      } catch {}
    }
  }

  // Gera recomendação padrão se nenhuma foi definida
  if (!recommendation) {
    if (culpritModName) {
      recommendation = `O crash foi disparado pelo mod ${culpritModName}. Desative este mod temporariamente ou procure uma atualização compatível.`;
    } else {
      recommendation =
        "Ocorreu um erro no Minecraft. Verifique se todos os mods instalados são compatíveis com a versão exata do jogo e loader.";
    }
  }

  return {
    crashFilePath: filePath,
    crashFileName: fileName,
    description,
    exceptionType,
    exceptionMessage,
    culpritModName,
    culpritModId,
    culpritFilePath,
    recommendation,
    fullContent: content,
  };
};

/**
 * Extrai detalhes de um erro fatal do Java (hs_err_pid*.log).
 */
const parseJavaFatalError = (
  content: string,
  filePath: string,
  fileName: string,
): CrashReportDetails => {
  const firstLines = content.split(/\r?\n/).slice(0, 30).join("\n");
  const isAccessViolation = content.includes("EXCEPTION_ACCESS_VIOLATION");
  const isGpuCrash = /nvoglv64|ig9icd64|atig6pxx|amdope64/i.test(firstLines);

  let recommendation = "Ocorreu uma falha crítica no processo Java do Minecraft.";
  if (isGpuCrash) {
    recommendation =
      "O driver da sua placa de vídeo encontrou um erro crítico ao renderizar o jogo. Atualize o driver da GPU ou desative shaders/otimizações agressivas.";
  } else if (isAccessViolation) {
    recommendation =
      "Houve uma violação de acesso na memória nativa do Java/OpenGL. Verifique mods que injetam código nativo ou shaders.";
  }

  return {
    crashFilePath: filePath,
    crashFileName: fileName,
    description: "Falha crítica na Máquina Virtual Java (JVM)",
    exceptionType: isAccessViolation ? "EXCEPTION_ACCESS_VIOLATION" : "JVM Fatal Error",
    exceptionMessage: isGpuCrash ? "Falha no driver gráfico / OpenGL nativo" : "Crash nativo na JVM",
    recommendation,
    fullContent: content,
  };
};

/**
 * Tenta identificar uma exceção grave no texto do console.
 */
const extractExceptionFromLogText = (
  text: string,
): {
  type: string;
  message: string;
  culpritModName?: string;
  culpritModId?: string;
  recommendation?: string;
} | null => {
  if (!text) return null;

  const match = text.match(
    /(?:Exception in thread "[^"]*"\s+)?(java\.[\w.]+(?:Exception|Error))(?::\s*(.*))?/i,
  );

  if (!match) return null;

  const type = match[1] ?? "Exception";
  const message = match[2]?.split(/\r?\n/)[0]?.trim() ?? "";

  for (const fp of knownModFingerprints) {
    if (text.includes(fp.packageName)) {
      return {
        type,
        message,
        culpritModName: fp.modName,
        culpritModId: fp.modId,
        recommendation: fp.friendlyAdvice,
      };
    }
  }

  return {
    type,
    message,
    recommendation: "O Minecraft encerrou com uma exceção não tratada.",
  };
};
