import AdmZip from "adm-zip";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { LauncherInstance, LoaderType } from "../../src/types/launcher";

type RepairInput = {
  instance: LauncherInstance;
  loaderVersion?: string;
};

type LockedModpackFile = {
  relativePath: string;
  fileName: string;
  required?: boolean;
};

type JarMetadata = {
  fileName: string;
  filePath: string;
  modIds: string[];
  displayName?: string;
  loader: "forge" | "fabric" | "quilt" | "unknown";
  loaderVersionRange?: string;
  dependencies: ModDependency[];
  reason?: string;
};

type ModDependency = {
  modId: string;
  mandatory: boolean;
  versionRange?: string;
};

type RepairAction = {
  fileName: string;
  reason: string;
};

const disabledSuffix = ".disabled-by-mlultimate";
const modpackLockFile = path.join("modpacks", "mlultimate-modpack-lock.json");

export const repairLaunchCompatibility = ({ instance, loaderVersion }: RepairInput) => {
  const modsDir = path.join(instance.gameDir, "mods");

  if (!existsSync(modsDir) || instance.loader === "vanilla") {
    return [];
  }

  migrateLegacyDisabledFiles(instance.gameDir, "mods");

  const report: {
    checkedAt: string;
    minecraftVersion: string;
    loader: LoaderType;
    loaderVersion?: string;
    disabled: RepairAction[];
    warnings: RepairAction[];
  } = {
    checkedAt: new Date().toISOString(),
    minecraftVersion: instance.minecraftVersion,
    loader: instance.loader,
    loaderVersion,
    disabled: [],
    warnings: [],
  };

  const jars = readdirSync(modsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => entry.name.toLowerCase().endsWith(".jar"))
    .map((entry) => path.join(modsDir, entry.name));
  const lockedFiles = readLockedModpackFiles(instance.gameDir);
  const requiredLockedPaths = new Set(
    lockedFiles
      .filter((file) => file.required !== false)
      .map((file) => normalizeRelativePath(file.relativePath)),
  );
  const metadata = jars.map((jar) => readJarMetadata(jar, instance.minecraftVersion));
  const modIds = new Set(metadata.flatMap((item) => item.modIds.map((modId) => modId.toLowerCase())));
  const duplicateGroups = groupDuplicateMods(metadata);
  const disableByPath = new Map<string, string>();
  const isRequiredLockedJar = (filePath: string) =>
    requiredLockedPaths.has(normalizeRelativePath(path.relative(instance.gameDir, filePath)));

  for (const item of metadata) {
    const reason = getIncompatibilityReason(item, instance, loaderVersion);

    if (reason) {
      if (isRequiredLockedJar(item.filePath)) {
        report.warnings.push({
          fileName: item.fileName,
          reason: `Preservado por estar no manifesto oficial do modpack. ${reason}`,
        });
        continue;
      }

      disableByPath.set(item.filePath, reason);
      continue;
    }

    const missing = item.dependencies.filter(
      (dependency) =>
        dependency.mandatory &&
        !isVirtualDependency(dependency.modId) &&
        !modIds.has(dependency.modId.toLowerCase()),
    );

    if (missing.length > 0) {
      report.warnings.push({
        fileName: item.fileName,
        reason: `Dependencia obrigatoria nao encontrada: ${missing
          .map((dependency) => dependency.modId)
          .join(", ")}.`,
      });
    }
  }

  for (const group of duplicateGroups) {
    const keep = group.find((item) => isRequiredLockedJar(item.filePath)) ?? group[0];

    for (const duplicate of group) {
      if (duplicate.filePath === keep?.filePath) {
        continue;
      }

      if (isRequiredLockedJar(duplicate.filePath)) {
        report.warnings.push({
          fileName: duplicate.fileName,
          reason: `Mod duplicado preservado por estar no manifesto oficial do modpack.`,
        });
        continue;
      }

      disableByPath.set(
        duplicate.filePath,
        `Mod duplicado (${duplicate.modIds.join(", ")}). Mantido: ${keep?.fileName ?? "outro jar"}.`,
      );
    }
  }

  for (const [filePath, reason] of disableByPath) {
    const fileName = path.basename(filePath);

    if (disableJar(filePath, instance.gameDir)) {
      report.disabled.push({ fileName, reason });
    }
  }

  writeCompatibilityReport(instance, report);

  return [
    ...report.disabled.map((action) => `Desativei ${action.fileName}: ${action.reason}`),
    ...report.warnings.map((action) => `Aviso em ${action.fileName}: ${action.reason}`),
  ];
};

export const repairSilentForgeBootstrapCrash = (instance: LauncherInstance) => {
  if (!["forge", "neoforge"].includes(instance.loader)) {
    return [];
  }

  const modsDir = path.join(instance.gameDir, "mods");

  if (!existsSync(modsDir)) {
    return [];
  }

  const optionalCrashSuspects = [
    {
      pattern: /^oculus-.*\.jar$/i,
      reason: "Modo seguro grafico: Oculus/shaders pode derrubar o Forge logo apos o OpenGL.",
    },
    {
      pattern: /^sodiumoptionsapi-.*\.jar$/i,
      reason: "Modo seguro grafico: Sodium Options API e opcional e depende da pilha grafica.",
    },
    {
      pattern: /^badoptimizations-.*\.jar$/i,
      reason: "Modo seguro grafico: otimizacao opcional removida apos queda silenciosa no bootstrap.",
    },
    {
      pattern: /^immediatelyfast-.*\.jar$/i,
      reason: "Modo seguro: otimizacao de renderizacao opcional removida apos queda silenciosa no bootstrap.",
    },
    {
      pattern: /^fast-ip-ping-.*\.jar$/i,
      reason: "Modo seguro: otimizacao de rede opcional removida apos queda silenciosa no bootstrap.",
    },
  ];
  const disabled: RepairAction[] = [];

  for (const entry of readdirSync(modsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".jar")) {
      continue;
    }

    const suspect = optionalCrashSuspects.find((item) => item.pattern.test(entry.name));

    if (!suspect) {
      continue;
    }

    const filePath = path.join(modsDir, entry.name);

    if (disableJar(filePath, instance.gameDir)) {
      disabled.push({ fileName: entry.name, reason: suspect.reason });
    }
  }

  if (disabled.length > 0) {
    appendCompatibilityReport(instance, disabled, []);
  }

  return disabled.map((action) => `Desativei ${action.fileName}: ${action.reason}`);
};

const appendCompatibilityReport = (
  instance: LauncherInstance,
  disabled: RepairAction[],
  warnings: RepairAction[],
) => {
  const reportPath = path.join(instance.gameDir, "mlultimate-compatibility-report.json");
  const existing = readCompatibilityReport(reportPath);
  const report = {
    checkedAt: new Date().toISOString(),
    minecraftVersion: instance.minecraftVersion,
    loader: instance.loader,
    loaderVersion: instance.loaderVersion,
    disabled: [...(existing?.disabled ?? []), ...disabled],
    warnings: [...(existing?.warnings ?? []), ...warnings],
  };

  writeCompatibilityReport(instance, report);
};

const writeCompatibilityReport = (
  instance: LauncherInstance,
  report: {
    checkedAt: string;
    minecraftVersion: string;
    loader: LoaderType;
    loaderVersion?: string;
    disabled: RepairAction[];
    warnings: RepairAction[];
  },
) => {
  const reportPath = path.join(instance.gameDir, "mlultimate-compatibility-report.json");

  if (report.disabled.length > 0 || report.warnings.length > 0) {
    writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  } else if (existsSync(reportPath)) {
    rmSync(reportPath, { force: true });
  }
};

const readCompatibilityReport = (reportPath: string) => {
  if (!existsSync(reportPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(reportPath, "utf8")) as {
      disabled?: RepairAction[];
      warnings?: RepairAction[];
    };
  } catch {
    return null;
  }
};

const readLockedModpackFiles = (gameDir: string) => {
  const lockPath = path.join(gameDir, modpackLockFile);

  if (!existsSync(lockPath)) {
    return [] as LockedModpackFile[];
  }

  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as { files?: LockedModpackFile[] };
    return Array.isArray(parsed.files) ? parsed.files : [];
  } catch {
    return [] as LockedModpackFile[];
  }
};

const normalizeRelativePath = (value: string) => value.replaceAll("\\", "/").toLowerCase();

const readJarMetadata = (filePath: string, minecraftVersion: string): JarMetadata => {
  const fileName = path.basename(filePath);

  try {
    const zip = new AdmZip(filePath);
    const modsToml = zip.getEntry("META-INF/mods.toml");
    const mcmodInfo = zip.getEntry("mcmod.info");
    const fabricJson = zip.getEntry("fabric.mod.json");
    const quiltJson = zip.getEntry("quilt.mod.json");
    const embeddedModIds = readEmbeddedModIds(zip);

    if (mcmodInfo && isLegacyForgeMinecraft(minecraftVersion)) {
      const metadata = parseMcmodInfo(fileName, filePath, mcmodInfo.getData().toString("utf8"));
      metadata.modIds = uniqueStrings([...metadata.modIds, ...embeddedModIds]);
      return metadata;
    }

    if (modsToml) {
      const metadata = parseForgeToml(fileName, filePath, modsToml.getData().toString("utf8"));
      metadata.modIds = uniqueStrings([...metadata.modIds, ...embeddedModIds]);
      return metadata;
    }

    if (fabricJson) {
      const metadata = parseFabricJson(fileName, filePath, fabricJson.getData().toString("utf8"), "fabric");
      metadata.modIds = uniqueStrings([...metadata.modIds, ...embeddedModIds]);
      return metadata;
    }

    if (quiltJson) {
      const metadata = parseFabricJson(fileName, filePath, quiltJson.getData().toString("utf8"), "quilt");
      metadata.modIds = uniqueStrings([...metadata.modIds, ...embeddedModIds]);
      return metadata;
    }

    if (mcmodInfo) {
      const metadata = parseMcmodInfo(fileName, filePath, mcmodInfo.getData().toString("utf8"));
      metadata.modIds = uniqueStrings([...metadata.modIds, ...embeddedModIds]);
      return metadata;
    }

    if (embeddedModIds.length > 0) {
      return {
        fileName,
        filePath,
        modIds: embeddedModIds,
        loader: "forge",
        dependencies: [],
      };
    }

    return {
      fileName,
      filePath,
      modIds: [],
      loader: "unknown",
      dependencies: [],
    };
  } catch {
    return {
      fileName,
      filePath,
      modIds: [],
      loader: "unknown",
      dependencies: [],
      reason: "Jar corrompido ou ilegivel.",
    };
  }
};

const readEmbeddedModIds = (zip: AdmZip) =>
  uniqueStrings(
    zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .filter((entry) => /^META-INF\/(?:jarjar|jars)\/.+\.jar$/i.test(entry.entryName))
      .flatMap((entry) => readNestedJarModIds(entry.getData())),
  );

const readNestedJarModIds = (buffer: Buffer) => {
  try {
    const zip = new AdmZip(buffer);
    const modsToml = zip.getEntry("META-INF/mods.toml");
    const fabricJson = zip.getEntry("fabric.mod.json");
    const quiltJson = zip.getEntry("quilt.mod.json");

    if (modsToml) {
      return parseForgeToml("embedded.jar", "embedded.jar", modsToml.getData().toString("utf8")).modIds;
    }

    if (fabricJson) {
      return parseFabricJson("embedded.jar", "embedded.jar", fabricJson.getData().toString("utf8"), "fabric").modIds;
    }

    if (quiltJson) {
      return parseFabricJson("embedded.jar", "embedded.jar", quiltJson.getData().toString("utf8"), "quilt").modIds;
    }
  } catch {
    return [];
  }

  return [];
};

const parseForgeToml = (fileName: string, filePath: string, text: string): JarMetadata => {
  const modIds: string[] = [];
  const dependencies: ModDependency[] = [];
  let current: Record<string, string | boolean> | null = null;
  let currentType: "mod" | "dependency" | null = null;
  let loaderVersionRange: string | undefined;
  let displayName: string | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "").trim();

    if (!line) {
      continue;
    }

    if (/^\[\[mods\]\]/.test(line)) {
      current = {};
      currentType = "mod";
      continue;
    }

    if (/^\[\[dependencies[.\]"'\w-]*\]\]/.test(line)) {
      current = {};
      currentType = "dependency";
      dependencies.push(current as ModDependency);
      continue;
    }

    const pair = line.match(/^([\w.-]+)\s*=\s*(.+)$/);

    if (!pair) {
      continue;
    }

    const key = pair[1]!;
    const value = parseTomlValue(pair[2]!);

    if (key === "loaderVersion" && typeof value === "string") {
      loaderVersionRange = value;
    }

    if (!current) {
      continue;
    }

    current[key] = value;

    if (currentType === "mod" && key === "modId" && typeof value === "string") {
      modIds.push(value);
    }

    if (currentType === "mod" && key === "displayName" && typeof value === "string") {
      displayName = value;
    }
  }

  return {
    fileName,
    filePath,
    modIds,
    displayName,
    loader: "forge",
    loaderVersionRange,
    dependencies,
  };
};

const parseFabricJson = (
  fileName: string,
  filePath: string,
  text: string,
  loader: "fabric" | "quilt",
): JarMetadata => {
  const parsed = JSON.parse(text) as {
    id?: string;
    name?: string;
    depends?: Record<string, string | string[]>;
  };

  return {
    fileName,
    filePath,
    modIds: parsed.id ? [parsed.id] : [],
    displayName: parsed.name,
    loader,
    dependencies: Object.entries(parsed.depends ?? {}).map(([modId, range]) => ({
      modId,
      mandatory: true,
      versionRange: Array.isArray(range) ? range.join(" || ") : range,
    })),
  };
};

const parseMcmodInfo = (fileName: string, filePath: string, text: string): JarMetadata => {
  const parsed = JSON.parse(text) as
    | Array<{
        modid?: string;
        name?: string;
        requiredMods?: string[] | string;
        dependencies?: string[] | string;
      }>
    | {
        modid?: string;
        name?: string;
        requiredMods?: string[] | string;
        dependencies?: string[] | string;
      };
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  const modIds = entries.flatMap((entry) => (entry.modid ? [entry.modid] : []));
  const dependencies = entries.flatMap((entry) => [
    ...parseLegacyDependencyList(entry.requiredMods, true),
    ...parseLegacyDependencyList(entry.dependencies, false),
  ]);

  return {
    fileName,
    filePath,
    modIds,
    displayName: entries.find((entry) => entry.name)?.name,
    loader: "forge",
    dependencies,
  };
};

const parseLegacyDependencyList = (
  value: string[] | string | undefined,
  mandatory: boolean,
): ModDependency[] => {
  const rawItems = Array.isArray(value) ? value : value ? value.split(/[;,]/) : [];
  const dependencies: ModDependency[] = [];

  for (const rawItem of rawItems) {
    const raw = rawItem.trim();
    const match = raw.match(/^([a-z0-9_.-]+)/i);

    if (!match) {
      continue;
    }

    dependencies.push({
      modId: match[1]!,
      mandatory,
      versionRange: raw.slice(match[1]!.length).trim() || undefined,
    });
  }

  return dependencies;
};

const parseTomlValue = (rawValue: string) => {
  const value = rawValue.trim().replace(/,$/, "");

  if (/^true$/i.test(value)) {
    return true;
  }

  if (/^false$/i.test(value)) {
    return false;
  }

  return value.replace(/^'''|'''$/g, "").replace(/^["']|["']$/g, "");
};

const getIncompatibilityReason = (
  item: JarMetadata,
  instance: LauncherInstance,
  loaderVersion?: string,
) => {
  if (item.reason) {
    return item.reason;
  }

  if (item.loader === "fabric" && !["fabric", "iris", "iris-sodium"].includes(instance.loader)) {
    return "Mod Fabric em instancia que nao usa Fabric.";
  }

  if (item.loader === "quilt" && instance.loader !== "quilt") {
    return "Mod Quilt em instancia que nao usa Quilt.";
  }

  if (item.loader === "forge" && !["forge", "neoforge"].includes(instance.loader)) {
    return "Mod Forge em instancia que nao usa Forge/NeoForge.";
  }

  const minecraftDependency = item.dependencies.find(
    (dependency) => dependency.modId.toLowerCase() === "minecraft" && dependency.mandatory,
  );

  if (
    minecraftDependency?.versionRange &&
    !versionRangeAllows(minecraftDependency.versionRange, instance.minecraftVersion)
  ) {
    return `Exige Minecraft ${minecraftDependency.versionRange}, mas a instancia usa ${instance.minecraftVersion}.`;
  }

  const fileMinecraftVersion = extractMinecraftVersionFromFileName(item.fileName);

  if (
    !minecraftDependency?.versionRange &&
    fileMinecraftVersion &&
    !sameMinecraftFamily(fileMinecraftVersion, instance.minecraftVersion)
  ) {
    return `Arquivo parece ser para Minecraft ${fileMinecraftVersion}, mas a instancia usa ${instance.minecraftVersion}.`;
  }

  const loaderDependency = item.dependencies.find(
    (dependency) =>
      dependency.mandatory &&
      ["forge", "neoforge"].includes(dependency.modId.toLowerCase()) &&
      ["forge", "neoforge"].includes(instance.loader),
  );
  const expectedLoaderVersion = loaderVersion ?? instance.loaderVersion;
  const loaderRange = loaderDependency?.versionRange ?? item.loaderVersionRange;

  if (
    expectedLoaderVersion &&
    loaderRange &&
    isVersionRangeExpression(loaderRange) &&
    !versionRangeAllows(loaderRange, expectedLoaderVersion)
  ) {
    return `Exige ${loaderDependency?.modId ?? instance.loader} ${loaderRange}, mas a instancia usa ${expectedLoaderVersion}.`;
  }

  return null;
};

const groupDuplicateMods = (metadata: JarMetadata[]) => {
  const groups = new Map<string, JarMetadata[]>();

  for (const item of metadata) {
    const key = item.modIds[0]?.toLowerCase();

    if (!key) {
      continue;
    }

    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => [...group].sort((left, right) => right.fileName.localeCompare(left.fileName)));
};

const disableJar = (filePath: string, gameDir: string) => {
  if (!existsSync(filePath)) {
    return false;
  }

  const disabledDir = disabledDirectoryForFile(gameDir, filePath);
  mkdirSync(disabledDir, { recursive: true });
  const target = uniqueDisabledPath(path.join(disabledDir, `${path.basename(filePath)}${disabledSuffix}`));
  renameSync(filePath, target);
  return true;
};

const migrateLegacyDisabledFiles = (gameDir: string, folderName: string) => {
  const legacyDir = path.join(gameDir, folderName, ".mlultimate-disabled");

  if (!existsSync(legacyDir)) {
    return;
  }

  const targetDir = path.join(gameDir, "modpacks", ".mlultimate-disabled", folderName);
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(legacyDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    renameSync(
      path.join(legacyDir, entry.name),
      uniqueDisabledPath(path.join(targetDir, entry.name)),
    );
  }

  try {
    rmSync(legacyDir, { force: true, recursive: true });
  } catch {
    // Old quarantine cleanup is best effort.
  }
};

const disabledDirectoryForFile = (gameDir: string, filePath: string) => {
  const root = path.resolve(gameDir);
  const relativeDirectory = path.relative(root, path.dirname(filePath));

  if (!relativeDirectory || relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)) {
    return path.join(gameDir, "modpacks", ".mlultimate-disabled", "root");
  }

  return path.join(gameDir, "modpacks", ".mlultimate-disabled", relativeDirectory);
};

const uniqueDisabledPath = (target: string) => {
  if (!existsSync(target)) {
    return target;
  }

  const parsed = path.parse(target);

  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);

    if (!existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(parsed.dir, `${parsed.name}-${Date.now()}${parsed.ext}`);
};

const isVirtualDependency = (modId: string) =>
  [
    "minecraft",
    "forge",
    "neoforge",
    "javafml",
    "fabricloader",
    "fabric",
    "quilt_loader",
  ].includes(modId.toLowerCase());

const isVersionRangeExpression = (range: string) => /[()[\],]/.test(range);

const extractMinecraftVersionFromFileName = (fileName: string) => {
  const normalized = fileName.replace(/\.jar$/i, "");
  const match =
    normalized.match(/(?:^|[-_+ ])(?:mc|minecraft)[-_]?v?_?(\d+\.\d+(?:\.\d+)?)(?:[-_+ ]|$)/i) ??
    normalized.match(/(?:^|[-_ ])MC[_-]?(\d+\.\d+(?:\.\d+)?)(?:[-_ ]|$)/) ??
    normalized.match(/\+(\d+\.\d+(?:\.\d+)?)(?:[-_+ ]|$)/);

  return match?.[1];
};

const sameMinecraftFamily = (left: string, right: string) => {
  const leftParts = left.split(".");
  const precision = leftParts.length >= 3 ? 3 : 2;
  const normalize = (version: string) => version.split(".").slice(0, precision).join(".");

  return normalize(left) === normalize(right);
};

const isLegacyForgeMinecraft = (version: string) => {
  const [major = 0, minor = 0] = numericParts(version);

  return major === 1 && minor <= 12;
};

const versionRangeAllows = (range: string, version: string): boolean => {
  const normalizedRange = range.trim();

  if (!normalizedRange || normalizedRange === "*" || normalizedRange === "${file.jarVersion}") {
    return true;
  }

  if (normalizedRange.includes("||")) {
    return normalizedRange.split("||").some((part) => versionRangeAllows(part, version));
  }

  const exact = normalizedRange.match(/^\[?([0-9][^,\])]*)]?$/);

  if (exact && !normalizedRange.includes(",")) {
    return compareVersions(version, exact[1]!) === 0;
  }

  const first = normalizedRange.at(0);
  const last = normalizedRange.at(-1);

  if ((first !== "[" && first !== "(") || (last !== "]" && last !== ")")) {
    return true;
  }

  const [lowerText, upperText] = normalizedRange.slice(1, -1).split(",", 2);
  const lowerInclusive = first === "[";
  const lower = lowerText?.trim();
  const upper = upperText?.trim();
  const upperInclusive = last === "]";

  if (lower) {
    const comparison = compareVersions(version, lower);

    if (comparison < 0 || (comparison === 0 && !lowerInclusive)) {
      return false;
    }
  }

  if (upper) {
    const comparison = compareVersions(version, upper);

    if (comparison > 0 || (comparison === 0 && !upperInclusive)) {
      return false;
    }
  }

  return true;
};

const compareVersions = (left: string, right: string) => {
  const leftParts = numericParts(left);
  const rightParts = numericParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }

  return 0;
};

const numericParts = (version: string) =>
  version
    .split(/[.+\-_\s]/)
    .map((part) => Number(part.match(/^\d+/)?.[0] ?? "0"));

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
