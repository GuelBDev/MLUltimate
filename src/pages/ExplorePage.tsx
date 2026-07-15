import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Download, Images, Package, Palette, RefreshCw, Search, Sparkles } from "lucide-react";
import { SiCurseforge, SiModrinth } from "react-icons/si";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useInstances } from "../hooks/useInstances";
import { useInstalledContent } from "../hooks/useInstalledContent";
import { useMinecraftVersions } from "../hooks/useMinecraftVersions";
import { launcherApi } from "../services/launcherApi";
import type {
  ContentProjectDetails,
  ContentProvider,
  ContentProviderFilter,
  ContentSearchInput,
  ContentSearchResult,
  ContentType,
  ContentVersion,
  InstalledContent,
  InstalledContentUpdateInfo,
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
const detailTabs = ["overview", "content", "changelog", "gallery", "versions"] as const;
type DetailTab = (typeof detailTabs)[number];
const detailTabLabels: Record<DetailTab, string> = {
  overview: "Overview",
  content: "Conteúdo",
  changelog: "Changelog",
  gallery: "Galeria",
  versions: "Versões",
};

type InstallTarget = {
  project: ContentSearchResult | ContentProjectDetails;
  version?: ContentVersion;
};

type InstallDisplayStatus = "available" | "installed" | "downloaded" | "update";

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
  const [results, setResults] = useState<ContentSearchResult[]>([]);
  const [selectedProject, setSelectedProject] = useState<ContentSearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [installTarget, setInstallTarget] = useState<InstallTarget | null>(null);
  const [providerInstallTarget, setProviderInstallTarget] = useState<InstallTarget | null>(null);
  const [loadClicks, setLoadClicks] = useState(0);
  const [activeOperations, setActiveOperations] = useState<string[]>([]);
  const [operationError, setOperationError] = useState<string | null>(null);

  const releaseVersions = useMemo(
    () =>
      (versions.data ?? [])
        .filter((item) => item.type === "release")
        .slice(0, 80),
    [versions.data],
  );
  const selectedVersion = version;
  const targetInstance = useMemo(
    () =>
      initialInstanceId
        ? instances.data?.find((instance) => instance.id === initialInstanceId)
        : undefined,
    [initialInstanceId, instances.data],
  );
  const effectiveVersion = targetInstance?.minecraftVersion ?? selectedVersion;
  const effectiveLoader = targetInstance
    ? normalizeContentLoader(targetInstance.loader)
    : loader;
  const resultLimit = loadClicks < 3 ? 20 + loadClicks * 20 : 60 + (loadClicks - 2) * 40;
  const installedContent = useInstalledContent(initialInstanceId);
  const installedUpdates = useQuery({
    queryKey: ["installed-content-updates", initialInstanceId],
    queryFn: () => launcherApi.checkInstalledContentUpdates(initialInstanceId ?? ""),
    enabled: Boolean(initialInstanceId),
    staleTime: 60_000,
  });
  const updateMap = useMemo(
    () => new Map((installedUpdates.data ?? []).map((item) => [item.id, item])),
    [installedUpdates.data],
  );
  const visibleResults = useMemo(
    () => {
      if (initialInstanceId && !targetInstance) {
        return [];
      }

      return targetInstance
        ? results.filter((project) =>
            getInstallCompatibility(project, undefined, targetInstance).compatible,
          )
        : results;
    },
    [initialInstanceId, results, targetInstance],
  );

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
        minecraftVersion: targetInstance?.minecraftVersion,
        loader: targetInstance ? normalizeContentLoader(targetInstance.loader) : undefined,
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
      setProviderInstallTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  const installAsInstance = useMutation({
    mutationFn: (input: {
      project: ContentSearchResult | ContentProjectDetails;
      versionId?: string;
    }) =>
      launcherApi.installContentAsInstance({
        provider: input.project.provider,
        type: input.project.type as "mod" | "modpack",
        projectId: input.project.projectId,
        versionId: input.versionId,
      }),
    onSuccess: () => {
      setInstallTarget(null);
      setProviderInstallTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
      void queryClient.invalidateQueries({ queryKey: ["minecraft", "versions"] });
    },
  });

  const updateInstalled = useMutation({
    mutationFn: launcherApi.updateInstalledContent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["installed-content", initialInstanceId] });
      void queryClient.invalidateQueries({ queryKey: ["installed-content-updates", initialInstanceId] });
      void queryClient.invalidateQueries({ queryKey: ["instance-inspection", initialInstanceId] });
      void queryClient.invalidateQueries({ queryKey: ["instances"] });
      void queryClient.invalidateQueries({ queryKey: ["downloads"] });
    },
  });

  const addOperation = (key: string) => {
    setActiveOperations((items) => (items.includes(key) ? items : [...items, key]));
  };

  const removeOperation = (key: string) => {
    setActiveOperations((items) => items.filter((item) => item !== key));
  };

  const runOperation = async (key: string, operation: () => Promise<unknown>) => {
    setOperationError(null);
    addOperation(key);

    try {
      await operation();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.");
    } finally {
      removeOperation(key);
    }
  };

  const refreshInstallState = () => {
    void queryClient.invalidateQueries({ queryKey: ["installed-content", initialInstanceId] });
    void queryClient.invalidateQueries({ queryKey: ["installed-content-updates", initialInstanceId] });
    void queryClient.invalidateQueries({ queryKey: ["instance-inspection", initialInstanceId] });
    void queryClient.invalidateQueries({ queryKey: ["instances"] });
    void queryClient.invalidateQueries({ queryKey: ["downloads"] });
  };

  const startInstallToInstance = (
    target: InstallTarget,
    instanceId: string,
    selectedProviderProject = target.project,
  ) => {
    const key = operationKey(selectedProviderProject, target.version?.id, instanceId);

    void runOperation(key, async () => {
      await install.mutateAsync({
        project: selectedProviderProject,
        instanceId,
        versionId: target.version?.id,
      });
      setInstallTarget(null);
      setProviderInstallTarget(null);
      refreshInstallState();
    });
  };

  const startInstallAsInstance = (
    target: InstallTarget,
    selectedProviderProject = target.project,
  ) => {
    const key = operationKey(selectedProviderProject, target.version?.id, "new-instance");

    void runOperation(key, async () => {
      await installAsInstance.mutateAsync({
        project: selectedProviderProject,
        versionId: target.version?.id,
      });
      setProviderInstallTarget(null);
      refreshInstallState();
    });
  };

  const startUpdateInstalled = (item: InstalledContent) => {
    const key = `update:${item.id}`;

    void runOperation(key, async () => {
      await updateInstalled.mutateAsync(item.id);
      refreshInstallState();
    });
  };

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
    setActiveTab("overview");
    details.mutate(project);
  };

  const updateSearchShape = (next: () => void) => {
    setLoadClicks(0);
    next();
  };

  const continueInstall = (target: InstallTarget, selectedProvider: ContentProvider) => {
    const project = selectProviderProject(target.project, selectedProvider);
    const selectedContentVersion =
      target.version?.provider === selectedProvider ? target.version : undefined;

    if (project.type === "modpack") {
      startInstallAsInstance({ project, version: selectedContentVersion }, project);
      return;
    }

    if (initialInstanceId) {
      startInstallToInstance({ project, version: selectedContentVersion }, initialInstanceId, project);
      return;
    }

    setInstallTarget({ project, version: selectedContentVersion });
  };

  const requestInstall = (
    project: ContentSearchResult | ContentProjectDetails,
    selectedContentVersion?: ContentVersion,
  ) => {
    const target = { project, version: selectedContentVersion };
    const availableProviders = getProjectProviders(project);

    if (availableProviders.length > 1) {
      setProviderInstallTarget(target);
      return;
    }

    continueInstall(target, availableProviders[0] ?? project.provider);
  };

  const chooseProvider = (selectedProvider: ContentProvider) => {
    if (!providerInstallTarget) {
      return;
    }

    const target = providerInstallTarget;
    setProviderInstallTarget(null);
    continueInstall(target, selectedProvider);
  };

  const error =
    operationError ??
    (search.error instanceof Error
      ? search.error.message
      : details.error instanceof Error
        ? details.error.message
        : install.error instanceof Error
          ? install.error.message
          : installAsInstance.error instanceof Error
            ? installAsInstance.error.message
            : updateInstalled.error instanceof Error
              ? updateInstalled.error.message
              : null);

  if (selectedProject) {
    const installableProject = details.data
      ? mergeProjectProviderMetadata(details.data, selectedProject)
      : selectedProject;

    return (
      <>
        <ProjectDetails
          project={details.data}
          fallback={selectedProject}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={() => setSelectedProject(null)}
          onInstall={(version) => requestInstall(installableProject, version)}
          installing={false}
          error={error}
          instances={instances.data ?? []}
          targetInstance={targetInstance}
          installedContent={installedContent.data ?? []}
          installedInstances={instances.data ?? []}
          updateMap={updateMap}
          activeOperations={activeOperations}
          onUpdateInstalled={startUpdateInstalled}
          installTarget={installTarget}
          onCloseInstall={() => setInstallTarget(null)}
          onConfirmInstall={(instanceId) =>
            installTarget
              ? startInstallToInstance(installTarget, instanceId)
              : startInstallToInstance(
                  { project: details.data ?? selectedProject },
                  instanceId,
                )
          }
        />
        <ProviderChoiceDialog
          target={providerInstallTarget}
          installing={false}
          onClose={() => setProviderInstallTarget(null)}
          onSelect={chooseProvider}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Biblioteca de conteúdo</h2>
            <p className="mt-1 text-sm text-[#94A3B8]">
              {targetInstance
                ? `Adicionando conteudo em ${targetInstance.name}. So aparecem itens compativeis com esta instancia.`
                : "Pesquise livremente e escolha a instancia compativel na hora de instalar."}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {targetInstance ? (
              <Badge tone="green">
                {targetInstance.minecraftVersion} - {targetInstance.loader}
              </Badge>
            ) : null}
            <Badge tone="blue">{providerLabels[provider]}</Badge>
          </div>
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
            disabled={Boolean(targetInstance)}
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
            disabled={Boolean(targetInstance)}
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
          Filtro ativo: {effectiveVersion || "todas as versoes"} - {effectiveLoader || "todos loaders"}
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
        {visibleResults.map((project) => {
          const installState = getProjectInstallState(
            project,
            installedContent.data ?? [],
            updateMap,
            undefined,
            instances.data ?? [],
          );
          const busy = isProjectOperationActive(project, activeOperations);
          const blocked = installState.status === "installed" || installState.status === "downloaded";

          return (
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
                  {installState.status === "installed" || installState.status === "downloaded" ? (
                    <Badge tone="green">
                      {installState.status === "downloaded" ? "Ja baixado" : "Ja instalado"}
                    </Badge>
                  ) : installState.status === "update" ? (
                    <Badge tone="blue">Atualizacao</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[#94A3B8]">
                  {project.author ? `${project.author} | ` : ""}
                  {project.downloads?.toLocaleString(document.documentElement.lang) ??
                    "downloads indisponiveis"}{" "}
                  downloads
                </p>
                <CompatibilityMeta project={project} />
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#94A3B8]">
                  {project.description}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <Button
                  type="button"
                  disabled={busy || blocked}
                  title={project.type === "modpack" ? "Criar instancia" : "Escolher instancia"}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (installState.status === "update" && installState.installed) {
                      startUpdateInstalled(installState.installed);
                      return;
                    }

                    requestInstall(project);
                  }}
                >
                  {busy ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : installState.status === "installed" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {projectActionLabel(project, installState.status, busy, Boolean(targetInstance))}
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
          );
        })}
      </section>

      {visibleResults.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-base font-semibold text-white">
            {targetInstance ? "Nenhum conteudo compativel encontrado" : "Nenhum resultado carregado"}
          </p>
          <p className="mt-2 text-sm text-[#94A3B8]">
            {targetInstance
              ? "A busca esta filtrando pela versao e loader desta instancia."
              : "A lista atualiza sozinha; use o refresh se quiser forcar uma nova consulta."}
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
        installing={false}
        onClose={() => setInstallTarget(null)}
        onInstall={(instanceId) =>
          installTarget
            ? startInstallToInstance(installTarget, instanceId)
            : undefined
        }
      />
      <ProviderChoiceDialog
        target={providerInstallTarget}
        installing={false}
        onClose={() => setProviderInstallTarget(null)}
        onSelect={chooseProvider}
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
  targetInstance?: LauncherInstance;
  installedContent: InstalledContent[];
  installedInstances: LauncherInstance[];
  updateMap: Map<string, InstalledContentUpdateInfo>;
  activeOperations: string[];
  onUpdateInstalled: (item: InstalledContent) => void;
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
  targetInstance,
  installedContent,
  installedInstances,
  updateMap,
  activeOperations,
  onUpdateInstalled,
  installTarget,
  onCloseInstall,
  onConfirmInstall,
}: ProjectDetailsProps) => {
  const current = project ? mergeProjectProviderMetadata(project, fallback) : fallback;
  const versions = useMemo(() => project?.versions ?? [], [project?.versions]);
  const [versionQuery, setVersionQuery] = useState("");
  const latestVersion = versions.at(0);
  const filteredVersions = useMemo(() => {
    const normalized = versionQuery.trim().toLowerCase();
    const compatibleVersions = targetInstance
      ? versions.filter((version) =>
          getInstallCompatibility(current, version, targetInstance).compatible,
        )
      : versions;

    if (!normalized) {
      return compatibleVersions;
    }

    return compatibleVersions.filter((version) =>
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
  }, [current, targetInstance, versionQuery, versions]);
  const visibleTabs = useMemo(
    () => detailTabs.filter((tab) => tab !== "content" || current.type === "modpack"),
    [current.type],
  );
  const projectInstallState = getProjectInstallState(
    current,
    installedContent,
    updateMap,
    undefined,
    installedInstances,
  );
  const projectBusy = isProjectOperationActive(current, activeOperations);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      onTabChange("overview");
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
              {current.downloads?.toLocaleString(document.documentElement.lang) ??
                "downloads indisponiveis"}{" "}
              downloads
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
            onClick={() => {
              if (projectInstallState.status === "update" && projectInstallState.installed) {
                onUpdateInstalled(projectInstallState.installed);
                return;
              }

              onInstall(latestVersion);
            }}
            disabled={
              installing ||
              projectBusy ||
              projectInstallState.status === "installed"
            }
            title="Escolher instância"
          >
            {projectBusy ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : projectInstallState.status === "installed" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : projectInstallState.status === "downloaded" ? (
              <Download className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {projectActionLabel(current, projectInstallState.status, projectBusy, Boolean(targetInstance))}
          </Button>
        </div>
      </section>

      <div className="flex gap-5 border-b border-white/10">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`border-b-2 px-1 pb-3 text-sm ${
              activeTab === tab
                ? "border-[#3B82F6] text-white"
                : "border-transparent text-[#94A3B8] hover:text-white"
            }`}
            onClick={() => onTabChange(tab)}
          >
            {detailTabLabels[tab]}
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
          <div className="space-y-5">
            {(project?.categories ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {project?.categories?.map((category) => (
                  <Badge key={category} tone="slate">
                    {category}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="whitespace-pre-wrap text-sm leading-7 text-[#D8DEE9]">
              {project?.body ?? current.description}
            </div>
            {project?.gallery[0] ? (
              <img
                src={project.gallery[0].url}
                alt=""
                className="max-h-[520px] w-full rounded-sm object-cover"
              />
            ) : null}
          </div>
        ) : null}

        {activeTab === "versions" ? (
          <div className="space-y-2">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={versionQuery}
                  onChange={(event) => setVersionQuery(event.target.value)}
                  className="h-10 w-full rounded-xl border border-white/10 bg-[#0D1117] pl-9 pr-3 text-sm text-white outline-none focus:border-[#60A5FA]/70"
                  placeholder="Pesquisar versão, loader ou arquivo"
                />
              </div>
              <Badge tone="slate">{filteredVersions.length} versões</Badge>
            </div>
            {filteredVersions.map((version) => {
              const versionInstallState = getProjectInstallState(
                current,
                installedContent,
                updateMap,
                version,
                installedInstances,
              );
              const versionBusy = activeOperations.includes(
                operationKey(current, version.id, targetInstance?.id ?? "new-instance"),
              );

              return (
                <VersionRow
                  key={`${version.provider}-${version.id}`}
                  type={current.type}
                  version={version}
                  status={versionInstallState.status}
                  busy={versionBusy}
                  onInstall={() => {
                    if (versionInstallState.status === "update" && versionInstallState.installed) {
                      onUpdateInstalled(versionInstallState.installed);
                      return;
                    }

                    onInstall(version);
                  }}
                  installing={installing}
                />
              );
            })}
            {versions.length === 0 ? <EmptyDetail text="Carregando versoes..." /> : null}
            {versions.length > 0 && filteredVersions.length === 0 ? (
              <EmptyDetail text="Nenhuma versão encontrada para esta busca." />
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

        {activeTab === "changelog" ? (
          <div className="whitespace-pre-wrap text-sm leading-7 text-[#D8DEE9]">
            {latestVersion?.changelog ??
              "O autor não publicou um changelog para a versão mais recente."}
          </div>
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
              <Badge tone="slate">{project?.modpackContent?.length ?? 0} itens</Badge>
            </div>
            {(project?.modpackContent ?? [])
              .filter((item) => {
                const normalized = versionQuery.trim().toLowerCase();
                return (
                  !normalized ||
                  [item.name, item.fileName, item.category, item.provider]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase()
                    .includes(normalized)
                );
              })
              .map((item) => (
                <div
                  key={`content-${item.provider}-${item.projectId}-${item.versionId}-${item.fileName ?? item.name}`}
                  className="grid grid-cols-1 gap-3 border-b border-white/8 px-2 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_130px_110px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {item.iconUrl ? (
                      <img src={item.iconUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <ContentTypeIcon
                        type={
                          item.category === "resourcepack"
                            ? "resourcepack"
                            : item.category === "shader"
                              ? "shader"
                              : "mod"
                        }
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{item.name}</p>
                      <p className="mt-1 truncate text-[#94A3B8]">
                        {item.fileName ?? `Projeto ${item.projectId}`}
                      </p>
                    </div>
                  </div>
                  <span className="capitalize text-[#B8C2D0]">{item.category}</span>
                  <span className="text-[#B8C2D0]">
                    {item.required ? "Obrigatório" : "Opcional"}
                  </span>
                </div>
              ))}
            {(project?.modpackContent ?? []).length === 0 ? (
              <EmptyDetail
                text={project?.contentNote ?? "O manifesto do modpack não expôs conteúdo."}
              />
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
  status,
  busy,
  onInstall,
  installing,
}: {
  type: ContentType;
  version: ContentVersion;
  status: InstallDisplayStatus;
  busy: boolean;
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
    <Button
      type="button"
      size="sm"
      disabled={installing || busy || status === "installed"}
      onClick={onInstall}
    >
      {busy ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : status === "installed" ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : status === "downloaded" ? (
        <Download className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {status === "installed"
        ? "Ja instalado"
        : status === "downloaded"
          ? "Baixar novamente"
          : status === "update"
            ? "Atualizar"
            : "Baixar"}
    </Button>
  </div>
);

const ProviderChoiceDialog = ({
  target,
  installing,
  onClose,
  onSelect,
}: {
  target: InstallTarget | null;
  installing: boolean;
  onClose: () => void;
  onSelect: (provider: ContentProvider) => void;
}) => {
  const availableProviders = target ? getProjectProviders(target.project) : [];

  return (
    <AnimatePresence>
      {target && availableProviders.length > 1 ? (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/72 px-4 py-8 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !installing) {
              onClose();
            }
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-choice-title"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/12 bg-[#161B22]/98 shadow-2xl shadow-black/55"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="border-b border-white/10 px-5 py-5 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">
                Escolher provedor
              </p>
              <h2 id="provider-choice-title" className="mt-2 text-xl font-semibold text-white">
                Escolha a origem do download
              </h2>
              <p className="mt-1 truncate text-sm font-medium text-white/85">
                {target.project.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
                Este conteúdo existe nos dois catálogos. Os arquivos e a composição do pacote podem
                variar entre os provedores.
              </p>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <ProviderChoiceCard
                provider="modrinth"
                title="Baixar com Modrinth"
                description="Usar a versão distribuída pelo catálogo Modrinth."
                installing={installing}
                onSelect={onSelect}
              />
              <ProviderChoiceCard
                provider="curseforge"
                title="Baixar com CurseForge"
                description="Usar a versão distribuída pelo catálogo CurseForge."
                installing={installing}
                onSelect={onSelect}
              />
            </div>

            <div className="flex justify-end border-t border-white/10 bg-[#0D1117]/55 px-5 py-4 sm:px-6">
              <Button type="button" variant="secondary" onClick={onClose} disabled={installing}>
                Cancelar
              </Button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const ProviderChoiceCard = ({
  provider,
  title,
  description,
  installing,
  onSelect,
}: {
  provider: ContentProvider;
  title: string;
  description: string;
  installing: boolean;
  onSelect: (provider: ContentProvider) => void;
}) => {
  const isModrinth = provider === "modrinth";
  const Logo = isModrinth ? SiModrinth : SiCurseforge;

  return (
    <button
      type="button"
      disabled={installing}
      onClick={() => onSelect(provider)}
      className={`group flex min-h-56 flex-col items-center justify-center rounded-2xl border px-5 py-6 text-center transition duration-200 disabled:cursor-wait disabled:opacity-60 ${
        isModrinth
          ? "border-[#1BD96A]/25 bg-[#1BD96A]/[0.06] hover:border-[#1BD96A]/65 hover:bg-[#1BD96A]/10"
          : "border-[#F16436]/25 bg-[#F16436]/[0.06] hover:border-[#F16436]/65 hover:bg-[#F16436]/10"
      }`}
    >
      <div
        className={`grid h-20 w-20 place-items-center rounded-2xl border bg-[#0D1117] shadow-xl transition duration-200 group-hover:-translate-y-1 ${
          isModrinth
            ? "border-[#1BD96A]/30 text-[#1BD96A] shadow-[#1BD96A]/10"
            : "border-[#F16436]/30 text-[#F16436] shadow-[#F16436]/10"
        }`}
      >
        <Logo className="h-11 w-11" aria-hidden="true" />
      </div>
      <span className="mt-5 text-base font-semibold text-white">{title}</span>
      <span className="mt-2 text-sm leading-5 text-[#94A3B8]">{description}</span>
    </button>
  );
};

const getProjectInstallState = (
  project: ContentSearchResult | ContentProjectDetails,
  installedContent: InstalledContent[],
  updateMap: Map<string, InstalledContentUpdateInfo>,
  version?: ContentVersion,
  installedInstances: LauncherInstance[] = [],
): {
  status: InstallDisplayStatus;
  installed?: InstalledContent;
  installedInstance?: LauncherInstance;
} => {
  if (project.type === "modpack") {
    const installedInstance = findInstalledInstanceForProject(project, installedInstances);

    if (installedInstance) {
      return { status: "downloaded", installedInstance };
    }
  }

  const installed = findInstalledContentForProject(project, installedContent);

  if (!installed) {
    return { status: "available" };
  }

  if (version && installed.versionId !== version.id) {
    return { status: "update", installed };
  }

  const update = updateMap.get(installed.id);

  if (update?.updateAvailable) {
    return { status: "update", installed };
  }

  return { status: "installed", installed };
};

const findInstalledContentForProject = (
  project: ContentSearchResult | ContentProjectDetails,
  installedContent: InstalledContent[],
) => {
  const refs = getProjectProviderRefs(project);

  return installedContent.find((item) =>
    item.type === project.type &&
    refs.some((ref) => item.provider === ref.provider && item.projectId === ref.projectId),
  );
};

const findInstalledInstanceForProject = (
  project: ContentSearchResult | ContentProjectDetails,
  instances: LauncherInstance[],
) => {
  const refs = getProjectProviderRefs(project);

  return instances.find((instance) =>
    refs.some(
      (ref) =>
        instance.sourceProvider === ref.provider &&
        instance.sourceProjectId === ref.projectId,
    ),
  );
};

const getProjectProviderRefs = (project: ContentSearchResult | ContentProjectDetails) =>
  getProjectProviders(project).map((provider) => ({
    provider,
    projectId: project.providerProjects?.[provider]?.projectId ??
      (project.provider === provider ? project.projectId : ""),
  })).filter((ref) => ref.projectId);

const operationKey = (
  project: ContentSearchResult | ContentProjectDetails,
  versionId?: string,
  targetId = "none",
) => `${project.provider}:${project.type}:${project.projectId}:${versionId ?? "latest"}:${targetId}`;

const isProjectOperationActive = (
  project: ContentSearchResult | ContentProjectDetails,
  activeOperations: string[],
) => {
  const refs = getProjectProviderRefs(project);

  return activeOperations.some((key) =>
    refs.some((ref) => key.startsWith(`${ref.provider}:${project.type}:${ref.projectId}:`)),
  );
};

const projectActionLabel = (
  project: ContentSearchResult | ContentProjectDetails,
  status: InstallDisplayStatus,
  busy: boolean,
  hasTargetInstance: boolean,
) => {
  if (busy) return "Adicionando...";
  if (status === "installed") return "Ja instalado";
  if (status === "downloaded") return project.type === "modpack" ? "Baixar novamente" : "Ja baixado";
  if (status === "update") return "Atualizar";
  if (project.type === "modpack") return "Criar instancia";
  return hasTargetInstance ? "Adicionar" : "Instalar";
};

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
          })).filter((row) => row.compatible)
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
              Nenhuma instancia compativel encontrada para este conteudo.
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

const getProjectProviders = (
  project: ContentSearchResult | ContentProjectDetails,
): ContentProvider[] =>
  Array.from(
    new Set([
      ...(project.providers ?? []),
      ...Object.keys(project.providerProjects ?? {}).filter(
        (provider): provider is ContentProvider =>
          provider === "modrinth" || provider === "curseforge",
      ),
      project.provider,
    ]),
  );

const selectProviderProject = <
  T extends ContentSearchResult | ContentProjectDetails,
>(
  project: T,
  provider: ContentProvider,
): T => {
  const providerProject = project.providerProjects?.[provider];

  if (!providerProject && project.provider !== provider) {
    throw new Error(`O projeto não possui uma referência válida para ${provider}.`);
  }

  return {
    ...project,
    provider,
    projectId: providerProject?.projectId ?? project.projectId,
    slug: providerProject?.slug ?? project.slug,
  };
};

const mergeProjectProviderMetadata = <
  T extends ContentSearchResult | ContentProjectDetails,
>(
  project: T,
  fallback: ContentSearchResult,
): T => ({
  ...fallback,
  ...project,
  providers: Array.from(
    new Set([
      ...getProjectProviders(fallback),
      ...getProjectProviders(project),
    ]),
  ),
  providerProjects: {
    ...fallback.providerProjects,
    ...project.providerProjects,
  },
});

const getInstallCompatibility = (
  project: ContentSearchResult | ContentProjectDetails,
  version: ContentVersion | undefined,
  instance: LauncherInstance,
) => {
  if (project.type === "resourcepack") {
    const selectedVersionTargets = version?.gameVersions ?? [];
    const selectedVersionCompatible =
      selectedVersionTargets.length === 0 ||
      selectedVersionTargets.some((gameVersion) =>
        isMinecraftVersionCompatible(gameVersion, instance.minecraftVersion),
      );

    if (!selectedVersionCompatible) {
      return {
        compatible: false,
        reason: `Esta textura nao e compativel com Minecraft ${instance.minecraftVersion}.`,
      };
    }

    return {
      compatible: true,
      reason: version
        ? `Textura pronta para instalar em ${instance.name}.`
        : `O launcher vai buscar uma textura compativel com Minecraft ${instance.minecraftVersion}.`,
    };
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

  if (!instance.contentManagementEnabled) {
    return {
      compatible: false,
      reason:
        "Gerenciamento de conteudo desativado neste perfil. Ative nas opcoes da instancia para instalar arquivos.",
    };
  }

  if (project.type === "shader" && !instance.shaderSupport.supported) {
    return {
      compatible: false,
      reason:
        `A instancia ${instance.name} nao possui um motor de shader reconhecido. ` +
        "Instale Iris, Iris + Sodium, OptiFine, Oculus, Angelica ou ShadersMod primeiro.",
    };
  }

  if (instance.loader === "vanilla") {
    return {
      compatible: false,
      reason:
        project.type === "modpack"
          ? "Modpacks precisam de uma instancia com loader compativel."
          : "Mods precisam de Fabric, Forge, NeoForge, Quilt, Iris ou Iris + Sodium. Vanilla aceita apenas texturas.",
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
    reason:
      project.type === "shader"
        ? `Pronto para instalar em ${instance.name} usando ${instance.shaderSupport.engines.join(", ")}.`
        : `Pronto para instalar em ${instance.name}.`,
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
