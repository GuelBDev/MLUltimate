import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Download, Images, RefreshCw, Search } from "lucide-react";
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
  LoaderType,
} from "../types/launcher";

type ExplorePageProps = {
  initialType?: ContentType;
  initialInstanceId?: string;
};

const providerFilters: ContentProviderFilter[] = ["all", "modrinth", "curseforge"];
const types: ContentType[] = ["mod", "modpack", "resourcepack", "shader"];
const loaders: LoaderType[] = ["vanilla", "fabric", "forge", "neoforge", "quilt"];
const detailTabs = ["overview", "content", "changelog", "gallery", "versions", "comments"] as const;

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

export const ExplorePage = ({ initialType = "mod", initialInstanceId }: ExplorePageProps) => {
  const queryClient = useQueryClient();
  const { instances } = useInstances();
  const { versions } = useMinecraftVersions();
  const [provider, setProvider] = useState<ContentProviderFilter>("all");
  const [type, setType] = useState<ContentType>(initialType);
  const [query, setQuery] = useState("");
  const [loader, setLoader] = useState<LoaderType | "">("");
  const [version, setVersion] = useState("");
  const [instanceId, setInstanceId] = useState(initialInstanceId ?? "");
  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [selectedProject, setSelectedProject] = useState<ContentSearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof detailTabs)[number]>("overview");

  const releaseVersions = useMemo(
    () =>
      (versions.data ?? [])
        .filter((item) => item.type === "release")
        .slice(0, 80),
    [versions.data],
  );
  const selectedVersion = version;
  const selectedInstanceId = instanceId;
  const selectedInstance = useMemo(
    () => (instances.data ?? []).find((instance) => instance.id === selectedInstanceId),
    [instances.data, selectedInstanceId],
  );
  const effectiveVersion = selectedInstance?.minecraftVersion ?? selectedVersion;
  const effectiveLoader = selectedInstance?.loader ?? loader;

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
        minecraftVersion: effectiveVersion || undefined,
        loader: effectiveLoader || undefined,
      }),
  });

  const install = useMutation({
    mutationFn: (input: { project: ContentSearchResult | ContentProjectDetails; versionId?: string }) =>
      launcherApi.installContent({
        provider: input.project.provider,
        type: input.project.type,
        projectId: input.project.projectId,
        instanceId: selectedInstanceId,
        versionId: input.versionId,
      }),
    onSuccess: () => {
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
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(runSearch, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, type, query, effectiveVersion, effectiveLoader]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch();
  };

  const openProject = (project: ContentSearchResult) => {
    setSelectedProject(project);
    setActiveTab("overview");
    details.mutate(project);
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
        onInstall={(version) =>
          install.mutate({
            project: details.data ?? selectedProject,
            versionId: version?.id,
          })
        }
        canInstall={Boolean(selectedInstanceId)}
        installing={install.isPending}
        error={error}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Explorar conteudo</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Lista atualizada automaticamente pela instancia selecionada.
            </p>
          </div>
          <Badge tone="blue">{providerLabels[provider]}</Badge>
        </div>

        <form
          className="mt-5 grid grid-cols-[0.8fr_0.9fr_minmax(150px,1fr)_0.8fr_0.8fr_44px_44px] gap-3 max-[900px]:grid-cols-2"
          onSubmit={submit}
        >
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as ContentProviderFilter)}
            className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            {providerFilters.map((item) => (
              <option key={item} value={item}>
                {providerLabels[item]}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as ContentType)}
            className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            {types.map((item) => (
              <option key={item} value={item}>
                {typeLabels[item]}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
            placeholder="Pesquisar"
          />
          <select
            value={selectedVersion}
            onChange={(event) => setVersion(event.target.value)}
            className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
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
            onChange={(event) => setLoader(event.target.value as LoaderType | "")}
            className="h-11 min-w-0 rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            <option value="">Todos loaders</option>
            {loaders.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
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
        </form>

        <div className="mt-4">
          <select
            value={selectedInstanceId}
            onChange={(event) => setInstanceId(event.target.value)}
            className="h-11 w-full rounded-xl border border-white/10 bg-[#0D1117] px-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
          >
            <option value="">Add: N/A - pesquisar todas as versoes</option>
            {(instances.data ?? []).map((instance) => (
              <option key={instance.id} value={instance.id}>
                Add to: {instance.name} - {instance.minecraftVersion} - {instance.loader}
              </option>
            ))}
          </select>
          {selectedInstance ? (
            <p className="mt-2 text-xs text-[#94A3B8]">
              Filtro ativo: Minecraft {selectedInstance.minecraftVersion} - {selectedInstance.loader}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[#94A3B8]">
              Filtro ativo: Add: N/A - todas as versoes e loaders
            </p>
          )}
        </div>

        {provider !== "modrinth" ? (
          <p className="mt-3 text-xs leading-5 text-[#94A3B8]">
            CurseForge usa a Core API oficial e precisa de chave local para retornar resultados.
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
              className="flex w-full gap-4 text-left"
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
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Button
                  type="button"
                  disabled={!selectedInstanceId || install.isPending}
                  title={selectedInstanceId ? "Instalar" : "Escolha uma instancia em Add"}
                  onClick={(event) => {
                    event.stopPropagation();
                    install.mutate({ project });
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
    </div>
  );
};

type ProjectDetailsProps = {
  project?: ContentProjectDetails;
  fallback: ContentSearchResult;
  activeTab: (typeof detailTabs)[number];
  onTabChange: (tab: (typeof detailTabs)[number]) => void;
  onBack: () => void;
  onInstall: (version?: ContentVersion) => void;
  canInstall: boolean;
  installing: boolean;
  error: string | null;
};

const ProjectDetails = ({
  project,
  fallback,
  activeTab,
  onTabChange,
  onBack,
  onInstall,
  canInstall,
  installing,
  error,
}: ProjectDetailsProps) => {
  const current = project ?? fallback;
  const versions = project?.versions ?? [];
  const latestVersion = versions.at(0);

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
        <div className="flex gap-4">
          {current.iconUrl ? (
            <img src={current.iconUrl} alt="" className="h-24 w-24 object-cover" />
          ) : (
            <div className="h-24 w-24 bg-white/8" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="truncate text-xl font-semibold text-white">{current.title}</h2>
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
            onClick={() => onInstall(latestVersion)}
            disabled={installing || !canInstall}
            title={canInstall ? "Instalar" : "Volte e escolha uma instancia em Add"}
          >
            <Download className="h-4 w-4" />
            Instalar
          </Button>
        </div>
      </section>

      <div className="flex gap-5 border-b border-white/10">
        {detailTabs.map((tab) => (
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
        {activeTab === "overview" ? (
          <div className="prose prose-invert max-w-none text-sm leading-7 text-[#B8C2D0]">
            {(project?.body || current.description).split("\n").slice(0, 20).map((line, index) => (
              <p key={`${line}-${index}`}>{line || " "}</p>
            ))}
          </div>
        ) : null}

        {activeTab === "versions" ? (
          <div className="space-y-2">
            {versions.map((version) => (
              <VersionRow
                key={`${version.provider}-${version.id}`}
                version={version}
                onInstall={() => onInstall(version)}
                installing={installing || !canInstall}
              />
            ))}
            {versions.length === 0 ? <EmptyDetail text="Carregando versoes..." /> : null}
          </div>
        ) : null}

        {activeTab === "changelog" ? (
          <div className="space-y-4">
            {versions
              .filter((version) => version.changelog)
              .slice(0, 8)
              .map((version) => (
                <div key={version.id} className="border-b border-white/8 pb-4 last:border-b-0">
                  <p className="font-semibold text-white">{version.name}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#B8C2D0]">
                    {version.changelog}
                  </p>
                </div>
              ))}
            {!versions.some((version) => version.changelog) ? (
              <EmptyDetail text="Changelog indisponivel para este provedor ou arquivo." />
            ) : null}
          </div>
        ) : null}

        {activeTab === "gallery" ? (
          <div className="grid grid-cols-2 gap-4">
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
                <EmptyDetail text="Galeria nao disponivel para este projeto." icon />
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "comments" ? (
          <EmptyDetail text={project?.commentsNote ?? "Comentarios indisponiveis."} />
        ) : null}

        {activeTab === "content" ? (
          <div className="space-y-2">
            {versions.slice(0, 30).map((version) => (
              <div
                key={`content-${version.id}`}
                className="grid grid-cols-[1fr_120px_120px] gap-3 border-b border-white/8 px-2 py-3 text-sm last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{version.fileName}</p>
                  <p className="mt-1 truncate text-[#94A3B8]">{version.name}</p>
                </div>
                <span className="text-[#B8C2D0]">{version.gameVersions.at(0) ?? "-"}</span>
                <span className="text-[#B8C2D0]">{version.provider}</span>
              </div>
            ))}
            {versions.length === 0 ? (
              <EmptyDetail text={project?.contentNote ?? "Conteudo aparece depois de instalar na instancia."} />
            ) : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
};

const VersionRow = ({
  version,
  onInstall,
  installing,
}: {
  version: ContentVersion;
  onInstall: () => void;
  installing: boolean;
}) => (
  <div className="grid grid-cols-[1fr_130px_120px_120px] items-center gap-3 border-b border-white/8 px-2 py-3 text-sm last:border-b-0">
    <div className="min-w-0">
      <p className="truncate font-semibold text-white">{version.name}</p>
      <p className="mt-1 truncate text-[#94A3B8]">{version.fileName}</p>
    </div>
    <span className="text-[#B8C2D0]">{version.gameVersions.at(0) ?? "-"}</span>
    <span className="text-[#B8C2D0]">{version.loaders.join(", ") || version.provider}</span>
    <Button type="button" size="sm" disabled={installing} onClick={onInstall}>
      <Download className="h-4 w-4" />
      Baixar
    </Button>
  </div>
);

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
          Compativel: {compatible.join(", ")}
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
