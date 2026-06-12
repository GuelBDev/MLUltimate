import { useEffect } from "react";
import { translations } from "../../i18n/translations";
import type { AppLanguage } from "../../types/launcher";

const textOriginals = new WeakMap<Text, string>();
const translatedAttributes = ["placeholder", "title", "aria-label"] as const;

type TranslatedAttribute = (typeof translatedAttributes)[number];

type RuntimeTranslatorProps = {
  language: AppLanguage;
};

export function RuntimeTranslator({ language }: RuntimeTranslatorProps) {
  useEffect(() => {
    document.documentElement.lang = language;

    const apply = () => translateDocument(language);
    apply();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(apply);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}

const translateDocument = (language: AppLanguage) => {
  translateTextNodes(document.body, language);
  translateAttributes(document.body, language);
};

const translateTextNodes = (root: HTMLElement, language: AppLanguage) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const dictionary = translations[language];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.nodeValue ?? "";
    const trimmed = text.trim();

    if (!trimmed || shouldSkipTextNode(node)) {
      continue;
    }

    const original = textOriginals.get(node) ?? trimmed;
    textOriginals.set(node, original);

    const translated = language === "pt-BR" ? original : dictionary[original] ?? original;
    const nextText = withOriginalSpacing(text, translated);

    if (node.nodeValue !== nextText) {
      node.nodeValue = nextText;
    }
  }
};

const translateAttributes = (root: HTMLElement, language: AppLanguage) => {
  const dictionary = translations[language];
  const elements = root.querySelectorAll<HTMLElement>(
    translatedAttributes.map((attribute) => `[${attribute}]`).join(","),
  );

  elements.forEach((element) => {
    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;

      const original = getOriginalAttribute(element, attribute);
      const translated = language === "pt-BR" ? original : dictionary[original] ?? original;

      if (element.getAttribute(attribute) !== translated) {
        element.setAttribute(attribute, translated);
      }
    });
  });
};

const getOriginalAttribute = (element: HTMLElement, attribute: TranslatedAttribute) => {
  const originalAttribute = `data-i18n-original-${attribute}`;
  const stored = element.getAttribute(originalAttribute);

  if (stored) {
    return stored;
  }

  const original = element.getAttribute(attribute) ?? "";
  element.setAttribute(originalAttribute, original);
  return original;
};

const withOriginalSpacing = (current: string, translated: string) => {
  const match = current.match(/^(\s*)(.*?)(\s*)$/s);

  if (!match) {
    return translated;
  }

  return `${match[1]}${translated}${match[3]}`;
};

const shouldSkipTextNode = (node: Text) => {
  const parent = node.parentElement;

  return Boolean(parent?.closest("script, style, textarea, input, select, option"));
};
