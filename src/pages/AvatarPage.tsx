import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  ExternalLink,
  Globe,
  ImagePlus,
  Layers,
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

type SkinCategoryTab = "my-skins" | "namemc" | "manual";

export function AvatarPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SkinCategoryTab>("namemc");
  const [originalQuery, setOriginalQuery] = useState("");
  const [nameMcSearchTerm, setNameMcSearchTerm] = useState("");
  const [offlineNickname, setOfflineNickname] = useState("");
  const [offlineSkinName, setOfflineSkinName] = useState("");
  const [offlineSearchResult, setOfflineSearchResult] = useState<SkinSearchResult | null>(null);
  const [pendingSkinId, setPendingSkinId] = useState<string | null>(null);

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
      setPendingSkinId(profile.nickname);
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
    onSettled: () => {
      setPendingSkinId(null);
      refreshSkins();
    },
  });

  const saveNameMcAndApply = useMutation({
    mutationFn: async (item: NameMCSkinLibraryItem) => {
      setPendingSkinId(item.id);
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
    onSettled: () => {
      setPendingSkinId(null);
      refreshSkins();
    },
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
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-[#121824] p-6 shadow-2xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 shadow-lg">
                <Shirt className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold text-white tracking-wide">Skins & Avatar</h1>
            </div>
            <p className="mt-2 text-sm text-gray-300">
              Personalize seu personagem com skins do NameMC, busca por nick ou importe imagens PNG locais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!hasMicrosoftLicense ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => loginMicrosoft.mutate()}
                disabled={loginMicrosoft.isPending}
                className="flex items-center gap-2 rounded-xl"
              >
                <LogIn className="h-4 w-4" />
                Entrar com Microsoft
              </Button>
            ) : (
              <Badge tone="green" className="py-2 px-3 text-xs font-semibold">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5 inline" />
                Microsoft Verificada
              </Badge>
            )}

            <Button
              type="button"
              onClick={() => importSkin.mutate(hasMicrosoftLicense)}
              disabled={importSkin.isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02] hover:from-blue-500 hover:to-indigo-500"
            >
              {importSkin.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar PNG
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("my-skins")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-200 ${
              activeTab === "my-skins"
                ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Layers className="h-4 w-4" />
            Minhas Skins ({skins.data?.length ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("namemc")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-200 ${
              activeTab === "namemc"
                ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Globe className="h-4 w-4" />
            Skins NameMC
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition duration-200 ${
              activeTab === "manual"
                ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Shirt className="h-4 w-4" />
            Skin Manual
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            void skins.refetch();
            void refreshNameMcSkins.mutate();
          }}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              skins.isFetching || refreshNameMcSkins.isPending ? "animate-spin text-blue-400" : ""
            }`}
          />
          Sincronizar Skins
        </button>
      </div>

      {/* Notifications / Status */}
      {saveProfileAndApply.isSuccess ? (
        <StatusMessage
          text={`Skin ${saveProfileAndApply.data.saved.name} equipada${
            hasMicrosoftLicense ? " e aplicada no Minecraft original" : ""
          }.`}
        />
      ) : null}
      {saveNameMcAndApply.isSuccess ? (
        <StatusMessage
          text={`Skin ${saveNameMcAndApply.data.saved.name} equipada${
            hasMicrosoftLicense ? " e aplicada no Minecraft original" : ""
          }.`}
        />
      ) : null}
      {equipSkin.isSuccess ? (
        <StatusMessage
          text={`Skin ${equipSkin.data.equipped.name} equipada${
            equipSkin.data.session ? " e aplicada no Minecraft original" : ""
          }.`}
        />
      ) : null}
      {importSkin.data?.skin ? (
        <StatusMessage
          text={`Skin ${importSkin.data.skin.name} importada e equipada${
            importSkin.data.session ? " no Minecraft original" : ""
          }.`}
        />
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

      {/* TAB 1: MINHAS SKINS SALVAS */}
      {activeTab === "my-skins" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {skins.data?.length ? (
              <div className="grid gap-4 md:grid-cols-2">
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
              <Card className="grid min-h-64 place-items-center p-8 text-center">
                <div className="max-w-sm">
                  <Shirt className="mx-auto h-12 w-12 text-[#60A5FA]" />
                  <p className="mt-3 text-base font-semibold text-white">Nenhuma skin salva ainda</p>
                  <p className="mt-1 text-sm text-[#94A3B8]">
                    Explore a biblioteca do NameMC ou importe sua imagem PNG customizada.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button type="button" onClick={() => setActiveTab("namemc")}>
                      <Globe className="h-4 w-4 mr-1.5" />
                      Explorar NameMC
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setActiveTab("manual")}
                    >
                      <Shirt className="h-4 w-4 mr-1.5" />
                      Skin Manual
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <ActiveSkinPanel activeSkin={activeSkin} hasMicrosoftLicense={hasMicrosoftLicense} />
        </div>
      )}

      {/* TAB 2: SKINS NAMEMC */}
      {activeTab === "namemc" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <Card className="overflow-hidden p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-500/15">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Biblioteca NameMC</h2>
                    <p className="mt-1 text-sm text-[#94A3B8]">
                      Pesquise nicks ou tags no NameMC, baixe e aplique direto no launcher ou conta original.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={hasMicrosoftLicense ? "green" : "slate"}>
                    {hasMicrosoftLicense ? "Conta verificada" : "Microsoft opcional"}
                  </Badge>
                  <Badge tone="blue">NameMC Online</Badge>
                </div>
              </div>

              <div className="mt-5">
                <form
                  className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                  onSubmit={submitOriginalSearch}
                >
                  <input
                    value={originalQuery}
                    onChange={(event) => setOriginalQuery(event.target.value)}
                    className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                    placeholder="Pesquisar nick ou tag no NameMC (ex: PvP, Anime, Dark, Nick)"
                    maxLength={16}
                  />
                  <Button
                    type="submit"
                    disabled={originalQuery.trim().length < 2 || nameMcSearch.isFetching}
                  >
                    {nameMcSearch.isFetching ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Pesquisar
                  </Button>
                </form>

                <div className="mt-4 flex flex-wrap gap-2">
                  {nameMcSearchTerm ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setNameMcSearchTerm("");
                        setOriginalQuery("");
                      }}
                    >
                      Limpar pesquisa
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => refreshNameMcSkins.mutate()}
                    disabled={refreshNameMcSkins.isPending}
                  >
                    <RefreshCw
                      className={cn("h-3.5 w-3.5", refreshNameMcSkins.isPending && "animate-spin")}
                    />
                    Atualizar salvas
                  </Button>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              {nameMcSearchTerm ? (
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">
                    Resultados para &quot;{nameMcSearchTerm}&quot;
                  </h3>
                  <Badge tone="slate">
                    {originalProfiles.length + originalItems.length} encontrados
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">Biblioteca NameMC em alta</h3>
                  <Badge tone="slate">{originalItems.length} skins</Badge>
                </div>
              )}

              {originalProfiles.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {originalProfiles.map((profile) => (
                    <NameMcProfileCard
                      key={profile.uuid}
                      profile={profile}
                      disabled={isSearchingNameMc}
                      isPending={pendingSkinId === profile.nickname}
                      onApply={() => saveProfileAndApply.mutate(profile)}
                    />
                  ))}
                </div>
              ) : null}

              <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {originalItems.map((item) => (
                  <NameMcSkinCard
                    key={item.id}
                    item={item}
                    disabled={isSearchingNameMc}
                    isPending={pendingSkinId === item.id}
                    onApply={() => saveNameMcAndApply.mutate(item)}
                  />
                ))}
              </div>
            </div>
          </div>

          <ActiveSkinPanel activeSkin={activeSkin} hasMicrosoftLicense={hasMicrosoftLicense} />
        </div>
      )}

      {/* TAB 3: SKIN MANUAL */}
      {activeTab === "manual" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <Card className="overflow-hidden p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-blue-300/20 bg-blue-500/15">
                  <Shirt className="h-5 w-5 text-[#60A5FA]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Skin manual</h2>
                  <p className="mt-1 text-sm text-[#94A3B8]">
                    Busque por nick do Minecraft ou importe um arquivo PNG local para equipar.
                  </p>
                </div>
              </div>

              <form
                className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                onSubmit={submitOfflineSearch}
              >
                <input
                  value={offlineNickname}
                  onChange={(event) => setOfflineNickname(event.target.value)}
                  className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                  placeholder="Digite um nick do Minecraft (ex: Notch, Jeb_)"
                  maxLength={16}
                />
                <Button
                  type="submit"
                  disabled={!offlineNickname.trim() || offlineSearch.isPending}
                >
                  {offlineSearch.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Buscar Nick
                </Button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => importSkin.mutate(false)}
                  disabled={importSkin.isPending}
                >
                  <Upload className="h-4 w-4" />
                  Importar arquivo PNG
                </Button>
                <Badge tone="slate">PNG 64x64 ou 64x32</Badge>
                <Badge tone="blue">Aplicação local</Badge>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Resultado da busca manual</h3>
              {offlineSearchResult ? (
                <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-white/10 bg-[#0D1117]/60">
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
                    className="mt-4 h-10 w-full max-w-xs rounded-xl border border-white/10 bg-[#161B22] px-3 text-sm text-white outline-none transition placeholder:text-[#94A3B8] focus:border-[#60A5FA]/70"
                    placeholder="Nome para salvar"
                    maxLength={40}
                  />
                  <Button
                    type="button"
                    className="mt-3 w-full max-w-xs"
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
                <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 bg-[#0D1117]/40 p-6 text-center">
                  <div>
                    <ImagePlus className="mx-auto h-10 w-10 text-[#60A5FA]" />
                    <p className="mt-3 text-sm font-semibold text-white">Nenhuma skin pesquisada</p>
                    <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
                      Digite um nick do Minecraft acima para visualizar e salvar, ou importe uma imagem PNG.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <ActiveSkinPanel activeSkin={activeSkin} hasMicrosoftLicense={hasMicrosoftLicense} />
        </div>
      )}
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
  <div className="rounded-2xl border border-white/10 bg-[#0D1117]/80 p-5 shadow-xl">
    <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-4 text-sm font-semibold text-white">
      <Shirt className="h-4 w-4 text-[#60A5FA]" />
      Skin Ativa no Launcher
    </div>
    {activeSkin ? (
      <div className="flex flex-col items-center text-center">
        <div className="grid h-48 w-36 place-items-center rounded-2xl border border-white/10 bg-black/40 p-2 shadow-inner">
          <SkinPreview
            src={activeSkin.imageDataUrl ?? activeSkin.previewUrl}
            name={activeSkin.name}
            className="h-44 w-32"
          />
        </div>
        <h3 className="mt-3 max-w-full truncate text-base font-semibold text-white">
          {activeSkin.name}
        </h3>
        <p className="mt-1 text-xs text-[#94A3B8]">
          {activeSkin.nickname ? `Nick: ${activeSkin.nickname}` : "Skin Customizada"}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Badge tone="green">Equipada</Badge>
          <Badge tone={hasMicrosoftLicense ? "green" : "slate"}>
            {hasMicrosoftLicense ? "Sincronizada no Original" : "Offline Local"}
          </Badge>
        </div>
      </div>
    ) : (
      <div className="grid min-h-64 place-items-center text-center">
        <div>
          <ImagePlus className="mx-auto h-10 w-10 text-[#60A5FA]" />
          <p className="mt-3 text-sm font-semibold text-white">Nenhuma skin ativa</p>
          <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
            Baixe pelo NameMC, busque por nick ou importe uma PNG customizada.
          </p>
        </div>
      </div>
    )}
  </div>
);

const NameMcProfileCard = ({
  profile,
  disabled,
  isPending,
  onApply,
}: {
  profile: SkinSearchResult;
  disabled: boolean;
  isPending?: boolean;
  onApply: () => void;
}) => (
  <div className="flex min-w-0 gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-3.5 transition hover:border-emerald-400/30">
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
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onApply}
          disabled={disabled || isPending}
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
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
  isPending,
  onApply,
}: {
  item: NameMCSkinLibraryItem;
  disabled: boolean;
  isPending?: boolean;
  onApply: () => void;
}) => (
  <div className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 transition hover:bg-white/[0.06] hover:border-white/20">
    <div className="grid h-20 w-16 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#0D1117]">
      <SkinPreview src={item.previewUrl} name={item.name} className="max-h-16 max-w-12" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
          <p className="mt-1 text-xs text-[#94A3B8]">
            {item.model === "slim" ? "Modelo Slim" : "Modelo Clássico"}
          </p>
        </div>
        {item.rank ? <Badge tone="slate">#{item.rank}</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onApply}
          disabled={disabled || isPending}
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
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
            {skin.equippedAt ? "Equipada" : "Equipar"}
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
          <p className="mt-2 text-xs text-emerald-200">Aplica no Minecraft original automaticamente.</p>
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
  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-md">
    {text}
  </div>
);
