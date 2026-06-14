import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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
  InstallContentAsInstanceInput,
  InstallContentInput,
  InstalledContent,
  LauncherInstance,
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
  loader: z.enum(["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"]).optional(),
  sort: z.enum(["relevance", "downloads", "updated", "newest"]).optional(),
  limit: z.number().int().min(1).max(200).default(20),
  offset: z.number().int().min(0).default(0),
});

const installInputSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string().min(1),
  instanceId: z.string().min(1),
  versionId: z.string().optional(),
});

const installAsInstanceInputSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack"]),
  projectId: z.string().min(1),
  versionId: z.string().optional(),
});

const projectInputSchema = z.object({
  provider: z.enum(["modrinth", "curseforge"]),
  type: z.enum(["mod", "modpack", "shader", "resourcepack"]),
  projectId: z.string().min(1),
  minecraftVersion: z.string().optional(),
  loader: z.enum(["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"]).optional(),
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
  enabled?: number;
  installed_at: string;
};

type InstallableFile = {
  provider: "modrinth" | "curseforge";
  versionId: string;
  name: string;
  fileName: string;
  url: string;
  sha1?: string;
  gameVersions: string[];
  loaders: LoaderType[];
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

  async installAsInstance(input: InstallContentAsInstanceInput): Promise<LauncherInstance> {
    const parsed = installAsInstanceInputSchema.parse(input);
    const project = await this.getProject({
      provider: parsed.provider,
      type: parsed.type,
      projectId: parsed.projectId,
    });
    const iconPath = project.iconUrl
      ? await downloadImageToTemp(project.iconUrl, parsed.projectId).catch(() => undefined)
      : undefined;
    const selected = await this.findInstallableFileForNewInstance(parsed);

    if (parsed.type === "modpack") {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "mlultimate-modpack-"));
      const archivePath = path.join(tempDir, sanitizeFileName(selected.fileName));

      try {
        await this.downloads.download({
          label: `Modpack ${project.title}`,
          url: selected.url,
          destination: archivePath,
          sha1: selected.sha1,
        });

        const instance = await this.instances.importArchiveFile(archivePath);
        return this.instances.update({
          id: instance.id,
          name: project.title,
          iconPath,
          contentManagementEnabled: false,
        });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }

    const minecraftVersion = chooseMinecraftVersion(selected.gameVersions);
    const loader = chooseLoaderForNewModInstance(selected.loaders);

    const instance = await this.instances.create({
      name: project.title,
      minecraftVersion,
      loader,
      ramMb: 4096,
      iconPath,
      contentManagementEnabled: true,
    });

    await this.install({
      provider: parsed.provider,
      type: "mod",
      projectId: parsed.projectId,
      instanceId: instance.id,
      versionId: selected.versionId,
    });

    return this.instances.getById(instance.id);
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

  async checkInstalledUpdates(instanceId: string) {
    const instance = await this.instances.getById(instanceId);
    const rows = this.database.all<InstalledContentRow>(
      "SELECT * FROM installed_content WHERE instance_id = ? ORDER BY installed_at DESC",
      [instanceId],
    );

    return Promise.all(
      rows.map(async (row) => {
        const latest = await this.findLatestCompatibleFile(row, instance).catch(() => null);

        return {
          id: row.id,
          updateAvailable: Boolean(latest && latest.versionId !== row.version_id),
          latestVersionId: latest?.versionId,
          latestVersionName: latest?.name,
          latestFileName: latest?.fileName,
        };
      }),
    );
  }

  async updateInstalledContent(id: string) {
    const row = this.getInstalledContentRow(id);
    const instance = await this.instances.getById(row.instance_id);
    assertContentManagementEnabled(instance.contentManagementEnabled);

    const latest = await this.findLatestCompatibleFile(row, instance);

    if (!latest) {
      throw new Error("Nenhum update compativel foi encontrado para esta instancia.");
    }

    if (latest.versionId === row.version_id) {
      return rowToInstalledContent(row);
    }

    const enabled = row.enabled !== 0;
    const activeDestination = path.join(
      instance.gameDir,
      folderForType(row.type),
      sanitizeFileName(latest.fileName),
    );
    const destination = enabled ? activeDestination : `${activeDestination}.disabled`;

    await this.downloads.download({
      label: `Update ${latest.name}`,
      url: latest.url,
      destination,
      sha1: latest.sha1,
    });

    if (existsSync(row.file_path) && path.resolve(row.file_path) !== path.resolve(destination)) {
      await rm(row.file_path, { force: true });
    }

    const now = new Date().toISOString();
    this.database.run(
      `
      UPDATE installed_content
      SET version_id = ?, name = ?, file_name = ?, file_path = ?, enabled = ?, installed_at = ?
      WHERE id = ?
      `,
      [
        latest.versionId,
        latest.name,
        sanitizeFileName(latest.fileName),
        destination,
        enabled ? 1 : 0,
        now,
        row.id,
      ],
    );

    return rowToInstalledContent(this.getInstalledContentRow(row.id));
  }

  async updateAllInstalledContent(input: { instanceId: string; type?: ContentType }) {
    const instance = await this.instances.getById(input.instanceId);
    assertContentManagementEnabled(instance.contentManagementEnabled);

    const rows = this.database.all<InstalledContentRow>(
      input.type
        ? "SELECT * FROM installed_content WHERE instance_id = ? AND type = ? ORDER BY installed_at DESC"
        : "SELECT * FROM installed_content WHERE instance_id = ? ORDER BY installed_at DESC",
      input.type ? [input.instanceId, input.type] : [input.instanceId],
    );
    const updated: InstalledContent[] = [];

    for (const row of rows) {
      const latest = await this.findLatestCompatibleFile(row, instance).catch(() => null);

      if (!latest || latest.versionId === row.version_id) {
        continue;
      }

      updated.push(await this.updateInstalledContent(row.id));
    }

    return updated;
  }

  async toggleInstalledContent(input: { id: string; enabled: boolean }) {
    const row = this.getInstalledContentRow(input.id);
    const instance = await this.instances.getById(row.instance_id);
    assertContentManagementEnabled(instance.contentManagementEnabled);

    const currentEnabled = row.enabled !== 0;

    if (currentEnabled === input.enabled) {
      return rowToInstalledContent(row);
    }

    const currentPath = row.file_path;
    const targetPath = input.enabled
      ? currentPath.replace(/\.disabled$/i, "")
      : `${currentPath}.disabled`;

    if (existsSync(currentPath) && path.resolve(currentPath) !== path.resolve(targetPath)) {
      await rename(currentPath, targetPath);
    }

    this.database.run(
      "UPDATE installed_content SET file_path = ?, enabled = ? WHERE id = ?",
      [targetPath, input.enabled ? 1 : 0, row.id],
    );

    return rowToInstalledContent(this.getInstalledContentRow(row.id));
  }

  async removeInstalledContent(id: string) {
    const row = this.getInstalledContentRow(id);
    const instance = await this.instances.getById(row.instance_id);
    assertContentManagementEnabled(instance.contentManagementEnabled);

    await rm(row.file_path, { force: true });
    this.database.run("DELETE FROM installed_content WHERE id = ?", [row.id]);
  }

  private getInstalledContentRow(id: string) {
    const row = this.database.get<InstalledContentRow>(
      "SELECT * FROM installed_content WHERE id = ?",
      [id],
    );

    if (!row) {
      throw new Error("Conteudo instalado nao encontrado.");
    }

    return row;
  }

  private async findLatestCompatibleFile(
    row: InstalledContentRow,
    instance: Awaited<ReturnType<InstanceService["getById"]>>,
  ): Promise<InstallableFile | null> {
    const loader = normalizeContentLoader(instance.loader) ?? instance.loader;

    if (!canInstallContentInLoader(row.type, instance.loader)) {
      return null;
    }

    if (row.provider === "modrinth") {
      let versions = await this.getModrinthVersions(
        row.project_id,
        row.type,
        instance.minecraftVersion,
        loader,
      );

      if (versions.length === 0) {
        versions = await this.getAllModrinthVersions(row.project_id);
      }

      const version = versions.find((candidate) =>
        isModrinthVersionCompatible(candidate, row.type, instance.minecraftVersion, loader),
      );
      const file = version?.files.find((candidate) => candidate.primary) ?? version?.files.at(0);

      if (!version || !file) {
        return null;
      }

      return {
        provider: "modrinth",
        versionId: version.id,
        name: version.name,
        fileName: file.filename,
        url: file.url,
        sha1: file.hashes.sha1,
        gameVersions: version.game_versions,
        loaders: version.loaders.filter(isLoaderType),
      };
    }

    let files = await this.getCurseForgeFiles(row.project_id, instance.minecraftVersion, loader);

    if (files.length === 0) {
      files = await this.getCurseForgeFiles(row.project_id, instance.minecraftVersion);
    }

    if (files.length === 0) {
      files = await this.getCurseForgeFiles(row.project_id);
    }

    const file = files.find((candidate) =>
      isCurseForgeFileCompatible(candidate, row.type, instance.minecraftVersion, loader),
    );

    if (!file) {
      return null;
    }

    return {
      provider: "curseforge",
      versionId: String(file.id),
      name: file.displayName ?? file.fileName,
      fileName: file.fileName,
      url: file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(row.project_id, file.id)),
      gameVersions: file.gameVersions.filter(isMinecraftVersion),
      loaders: file.gameVersions.map((version) => version.toLowerCase()).filter(isLoaderType),
    };
  }

  private async findInstallableFileForNewInstance(
    input: z.infer<typeof installAsInstanceInputSchema>,
  ): Promise<InstallableFile> {
    if (input.provider === "modrinth") {
      const versions = await this.getAllModrinthVersions(input.projectId);
      const version = input.versionId
        ? versions.find((candidate) => candidate.id === input.versionId)
        : versions.find((candidate) => {
            const loaders = candidate.loaders.filter(isLoaderType);
            return input.type === "modpack" || loaders.length > 0;
          }) ?? versions.at(0);
      const file = version?.files.find((candidate) => candidate.primary) ?? version?.files.at(0);

      if (!version || !file) {
        throw new Error("Nenhum arquivo Modrinth foi encontrado para criar a instancia.");
      }

      return {
        provider: "modrinth",
        versionId: version.id,
        name: version.name,
        fileName: file.filename,
        url: file.url,
        sha1: file.hashes.sha1,
        gameVersions: version.game_versions,
        loaders: version.loaders.filter(isLoaderType),
      };
    }

    const files = await this.getCurseForgeFiles(input.projectId);
    const file = input.versionId
      ? files.find((candidate) => String(candidate.id) === input.versionId)
      : files.find((candidate) => {
          const loaders = candidate.gameVersions
            .map((version) => version.toLowerCase())
            .filter(isLoaderType);
          return input.type === "modpack" || loaders.length > 0;
        }) ?? files.at(0);

    if (!file) {
      throw new Error("Nenhum arquivo CurseForge foi encontrado para criar a instancia.");
    }

    return {
      provider: "curseforge",
      versionId: String(file.id),
      name: file.displayName ?? file.fileName,
      fileName: file.fileName,
      url: file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(input.projectId, file.id)),
      gameVersions: file.gameVersions.filter(isMinecraftVersion),
      loaders: file.gameVersions.map((version) => version.toLowerCase()).filter(isLoaderType),
    };
  }

  private async searchModrinth(
    input: z.infer<typeof searchInputSchema>,
  ): Promise<ContentSearchResult[]> {
    const facets = [[`project_type:${input.type}`]];
    const loader = normalizeContentLoader(input.loader);

    if (input.minecraftVersion) {
      facets.push([`versions:${input.minecraftVersion}`]);
    }

    if (
      loader &&
      loader !== "vanilla" &&
      (input.type === "mod" || input.type === "modpack")
    ) {
      facets.push([`categories:${loader}`]);
    }

    const params = new URLSearchParams({
      query: input.query,
      limit: String(input.limit),
      offset: String(input.offset),
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
    const loader = normalizeContentLoader(input.loader);
    const pageSize = Math.min(input.limit, 50);
    const pages = Math.max(1, Math.ceil(input.limit / pageSize));
    const projects: z.infer<typeof curseForgeSearchSchema>["data"] = [];

    for (let page = 0; page < pages; page += 1) {
      const params = new URLSearchParams({
        gameId: String(MINECRAFT_GAME_ID),
        pageSize: String(pageSize),
        index: String(input.offset + page * pageSize),
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

      const modLoaderType = mapCurseForgeModLoader(loader);

      if (modLoaderType && (input.type === "mod" || input.type === "modpack")) {
        params.set("modLoaderType", String(modLoaderType));
      }

      const response = await this.fetchCurseForge(`/mods/search?${params}`, "Buscar projetos na CurseForge");

      if (!response.ok) {
        throw new Error(`CurseForge retornou erro ${response.status}.`);
      }

      const json = curseForgeSearchSchema.parse(await response.json());
      projects.push(...json.data);

      if (json.data.length < pageSize) {
        break;
      }
    }

    return projects.map((project) => ({
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
    assertContentManagementEnabled(instance.contentManagementEnabled);

    if (!canInstallContentInLoader(input.type, instance.loader)) {
      throw new Error(contentInstallBlockReason(input.type, instance.loader));
    }

    if (installedProjectIds.has(input.projectId)) {
      return [];
    }

    installedProjectIds.add(input.projectId);

    const loader = normalizeContentLoader(instance.loader) ?? instance.loader;
    let versions = await this.getModrinthVersions(
      input.projectId,
      input.type,
      instance.minecraftVersion,
      loader,
    );
    const selectedVersionMissing =
      input.versionId && !versions.some((candidate) => candidate.id === input.versionId);

    if (versions.length === 0 || selectedVersionMissing) {
      versions = await this.getAllModrinthVersions(input.projectId);
    }

    const compatibleVersions = versions.filter((candidate) =>
      isModrinthVersionCompatible(candidate, input.type, instance.minecraftVersion, loader),
    );
    const version = input.versionId
      ? compatibleVersions.find((candidate) => candidate.id === input.versionId)
      : compatibleVersions.at(0);

    if (!version) {
      throw new Error(
        input.versionId
          ? "A versao Modrinth escolhida nao e compativel com esta instancia."
          : "Nenhum arquivo Modrinth compativel foi encontrado para esta instancia.",
      );
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
    const contentLoader = normalizeContentLoader(loader);
    const params = new URLSearchParams({
      game_versions: JSON.stringify([minecraftVersion]),
    });

    if ((type === "mod" || type === "modpack") && contentLoader !== "vanilla") {
      params.set("loaders", JSON.stringify([contentLoader]));
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

  private async getAllModrinthVersions(projectId: string) {
    const response = await fetchWithElectronNet(
      `${MODRINTH_API}/project/${projectId}/version`,
      "Buscar todos os arquivos no Modrinth",
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
          normalizeContentLoader(input.loader) ?? "vanilla",
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
      this.getCurseForgeFiles(
        input.projectId,
        input.minecraftVersion,
        normalizeContentLoader(input.loader),
      ),
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
    const files: z.infer<typeof curseForgeFilesSchema>["data"] = [];
    const pageSize = 50;
    const maxFiles = minecraftVersion ? 1000 : 1500;

    for (let index = 0; index < maxFiles; index += pageSize) {
      const params = new URLSearchParams({
        pageSize: String(pageSize),
        index: String(index),
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

      const page = curseForgeFilesSchema.parse(await response.json()).data;
      files.push(...page);

      if (page.length < pageSize) {
        break;
      }
    }

    return files;
  }

  private async installCurseForge(
    input: z.infer<typeof installInputSchema>,
  ): Promise<InstalledContent> {
    const instance = await this.instances.getById(input.instanceId);
    assertContentManagementEnabled(instance.contentManagementEnabled);

    if (!canInstallContentInLoader(input.type, instance.loader)) {
      throw new Error(contentInstallBlockReason(input.type, instance.loader));
    }
    const loader = normalizeContentLoader(instance.loader) ?? instance.loader;
    let files = await this.getCurseForgeFiles(
      input.projectId,
      instance.minecraftVersion,
      loader,
    );
    const selectedFileMissing =
      input.versionId && !files.some((candidate) => String(candidate.id) === input.versionId);

    if (files.length === 0 || selectedFileMissing) {
      files = await this.getCurseForgeFiles(input.projectId, instance.minecraftVersion);
    }

    if (
      files.length === 0 ||
      (input.versionId && !files.some((candidate) => String(candidate.id) === input.versionId))
    ) {
      files = await this.getCurseForgeFiles(input.projectId);
    }

    const compatibleFiles = files.filter((candidate) =>
      isCurseForgeFileCompatible(candidate, input.type, instance.minecraftVersion, loader),
    );
    const file = input.versionId
      ? compatibleFiles.find((candidate) => String(candidate.id) === input.versionId)
      : compatibleFiles.find((candidate) =>
        candidate.gameVersions.some((version) =>
          isMinecraftVersionCompatible(version, instance.minecraftVersion),
        ),
      ) ?? compatibleFiles.at(0);

    if (!file) {
      throw new Error(
        input.versionId
          ? "A versao CurseForge escolhida nao e compativel com esta instancia."
          : "Nenhum arquivo CurseForge compativel foi encontrado.",
      );
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
        (id, instance_id, provider, type, project_id, version_id, name, file_name, file_path, enabled, installed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        1,
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
      enabled: true,
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
  switch (normalizeContentLoader(loader)) {
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

const normalizeContentLoader = (loader?: LoaderType): LoaderType | undefined => {
  if (loader === "iris" || loader === "iris-sodium") {
    return "fabric";
  }

  return loader;
};

const canInstallContentInLoader = (type: ContentType, loader: LoaderType) => {
  if (type === "resourcepack") {
    return true;
  }

  if (type === "shader") {
    return loader === "iris" || loader === "iris-sodium";
  }

  return loader !== "vanilla";
};

const contentInstallBlockReason = (type: ContentType, loader: LoaderType) => {
  if (type === "shader") {
    return loader === "vanilla"
      ? "Shaders precisam de um motor grÃ¡fico. Crie uma instÃ¢ncia Iris ou Iris + Sodium."
      : "Este shader nÃ£o Ã© compatÃ­vel com o motor grÃ¡fico desta instÃ¢ncia.";
  }

  if (type === "modpack") {
    return "Modpacks precisam de uma instÃ¢ncia com loader compatÃ­vel.";
  }

  if (type === "mod") {
    return "Mods exigem uma instÃ¢ncia com Fabric, Forge, NeoForge, Quilt, Iris ou Iris + Sodium.";
  }

  return "Este conteÃºdo nÃ£o Ã© compatÃ­vel com a instÃ¢ncia selecionada.";
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

const downloadImageToTemp = async (url: string, projectId: string) => {
  const response = await fetchWithElectronNet(url, "Baixar icone do projeto");

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar o icone do projeto (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension = imageExtensionFromUrl(url, contentType);
  const directory = path.join(os.tmpdir(), "mlultimate-content-icons");
  const filePath = path.join(directory, `${sanitizeFileName(projectId)}-${randomUUID()}${extension}`);

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));

  return filePath;
};

const imageExtensionFromUrl = (url: string, contentType: string) => {
  const extension = path.extname(new URL(url).pathname).toLowerCase();

  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    return extension;
  }

  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  return ".png";
};

const chooseMinecraftVersion = (versions: string[]) => {
  const version = latestGameVersion(versions) ?? versions.find(isMinecraftVersion);

  if (!version) {
    throw new Error("O arquivo nao informa uma versao valida do Minecraft.");
  }

  return version;
};

const chooseLoaderForNewModInstance = (loaders: LoaderType[]): LoaderType => {
  const loader = loaders.find((candidate) => candidate !== "vanilla");

  if (!loader) {
    throw new Error("O mod nao informa loader compativel para criar uma instancia nova.");
  }

  return loader;
};

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

const isModrinthVersionCompatible = (
  version: z.infer<typeof modrinthVersionSchema>,
  type: ContentType,
  minecraftVersion: string,
  loader: LoaderType,
) => {
  const gameOk =
    version.game_versions.length === 0 ||
    version.game_versions.some((candidate) =>
      isMinecraftVersionCompatible(candidate, minecraftVersion),
    );

  if (!gameOk) {
    return false;
  }

  if (type === "resourcepack" || type === "shader" || loader === "vanilla") {
    return true;
  }

  const loaders = version.loaders
    .map((candidate) => candidate.toLowerCase())
    .filter(isLoaderType);

  return loaders.length === 0 || loaders.includes(loader);
};

const isCurseForgeFileCompatible = (
  file: z.infer<typeof curseForgeFilesSchema>["data"][number],
  type: ContentType,
  minecraftVersion: string,
  loader: LoaderType,
) => {
  const gameVersions = file.gameVersions.filter(isMinecraftVersion);
  const gameOk =
    gameVersions.length === 0 ||
    gameVersions.some((candidate) => isMinecraftVersionCompatible(candidate, minecraftVersion));

  if (!gameOk) {
    return false;
  }

  if (type === "resourcepack" || type === "shader" || loader === "vanilla") {
    return true;
  }

  const loaders = file.gameVersions
    .map((candidate) => candidate.toLowerCase())
    .filter(isLoaderType);

  return loaders.length === 0 || loaders.includes(loader);
};

const isMinecraftVersionCompatible = (candidate: string, target: string) => {
  const normalizedCandidate = candidate.trim().toLowerCase();
  const normalizedTarget = target.trim().toLowerCase();

  if (normalizedCandidate === normalizedTarget) {
    return true;
  }

  if (normalizedCandidate.endsWith(".x")) {
    return normalizedTarget.startsWith(normalizedCandidate.slice(0, -1));
  }

  return false;
};

const isLoaderType = (value: string): value is LoaderType =>
  ["vanilla", "fabric", "iris", "iris-sodium", "forge", "neoforge", "quilt"].includes(value);

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
  enabled: row.enabled !== 0,
  installedAt: row.installed_at,
});

const assertContentManagementEnabled = (enabled: boolean) => {
  if (!enabled) {
    throw new Error(
      "Gerenciamento de conteudo desativado para este perfil. Ative nas opcoes da instancia antes de alterar mods, texturas ou shaders.",
    );
  }
};

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
