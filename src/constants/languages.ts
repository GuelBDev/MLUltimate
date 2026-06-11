import type { AppLanguage } from "../types/launcher";

export const languageOptions: Array<{
  id: AppLanguage;
  label: string;
  description: string;
}> = [
  { id: "pt-BR", label: "Portugues Brasil", description: "Interface em portugues brasileiro." },
  { id: "pt-PT", label: "Portugues Portugal", description: "Interface em portugues europeu." },
  { id: "en", label: "English", description: "Interface in English." },
  { id: "fr", label: "French", description: "Interface en francais." },
];
