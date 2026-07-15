import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  ExternalLink,
  ImagePlus,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
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
import type { LauncherSkin, NameMCSkinLibraryItem, SkinSearchResult } from "../types/launcher";
import { cn } from "../utils/cn";

const skinsKey = ["avatar-skins"] as const;
const authKey = ["auth", "session"] as const;

export function AvatarPage() {
  const queryClient = useQueryClient();
  const [originalQuery, setOriginalQuery] = useState("");
  const [nameMcSearchTerm, setNameMcSearchTerm] = useState("");
  const [offlineNickname, setOfflineNickname] = useState("");
  const [offlineSkinName, setOfflineSkinName] = useState("");
  const [offlineSearchResult, setOfflineSearchResult] = useState<SkinSearchResult | null>(null);

  const skins = useQuery({
    queryKey: skinsKey,
    queryFn: launcherApi.listSkins,
    refetchInterval: 5 * 60 * 1000,
  });
  const authSession = useQuery({
    queryKey: authKey,
    queryFn: launcherApi.getSession,
  });
  const featuredNameMc = useQuery({
    queryKey: ["avatar", "namemc", "featured"],
    queryFn: () => launcherApi.browseNameMcLibrary({ category: "trending", page: 1 }),
    staleTime: 10 * 60 * 1000,
  });
  const nameMcSearch = useQuery({
    queryKey: ["avatar", "namemc", "search", nameMcSearchTerm],
    queryFn: () => launcherApi.searchNameMcLibrary(nameMcSearchTerm),
    enabled: nameMcSearchTerm.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const activeSkin = (skins.data ?? []).find((skin) => skin.equippedAt);
  const hasMicrosoftLicense =
    authSession.data?.status === "signed-in" &&
    authSession.data.account.provider === "microsoft" &&
    authSession.data.account.license.status === "verified";

  const refreshSkins = () => {
    void queryClient.invalidateQueries({ queryKey: skinsKey });
  };

  const setAuthSession = (data: Awaited<ReturnType<typeof launcherApi.getSession>>) => {
    queryClient.setQueryData(authKey, data);
  };

  const loginMicrosoft = useMutation({
    mutationFn: launcherApi.loginMicrosoft,
    onSuccess: setAuthSession,
  });

  const refreshNameMcSkins = useMutation({
    mutationFn: launcherApi.refreshNameMcSkins,
    onSuccess: refreshSkins,
  });

  const saveProfileAndApply = useMutation({
    mutationFn: async (profile: SkinSearchResult) => {
      const saved = await launcherApi.saveNicknameSkin({
        nickname: profile.nickname,
        name: profile.nickname,
      });
      await launcherApi.equipSkin(saved.id);
      const session = hasMicrosoftLicense
        ? await launcherApi.applyOfficialSkin({ variant: saved.variant ?? profile.variant ?? "classic" })
        : null;

      return { saved, session };
    },
    onSuccess: ({ session }) => {
      if (session) setAuthSession(session);
      refreshSkins();
    },
    onSettled: refreshSkins,
  });

  const saveNameMcAndApply = useMutation({
    mutationFn: async (item: NameMCSkinLibraryItem) => {
      const saved = await launcherApi.saveNameMcSkin({
        skinId: item.id,
        name: item.name,
        variant: item.model ?? "classic",
      });
      await launcherApi.equipSkin(saved.id);
      const session = hasMicrosoftLicense
        ? await launcherApi.applyOfficialSkin({ variant: saved.variant ?? item.model ?? "classic" })
        : null;

      return { saved, session };
    },
    onSuccess: ({ session }) => {
      if (session) setAuthSession(session);
      refreshSkins();
    },
    onSettled: refreshSkins,
  });

  const importSkin = useMutation({
    mutationFn: async (applyToOfficial: boolean) => {
      const skin = await launcherApi.importCustomSkin();

      if (!skin) {
        return null;
      }

      await launcherApi.equipSkin(skin.id);
      const session = applyToOfficial && hasMicrosoftLicense
        ? await launcherApi.applyOfficialSkin({ variant: skin.variant ?? "classic" })
        : null;

      return { skin, session };
    },
    onSuccess: (result) => {
      if (result?.session) setAuthSession(result.session);
      refreshSkins();
    },
    onSettled: refreshSkins,
  });

  const offlineSearch = useMutation({
    mutationFn: launcherApi.searchSkinNickname,
    onSuccess: (result) => {
      setOfflineSearchResult(result);
      setOfflineSkinName(result.nickname);
    },
  });

  const saveOfflineSkin = useMutation({
    mutationFn: async () => {
      if (!offlineSearchResult) {
        throw new Error("Busque um nick antes de salvar a skin manual.");
      }

      const saved = await launcherApi.saveNicknameSkin({
        nickname: offlineSearchResult.nickname,
        name: offlineSkinName.trim() || offlineSearchResult.nickname,
      });

      await launcherApi.equipSkin(saved.id);
      return saved;
    },
    onSuccess: () => {
      setOfflineNickname("");
      setOfflineSkinName("");
      setOfflineSearchResult(null);
      refreshSkins();
    },
    onSettled: refreshSkins,
  });

  const equipSkin = useMutation({
    mutationFn: async (skin: LauncherSkin) => {
      const equipped = await launcherApi.equipSkin(skin.id);
      const session = hasMicrosoftLicense
        ? await launcherApi.applyOfficialSkin({ variant: equipped.variant ?? skin.variant ?? "classic" })
        : null;

      return { equipped, session };
    },
    onSuccess: ({ session }) => {
      if (session) setAuthSession(session);
      refreshSkins();
    },
    onSettled: refreshSkins,
  });

  const removeSkin = useMutation({
    mutationFn: launcherApi.removeSkin,
    onSuccess: refreshSkins,
  });

  const submitOriginalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameMcSearchTerm(originalQuery.trim());
  };

  const submitOfflineSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    offlineSearch.mutate(offlineNickname);
  };

  const originalItems = nameMcSearch.data?.skins ?? featuredNameMc.data?.items ?? [];
  const originalProfiles = nameMcSearch.data?.profiles ?? [];
  const isSearchingNameMc = nameMcSearch.isFetching || saveProfileAndApply.isPending || saveNameMcAndApply.isPending;
  const error =
    loginMicrosoft.error instanceof Error
      ? loginMicrosoft.error.message
      : nameMcSearch.error instanceof Error
        ? nameMcSearch.error.message
        : featuredNameMc.error instanceof Error
          ? featuredNameMc.error.message
          : saveProfileAndApply.error instanceof Error
            ? saveProfileAndApply.error.message
            : saveNameMcAndApply.error instanceof Error
              ? saveNameMcAndApply.error.message
              : importSkin.error instanceof Error
                ? importSkin.error.message
                : offlineSearch.error instanceof Error
                  ? offlineSearch.error.message
                  : saveOfflineSkin.error instanceof Error
                    ? saveOfflineSkin.error.message
                    : equipSkin.error instanceof Error
                      ? equipSkin.error.message
                      : removeSkin.error instanceof Error
                        ? removeSkin.error.message
                        : refreshNameMcSkins.error instanceof Error
                          ? refreshNameMcSkins.error.message
                          : null;

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-500/15">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Minecraft original</h2>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Pesquise no NameMC, baixe a skin e aplique direto na conta Microsoft/Mojang.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={hasMicrosoftLicense ? "green" : "slate"}>
              {hasMicrosoftLicense ? "Conta verificada" : "Microsoft exigida"}
            </Badge>
            <Badge tone="blue">NameMC</Badge>
          </div>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submitOriginalSearch}>
              <input
                value={originalQuery}
                onChange={(event) => setOriginalQuery(event.target.value)}
                className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                placeholder="Pesquisar nick ou tag no NameMC"
                maxLength={16}
              />
              <Button type="submit" disabled={originalQuery.trim().length < 2 || nameMcSearch.isFetching}>
                {nameMcSearch.isFetching ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Pesquisar
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {!hasMicrosoftLicense ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => loginMicrosoft.mutate()}
                  disabled={loginMicrosoft.isPending}
                >
                  <LogIn className="h-4 w-4" />
                  Entrar com Microsoft
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => importSkin.mutate(true)}
                disabled={!hasMicrosoftLicense || importSkin.isPending}
              >
                {importSkin.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                PNG e aplicar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => refreshNameMcSkins.mutate()}
                disabled={refreshNameMcSkins.isPending}
              >
                <RefreshCw className={cn("h-4 w-4", refreshNameMcSkins.isPending && "animate-spin")} />
                Atualizar salvas
              </Button>
            </div>

            <div className="mt-5 grid gap-3">
              {nameMcSearchTerm ? (
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">
                    Resultados para {nameMcSearchTerm}
                  </h3>
                  <Badge tone="slate">
                    {originalProfiles.length + originalItems.length} encontrados
                  </Badge>
                </div>
              ) : (
                <h3 className="text-sm font-semibold text-white">Biblioteca NameMC em alta</h3>
              )}

              {originalProfiles.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {originalProfiles.map((profile) => (
                    <NameMcProfileCard
                      key={profile.uuid}
                      profile={profile}
                      disabled={isSearchingNameMc}
                      onApply={() => saveProfileAndApply.mutate(profile)}
                    />
                  ))}
                </div>
              ) : null}

              <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {originalItems.map((item) => (
                  <NameMcSkinCard
                    key={item.id}
                    item={item}
                    disabled={isSearchingNameMc}
                    onApply={() => saveNameMcAndApply.mutate(item)}
                  />
                ))}
              </div>
            </div>
          </div>

          <ActiveSkinPanel activeSkin={activeSkin} hasMicrosoftLicense={hasMicrosoftLicense} />
        </div>
      </Card>

      <Card className="overflow-hidden p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-blue-300/20 bg-blue-500/15">
                <Shirt className="h-5 w-5 text-[#60A5FA]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Skin manual</h2>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  Busque por nick ou importe uma PNG para equipar no launcher.
                </p>
              </div>
            </div>

            <form className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submitOfflineSearch}>
              <input
                value={offlineNickname}
                onChange={(event) => setOfflineNickname(event.target.value)}
                className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                placeholder="Digite um nick do Minecraft"
                maxLength={16}
              />
              <Button type="submit" disabled={!offlineNickname.trim() || offlineSearch.isPending}>
                {offlineSearch.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => importSkin.mutate(false)}
                disabled={importSkin.isPending}
              >
                <Upload className="h-4 w-4" />
                Importar PNG
              </Button>
              <Badge tone="slate">PNG 64x64 ou 64x32</Badge>
              <Badge tone="blue">Aplicacao local</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0D1117]/60 p-4">
            {offlineSearchResult ? (
              <div className="flex flex-col items-center text-center">
                <SkinPreview
                  src={offlineSearchResult.skinUrl}
                  name={offlineSearchResult.nickname}
                  className="h-44 w-32"
                />
                <h3 className="mt-3 text-base font-semibold text-white">
                  {offlineSearchResult.nickname}
                </h3>
                <a
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#60A5FA] hover:text-[#93C5FD]"
                  href={offlineSearchResult.namemcUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir no NameMC
                  <ExternalLink className="h-3 w-3" />
                </a>
                <input
                  value={offlineSkinName}
                  onChange={(event) => setOfflineSkinName(event.target.value)}
                  className="mt-4 h-10 w-full rounded-xl border border-white/10 bg-[#161B22] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                  placeholder="Nome para salvar"
                  maxLength={40}
                />
                <Button
                  type="button"
                  className="mt-3 w-full"
                  disabled={saveOfflineSkin.isPending}
                  onClick={() => saveOfflineSkin.mutate()}
                >
                  {saveOfflineSkin.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Salvar e equipar
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

      {saveProfileAndApply.isSuccess ? (
        <StatusMessage text={`Skin ${saveProfileAndApply.data.saved.name} equipada${hasMicrosoftLicense ? " e aplicada no Minecraft original" : ""}.`} />
      ) : null}
      {saveNameMcAndApply.isSuccess ? (
        <StatusMessage text={`Skin ${saveNameMcAndApply.data.saved.name} equipada${hasMicrosoftLicense ? " e aplicada no Minecraft original" : ""}.`} />
      ) : null}
      {equipSkin.isSuccess ? (
        <StatusMessage text={`Skin ${equipSkin.data.equipped.name} equipada${equipSkin.data.session ? " e aplicada no Minecraft original" : ""}.`} />
      ) : null}
      {importSkin.data?.skin ? (
        <StatusMessage text={`Skin ${importSkin.data.skin.name} importada e equipada${importSkin.data.session ? " no Minecraft original" : ""}.`} />
      ) : null}
      {saveOfflineSkin.isSuccess ? (
        <StatusMessage text={`Skin ${saveOfflineSkin.data.name} pronta para uso manual.`} />
      ) : null}
      {refreshNameMcSkins.data ? (
        <p className="text-xs text-[#94A3B8]">
          {refreshNameMcSkins.data.updated} skin(s) atualizada(s) de {refreshNameMcSkins.data.checked} verificadas.
        </p>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Skins salvas</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Ao clicar em Equipar, a skin fica ativa no launcher e tambem vai para a conta original quando ela estiver verificada.
            </p>
          </div>
          <Badge tone="slate">{skins.data?.length ?? 0} skins</Badge>
        </div>

        {skins.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skins.data.map((skin) => (
              <SavedSkinCard
                key={skin.id}
                skin={skin}
                canApplyOfficial={hasMicrosoftLicense}
                disabled={equipSkin.isPending || removeSkin.isPending}
                onEquip={() => equipSkin.mutate(skin)}
                onRemove={() => removeSkin.mutate(skin.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="grid min-h-44 place-items-center p-6 text-center">
            <div>
              <Shirt className="mx-auto h-10 w-10 text-[#60A5FA]" />
              <p className="mt-3 text-sm font-semibold text-white">Nenhuma skin salva</p>
              <p className="mt-1 text-sm text-[#94A3B8]">
                Baixe uma skin pelo NameMC ou importe uma PNG customizada.
              </p>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

const ActiveSkinPanel = ({
  activeSkin,
  hasMicrosoftLicense,
}: {
  activeSkin?: LauncherSkin;
  hasMicrosoftLicense: boolean;
}) => (
  <div className="rounded-2xl border border-white/10 bg-[#0D1117]/60 p-4">
    {activeSkin ? (
      <div className="flex flex-col items-center text-center">
        <SkinPreview
          src={activeSkin.imageDataUrl ?? activeSkin.previewUrl}
          name={activeSkin.name}
          className="h-44 w-32"
        />
        <h3 className="mt-3 max-w-full truncate text-base font-semibold text-white">{activeSkin.name}</h3>
        <p className="mt-1 text-xs text-[#94A3B8]">Skin ativa no launcher</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Badge tone="green">Ativa</Badge>
          <Badge tone={hasMicrosoftLicense ? "green" : "slate"}>
            {hasMicrosoftLicense ? "Original pronto" : "Offline local"}
          </Badge>
        </div>
      </div>
    ) : (
      <div className="grid min-h-64 place-items-center text-center">
        <div>
          <ImagePlus className="mx-auto h-10 w-10 text-[#60A5FA]" />
          <p className="mt-3 text-sm font-semibold text-white">Nenhuma skin ativa</p>
          <p className="mt-1 text-sm leading-6 text-[#94A3B8]">
            Baixe por nick, NameMC ou importe uma PNG.
          </p>
        </div>
      </div>
    )}
  </div>
);

const NameMcProfileCard = ({
  profile,
  disabled,
  onApply,
}: {
  profile: SkinSearchResult;
  disabled: boolean;
  onApply: () => void;
}) => (
  <div className="flex min-w-0 gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-3">
    <div className="grid h-20 w-16 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#0D1117]">
      <SkinPreview src={profile.avatarUrl} name={profile.nickname} className="max-h-16 max-w-12" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{profile.nickname}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {profile.match === "exact" ? "Nick exato" : "Nick parecido"}
          </p>
        </div>
        <Badge tone={profile.match === "exact" ? "green" : "blue"}>
          {profile.match === "exact" ? "Exato" : "Parecido"}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onApply} disabled={disabled}>
          <Download className="h-4 w-4" />
          Baixar e aplicar
        </Button>
        <a
          className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-semibold text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
          href={profile.namemcUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
);

const NameMcSkinCard = ({
  item,
  disabled,
  onApply,
}: {
  item: NameMCSkinLibraryItem;
  disabled: boolean;
  onApply: () => void;
}) => (
  <div className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:bg-white/[0.06]">
    <div className="grid h-20 w-16 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#0D1117]">
      <SkinPreview src={item.previewUrl} name={item.name} className="max-h-16 max-w-12" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {item.model === "slim" ? "Slim" : "Classic"}
          </p>
        </div>
        {item.rank ? <Badge tone="slate">#{item.rank}</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onApply} disabled={disabled}>
          <Download className="h-4 w-4" />
          Baixar e aplicar
        </Button>
        <a
          className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 px-3 text-sm font-semibold text-[#94A3B8] transition hover:bg-white/8 hover:text-white"
          href={item.namemcUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
);

const SavedSkinCard = ({
  skin,
  canApplyOfficial,
  disabled,
  onEquip,
  onRemove,
}: {
  skin: LauncherSkin;
  canApplyOfficial: boolean;
  disabled: boolean;
  onEquip: () => void;
  onRemove: () => void;
}) => (
  <Card className="overflow-hidden p-4">
    <div className="flex gap-4">
      <div className="grid h-28 w-24 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#0D1117]">
        <SkinPreview
          src={skin.imageDataUrl ?? skin.previewUrl}
          name={skin.name}
          className="max-h-24 max-w-20"
        />
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
            disabled={disabled}
            onClick={onEquip}
          >
            <Star className="h-4 w-4" />
            Equipar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {canApplyOfficial ? (
          <p className="mt-3 text-xs text-emerald-200">Equipar aplica no original automaticamente.</p>
        ) : null}
      </div>
    </div>
  </Card>
);

const SkinPreview = ({
  src,
  name,
  className,
}: {
  src?: string;
  name: string;
  className?: string;
}) => {
  if (!src) {
    return <Shirt className="h-8 w-8 text-[#60A5FA]" />;
  }

  return (
    <img
      src={src}
      alt={name}
      className={cn("object-contain drop-shadow-2xl [image-rendering:pixelated]", className)}
    />
  );
};

const StatusMessage = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
    {text}
  </div>
);
