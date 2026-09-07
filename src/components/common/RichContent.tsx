import React, { useMemo } from "react";
import { marked } from "marked";

type RichContentProps = {
  content?: string | null;
  className?: string;
  fallback?: string;
};

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Sanitizes and cleans the HTML generated from Markdown or API HTML bodies.
 * Strips dangerous elements while preserving styling, formatting, images, and links.
 */
const sanitizeHtml = (html: string): string => {
  if (!html) return "";

  let clean = html
    // Remove script tags and contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove style tags and contents
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Remove iframes, objects, embeds
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "")
    // Remove inline event handlers like onclick, onload, onerror
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^>\s]+/gi, "")
    // Remove javascript: pseudo-protocol in href or src
    .replace(/href\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, 'href="#"')
    .replace(/src\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, 'src=""');

  // Ensure all anchor links open in a new tab safely
  clean = clean.replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
    let newAttrs = attrs;
    if (!/target\s*=/i.test(newAttrs)) {
      newAttrs += ' target="_blank"';
    } else {
      newAttrs = newAttrs.replace(/target\s*=\s*(['"])[^'"]*\1/i, 'target="_blank"');
    }
    if (!/rel\s*=/i.test(newAttrs)) {
      newAttrs += ' rel="noopener noreferrer"';
    } else {
      newAttrs = newAttrs.replace(/rel\s*=\s*(['"])[^'"]*\1/i, 'rel="noopener noreferrer"');
    }
    return `<a${newAttrs}>`;
  });

  // Ensure images are responsive and clean
  clean = clean.replace(/<img\b([^>]*)>/gi, (_match, attrs) => {
    let newAttrs = attrs;
    if (!/loading\s*=/i.test(newAttrs)) {
      newAttrs += ' loading="lazy"';
    }
    if (!/class\s*=/i.test(newAttrs)) {
      newAttrs += ' class="rich-content-img"';
    } else {
      newAttrs = newAttrs.replace(/class\s*=\s*(['"])(.*?)\1/i, 'class="$2 rich-content-img"');
    }
    return `<img${newAttrs}/>`;
  });

  return clean;
};

export const RichContent: React.FC<RichContentProps> = ({
  content,
  className = "",
  fallback = "Nenhuma descrição disponível.",
}) => {
  const html = useMemo(() => {
    if (!content || !content.trim()) {
      return null;
    }

    try {
      // If content is already parsed or raw markdown/html, parse with marked
      const parsed = marked.parse(content, { async: false }) as string;
      return sanitizeHtml(parsed);
    } catch (err) {
      console.warn("Falha ao processar conteúdo rico (Markdown/HTML):", err);
      return sanitizeHtml(content);
    }
  }, [content]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (anchor && anchor.href) {
      const href = anchor.href;
      if (href.startsWith("http://") || href.startsWith("https://")) {
        event.preventDefault();
        window.open(href, "_blank");
      }
    }
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target && target.tagName === "IMG") {
      (target as HTMLImageElement).style.display = "none";
    }
  };

  if (!html) {
    return <div className={`text-sm text-[#94A3B8] ${className}`}>{fallback}</div>;
  }

  return (
    <div
      className={`rich-content text-sm leading-7 text-[#D8DEE9] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
      onErrorCapture={handleImageError}
    />
  );
};
