import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const legacyPath = path.join(root, "src", "i18n", "legacyTranslations.ts");
const outputPath = path.join(root, "src", "i18n", "generatedTranslations.ts");
const sourceRoots = [
  path.join(root, "src", "App.tsx"),
  path.join(root, "src", "pages"),
  path.join(root, "src", "components"),
];

const locales = [
  { id: "pt-BR", target: null, source: "pt" },
  { id: "pt-PT", target: "pt-PT", source: "pt" },
  { id: "en", target: "en", source: "pt" },
  { id: "es", target: "es", source: "pt" },
  { id: "fr", target: "fr", source: "pt" },
  { id: "de", target: "de", source: "en" },
  { id: "it", target: "it", source: "pt" },
  { id: "ru", target: "ru", source: "en" },
  { id: "zh-CN", target: "zh-CN", source: "en" },
  { id: "ja", target: "ja", source: "en" },
  { id: "ko", target: "ko", source: "en" },
  { id: "ar", target: "ar", source: "en" },
  { id: "hi", target: "hi", source: "en" },
  { id: "tr", target: "tr", source: "en" },
];

const translatedAttributes = new Set(["placeholder", "title", "aria-label"]);
const visiblePropertyNames = new Set([
  "badge",
  "cancelLabel",
  "changes",
  "confirmLabel",
  "date",
  "description",
  "detail",
  "eyebrow",
  "label",
  "message",
  "items",
  "placeholder",
  "subtitle",
  "text",
  "title",
]);
const visibleCalls = new Set([
  "Error",
  "setDone",
  "setError",
  "setRunning",
  "setStatusText",
]);
const separator = "[[[MLU_SPLIT]]]";

const normalizeText = (value) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

const isHumanText = (value) => {
  const text = normalizeText(value);

  if (text.length < 2 || text.length > 420 || !/\p{L}/u.test(text)) return false;
  if (/^(?:https?:|data:|file:|[.#/]|--)/i.test(text)) return false;
  if (/^[a-z0-9:_./-]+$/i.test(text) && !/[A-Z]/.test(text)) return false;
  if (/^(?:flex|grid|block|hidden|relative|absolute|fixed|sticky|rounded|border|bg-|text-|p-|m-|w-|h-|min-|max-|gap-|items-|justify-|overflow-|shadow|transition)/.test(text)) {
    return false;
  }
  if (/[{}[\]]/.test(text) && !/\{\{\d+\}\}/.test(text)) return false;

  return true;
};

const needsPortugueseNormalization = (text) =>
  /\b(?:acao|acoes|anuncio|anuncios|ate|atualizacao|atualizacoes|codigo|compativel|compativeis|configuracao|configuracoes|conexao|conexoes|conteudo|conteudos|disponivel|disponiveis|exibicao|experiencia|funcao|funcoes|grafico|indisponivel|instancia|instancias|ja|licenca|midia|nao|numero|obrigatorio|obrigatorios|opcao|opcoes|otimizacao|padrao|possivel|preferencia|preferencias|propria|proprio|sessao|so|ultima|ultimo|usuario|usuarios|versao|versoes|voce)\b/i.test(
    text,
  );

const stringValue = (node) => {
  if (ts.isStringLiteralLike(node)) return normalizeText(node.text);

  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return normalizeText(node.text);
  }

  return null;
};

const templateValue = (node) => {
  if (!ts.isTemplateExpression(node)) return null;

  let result = node.head.text;
  node.templateSpans.forEach((span, index) => {
    result += `{{${index}}}${span.literal.text}`;
  });
  return normalizeText(result);
};

const propertyName = (node) => {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return null;
};

const renderedExpression = (node) => {
  let current = node.parent;

  while (current) {
    if (ts.isJsxExpression(current)) {
      if (ts.isJsxAttribute(current.parent)) {
        return translatedAttributes.has(current.parent.name.getText());
      }
      return true;
    }
    if (ts.isStatement(current) || ts.isSourceFile(current)) return false;
    current = current.parent;
  }

  return false;
};

const collectSourceFile = (filePath, sourcePairs, templates) => {
  const sourceText = ts.sys.readFile(filePath);
  if (!sourceText) return;

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const addStatic = (text) => {
    const normalized = normalizeText(text);
    if (isHumanText(normalized)) sourcePairs.set(normalized, normalized);
  };
  const addTemplate = (text) => {
    const normalized = normalizeText(text);
    if (isHumanText(normalized) && /\{\{\d+\}\}/.test(normalized)) {
      templates.add(normalized);
    }
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      addStatic(node.text);
    }

    if (ts.isJsxAttribute(node) && translatedAttributes.has(node.name.getText())) {
      const value = node.initializer && stringValue(node.initializer);
      if (value) addStatic(value);
    }

    if (ts.isPropertyAssignment(node) && visiblePropertyNames.has(propertyName(node.name))) {
      const value = stringValue(node.initializer);
      const template = templateValue(node.initializer);
      if (value) addStatic(value);
      if (template) addTemplate(template);
      if (ts.isArrayLiteralExpression(node.initializer)) {
        node.initializer.elements.forEach((element) => {
          const itemValue = stringValue(element);
          const itemTemplate = templateValue(element);
          if (itemValue) addStatic(itemValue);
          if (itemTemplate) addTemplate(itemTemplate);
        });
      }
    }

    if (ts.isCallExpression(node)) {
      const callName =
        ts.isIdentifier(node.expression) || ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name?.text ?? node.expression.text
          : null;

      if (callName && visibleCalls.has(callName)) {
        node.arguments.forEach((argument) => {
          const value = stringValue(argument);
          const template = templateValue(argument);
          if (value) addStatic(value);
          if (template) addTemplate(template);
        });
      }
    }

    if (ts.isStringLiteralLike(node) && renderedExpression(node)) {
      addStatic(node.text);
    }

    if (ts.isTemplateExpression(node) && renderedExpression(node)) {
      const template = templateValue(node);
      if (template) addTemplate(template);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

const collectFiles = async (entry) => {
  const stat = await import("node:fs/promises").then(({ stat }) => stat(entry));
  if (stat.isFile()) return [entry];

  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(entry, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((item) =>
      item.isDirectory()
        ? collectFiles(path.join(entry, item.name))
        : Promise.resolve(
            /\.(?:ts|tsx)$/.test(item.name) ? [path.join(entry, item.name)] : [],
          ),
    ),
  );
  return nested.flat();
};

const readLegacyPortuguese = async () => {
  const sourceText = await readFile(legacyPath, "utf8");
  const sourceFile = ts.createSourceFile(
    legacyPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const pairs = new Map();
  const canonicals = new Set();

  sourceFile.forEachChild((node) => {
    if (
      !ts.isVariableStatement(node) ||
      !node.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === "ptBR",
      )
    ) {
      return;
    }

    const declaration = node.declarationList.declarations.find(
      (item) => ts.isIdentifier(item.name) && item.name.text === "ptBR",
    );
    if (!declaration || !declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) {
      return;
    }

    declaration.initializer.properties.forEach((property) => {
      if (!ts.isPropertyAssignment(property)) return;
      const source = propertyName(property.name);
      const canonical = stringValue(property.initializer);
      if (!source || !canonical) return;
      pairs.set(normalizeText(source), normalizeText(canonical));
      pairs.set(normalizeText(canonical), normalizeText(canonical));
      canonicals.add(normalizeText(canonical));
    });
  });

  return { pairs, canonicals };
};

const createBatches = (items, maxLength = 3200) => {
  const batches = [];
  let current = [];
  let length = 0;

  items.forEach((item) => {
    const nextLength = length + item.length + separator.length + 2;
    if (current.length > 0 && nextLength > maxLength) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push(item);
    length += item.length + separator.length + 2;
  });

  if (current.length > 0) batches.push(current);
  return batches;
};

const fetchTranslation = async (sourceLanguage, targetLanguage, batch) => {
  if (sourceLanguage === targetLanguage || !targetLanguage) return batch;

  const params = new URLSearchParams({
    client: "gtx",
    sl: sourceLanguage,
    tl: targetLanguage,
    dt: "t",
    q: batch.join(`\n${separator}\n`),
  });
  const url = `https://translate.googleapis.com/translate_a/single?${params}`;
  let lastError;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "MLUltimate-i18n-builder/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const translatedText = payload[0].map((item) => item[0]).join("");
      const translated = translatedText
        .split(separator)
        .map((item) => normalizeText(item));

      if (translated.length !== batch.length) {
        throw new Error(`expected ${batch.length} items, received ${translated.length}`);
      }

      return translated;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    }
  }

  throw lastError;
};

const translateList = async (sourceLanguage, targetLanguage, items) => {
  const result = [];
  const batches = createBatches(items);

  for (const [index, batch] of batches.entries()) {
    process.stdout.write(
      `  ${targetLanguage}: lote ${index + 1}/${batches.length} (${batch.length} textos)\n`,
    );
    result.push(...(await fetchTranslation(sourceLanguage, targetLanguage, batch)));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  return result;
};

const toTs = (value) => JSON.stringify(value, null, 2);

const legacyPortuguese = await readLegacyPortuguese();
const sourcePairs = legacyPortuguese.pairs;
sourcePairs.set("Aguardando", "Aguardando");
const templates = new Set();
const sourceFiles = (
  await Promise.all(sourceRoots.map((entry) => collectFiles(entry)))
).flat();
sourceFiles.forEach((filePath) => collectSourceFile(filePath, sourcePairs, templates));

const supplementalPortuguese = [
  ...new Set(
    [...sourcePairs.values()].filter(
      (text) =>
        !legacyPortuguese.canonicals.has(text) &&
        needsPortugueseNormalization(text),
    ),
  ),
].sort((left, right) => left.localeCompare(right, "pt-BR"));

if (supplementalPortuguese.length > 0) {
  process.stdout.write("Normalizando ortografia dos textos em português...\n");
  const supplementalEnglish = await translateList("pt", "en", supplementalPortuguese);
  const normalizedPortuguese = await translateList("en", "pt", supplementalEnglish);
  const normalizedLookup = new Map(
    supplementalPortuguese.map((text, index) => [
      text,
      normalizedPortuguese[index] ?? text,
    ]),
  );

  sourcePairs.forEach((canonical, source) => {
    sourcePairs.set(source, normalizedLookup.get(canonical) ?? canonical);
  });
}

const canonicalTexts = [...new Set(sourcePairs.values())].sort((left, right) =>
  left.localeCompare(right, "pt-BR"),
);
const templateTexts = [...templates].sort((left, right) => left.localeCompare(right, "pt-BR"));
const englishCanonical = await translateList("pt", "en", canonicalTexts);
const englishTemplates = await translateList("pt", "en", templateTexts);
const canonicalByLocale = new Map([
  ["pt-BR", canonicalTexts],
  ["en", englishCanonical],
]);
const templatesByLocale = new Map([
  ["pt-BR", templateTexts],
  ["en", englishTemplates],
]);

for (const locale of locales) {
  if (canonicalByLocale.has(locale.id)) continue;
  const sourceTexts = locale.source === "en" ? englishCanonical : canonicalTexts;
  const sourceTemplates = locale.source === "en" ? englishTemplates : templateTexts;
  canonicalByLocale.set(
    locale.id,
    await translateList(locale.source, locale.target, sourceTexts),
  );
  templatesByLocale.set(
    locale.id,
    await translateList(locale.source, locale.target, sourceTemplates),
  );
}

const generatedTranslations = {};
const generatedTemplates = {};

for (const locale of locales) {
  const translatedCanonical = canonicalByLocale.get(locale.id);
  const translatedTemplates = templatesByLocale.get(locale.id);
  const canonicalLookup = new Map(
    canonicalTexts.map((canonical, index) => [canonical, translatedCanonical[index] ?? canonical]),
  );
  generatedTranslations[locale.id] = Object.fromEntries(
    [...sourcePairs.entries()]
      .map(([source, canonical]) => [source, canonicalLookup.get(canonical) ?? canonical])
      .sort(([left], [right]) => left.localeCompare(right, "pt-BR")),
  );
  generatedTemplates[locale.id] = Object.fromEntries(
    templateTexts.map((template, index) => [
      template,
      translatedTemplates[index] ?? template,
    ]),
  );
}

const output = `// Gerado por scripts/generate-i18n.mjs. Não edite manualmente.\nimport type { AppLanguage } from "../types/launcher";\n\nexport const generatedTranslations = ${toTs(generatedTranslations)} as const satisfies Record<AppLanguage, Record<string, string>>;\n\nexport const generatedTemplates = ${toTs(generatedTemplates)} as const satisfies Record<AppLanguage, Record<string, string>>;\n`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");
process.stdout.write(
  `Gerado ${path.relative(root, outputPath)} com ${canonicalTexts.length} textos e ${templateTexts.length} modelos em ${locales.length} idiomas.\n`,
);
