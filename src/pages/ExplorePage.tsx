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
  LauncherInstance,
  LoaderType,
} from "../types/launcher";

type ExplorePageProps = {
  initialType?: ContentType;
  initialInstanceId?: string;
};

const providerFilters: ContentProviderFilter[] = ["all", "modrinth", "curseforge"];
const types: ContentType[] = ["mod", "modpack", "resourcepack", "shader"];
const loaders: LoaderType[] = ["vanilla", "fabric", "forge", "neoforge", "quilt"];
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
    setActiveTab("versions");
    details.mutate(project);
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
            <h2 className="text-lg font-semibold text-white">Explorar conteudo</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Pesquise livremente e escolha a instancia compativel na hora de instalar.
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

        <p className="mt-3 text-xs text-[#94A3B8]">
          Filtro ativo: {selectedVersion || "todas as versoes"} - {loader || "todos loaders"}
        </p>

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
                  disabled={install.isPending}
                  title="Escolher instancia"
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
  const versions = project?.versions ?? [];
  const latestVersion = versions.at(0);
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
            disabled={installing}
            title="Escolher instancia"
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
            {versions.map((version) => (
              <VersionRow
                key={`${version.provider}-${version.id}`}
                version={version}
                onInstall={() => onInstall(version)}
                installing={installing}
              />
            ))}
            {versions.length === 0 ? <EmptyDetail text="Carregando versoes..." /> : null}
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
              Escolher instancia
            </p>
            <h2 className="mt-2 truncate text-xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Instancias vanilla e incompatíveis aparecem bloqueadas para evitar arquivo quebrado.
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
                  {compatible ? "Compativel" : "Bloqueado"}
                </Badge>
              </div>
              <p className={`mt-3 text-sm ${compatible ? "text-[#B8C2D0]" : "text-[#94A3B8]"}`}>
                {reason}
              </p>
            </button>
          ))}

          {compatibilityRows.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#0D1117] p-6 text-center text-sm text-[#94A3B8]">
              Crie uma instancia Fabric, Forge, NeoForge ou Quilt na Biblioteca antes de instalar conteudo.
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-sm text-[#94A3B8]">
            {availableCount > 0
              ? `${availableCount} instancia${availableCount === 1 ? "" : "s"} disponivel${availableCount === 1 ? "" : "is"}.`
              : "Nenhuma instancia compativel encontrada."}
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
  if (instance.loader === "vanilla") {
    return { compatible: false, reason: "Instancia vanilla nao aceita instalacao automatica de mods, shaders ou modpacks." };
  }

  const gameVersions = version?.gameVersions ?? project.compatibleGameVersions ?? [];
  const versionCompatible =
    gameVersions.length === 0 ||
    gameVersions.some((gameVersion) => isMinecraftVersionCompatible(gameVersion, instance.minecraftVersion));

  if (!versionCompatible) {
    return {
      compatible: false,
      reason: `Incompativel com Minecraft ${instance.minecraftVersion}.`,
    };
  }

  const contentLoaders = version?.loaders ?? project.compatibleLoaders ?? [];
  const loaderCompatible =
    project.type === "resourcepack" ||
    contentLoaders.length === 0 ||
    contentLoaders.includes(instance.loader);

  if (!loaderCompatible) {
    return {
      compatible: false,
      reason: `Precisa de ${contentLoaders.join(", ")}; esta instancia usa ${instance.loader}.`,
    };
  }

  return {
    compatible: true,
    reason: `Pronto para instalar em ${instance.name}.`,
  };
};

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
