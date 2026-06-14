import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Download, Images, Package, Palette, RefreshCw, Search, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useInstances } from "../hooks/useInstances";
import { useMinecraftVersions } from "../hooks/useMinecraftVersions";
import { launcherApi } from "../services/launcherApi";
import type {
  ContentProjectDetails,
  ContentProviderFilter,
  ContentSearchInput,
  ContentSearchResult,
  ContentType,
  ContentVersion,
  LauncherInstance,
  LoaderType,
} from "../types/launcher";

type ExplorePageProps = {
  initialType?: ContentType;
  initialInstanceId?: string;
};

const providerFilters: ContentProviderFilter[] = ["all", "modrinth", "curseforge"];
const types: ContentType[] = ["mod", "modpack", "resourcepack", "shader"];
const loaders: LoaderType[] = ["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"];
const detailTabs = ["content", "gallery", "versions", "comments"] as const;
type DetailTab = (typeof detailTabs)[number];

type InstallTarget = {
  project: ContentSearchResult | ContentProjectDetails;
  version?: ContentVersion;
};

const typeLabels: Record<ContentType, string> = {
  mod: "Mods",
  modpack: "Modpacks",
  resourcepack: "Texturas",
  shader: "Shaders",
};

const providerLabels: Record<ContentProviderFilter, string> = {
  all: "Todos",
  modrinth: "Modrinth",
  curseforge: "CurseForge",
};

export const ExplorePage = ({ initialType = "mod" }: ExplorePageProps) => {
  const queryClient = useQueryClient();
  const { instances } = useInstances();
  const { versions } = useMinecraftVersions();
  const [provider, setProvider] = useState<ContentProviderFilter>("all");
  const [type, setType] = useState<ContentType>(initialType);
  const [query, setQuery] = useState("");
  const [loader, setLoader] = useState<LoaderType | "">("");
  const [version, setVersion] = useState("");
  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [selectedProject, setSelectedProject] = useState<ContentSearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("versions");
  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null);
  const [loadClicks, setLoadClicks] = useState(0);

  const releaseVersions = useMemo(
    () =>
      (versions.data ?? [])
        .filter((item) => item.type === "release")
        .slice(0, 80),
    [versions.data],
  );
  const selectedVersion = version;
  const effectiveVersion = selectedVersion;
  const effectiveLoader = loader;
  const resultLimit = loadClicks < 3 ? 20 + loadClicks * 20 : 60 + (loadClicks - 2) * 40;

  const search = useMutation({
    mutationFn: (input: ContentSearchInput) => launcherApi.searchContent(input),
    onSuccess: setResults,
  });

  const details = useMutation({
    mutationFn: (project: ContentSearchResult) =>
      launcherApi.getContentProject({
        provider: project.provider,
        type: project.type,
        projectId: project.projectId,
      }),
  });

  const install = useMutation({
    mutationFn: (input: {
      project: ContentSearchResult | ContentProjectDetails;
      instanceId: string;
      versionId?: string;
    }) =>
      launcherApi.installContent({
        provider: input.project.provider,
        type: input.project.type,
        projectId: input.project.projectId,
        instanceId: input.instanceId,
        versionId: input.versionId,
      }),
    onSuccess: () => {
      setInstallTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  const runSearch = () => {
    search.mutate({
      provider,
      type,
      query,
      minecraftVersion: effectiveVersion || undefined,
      loader: effectiveLoader || undefined,
      sort: "downloads",
      limit: resultLimit,
      offset: 0,
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(runSearch, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, type, query, effectiveVersion, effectiveLoader, resultLimit]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch();
  };

  const openProject = (project: ContentSearchResult) => {
    setSelectedProject(project);
    setActiveTab("versions");
    details.mutate(project);
  };

  const updateSearchShape = (next: () => void) => {
    setLoadClicks(0);
    next();
  };

  const requestInstall = (project: ContentSearchResult | ContentProjectDetails, selectedContentVersion?: ContentVersion) => {
    setInstallTarget({ project, version: selectedContentVersion });
  };

  const error =
    search.error instanceof Error
      ? search.error.message
      : details.error instanceof Error
        ? details.error.message
        : install.error instanceof Error
          ? install.error.message
          : null;

  if (selectedProject) {
    return (
      <ProjectDetails
        project={details.data}
        fallback={selectedProject}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={() => setSelectedProject(null)}
        onInstall={(version) => requestInstall(details.data ?? selectedProject, version)}
        installing={install.isPending}
        error={error}
        instances={instances.data ?? []}
        installTarget={installTarget}
        onCloseInstall={() => setInstallTarget(null)}
        onConfirmInstall={(instanceId) =>
          install.mutate({
            project: installTarget?.project ?? details.data ?? selectedProject,
            instanceId,
            versionId: installTarget?.version?.id,
          })
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Explorar conteúdo</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Pesquise livremente e escolha a instância compatível na hora de instalar.
            </p>
          </div>
          <Badge tone="blue">{providerLabels[provider]}</Badge>
        </div>

        <form className="mt-5 flex flex-wrap items-center gap-3" onSubmit={submit}>
          <select
            value={provider}
            onChange={(event) =>
              updateSearchShape(() => setProvider(event.target.value as ContentProviderFilter))
            }
            className="h-11 min-w-0 flex-1 basis-[120px] rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            {providerFilters.map((item) => (
              <option key={item} value={item}>
                {providerLabels[item]}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) =>
              updateSearchShape(() => setType(event.target.value as ContentType))
            }
            className="h-11 min-w-0 flex-1 basis-[130px] rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            {types.map((item) => (
              <option key={item} value={item}>
                {typeLabels[item]}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => updateSearchShape(() => setQuery(event.target.value))}
            className="h-11 min-w-0 flex-[1.6] basis-[180px] rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
            placeholder="Pesquisar"
          />
          <select
            value={selectedVersion}
            onChange={(event) => updateSearchShape(() => setVersion(event.target.value))}
            className="h-11 min-w-0 flex-1 basis-[140px] rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            <option value="">Todas versoes</option>
            {releaseVersions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))}
          </select>
          <select
            value={loader}
            onChange={(event) =>
              updateSearchShape(() => setLoader(event.target.value as LoaderType | ""))
            }
            className="h-11 min-w-0 flex-1 basis-[140px] rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            <option value="">Todos loaders</option>
            {loaders.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex shrink-0 gap-2">
            <Button type="submit" size="icon" title="Buscar" disabled={search.isPending}>
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              title="Atualizar lista"
              onClick={runSearch}
              disabled={search.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${search.isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </form>

        <p className="mt-3 text-xs text-[#94A3B8]">
          Filtro ativo: {selectedVersion || "todas as versoes"} - {loader || "todos loaders"}
        </p>

        {provider !== "modrinth" ? (
          <p className="mt-3 text-xs leading-5 text-[#94A3B8]">
            CurseForge usa a API central segura do MLUltimate; nenhuma chave precisa ser colocada pelo usuário.
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
      </Card>

      <section className="grid gap-4">
        {results.map((project) => (
          <Card
            key={`${project.provider}-${project.projectId}`}
            className="p-4 transition hover:border-[#60A5FA]/35 hover:bg-white/7"
          >
            <button
              type="button"
              className="flex w-full min-w-0 flex-col gap-4 text-left sm:flex-row"
              onClick={() => openProject(project)}
            >
              {project.iconUrl ? (
                <img
                  src={project.iconUrl}
                  alt=""
                  className="h-16 w-16 rounded-xl border border-white/10 object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl border border-white/10 bg-white/5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-white">{project.title}</h3>
                  <Badge tone="slate">{typeLabels[project.type]}</Badge>
                </div>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {project.author ? `${project.author} | ` : ""}
                  {project.downloads?.toLocaleString("pt-BR") ?? "downloads indisponiveis"} downloads
                </p>
                <CompatibilityMeta project={project} />
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#94A3B8]">
                  {project.description}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <Button
                  type="button"
                  disabled={install.isPending}
                  title="Escolher instância"
                  onClick={(event) => {
                    event.stopPropagation();
                    requestInstall(project);
                  }}
                >
                  <Download className="h-4 w-4" />
                  Instalar
                </Button>
                <div className="flex gap-1">
                  {(project.providers ?? [project.provider]).map((item) => (
                    <Badge key={item} tone={item === "modrinth" ? "green" : "blue"}>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </button>
          </Card>
        ))}
      </section>

      {results.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-white">Nenhum resultado carregado</p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            A lista atualiza sozinha; use o refresh se quiser forcar uma nova consulta.
          </p>
        </Card>
      ) : null}

      {results.length > 0 ? (
        <div className="flex justify-center pb-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setLoadClicks((value) => value + 1)}
            disabled={search.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${search.isPending ? "animate-spin" : ""}`} />
            Carregar Mais
          </Button>
        </div>
      ) : null}

      <InstallInstanceDialog
        target={installTarget}
        instances={instances.data ?? []}
        installing={install.isPending}
        onClose={() => setInstallTarget(null)}
        onInstall={(instanceId) =>
          installTarget
            ? install.mutate({
                project: installTarget.project,
                instanceId,
                versionId: installTarget.version?.id,
              })
            : undefined
        }
      />
    </div>
  );
};

type ProjectDetailsProps = {
  project?: ContentProjectDetails;
  fallback: ContentSearchResult;
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onBack: () => void;
  onInstall: (version?: ContentVersion) => void;
  installing: boolean;
  error: string | null;
  instances: LauncherInstance[];
  installTarget: InstallTarget | null;
  onCloseInstall: () => void;
  onConfirmInstall: (instanceId: string) => void;
};

const ProjectDetails = ({
  project,
  fallback,
  activeTab,
  onTabChange,
  onBack,
  onInstall,
  installing,
  error,
  instances,
  installTarget,
  onCloseInstall,
  onConfirmInstall,
}: ProjectDetailsProps) => {
  const current = project ?? fallback;
  const versions = useMemo(() => project?.versions ?? [], [project?.versions]);
  const [versionQuery, setVersionQuery] = useState("");
  const latestVersion = versions.at(0);
  const filteredVersions = useMemo(() => {
    const normalized = versionQuery.trim().toLowerCase();

    if (!normalized) {
      return versions;
    }

    return versions.filter((version) =>
      [
        version.name,
        version.fileName,
        version.provider,
        ...version.gameVersions,
        ...version.loaders,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [versionQuery, versions]);
  const visibleTabs = useMemo(
    () => detailTabs.filter((tab) => tab !== "content" || current.type === "modpack"),
    [current.type],
  );

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      onTabChange("versions");
    }
  }, [activeTab, onTabChange, visibleTabs]);

  return (
    <div className="space-y-5">
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-[#94A3B8] transition hover:text-white"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <section className="rounded-sm bg-[#1f1f1f] p-4">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
          {current.iconUrl ? (
            <img src={current.iconUrl} alt="" className="h-24 w-24 object-cover" />
          ) : (
            <div className="h-24 w-24 bg-white/8" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h2 className="min-w-0 break-words text-xl font-semibold text-white">{current.title}</h2>
              <Badge tone="slate">{typeLabels[current.type]}</Badge>
            </div>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {current.author ? `by ${current.author} | ` : ""}
              {current.downloads?.toLocaleString("pt-BR") ?? "downloads indisponiveis"} downloads
            </p>
            <CompatibilityMeta project={current} />
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#B8C2D0]">
              {current.description}
            </p>
            <div className="mt-3 flex gap-2">
              {(current.providers ?? [current.provider]).map((item) => (
                <Badge key={item} tone={item === "modrinth" ? "green" : "blue"}>
                  {item}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            type="button"
            className="shrink-0"
            onClick={() => onInstall(latestVersion)}
            disabled={installing}
            title="Escolher instância"
          >
            <Download className="h-4 w-4" />
            Instalar
          </Button>
        </div>
      </section>

      <div className="flex gap-5 border-b border-white/10">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`border-b-2 px-1 pb-3 text-sm capitalize ${
              activeTab === tab
                ? "border-[#f05a28] text-white"
                : "border-transparent text-[#94A3B8] hover:text-white"
            }`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-sm border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <Card className="rounded-sm border-white/10 bg-[#1f1f1f] p-5">
        {activeTab === "versions" ? (
          <div className="space-y-2">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={versionQuery}
                  onChange={(event) => setVersionQuery(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0D1117] pl-9 pr-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
                  placeholder="Pesquisar versÃ£o, loader ou arquivo"
                />
              </div>
              <Badge tone="slate">{filteredVersions.length} versÃµes</Badge>
            </div>
            {filteredVersions.map((version) => (
              <VersionRow
                key={`${version.provider}-${version.id}`}
                type={current.type}
                version={version}
                onInstall={() => onInstall(version)}
                installing={installing}
              />
            ))}
            {versions.length === 0 ? <EmptyDetail text="Carregando versoes..." /> : null}
            {versions.length > 0 && filteredVersions.length === 0 ? (
              <EmptyDetail text="Nenhuma versÃ£o encontrada para esta busca." />
            ) : null}
          </div>
        ) : null}

        {activeTab === "gallery" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(project?.gallery ?? []).map((image) => (
              <figure key={image.url} className="overflow-hidden rounded-sm bg-black/20">
                <img src={image.url} alt="" className="h-52 w-full object-cover" />
                {image.title ? (
                  <figcaption className="px-3 py-2 text-sm text-[#B8C2D0]">{image.title}</figcaption>
                ) : null}
              </figure>
            ))}
            {(project?.gallery ?? []).length === 0 ? (
              <div className="col-span-2">
                <EmptyDetail text="Galeria não disponível para este projeto." icon />
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "comments" ? (
          <EmptyDetail text={project?.commentsNote ?? "Comentários indisponíveis."} />
        ) : null}

        {activeTab === "content" ? (
          <div className="space-y-2">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={versionQuery}
                  onChange={(event) => setVersionQuery(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0D1117] pl-9 pr-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
                  placeholder="Pesquisar conteúdo do projeto"
                />
              </div>
              <Badge tone="slate">{filteredVersions.length} arquivos</Badge>
            </div>
            {filteredVersions.slice(0, 60).map((version) => (
              <div
                key={`content-${version.id}`}
                className="grid grid-cols-1 gap-3 border-b border-white/8 px-2 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_120px_120px]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ContentTypeIcon type={current.type} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{version.fileName}</p>
                    <p className="mt-1 truncate text-[#94A3B8]">{version.name}</p>
                  </div>
                </div>
                <span className="text-[#B8C2D0]">{version.gameVersions.at(0) ?? "-"}</span>
                <span className="text-[#B8C2D0]">{version.provider}</span>
              </div>
            ))}
            {versions.length === 0 ? (
              <EmptyDetail text={project?.contentNote ?? "Conteúdo aparece depois de instalar na instância."} />
            ) : null}
            {versions.length > 0 && filteredVersions.length === 0 ? (
              <EmptyDetail text="Nenhum arquivo encontrado para esta busca." />
            ) : null}
          </div>
        ) : null}
      </Card>

      <InstallInstanceDialog
        target={installTarget}
        instances={instances}
        installing={installing}
        onClose={onCloseInstall}
        onInstall={onConfirmInstall}
      />
    </div>
  );
};

const VersionRow = ({
  type,
  version,
  onInstall,
  installing,
}: {
  type: ContentType;
  version: ContentVersion;
  onInstall: () => void;
  installing: boolean;
}) => (
  <div className="grid grid-cols-1 items-center gap-3 border-b border-white/8 px-2 py-3 text-sm last:border-b-0 md:grid-cols-[1fr_130px_120px_120px]">
    <div className="flex min-w-0 items-center gap-3">
      <ContentTypeIcon type={type} />
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">{version.name}</p>
        <p className="mt-1 truncate text-[#94A3B8]">{version.fileName}</p>
      </div>
    </div>
    <span className="text-[#B8C2D0]">{version.gameVersions.at(0) ?? "-"}</span>
    <span className="text-[#B8C2D0]">{version.loaders.join(", ") || version.provider}</span>
    <Button type="button" size="sm" disabled={installing} onClick={onInstall}>
      <Download className="h-4 w-4" />
      Baixar
    </Button>
  </div>
);

const InstallInstanceDialog = ({
  target,
  instances,
  installing,
  onClose,
  onInstall,
}: {
  target: InstallTarget | null;
  instances: LauncherInstance[];
  installing: boolean;
  onClose: () => void;
  onInstall: (instanceId: string) => void;
}) => {
  const compatibilityRows = useMemo(
    () =>
      target
        ? instances.map((instance) => ({
            instance,
            ...getInstallCompatibility(target.project, target.version, instance),
          }))
        : [],
    [instances, target],
  );

  if (!target) {
    return null;
  }

  const availableCount = compatibilityRows.filter((row) => row.compatible).length;
  const title = target.version ? `${target.project.title} - ${target.version.name}` : target.project.title;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/12 bg-[#161B22] p-5 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">
              Escolher instância
            </p>
            <h2 className="mt-2 truncate text-xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Texturas funcionam em vanilla; mods, shaders e modpacks exigem loader ou motor gráfico compatível.
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} disabled={installing}>
            Fechar
          </Button>
        </div>

        <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {compatibilityRows.map(({ instance, compatible, reason }) => (
            <button
              key={instance.id}
              type="button"
              disabled={!compatible || installing}
              onClick={() => onInstall(instance.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                compatible
                  ? "border-[#3B82F6]/40 bg-[#0D1117] hover:border-[#60A5FA] hover:bg-[#132033]"
                  : "cursor-not-allowed border-white/8 bg-white/[0.04] opacity-55"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{instance.name}</p>
                  <p className="mt-1 text-sm text-[#94A3B8]">
                    Minecraft {instance.minecraftVersion} - {instance.loader}
                  </p>
                </div>
                <Badge tone={compatible ? "green" : "slate"}>
                  {compatible ? "Compatível" : "Bloqueado"}
                </Badge>
              </div>
              <p className={`mt-3 text-sm ${compatible ? "text-[#B8C2D0]" : "text-[#94A3B8]"}`}>
                {reason}
              </p>
            </button>
          ))}

          {compatibilityRows.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6 text-center text-sm text-[#94A3B8]">
              Crie uma instância em Meus Modpacks antes de instalar conteúdo.
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-sm text-[#94A3B8]">
            {availableCount > 0
              ? `${availableCount} instância${availableCount === 1 ? "" : "s"} disponível${availableCount === 1 ? "" : "is"}.`
              : "Nenhuma instância compatível encontrada."}
          </p>
          <Button type="button" variant="secondary" onClick={onClose} disabled={installing}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};

const getInstallCompatibility = (
  project: ContentSearchResult | ContentProjectDetails,
  version: ContentVersion | undefined,
  instance: LauncherInstance,
) => {
  if (project.type === "resourcepack") {
    return { compatible: true, reason: `Textura pronta para instalar em ${instance.name}.` };
  }

  if (project.type === "shader" && !["iris", "iris-sodium"].includes(instance.loader)) {
    return {
      compatible: false,
      reason:
        instance.loader === "vanilla"
          ? "Shaders precisam de Iris, Iris + Sodium ou outro motor gráfico. Vanilla aceita apenas texturas."
          : `Esta instância usa ${instance.loader}; crie uma instância Iris ou Iris + Sodium para shaders.`,
    };
  }

  if (instance.loader === "vanilla") {
    return {
      compatible: false,
      reason:
        project.type === "modpack"
          ? "Modpacks precisam de uma instância com loader compatível."
          : "Mods precisam de Fabric, Forge, NeoForge, Quilt, Iris ou Iris + Sodium. Vanilla aceita apenas texturas.",
    };
  }

  const gameVersions = version?.gameVersions ?? project.compatibleGameVersions ?? [];
  const versionCompatible =
    gameVersions.length === 0 ||
    gameVersions.some((gameVersion) => isMinecraftVersionCompatible(gameVersion, instance.minecraftVersion));

  if (!versionCompatible) {
    return {
      compatible: false,
      reason: `Incompatível com Minecraft ${instance.minecraftVersion}.`,
    };
  }

  const contentLoaders = version?.loaders ?? project.compatibleLoaders ?? [];
  const instanceContentLoader = normalizeContentLoader(instance.loader);
  const loaderCompatible =
    project.type === "shader" ||
    contentLoaders.length === 0 ||
    contentLoaders.includes(instanceContentLoader);

  if (!loaderCompatible) {
    return {
      compatible: false,
      reason: `Precisa de ${contentLoaders.join(", ")}; esta instância usa ${instance.loader}.`,
    };
  }

  return {
    compatible: true,
    reason: `Pronto para instalar em ${instance.name}.`,
  };
};

const normalizeContentLoader = (loader: LoaderType): LoaderType =>
  loader === "iris" || loader === "iris-sodium" ? "fabric" : loader;

const isMinecraftVersionCompatible = (supported: string, instanceVersion: string) => {
  if (supported === instanceVersion) {
    return true;
  }

  if (supported.endsWith(".x")) {
    return instanceVersion.startsWith(supported.slice(0, -1));
  }

  return false;
};

const CompatibilityMeta = ({ project }: { project: ContentSearchResult | ContentProjectDetails }) => {
  const compatible = project.compatibleGameVersions?.slice(0, 4) ?? [];
  const loaders = project.compatibleLoaders?.slice(0, 4) ?? [];

  if (!project.latestGameVersion && compatible.length === 0 && loaders.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[#94A3B8]">
      {project.latestGameVersion ? (
        <span className="rounded-sm border border-white/10 bg-white/6 px-2 py-1">
          Atual: {project.latestGameVersion}
        </span>
      ) : null}
      {compatible.length > 0 ? (
        <span className="rounded-sm border border-white/10 bg-white/6 px-2 py-1">
          Compatível: {compatible.join(", ")}
        </span>
      ) : null}
      {loaders.length > 0 ? (
        <span className="rounded-sm border border-white/10 bg-white/6 px-2 py-1">
          {loaders.join(", ")}
        </span>
      ) : null}
    </div>
  );
};

const EmptyDetail = ({ text, icon = false }: { text: string; icon?: boolean }) => (
  <div className="py-10 text-center text-sm text-[#94A3B8]">
    {icon ? <Images className="mx-auto mb-3 h-6 w-6" /> : null}
    {text}
  </div>
);

const ContentTypeIcon = ({ type }: { type: ContentType }) => {
  const Icon =
    type === "resourcepack" ? Palette : type === "shader" ? Sparkles : Package;

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/6 text-[#60A5FA]">
      <Icon className="h-4 w-4" />
    </span>
  );
};
