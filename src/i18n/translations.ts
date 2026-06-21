import { generatedTemplates, generatedTranslations } from "./generatedTranslations";
import { legacyTranslations } from "./legacyTranslations";
import type { AppLanguage } from "../types/launcher";

export type TranslationMap = Record<string, string>;

const legacyByLanguage =
  legacyTranslations as Partial<Record<AppLanguage, TranslationMap>>;
const legacyPortuguese = legacyByLanguage["pt-BR"] ?? {};
const expandedLegacy = (language: AppLanguage) => {
  const locale = legacyByLanguage[language];
  if (!locale) return {};

  return Object.fromEntries(
    Object.entries(locale).flatMap(([source, translation]) => {
      const canonical = legacyPortuguese[source];
      return canonical && canonical !== source
        ? [
            [source, translation],
            [canonical, translation],
          ]
        : [[source, translation]];
    }),
  );
};
const technicalOverrides: Partial<Record<AppLanguage, TranslationMap>> = {
  es: {
    Mods: "Mods",
    "Mods instalados": "Mods instalados",
    Shaders: "Shaders",
  },
  ru: {
    Loader: "Загрузчик",
    Modpacks: "Модпаки",
    "Minhas Instâncias": "Мои сборки",
    "Minhas Instancias": "Мои сборки",
    Instâncias: "Сборки",
    Instancias: "Сборки",
    "Criar instância": "Создать сборку",
    "Criar instancia": "Создать сборку",
  },
  "zh-CN": {
    Biblioteca: "内容库",
    Loader: "加载器",
    Modpacks: "整合包",
    Jogar: "启动游戏",
  },
  ja: {
    Biblioteca: "ライブラリ",
    Loader: "ローダー",
    Modpacks: "Modパック",
    Jogar: "プレイ",
    "Minhas Instâncias": "マイインスタンス",
    "Minhas Instancias": "マイインスタンス",
  },
  ko: {
    Biblioteca: "라이브러리",
    Loader: "로더",
    Modpacks: "모드팩",
    Jogar: "플레이",
  },
  ar: {
    Mods: "Mods",
    "Mods instalados": "Mods المثبتة",
    Shaders: "Shaders",
    Loader: "مُحمّل المودات",
    Modpacks: "حزم المودات",
    "Fechar para segundo plano": "إخفاء في الخلفية",
  },
  hi: {
    Biblioteca: "लाइब्रेरी",
    Loader: "लोडर",
    Modpacks: "मॉडपैक",
    "Minhas Instâncias": "मेरे इंस्टेंस",
    "Minhas Instancias": "मेरे इंस्टेंस",
    Instâncias: "इंस्टेंस",
    Instancias: "इंस्टेंस",
    "Criar instância": "इंस्टेंस बनाएँ",
    "Criar instancia": "इंस्टेंस बनाएँ",
  },
  tr: {
    Loader: "Yükleyici",
    Modpacks: "Mod paketleri",
    "Minhas Instâncias": "Kurulumlarım",
    "Minhas Instancias": "Kurulumlarım",
    Instâncias: "Kurulumlar",
    Instancias: "Kurulumlar",
    "Criar instância": "Kurulum oluştur",
    "Criar instancia": "Kurulum oluştur",
  },
};

export const translations = Object.fromEntries(
  (Object.keys(generatedTranslations) as AppLanguage[]).map((language) => [
    language,
    {
      ...generatedTranslations[language],
      ...expandedLegacy(language),
      ...(technicalOverrides[language] ?? {}),
    },
  ]),
) as unknown as Record<AppLanguage, TranslationMap>;

const templateMatchers = new Map<
  AppLanguage,
  Array<{ expression: RegExp; translation: string }>
>();

export const translateText = (language: AppLanguage, text: string) => {
  const repaired = repairMojibake(text);
  const dictionary = translations[language];
  const direct =
    dictionary[repaired] ??
    dictionary[withoutDiacritics(repaired)] ??
    dictionary[text] ??
    dictionary[withoutDiacritics(text)];

  if (direct) {
    return direct;
  }

  for (const matcher of getTemplateMatchers(language)) {
    const match = repaired.match(matcher.expression);
    if (!match) continue;

    return matcher.translation.replace(/\{\{(\d+)\}\}/g, (_, index: string) => {
      const capture = match[Number(index) + 1];
      return capture ?? "";
    });
  }

  return repaired;
};

export const repairMojibake = (text: string) => {
  let repaired = text;

  for (let pass = 0; pass < 3 && hasMojibake(repaired); pass += 1) {
    const bytes = toWindows1252Bytes(repaired);
    if (!bytes) break;

    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes,
      );
      if (mojibakeScore(decoded) >= mojibakeScore(repaired)) break;
      repaired = decoded;
    } catch {
      break;
    }
  }

  return repaired;
};

const getTemplateMatchers = (language: AppLanguage) => {
  const cached = templateMatchers.get(language);
  if (cached) return cached;

  const matchers = Object.entries(generatedTemplates[language]).map(
    ([template, translation]) => ({
      expression: templateExpression(template),
      translation,
    }),
  );
  templateMatchers.set(language, matchers);
  return matchers;
};

const templateExpression = (template: string) => {
  const segments = template.split(/\{\{\d+\}\}/g).map(escapeRegExp);
  const placeholders = template.match(/\{\{\d+\}\}/g) ?? [];
  let source = "^";

  placeholders.forEach((_, index) => {
    source += `${segments[index]}(.+?)`;
  });
  source += `${segments.at(-1) ?? ""}$`;

  return new RegExp(source, "u");
};

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const withoutDiacritics = (text: string) =>
  text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const hasMojibake = (text: string) =>
  /(?:Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|Ãƒ|â(?:€|€™|€œ|€|€“|€”))/u.test(text);

const mojibakeScore = (text: string) =>
  (
    text.match(
      /(?:Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|Ãƒ|â(?:€|€™|€œ|€|€“|€”)|�)/gu,
    ) ?? []
  ).length;

const windows1252Bytes = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

const toWindows1252Bytes = (text: string) => {
  const bytes: number[] = [];

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    const mapped = windows1252Bytes.get(character);
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }

  return Uint8Array.from(bytes);
};
