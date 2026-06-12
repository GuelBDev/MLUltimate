import path from "node:path";
import { randomUUID } from "node:crypto";
import { net } from "electron";
import { z } from "zod";
import { LauncherDatabase } from "../database/sqliteDatabase";
import { DownloadManager } from "../downloads/downloadManager";
import { InstanceService } from "../instances/instanceService";
import type {
  ContentProjectDetails,
  ContentProjectInput,
  ContentSearchInput,
  ContentSearchResult,
  ContentVersion,
  ContentType,
  InstallContentInput,
  InstalledContent,
  LoaderType,
} from "../../src/types/launcher";

const MODRINTH_API = "https://api.modrinth.com/v2";
const CURSEFORGE_API = "https://api.curseforge.com/v1";
const DEFAULT_CURSEFORGE_PROXY_URL =
  "https://mlultimate-curseforge-proxy.miguelgossani068.workers.dev";
const CURSEFORGE_PROXY_URL =
  process.env.MLULTIMATE_CURSEFORGE_PROXY_URL || DEFAULT_CURSEFORGE_PROXY_URL;
const MINECRAFT_GAME_ID = 432;

const searchInputSchema = z.object({
  provider: z.enum(["all", "modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  query: z.string().trim().max(80).default(""),
  minecraftVersion: z.string().optional(),
  loader: z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]).optional(),
  sort: z.enum(["relevance", "downloads", "updated", "newest"]).optional(),
});

const installInputSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string().min(1),
  instanceId: z.string().min(1),
  versionId: z.string().optional(),
});

const projectInputSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string().min(1),
  minecraftVersion: z.string().optional(),
  loader: z.enum(["vanilla", "fabric", "forge", "neoforge", "quilt"]).optional(),
});

const modrinthSearchSchema = z.object({
  hits: z.array(
    z.object({
      project_id: z.string(),
      slug: z.string().optional(),
      project_type: z.string(),
      title: z.string(),
      author: z.string().optional(),
      description: z.string().default(""),
      downloads: z.number().optional(),
      icon_url: z.string().nullable().optional(),
      versions: z.array(z.string()).optional().default([]),
      latest_version: z.string().optional(),
      categories: z.array(z.string()).optional().default([]),
      date_modified: z.string().optional(),
    }),
  ),
});

const modrinthProjectSchema = z.object({
  id: z.string(),
  slug: z.string().optional(),
  title: z.string(),
  description: z.string().default(""),
  body: z.string().optional().default(""),
  downloads: z.number().optional(),
  icon_url: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  wiki_url: z.string().nullable().optional(),
  discord_url: z.string().nullable().optional(),
  gallery: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const modrinthVersionSchema = z.object({
  id: z.string(),
  name: z.string(),
  version_number: z.string().optional(),
  date_published: z.string().optional(),
  downloads: z.number().optional(),
  game_versions: z.array(z.string()).default([]),
  loaders: z.array(z.string()).default([]),
  changelog: z.string().nullable().optional(),
  files: z.array(
    z.object({
      url: z.string().url(),
      filename: z.string(),
      primary: z.boolean().optional(),
      hashes: z.object({
        sha1: z.string().optional(),
      }),
    }),
  ),
  dependencies: z
    .array(
      z.object({
        project_id: z.string().nullable().optional(),
        dependency_type: z.string(),
      }),
    )
    .default([]),
});

const curseForgeSearchSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      slug: z.string().optional(),
      summary: z.string().default(""),
      downloadCount: z.number().optional(),
      logo: z.object({ url: z.string().optional() }).nullable().optional(),
      links: z.object({ websiteUrl: z.string().optional() }).optional(),
      authors: z.array(z.object({ name: z.string() })).optional(),
      latestFilesIndexes: z
        .array(
          z.object({
            gameVersion: z.string().optional(),
            modLoader: z.number().optional(),
          }),
        )
        .optional()
        .default([]),
      dateModified: z.string().optional(),
    }),
  ),
});

const curseForgeProjectSchema = z.object({
  data: z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string().optional(),
    summary: z.string().default(""),
    downloadCount: z.number().optional(),
    logo: z.object({ url: z.string().optional() }).nullable().optional(),
    links: z.object({ websiteUrl: z.string().optional(), sourceUrl: z.string().optional() }).optional(),
    authors: z.array(z.object({ name: z.string() })).optional(),
    dateModified: z.string().optional(),
  }),
});

const curseForgeFilesSchema = z.object({
  data: z.array(
    z.object({
      id: z.number(),
      displayName: z.string().optional(),
      fileName: z.string(),
      downloadUrl: z.string().nullable().optional(),
      gameVersions: z.array(z.string()).default([]),
      fileDate: z.string().optional(),
      downloadCount: z.number().optional(),
    }),
  ),
});

type InstalledContentRow = {
  id: string;
  instance_id: string;
  provider: "modrinth" | "curseforge";
  type: ContentType;
  project_id: string;
  version_id: string;
  name: string;
  file_name: string;
  file_path: string;
  installed_at: string;
};

export class ContentService {
  constructor(
    private readonly database: LauncherDatabase,
    private readonly downloads: DownloadManager,
    private readonly instances: InstanceService,
  ) {}

  async search(input: ContentSearchInput): Promise<ContentSearchResult[]> {
    const parsed = searchInputSchema.parse(input);

    if (parsed.provider === "all") {
      const [modrinth, curseforge] = await Promise.all([
        this.searchModrinth({ ...parsed, provider: "modrinth" }),
        this.searchCurseForge({ ...parsed, provider: "curseforge" }).catch(() => []),
      ]);

      return mergeProviderResults([...modrinth, ...curseforge]);
    }

    if (parsed.provider === "modrinth") {
      return this.searchModrinth(parsed);
    }

    return this.searchCurseForge(parsed);
  }

  async install(input: InstallContentInput): Promise<InstalledContent[]> {
    const parsed = installInputSchema.parse(input);

    if (parsed.provider === "modrinth") {
      return this.installModrinth(parsed);
    }

    return [await this.installCurseForge(parsed)];
  }

  async getProject(input: ContentProjectInput): Promise<ContentProjectDetails> {
    const parsed = projectInputSchema.parse(input);

    if (parsed.provider === "modrinth") {
      return this.getModrinthProject(parsed);
    }

    return this.getCurseForgeProject(parsed);
  }

  listInstalled(instanceId: string) {
    return this.database
      .all<InstalledContentRow>(
        "SELECT * FROM installed_content WHERE instance_id = ? ORDER BY installed_at DESC",
        [instanceId],
      )
      .map(rowToInstalledContent);
  }

  private async searchModrinth(
    input: z.infer<typeof searchInputSchema>,
  ): Promise<ContentSearchResult[]> {
    const facets = [[`project_type:${input.type}`]];

    if (input.minecraftVersion) {
      facets.push([`versions:${input.minecraftVersion}`]);
    }

    if (
      input.loader &&
      input.loader !== "vanilla" &&
      (input.type === "mod" || input.type === "modpack")
    ) {
      facets.push([`categories:${input.loader}`]);
    }

    const params = new URLSearchParams({
      query: input.query,
      limit: "20",
      facets: JSON.stringify(facets),
      index: mapModrinthSort(input.sort),
    });

    const response = await fetchWithElectronNet(
      `${MODRINTH_API}/search?${params}`,
      "Buscar projetos no Modrinth",
    );

    if (!response.ok) {
      throw new Error(`Modrinth retornou erro ${response.status}.`);
    }

    const json = modrinthSearchSchema.parse(await response.json());

    return json.hits.map((hit) => ({
      provider: "modrinth",
      providers: ["modrinth"],
      type: input.type,
      projectId: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      author: hit.author,
      description: hit.description,
      downloads: hit.downloads,
      iconUrl: hit.icon_url ?? undefined,
      projectUrl: hit.slug ? `https://modrinth.com/${input.type}/${hit.slug}` : undefined,
      updatedAt: hit.date_modified,
      latestGameVersion: latestGameVersion(hit.versions) ?? hit.latest_version,
      compatibleGameVersions: compactGameVersions(hit.versions),
      compatibleLoaders: hit.categories.filter(isLoaderType),
    }));
  }

  private async searchCurseForge(
    input: z.infer<typeof searchInputSchema>,
  ): Promise<ContentSearchResult[]> {
    const params = new URLSearchParams({
      gameId: String(MINECRAFT_GAME_ID),
      pageSize: "20",
      searchFilter: input.query,
      sortField: mapCurseForgeSort(input.sort),
      sortOrder: "desc",
    });

    const classId = mapCurseForgeClassId(input.type);

    if (classId) {
      params.set("classId", String(classId));
    }

    if (input.minecraftVersion) {
      params.set("gameVersion", input.minecraftVersion);
    }

    const modLoaderType = mapCurseForgeModLoader(input.loader);

    if (modLoaderType && (input.type === "mod" || input.type === "modpack")) {
      params.set("modLoaderType", String(modLoaderType));
    }

    const response = await this.fetchCurseForge(`/mods/search?${params}`, "Buscar projetos na CurseForge");

    if (!response.ok) {
      throw new Error(`CurseForge retornou erro ${response.status}.`);
    }

    const json = curseForgeSearchSchema.parse(await response.json());

    return json.data.map((project) => ({
      provider: "curseforge",
      providers: ["curseforge"],
      type: input.type,
      projectId: String(project.id),
      slug: project.slug,
      title: project.name,
      author: project.authors?.map((author) => author.name).join(", "),
      description: project.summary,
      downloads: project.downloadCount,
      iconUrl: project.logo?.url,
      projectUrl: project.links?.websiteUrl,
      updatedAt: project.dateModified,
      latestGameVersion: latestGameVersion(
        project.latestFilesIndexes.map((file) => file.gameVersion).filter(isMinecraftVersion),
      ),
      compatibleGameVersions: compactGameVersions(
        project.latestFilesIndexes.map((file) => file.gameVersion).filter(isMinecraftVersion),
      ),
      compatibleLoaders: Array.from(
        new Set(
          project.latestFilesIndexes
            .map((file) => curseForgeLoaderToType(file.modLoader))
            .filter((item): item is LoaderType => Boolean(item)),
        ),
      ),
    }));
  }

  private async installModrinth(
    input: z.infer<typeof installInputSchema>,
    installedProjectIds = new Set<string>(),
  ): Promise<InstalledContent[]> {
    const instance = await this.instances.getById(input.instanceId);

    if (input.type === "mod" && instance.loader === "vanilla") {
      throw new Error("Mods exigem uma instância com Fabric, Forge, NeoForge ou Quilt.");
    }

    if (installedProjectIds.has(input.projectId)) {
      return [];
    }

    installedProjectIds.add(input.projectId);

    const versions = await this.getModrinthVersions(
      input.projectId,
      input.type,
      instance.minecraftVersion,
      instance.loader,
    );
    const version =
      versions.find((candidate) => candidate.id === input.versionId) ?? versions.at(0);

    if (!version) {
      throw new Error("Nenhum arquivo Modrinth compatível foi encontrado para esta instância.");
    }

    const file = version.files.find((candidate) => candidate.primary) ?? version.files.at(0);

    if (!file) {
      throw new Error("A versão Modrinth encontrada não possui arquivo para baixar.");
    }

    const installed = await this.installFile({
      instanceId: instance.id,
      provider: "modrinth",
      type: input.type,
      projectId: input.projectId,
      versionId: version.id,
      name: version.name,
      fileName: file.filename,
      url: file.url,
      sha1: file.hashes.sha1,
      gameDir: instance.gameDir,
    });

    const dependencies: InstalledContent[] = [];

    for (const dependency of version.dependencies) {
      if (dependency.dependency_type !== "required" || !dependency.project_id) {
        continue;
      }

      dependencies.push(
        ...(await this.installModrinth(
          {
            provider: "modrinth",
            type: input.type,
            projectId: dependency.project_id,
            instanceId: input.instanceId,
          },
          installedProjectIds,
        )),
      );
    }

    return [installed, ...dependencies];
  }

  private async getModrinthVersions(
    projectId: string,
    type: ContentType,
    minecraftVersion: string,
    loader: LoaderType,
  ) {
    const params = new URLSearchParams({
      game_versions: JSON.stringify([minecraftVersion]),
    });

    if ((type === "mod" || type === "modpack") && loader !== "vanilla") {
      params.set("loaders", JSON.stringify([loader]));
    }

    const response = await fetchWithElectronNet(
      `${MODRINTH_API}/project/${projectId}/version?${params}`,
      "Buscar arquivos no Modrinth",
    );

    if (!response.ok) {
      throw new Error(`Modrinth retornou erro ${response.status} ao buscar arquivos.`);
    }

    return z.array(modrinthVersionSchema).parse(await response.json());
  }

  private async getModrinthProject(
    input: z.infer<typeof projectInputSchema>,
  ): Promise<ContentProjectDetails> {
    const versionsPromise = input.minecraftVersion
      ? this.getModrinthVersions(
          input.projectId,
          input.type,
          input.minecraftVersion,
          input.loader ?? "vanilla",
        )
      : fetchWithElectronNet(
          `${MODRINTH_API}/project/${input.projectId}/version`,
          "Buscar versoes no Modrinth",
        ).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Modrinth retornou erro ${response.status} ao buscar versoes.`);
          }

          return z.array(modrinthVersionSchema).parse(await response.json());
        });

    const [projectResponse, versions] = await Promise.all([
      fetchWithElectronNet(
        `${MODRINTH_API}/project/${input.projectId}`,
        "Buscar detalhes no Modrinth",
      ),
      versionsPromise,
    ]);

    if (!projectResponse.ok) {
      throw new Error(`Modrinth retornou erro ${projectResponse.status} ao buscar detalhes.`);
    }

    const project = modrinthProjectSchema.parse(await projectResponse.json());
    const contentVersions = versions.map((version) => toModrinthContentVersion(version));

    return {
      provider: "modrinth",
      providers: ["modrinth"],
      type: input.type,
      projectId: project.id,
      slug: project.slug,
      title: project.title,
      description: project.description,
      body: project.body,
      downloads: project.downloads,
      iconUrl: project.icon_url ?? undefined,
      projectUrl: project.slug ? `https://modrinth.com/${input.type}/${project.slug}` : undefined,
      sourceUrl: project.source_url ?? project.wiki_url ?? project.discord_url ?? undefined,
      latestGameVersion: latestGameVersion(contentVersions.flatMap((version) => version.gameVersions)),
      compatibleGameVersions: compactGameVersions(
        contentVersions.flatMap((version) => version.gameVersions),
      ),
      compatibleLoaders: Array.from(
        new Set(contentVersions.flatMap((version) => version.loaders)),
      ),
      gallery: project.gallery.map((image) => ({
        url: image.url,
        title: image.title ?? undefined,
        description: image.description ?? undefined,
      })),
      versions: contentVersions,
      commentsNote: "Comentários não são expostos pela API pública do Modrinth.",
      contentNote: "Conteúdo instalado é listado na tela da instância.",
    };
  }

  private async getCurseForgeProject(
    input: z.infer<typeof projectInputSchema>,
  ): Promise<ContentProjectDetails> {
    const [projectResponse, filesResponse] = await Promise.all([
      this.fetchCurseForge(`/mods/${input.projectId}`, "Buscar detalhes na CurseForge"),
      this.getCurseForgeFiles(input.projectId, input.minecraftVersion, input.loader),
    ]);

    if (!projectResponse.ok) {
      throw new Error(`CurseForge retornou erro ${projectResponse.status} ao buscar detalhes.`);
    }

    const project = curseForgeProjectSchema.parse(await projectResponse.json()).data;
    const contentVersions = filesResponse.map((file) => toCurseForgeContentVersion(file));

    return {
      provider: "curseforge",
      providers: ["curseforge"],
      type: input.type,
      projectId: String(project.id),
      slug: project.slug,
      title: project.name,
      author: project.authors?.map((author) => author.name).join(", "),
      description: project.summary,
      body: project.summary,
      downloads: project.downloadCount,
      iconUrl: project.logo?.url,
      projectUrl: project.links?.websiteUrl,
      sourceUrl: project.links?.sourceUrl,
      updatedAt: project.dateModified,
      latestGameVersion: latestGameVersion(contentVersions.flatMap((version) => version.gameVersions)),
      compatibleGameVersions: compactGameVersions(
        contentVersions.flatMap((version) => version.gameVersions),
      ),
      compatibleLoaders: Array.from(
        new Set(contentVersions.flatMap((version) => version.loaders)),
      ),
      gallery: [],
      versions: contentVersions,
      commentsNote: "Comentários não são expostos pela Core API oficial da CurseForge.",
      contentNote: "Arquivos do projeto aparecem em Versions.",
    };
  }

  private async getCurseForgeFiles(
    projectId: string,
    minecraftVersion?: string,
    loader?: LoaderType,
  ) {
    const params = new URLSearchParams({
      pageSize: "40",
    });

    if (minecraftVersion) {
      params.set("gameVersion", minecraftVersion);
    }

    const modLoaderType = mapCurseForgeModLoader(loader);

    if (modLoaderType) {
      params.set("modLoaderType", String(modLoaderType));
    }

    const response = await this.fetchCurseForge(
      `/mods/${projectId}/files?${params}`,
      "Buscar arquivos na CurseForge",
    );

    if (!response.ok) {
      throw new Error(`CurseForge retornou erro ${response.status} ao buscar arquivos.`);
    }

    return curseForgeFilesSchema.parse(await response.json()).data;
  }

  private async installCurseForge(
    input: z.infer<typeof installInputSchema>,
  ): Promise<InstalledContent> {
    const instance = await this.instances.getById(input.instanceId);
    const files = await this.getCurseForgeFiles(
      input.projectId,
      instance.minecraftVersion,
      instance.loader,
    );
    const file =
      files.find((candidate) => String(candidate.id) === input.versionId) ??
      files.find((candidate) => candidate.gameVersions.includes(instance.minecraftVersion)) ??
      files.at(0);

    if (!file) {
      throw new Error("Nenhum arquivo CurseForge compatível foi encontrado.");
    }

    const downloadUrl =
      file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(input.projectId, file.id));

    return this.installFile({
      instanceId: instance.id,
      provider: "curseforge",
      type: input.type,
      projectId: input.projectId,
      versionId: String(file.id),
      name: file.displayName ?? file.fileName,
      fileName: file.fileName,
      url: downloadUrl,
      gameDir: instance.gameDir,
    });
  }

  private async getCurseForgeDownloadUrl(projectId: string, fileId: number) {
    const response = await this.fetchCurseForge(
      `/mods/${projectId}/files/${fileId}/download-url`,
      "Buscar URL de download na CurseForge",
    );

    if (!response.ok) {
      throw new Error(`CurseForge não liberou URL de download (${response.status}).`);
    }

    const json = z.object({ data: z.string().url() }).parse(await response.json());
    return json.data;
  }

  private async installFile(input: {
    instanceId: string;
    provider: "modrinth" | "curseforge";
    type: ContentType;
    projectId: string;
    versionId: string;
    name: string;
    fileName: string;
    url: string;
    sha1?: string;
    gameDir: string;
  }): Promise<InstalledContent> {
    const fileName = sanitizeFileName(input.fileName);
    const destination = path.join(input.gameDir, folderForType(input.type), fileName);

    await this.downloads.download({
      label: `${input.name} (${input.type})`,
      url: input.url,
      destination,
      sha1: input.sha1,
    });

    const id = randomUUID();
    const installedAt = new Date().toISOString();

    this.database.run(
      `
      INSERT OR IGNORE INTO installed_content
        (id, instance_id, provider, type, project_id, version_id, name, file_name, file_path, installed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.instanceId,
        input.provider,
        input.type,
        input.projectId,
        input.versionId,
        input.name,
        fileName,
        destination,
        installedAt,
      ],
    );

    return {
      id,
      instanceId: input.instanceId,
      provider: input.provider,
      type: input.type,
      projectId: input.projectId,
      versionId: input.versionId,
      name: input.name,
      fileName,
      filePath: destination,
      installedAt,
    };
  }

  private fetchCurseForge(pathAndQuery: string, context: string) {
    const proxyBase = CURSEFORGE_PROXY_URL.trim().replace(/\/$/, "");

    if (proxyBase) {
      return fetchWithElectronNet(`${proxyBase}${pathAndQuery}`, {
        context,
        headers: { Accept: "application/json" },
      });
    }

    return fetchWithElectronNet(`${CURSEFORGE_API}${pathAndQuery}`, {
      context,
      headers: {
        Accept: "application/json",
        "x-api-key": this.requireCurseForgeKey(),
      },
    });
  }

  private requireCurseForgeKey() {
    const apiKey =
      process.env.MLULTIMATE_CURSEFORGE_API_KEY ||
      process.env.CURSEFORGE_API_KEY ||
      "";

    if (!apiKey) {
      throw new Error(
        "CurseForge exige uma API central do MLUltimate. Configure MLULTIMATE_CURSEFORGE_PROXY_URL no app distribuido ou MLULTIMATE_CURSEFORGE_API_KEY no ambiente seguro.",
      );
    }

    return apiKey;
  }
}

const mapModrinthSort = (sort?: string) => {
  switch (sort) {
    case "downloads":
      return "downloads";
    case "updated":
      return "updated";
    case "newest":
      return "newest";
    case "relevance":
    default:
      return "relevance";
  }
};

const mapCurseForgeSort = (sort?: string) => {
  switch (sort) {
    case "downloads":
      return "2";
    case "updated":
      return "3";
    case "newest":
      return "11";
    case "relevance":
    default:
      return "1";
  }
};

const mapCurseForgeClassId = (type: ContentType) => {
  switch (type) {
    case "mod":
      return 6;
    case "modpack":
      return 4471;
    case "resourcepack":
      return 12;
    case "shader":
      return 6552;
  }
};

const mapCurseForgeModLoader = (loader?: LoaderType) => {
  switch (loader) {
    case "forge":
      return 1;
    case "fabric":
      return 4;
    case "quilt":
      return 5;
    case "neoforge":
      return 6;
    case "vanilla":
    default:
      return null;
  }
};

const folderForType = (type: ContentType) => {
  switch (type) {
    case "mod":
      return "mods";
    case "shader":
      return "shaderpacks";
    case "resourcepack":
      return "resourcepacks";
    case "modpack":
      return "modpacks";
  }
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .split("")
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "_" : character,
    )
    .join("");

const mergeProviderResults = (results: ContentSearchResult[]) => {
  const grouped = new Map<string, ContentSearchResult>();

  for (const result of results) {
    const key = `${result.type}:${normalizeTitle(result.title)}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        ...result,
        providers: result.providers ?? [result.provider],
      });
      continue;
    }

    existing.providers = Array.from(
      new Set([...(existing.providers ?? [existing.provider]), result.provider]),
    );
    existing.downloads = Math.max(existing.downloads ?? 0, result.downloads ?? 0);
    existing.compatibleGameVersions = compactGameVersions([
      ...(existing.compatibleGameVersions ?? []),
      ...(result.compatibleGameVersions ?? []),
    ]);
    existing.compatibleLoaders = Array.from(
      new Set([...(existing.compatibleLoaders ?? []), ...(result.compatibleLoaders ?? [])]),
    );
    existing.latestGameVersion =
      latestGameVersion([existing.latestGameVersion, result.latestGameVersion].filter(isMinecraftVersion)) ??
      existing.latestGameVersion ??
      result.latestGameVersion;
  }

  return [...grouped.values()].sort((left, right) => (right.downloads ?? 0) - (left.downloads ?? 0));
};

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "");

const toModrinthContentVersion = (
  version: z.infer<typeof modrinthVersionSchema>,
): ContentVersion => {
  const file = version.files.find((candidate) => candidate.primary) ?? version.files.at(0);

  return {
    provider: "modrinth",
    id: version.id,
    name: version.name,
    fileName: file?.filename ?? version.name,
    datePublished: version.date_published,
    gameVersions: version.game_versions,
    loaders: version.loaders.filter(isLoaderType),
    downloads: version.downloads,
    changelog: version.changelog ?? undefined,
  };
};

const toCurseForgeContentVersion = (
  file: z.infer<typeof curseForgeFilesSchema>["data"][number],
): ContentVersion => ({
  provider: "curseforge",
  id: String(file.id),
  name: file.displayName ?? file.fileName,
  fileName: file.fileName,
  datePublished: file.fileDate,
  gameVersions: file.gameVersions,
  loaders: file.gameVersions.map((version) => version.toLowerCase()).filter(isLoaderType),
  downloads: file.downloadCount,
});

const isLoaderType = (value: string): value is LoaderType =>
  ["vanilla", "fabric", "forge", "neoforge", "quilt"].includes(value);

const isMinecraftVersion = (value: unknown): value is string =>
  typeof value === "string" && /^\d+(?:\.\d+){0,2}(?:[-\w.]*)?$/.test(value);

const latestGameVersion = (versions: string[]) => {
  const sorted = versions.filter(isMinecraftVersion).sort(compareMinecraftVersions);
  return sorted.at(-1);
};

const compactGameVersions = (versions: string[]) => {
  const groups = new Map<string, string[]>();

  for (const version of versions.filter(isMinecraftVersion)) {
    const parts = version.split(".");
    const major = parts[0] ?? version;
    const minor = parts[1];
    const key = minor ? `${major}.${minor}` : major;
    groups.set(key, [...(groups.get(key) ?? []), version]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => compareMinecraftVersions(left, right))
    .map(([key, values]) => {
      const hasPatch = values.some((version) => version.split(".").length >= 3);
      return hasPatch ? `${key}.x` : key;
    })
    .slice(-6)
    .reverse();
};

const compareMinecraftVersions = (left: string, right: string) => {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return left.localeCompare(right);
};

const curseForgeLoaderToType = (loader?: number): LoaderType | null => {
  switch (loader) {
    case 1:
      return "forge";
    case 4:
      return "fabric";
    case 5:
      return "quilt";
    case 6:
      return "neoforge";
    default:
      return null;
  }
};

const rowToInstalledContent = (row: InstalledContentRow): InstalledContent => ({
  id: row.id,
  instanceId: row.instance_id,
  provider: row.provider,
  type: row.type,
  projectId: row.project_id,
  versionId: row.version_id,
  name: row.name,
  fileName: row.file_name,
  filePath: row.file_path,
  installedAt: row.installed_at,
});

const fetchWithElectronNet = async (
  url: string,
  options: string | { context: string; headers?: Record<string, string> },
) => {
  const context = typeof options === "string" ? options : options.context;
  const headers =
    typeof options === "string"
      ? { "User-Agent": "MLUltimateLauncher/0.1 (+https://local)" }
      : {
          "User-Agent": "MLUltimateLauncher/0.1 (+https://local)",
          ...options.headers,
        };

  try {
    return await net.fetch(url, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} falhou: ${message}`, { cause: error });
  }
};
