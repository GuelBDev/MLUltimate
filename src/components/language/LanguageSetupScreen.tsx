import { Languages } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { languageOptions } from "../../constants/languages";
import type { AppLanguage } from "../../types/launcher";

type LanguageSetupScreenProps = {
  currentLanguage: AppLanguage;
  saving?: boolean;
  onSave: (language: AppLanguage) => void;
};

export function LanguageSetupScreen({
  currentLanguage,
  saving = false,
  onSave,
}: LanguageSetupScreenProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<AppLanguage>(currentLanguage);

  return (
    <div className="grid min-h-screen place-items-center bg-[#0D1117] px-5 text-white">
      <Card className="w-full max-w-xl p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#60A5FA]/25 bg-[#3B82F6]/12">
            <Languages className="h-6 w-6 text-[#60A5FA]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#60A5FA]">MLUltimate Launcher</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Escolha o idioma</h1>
            <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
              Selecione o idioma inicial do app. Você pode alterar isso depois nas Configurações.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {languageOptions.map((language) => {
            const active = selectedLanguage === language.id;

            return (
              <button
                key={language.id}
                type="button"
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-[#60A5FA]/70 bg-[#3B82F6]/15"
                    : "border-white/10 bg-[#0D1117]/70 hover:border-[#60A5FA]/35 hover:bg-white/6"
                }`}
                onClick={() => setSelectedLanguage(language.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{language.label}</p>
                  <span
                    className={`h-3 w-3 rounded-full border ${
                      active ? "border-[#60A5FA] bg-[#60A5FA]" : "border-[#94A3B8]"
                    }`}
                  />
                </div>
                <p className="mt-1 text-sm text-[#94A3B8]">{language.description}</p>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          className="mt-6 w-full"
          disabled={saving}
          onClick={() => onSave(selectedLanguage)}
        >
          Continuar
        </Button>
      </Card>
    </div>
  );
}
