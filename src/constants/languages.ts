import type { AppLanguage } from "../types/launcher";

export const languageOptions: Array<{
  id: AppLanguage;
  label: string;
  description: string;
}> = [
  { id: "pt-BR", label: "Português Brasil", description: "Interface em português brasileiro." },
  { id: "pt-PT", label: "Português Portugal", description: "Interface em português europeu." },
  { id: "en", label: "English", description: "Interface in English." },
  { id: "fr", label: "Français", description: "Interface en français." },
];
