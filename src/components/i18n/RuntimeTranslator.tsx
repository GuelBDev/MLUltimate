import { useEffect } from "react";
import { languageDirection, languageLocale } from "../../constants/languages";
import { translations, translateText } from "../../i18n/translations";
import type { AppLanguage } from "../../types/launcher";

const textOriginals = new WeakMap<Text, string>();
const translatedAttributes = ["placeholder", "title", "aria-label"] as const;

type TranslatedAttribute = (typeof translatedAttributes)[number];

type RuntimeTranslatorProps = {
  language: AppLanguage;
};

export function RuntimeTranslator({ language }: RuntimeTranslatorProps) {
  useEffect(() => {
    document.documentElement.dataset.appLanguage = language;
    document.documentElement.lang = languageLocale(language);
    document.documentElement.dir = languageDirection(language);

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

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.nodeValue ?? "";
    const trimmed = text.trim();

    if (!trimmed || shouldSkipTextNode(node)) {
      continue;
    }

    const storedOriginal = textOriginals.get(node);
    const original =
      storedOriginal &&
      (trimmed === storedOriginal || isKnownTranslation(storedOriginal, trimmed))
        ? storedOriginal
        : trimmed;
    textOriginals.set(node, original);

    const translated = translateText(language, original);
    const nextText = withOriginalSpacing(text, translated);

    if (node.nodeValue !== nextText) {
      node.nodeValue = nextText;
    }
  }
};

const translateAttributes = (root: HTMLElement, language: AppLanguage) => {
  const elements = root.querySelectorAll<HTMLElement>(
    translatedAttributes.map((attribute) => `[${attribute}]`).join(","),
  );

  elements.forEach((element) => {
    translatedAttributes.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;

      const original = getOriginalAttribute(element, attribute);
      const translated = translateText(language, original);

      if (element.getAttribute(attribute) !== translated) {
        element.setAttribute(attribute, translated);
      }
    });
  });
};

const getOriginalAttribute = (element: HTMLElement, attribute: TranslatedAttribute) => {
  const originalAttribute = `data-i18n-original-${attribute}`;
  const stored = element.getAttribute(originalAttribute);
  const current = element.getAttribute(attribute) ?? "";

  if (stored) {
    if (current !== stored && !isKnownTranslation(stored, current)) {
      element.setAttribute(originalAttribute, current);
      return current;
    }

    return stored;
  }

  const original = current;
  element.setAttribute(originalAttribute, original);
  return original;
};

const isKnownTranslation = (original: string, current: string) =>
  (Object.keys(translations) as AppLanguage[]).some(
    (language) => translateText(language, original) === current,
  );

const withOriginalSpacing = (current: string, translated: string) => {
  const match = current.match(/^(\s*)(.*?)(\s*)$/s);

  if (!match) {
    return translated;
  }

  return `${match[1]}${translated}${match[3]}`;
};

const shouldSkipTextNode = (node: Text) => {
  const parent = node.parentElement;

  return Boolean(
    parent?.closest("script, style, textarea, input, [data-i18n-skip='true']"),
  );
};
