import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  ImagePlus,
  Save,
  Search,
  Shirt,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { launcherApi } from "../services/launcherApi";
import type { SkinSearchResult } from "../types/launcher";

const skinsKey = ["avatar-skins"] as const;

export function AvatarPage() {
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState("");
  const [skinName, setSkinName] = useState("");
  const [searchResult, setSearchResult] = useState<SkinSearchResult | null>(null);

  const skins = useQuery({
    queryKey: skinsKey,
    queryFn: launcherApi.listSkins,
  });

  const refreshSkins = () => {
    void queryClient.invalidateQueries({ queryKey: skinsKey });
  };

  const search = useMutation({
    mutationFn: launcherApi.searchSkinNickname,
    onSuccess: (result) => {
      setSearchResult(result);
      setSkinName(result.nickname);
    },
  });

  const saveNicknameSkin = useMutation({
    mutationFn: launcherApi.saveNicknameSkin,
    onSuccess: () => {
      setNickname("");
      setSkinName("");
      setSearchResult(null);
      refreshSkins();
    },
  });

  const importCustomSkin = useMutation({
    mutationFn: launcherApi.importCustomSkin,
    onSuccess: (skin) => {
      if (skin) refreshSkins();
    },
  });

  const equipSkin = useMutation({
    mutationFn: launcherApi.equipSkin,
    onSuccess: refreshSkins,
  });

  const removeSkin = useMutation({
    mutationFn: launcherApi.removeSkin,
    onSuccess: refreshSkins,
  });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search.mutate(nickname);
  };

  const error =
    search.error instanceof Error
      ? search.error.message
      : saveNicknameSkin.error instanceof Error
        ? saveNicknameSkin.error.message
        : importCustomSkin.error instanceof Error
          ? importCustomSkin.error.message
          : equipSkin.error instanceof Error
            ? equipSkin.error.message
            : removeSkin.error instanceof Error
              ? removeSkin.error.message
              : null;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="overflow-hidden">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-blue-300/20 bg-blue-500/15">
                <Shirt className="h-5 w-5 text-[#60A5FA]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Avatar</h2>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Busque uma skin por nick, salve na biblioteca e equipe quando quiser.
                </p>
              </div>
            </div>

            <form className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submitSearch}>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                placeholder="Digite um nick do Minecraft"
                maxLength={16}
              />
              <Button type="submit" disabled={!nickname.trim() || search.isPending}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => importCustomSkin.mutate()}
                disabled={importCustomSkin.isPending}
              >
                <Upload className="h-4 w-4" />
                Importar PNG
              </Button>
              <Badge tone="slate">PNG 64x64 ou 64x32</Badge>
              <Badge tone="blue">NameMC por nick</Badge>
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D1117]/60 p-4">
            {searchResult ? (
              <div className="flex flex-col items-center text-center">
                <img
                  src={searchResult.skinUrl}
                  alt={searchResult.nickname}
                  className="h-44 w-32 object-contain drop-shadow-2xl [image-rendering:pixelated]"
                />
                <h3 className="mt-3 text-base font-semibold text-white">
                  {searchResult.nickname}
                </h3>
                <a
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#60A5FA] hover:text-[#93C5FD]"
                  href={searchResult.namemcUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir no NameMC
                  <ExternalLink className="h-3 w-3" />
                </a>
                <input
                  value={skinName}
                  onChange={(event) => setSkinName(event.target.value)}
                  className="mt-4 h-10 w-full rounded-xl border border-white/10 bg-[#161B22] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                  placeholder="Nome para salvar"
                  maxLength={40}
                />
                <Button
                  type="button"
                  className="mt-3 w-full"
                  disabled={saveNicknameSkin.isPending}
                  onClick={() =>
                    saveNicknameSkin.mutate({
                      nickname: searchResult.nickname,
                      name: skinName.trim() || searchResult.nickname,
                    })
                  }
                >
                  <Save className="h-4 w-4" />
                  Salvar skin
                </Button>
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center text-center">
                <div>
                  <ImagePlus className="mx-auto h-10 w-10 text-[#60A5FA]" />
                  <p className="mt-3 text-sm font-semibold text-white">Nenhuma skin selecionada</p>
                  <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
                    Busque um nick ou importe uma imagem PNG customizada.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Skins salvas</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              A skin equipada fica marcada para uso dentro do launcher.
            </p>
          </div>
          <Badge tone="slate">{skins.data?.length ?? 0} skins</Badge>
        </div>

        {skins.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skins.data.map((skin) => (
              <Card key={skin.id} className="overflow-hidden p-4">
                <div className="flex gap-4">
                  <div className="grid h-28 w-24 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#0D1117]">
                    {skin.imageDataUrl || skin.previewUrl ? (
                      <img
                        src={skin.imageDataUrl ?? skin.previewUrl}
                        alt={skin.name}
                        className="max-h-24 max-w-20 object-contain [image-rendering:pixelated]"
                      />
                    ) : (
                      <Shirt className="h-8 w-8 text-[#60A5FA]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">{skin.name}</h3>
                        <p className="mt-1 truncate text-xs text-[#94A3B8]">
                          {skin.nickname ?? (skin.source === "custom" ? "Skin customizada" : "NameMC")}
                        </p>
                      </div>
                      {skin.equippedAt ? <Badge tone="green">Ativa</Badge> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={skin.equippedAt ? "secondary" : "primary"}
                        disabled={equipSkin.isPending}
                        onClick={() => equipSkin.mutate(skin.id)}
                      >
                        <Star className="h-4 w-4" />
                        Equipar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={removeSkin.isPending}
                        onClick={() => removeSkin.mutate(skin.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="grid min-h-44 place-items-center p-6 text-center">
            <div>
              <Shirt className="mx-auto h-10 w-10 text-[#60A5FA]" />
              <p className="mt-3 text-sm font-semibold text-white">Nenhuma skin salva</p>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Salve uma skin por nick ou importe uma PNG customizada.
              </p>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
