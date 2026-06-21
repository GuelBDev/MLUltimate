import type { AppLanguage } from "../types/launcher";

export const languageOptions: Array<{
  id: AppLanguage;
  label: string;
  description: string;
  locale: string;
  direction?: "ltr" | "rtl";
}> = [
  {
    id: "pt-BR",
    label: "Português Brasil",
    description: "Interface em português brasileiro.",
    locale: "pt-BR",
  },
  {
    id: "pt-PT",
    label: "Português Portugal",
    description: "Interface em português europeu.",
    locale: "pt-PT",
  },
  { id: "en", label: "English", description: "Interface in English.", locale: "en-US" },
  { id: "es", label: "Español", description: "Interfaz en español.", locale: "es-ES" },
  { id: "fr", label: "Français", description: "Interface en français.", locale: "fr-FR" },
  {
    id: "de",
    label: "Deutsch",
    description: "Benutzeroberfläche auf Deutsch.",
    locale: "de-DE",
  },
  { id: "it", label: "Italiano", description: "Interfaccia in italiano.", locale: "it-IT" },
  { id: "ru", label: "Русский", description: "Интерфейс на русском языке.", locale: "ru-RU" },
  { id: "zh-CN", label: "简体中文", description: "简体中文界面。", locale: "zh-CN" },
  { id: "ja", label: "日本語", description: "日本語のインターフェース。", locale: "ja-JP" },
  { id: "ko", label: "한국어", description: "한국어 인터페이스.", locale: "ko-KR" },
  {
    id: "ar",
    label: "العربية",
    description: "واجهة باللغة العربية.",
    locale: "ar",
    direction: "rtl",
  },
  { id: "hi", label: "हिन्दी", description: "हिन्दी में इंटरफ़ेस।", locale: "hi-IN" },
  { id: "tr", label: "Türkçe", description: "Türkçe arayüz.", locale: "tr-TR" },
];

export const languageLocale = (language: AppLanguage) =>
  languageOptions.find((item) => item.id === language)?.locale ?? language;

export const languageDirection = (language: AppLanguage) =>
  languageOptions.find((item) => item.id === language)?.direction ?? "ltr";
