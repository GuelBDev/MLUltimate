import AdmZip from "adm-zip";
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
  ModpackContentEntry,
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
  includeModpackContent: z.boolean().optional().default(true),
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
  categories: z.array(z.string()).optional().default([]),
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

const modrinthProjectIconSchema = z.object({
  id: z.string(),
  icon_url: z.string().nullable().optional(),
});

const modrinthVersionSchema = z.object({
  id: z.string(),
  project_id: z.string().optional(),
  name: z.string(),
  version_number: z.string().optional(),
  date_published: z.string().optional(),
  downloads: z.number().optional(),
  version_type: z.enum(["release", "beta", "alpha"]).optional(),
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
        version_id: z.string().nullable().optional(),
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
      links: z.object({ websiteUrl: z.string().nullable().optional() }).optional(),
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
    classId: z.number().optional(),
    name: z.string(),
    slug: z.string().optional(),
    summary: z.string().default(""),
    downloadCount: z.number().optional(),
    logo: z.object({ url: z.string().optional() }).nullable().optional(),
    links: z
      .object({
        websiteUrl: z.string().nullable().optional(),
        sourceUrl: z.string().nullable().optional(),
      })
      .optional(),
    authors: z.array(z.object({ name: z.string() })).optional(),
    dateModified: z.string().optional(),
    mainFileId: z.number().optional(),
    categories: z
      .array(
        z.object({
          name: z.string(),
        }),
      )
      .optional()
      .default([]),
    screenshots: z
      .array(
        z.object({
          title: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
          thumbnailUrl: z.string().optional(),
          url: z.string(),
        }),
      )
      .optional()
      .default([]),
  }),
});

const curseForgeProjectsSchema = z.object({
  data: z.array(curseForgeProjectSchema.shape.data),
});

const curseForgeFileDataSchema = z.object({
  id: z.number(),
  displayName: z.string().optional(),
  fileName: z.string(),
  downloadUrl: z.string().nullable().optional(),
  gameVersions: z.array(z.string()).default([]),
  isAvailable: z.boolean().optional().default(true),
  isServerPack: z.boolean().optional().default(false),
  dependencies: z
    .array(
      z.object({
        modId: z.number(),
        relationType: z.number(),
      }),
    )
    .optional()
    .default([]),
  hashes: z
    .array(
      z.object({
        algo: z.number(),
        value: z.string(),
      }),
    )
    .optional()
    .default([]),
  fileDate: z.string().optional(),
  downloadCount: z.number().optional(),
  releaseType: z.number().optional(),
});

const curseForgeFilesSchema = z.object({
  data: z.array(curseForgeFileDataSchema),
});

const curseForgeFileSchema = z.object({
  data: curseForgeFileDataSchema,
});

const stringResponseSchema = z.object({ data: z.string() });

const curseForgeManifestPreviewSchema = z.object({
  files: z
    .array(
      z.object({
        projectID: z.number(),
        fileID: z.number(),
        required: z.boolean().optional().default(true),
      }),
    )
    .default([]),
  overrides: z.string().optional().default("overrides"),
});

const modrinthIndexPreviewSchema = z.object({
  files: z
    .array(
      z.object({
        path: z.string(),
        hashes: z.object({ sha1: z.string().optional() }).optional(),
        env: z
          .object({
            client: z.string().optional(),
          })
          .optional(),
      }),
    )
    .default([]),
});

const modrinthContentProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon_url: z.string().nullable().optional(),
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
  icon_url?: string | null;
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
  private readonly projectIconCache = new Map<string, string | null>();
  private readonly modpackContentCache = new Map<string, ModpackContentEntry[]>();

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
          visible: false,
        });

        const instance = await this.instances.importArchiveFile(archivePath);
        const updated = await this.instances.update({
          id: instance.id,
          name: project.title,
          iconPath,
          contentManagementEnabled: true,
        });
        return this.instances.setSourceMetadata(updated.id, {
          provider: parsed.provider,
          projectId: parsed.projectId,
          versionId: selected.versionId,
          projectSlug: project.slug,
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

    return this.instances.setSourceMetadata(instance.id, {
      provider: parsed.provider,
      projectId: parsed.projectId,
      versionId: selected.versionId,
      projectSlug: project.slug,
    });
  }

  async getProject(input: ContentProjectInput): Promise<ContentProjectDetails> {
    const parsed = projectInputSchema.parse(input);

    if (parsed.provider === "modrinth") {
      return this.getModrinthProject(parsed);
    }

    return this.getCurseForgeProject(parsed);
  }

  async listInstalled(instanceId: string) {
    await this.instances.restoreLockedContent(instanceId);

    const rows = this.database.all<InstalledContentRow>(
      "SELECT * FROM installed_content WHERE instance_id = ? ORDER BY installed_at DESC",
      [instanceId],
    );

    await this.hydrateContentIcons(rows);

    return this.database
      .all<InstalledContentRow>(
        "SELECT * FROM installed_content WHERE instance_id = ? ORDER BY installed_at DESC",
        [instanceId],
      )
      .map(rowToInstalledContent);
  }

  async hydrateInstanceContentImages(
    instanceId: string,
    types: ContentType[] = ["mod", "resourcepack", "shader"],
  ) {
    await this.instances.restoreLockedContent(instanceId);

    if (types.length === 0) return;

    const placeholders = types.map(() => "?").join(", ");
    const rows = this.database.all<InstalledContentRow>(
      `SELECT * FROM installed_content WHERE instance_id = ? AND type IN (${placeholders})`,
      [instanceId, ...types],
    );

    await this.hydrateContentIcons(rows);
  }

  async checkInstalledUpdates(instanceId: string) {
    await this.instances.restoreLockedContent(instanceId);

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
    assertContentManagementEnabled(instance.contentManagementEnabled, row.type);

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
    assertContentManagementEnabled(instance.contentManagementEnabled, input.type);

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
    assertContentManagementEnabled(instance.contentManagementEnabled, row.type);

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
    assertContentManagementEnabled(instance.contentManagementEnabled, row.type);

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

  private async hydrateContentIcons(rows: InstalledContentRow[]) {
    const missing = rows.filter((row) => !row.icon_url);

    if (missing.length === 0) {
      return;
    }

    const updates = [
      ...(await this.resolveModrinthContentIcons(
        missing.filter((row) => row.provider === "modrinth"),
      )),
      ...(await this.resolveCurseForgeContentIcons(
        missing.filter((row) => row.provider === "curseforge"),
      )),
    ];

    this.database.runMany(
      "UPDATE installed_content SET icon_url = ? WHERE id = ?",
      updates.map((update) => [update.iconUrl, update.id]),
    );
  }

  private async resolveModrinthContentIcons(rows: InstalledContentRow[]) {
    if (rows.length === 0) {
      return [];
    }

    const projectIdByRow = new Map<string, string>();
    const hashRows = rows.filter((row) => isSha1(row.project_id));
    const directRows = rows.filter((row) => !isSha1(row.project_id));

    for (const row of directRows) {
      projectIdByRow.set(row.id, row.project_id);
    }

    for (const group of chunk(hashRows, 100)) {
      const hashes = group.map((row) => row.project_id);
      const response = await net.fetch(`${MODRINTH_API}/version_files`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "MLUltimateLauncher/0.1 (+https://local)",
        },
        body: JSON.stringify({ hashes, algorithm: "sha1" }),
      }).catch(() => null);

      if (!response?.ok) {
        continue;
      }

      const versions = z
        .record(z.string(), modrinthVersionSchema.nullable())
        .parse(await response.json());

      for (const row of group) {
        const projectId = versions[row.project_id]?.project_id;

        if (projectId) {
          projectIdByRow.set(row.id, projectId);
        }
      }
    }

    const projectIds = Array.from(new Set(projectIdByRow.values()));
    const icons = await this.getModrinthProjectIcons(projectIds);

    return rows.flatMap((row) => {
      const projectId = projectIdByRow.get(row.id);
      const iconUrl = projectId ? icons.get(projectId) : undefined;
      return iconUrl ? [{ id: row.id, iconUrl }] : [];
    });
  }

  private async getModrinthProjectIcons(projectIds: string[]) {
    const icons = new Map<string, string>();
    const uncached = projectIds.filter((projectId) => {
      const cached = this.projectIconCache.get(`modrinth:${projectId}`);

      if (cached) {
        icons.set(projectId, cached);
      }

      return cached === undefined;
    });

    for (const group of chunk(uncached, 100)) {
      const params = new URLSearchParams({ ids: JSON.stringify(group) });
      const response = await fetchWithElectronNet(
        `${MODRINTH_API}/projects?${params}`,
        "Buscar imagens dos projetos no Modrinth",
      ).catch(() => null);

      if (!response?.ok) {
        continue;
      }

      const projects = z.array(modrinthProjectIconSchema).parse(await response.json());

      for (const project of projects) {
        const iconUrl = project.icon_url ?? null;
        this.projectIconCache.set(`modrinth:${project.id}`, iconUrl);

        if (iconUrl) {
          icons.set(project.id, iconUrl);
        }
      }

      for (const projectId of group) {
        if (!projects.some((project) => project.id === projectId)) {
          this.projectIconCache.set(`modrinth:${projectId}`, null);
        }
      }
    }

    return icons;
  }

  private async resolveCurseForgeContentIcons(rows: InstalledContentRow[]) {
    if (rows.length === 0) {
      return [];
    }

    const icons = new Map<string, string>();
    const projectIds = Array.from(new Set(rows.map((row) => row.project_id)));
    const uncached = projectIds.filter((projectId) => {
      const cached = this.projectIconCache.get(`curseforge:${projectId}`);

      if (cached) {
        icons.set(projectId, cached);
      }

      return cached === undefined;
    });

    await runPool(uncached, 12, async (projectId) => {
      const response = await this.fetchCurseForge(
        `/mods/${projectId}`,
        "Buscar imagem do projeto na CurseForge",
      ).catch(() => null);

      if (!response?.ok) {
        return;
      }

      const project = curseForgeProjectSchema.parse(await response.json()).data;
      const iconUrl = project.logo?.url ?? null;
      this.projectIconCache.set(`curseforge:${projectId}`, iconUrl);

      if (iconUrl) {
        icons.set(projectId, iconUrl);
      }
    });

    return rows.flatMap((row) => {
      const iconUrl = icons.get(row.project_id);
      return iconUrl ? [{ id: row.id, iconUrl }] : [];
    });
  }

  private async findLatestCompatibleFile(
    row: InstalledContentRow,
    instance: Awaited<ReturnType<InstanceService["getById"]>>,
  ): Promise<InstallableFile | null> {
    const loader = normalizeContentLoader(instance.loader) ?? instance.loader;

    if (!canInstallContentInInstance(row.type, instance)) {
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

    let files = await this.getCurseForgeFiles(row.project_id, instance.minecraftVersion, loader, row.type);

    if (files.length === 0) {
      files = await this.getCurseForgeFiles(row.project_id, instance.minecraftVersion, undefined, row.type);
    }

    if (files.length === 0) {
      files = await this.getCurseForgeFiles(row.project_id, undefined, undefined, row.type);
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
      url: file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(row.project_id, file.id).catch(() =>
        curseForgeCdnDownloadUrl(file),
      )),
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

    if (input.versionId) {
      const file = await this.getCurseForgeFile(input.projectId, input.versionId);

      if (input.type === "modpack" && (file.isServerPack || !file.fileName.toLowerCase().endsWith(".zip"))) {
        throw new Error("A versao CurseForge escolhida nao possui um pacote de modpack instalavel.");
      }

      return {
        provider: "curseforge",
        versionId: String(file.id),
        name: file.displayName ?? file.fileName,
        fileName: file.fileName,
        url: file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(input.projectId, file.id).catch(() =>
          curseForgeCdnDownloadUrl(file),
        )),
        sha1: curseForgeSha1(file),
        gameVersions: file.gameVersions.filter(isMinecraftVersion),
        loaders: file.gameVersions.map((version) => version.toLowerCase()).filter(isLoaderType),
      };
    }

    const files = await this.getCurseForgeFiles(input.projectId, undefined, undefined, input.type);
    const file = input.versionId
      ? files.find((candidate) => String(candidate.id) === input.versionId)
      : files.find((candidate) => {
          const loaders = candidate.gameVersions
            .map((version) => version.toLowerCase())
            .filter(isLoaderType);
          return input.type === "modpack"
            ? !candidate.isServerPack && candidate.fileName.toLowerCase().endsWith(".zip")
            : loaders.length > 0;
        }) ?? files.at(0);

    if (!file) {
      throw new Error("Nenhum arquivo CurseForge foi encontrado para criar a instancia.");
    }

    return {
      provider: "curseforge",
      versionId: String(file.id),
      name: file.displayName ?? file.fileName,
      fileName: file.fileName,
      url: file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(input.projectId, file.id).catch(() =>
        curseForgeCdnDownloadUrl(file),
      )),
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
      providerProjects: {
        modrinth: {
          projectId: hit.project_id,
          slug: hit.slug,
        },
      },
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
      providerProjects: {
        curseforge: {
          projectId: String(project.id),
          slug: project.slug,
        },
      },
      type: input.type,
      projectId: String(project.id),
      slug: project.slug,
      title: project.name,
      author: project.authors?.map((author) => author.name).join(", "),
      description: project.summary,
      downloads: project.downloadCount,
      iconUrl: project.logo?.url,
      projectUrl: project.links?.websiteUrl ?? undefined,
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
    assertContentManagementEnabled(instance.contentManagementEnabled, input.type);

    if (!canInstallContentInInstance(input.type, instance)) {
      throw new Error(contentInstallBlockReason(input.type, instance));
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
      if (dependency.dependency_type !== "required") {
        continue;
      }

      let dependencyProjectId = dependency.project_id ?? undefined;
      let dependencyVersionId = dependency.version_id ?? undefined;

      if (!dependencyProjectId && dependencyVersionId) {
        const dependencyVersion = await this.getModrinthVersionById(dependencyVersionId);
        dependencyProjectId = dependencyVersion.project_id;
        dependencyVersionId = dependencyVersion.id;
      }

      if (!dependencyProjectId) {
        continue;
      }

      dependencies.push(
        ...(await this.installModrinth(
          {
            provider: "modrinth",
            type: "mod",
            projectId: dependencyProjectId,
            instanceId: input.instanceId,
            versionId: dependencyVersionId,
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

  private async getModrinthVersionById(versionId: string) {
    const response = await fetchWithElectronNet(
      `${MODRINTH_API}/version/${versionId}`,
      "Buscar versao no Modrinth",
    );

    if (!response.ok) {
      throw new Error(`Modrinth retornou erro ${response.status} ao buscar versao.`);
    }

    return modrinthVersionSchema.parse(await response.json());
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
    const modpackContent =
      input.type === "modpack" && input.includeModpackContent && versions[0]
        ? await this.getModrinthModpackContent(project.id, versions[0]).catch(() => [])
        : undefined;

    return {
      provider: "modrinth",
      providers: ["modrinth"],
      providerProjects: {
        modrinth: {
          projectId: project.id,
          slug: project.slug,
        },
      },
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
      categories: project.categories,
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
      modpackContent,
      commentsNote: "Comentários não são expostos pela API pública do Modrinth.",
      contentNote: "Conteúdo instalado é listado na tela da instância.",
    };
  }

  private async getCurseForgeProject(
    input: z.infer<typeof projectInputSchema>,
  ): Promise<ContentProjectDetails> {
    const [projectResponse, descriptionResponse, filesResponse] = await Promise.all([
      this.fetchCurseForge(`/mods/${input.projectId}`, "Buscar detalhes na CurseForge"),
      this.fetchCurseForge(
        `/mods/${input.projectId}/description`,
        "Buscar descricao na CurseForge",
      ).catch(() => null),
      this.getCurseForgeFiles(
        input.projectId,
        input.minecraftVersion,
        normalizeContentLoader(input.loader),
        input.type,
      ),
    ]);

    if (!projectResponse.ok) {
      throw new Error(`CurseForge retornou erro ${projectResponse.status} ao buscar detalhes.`);
    }

    const project = curseForgeProjectSchema.parse(await projectResponse.json()).data;
    const visibleFiles =
      input.type === "modpack"
        ? filesResponse.filter(
            (file) => !file.isServerPack && file.fileName.toLowerCase().endsWith(".zip"),
          )
        : filesResponse;
    const contentVersions = visibleFiles.map((file) => toCurseForgeContentVersion(file));
    const description =
      descriptionResponse?.ok
        ? htmlToPlainText(stringResponseSchema.parse(await descriptionResponse.json()).data)
        : project.summary;
    const latestFile = visibleFiles[0];

    if (latestFile && contentVersions[0]) {
      const changelogResponse = await this.fetchCurseForge(
        `/mods/${input.projectId}/files/${latestFile.id}/changelog`,
        "Buscar changelog na CurseForge",
      ).catch(() => null);

      if (changelogResponse?.ok) {
        contentVersions[0].changelog = htmlToPlainText(
          stringResponseSchema.parse(await changelogResponse.json()).data,
        );
      }
    }

    const modpackContent =
      input.type === "modpack" && input.includeModpackContent && latestFile
        ? await this.getCurseForgeModpackContent(project.id, latestFile).catch((error) => {
            console.warn("Falha ao inspecionar manifesto CurseForge", error);
            return [];
          })
        : undefined;

    return {
      provider: "curseforge",
      providers: ["curseforge"],
      providerProjects: {
        curseforge: {
          projectId: String(project.id),
          slug: project.slug,
        },
      },
      type: input.type,
      projectId: String(project.id),
      slug: project.slug,
      title: project.name,
      author: project.authors?.map((author) => author.name).join(", "),
      description: project.summary,
      body: description,
      downloads: project.downloadCount,
      iconUrl: project.logo?.url,
      projectUrl: project.links?.websiteUrl ?? undefined,
      sourceUrl: project.links?.sourceUrl ?? undefined,
      updatedAt: project.dateModified,
      latestGameVersion: latestGameVersion(contentVersions.flatMap((version) => version.gameVersions)),
      compatibleGameVersions: compactGameVersions(
        contentVersions.flatMap((version) => version.gameVersions),
      ),
      compatibleLoaders: Array.from(
        new Set(contentVersions.flatMap((version) => version.loaders)),
      ),
      categories: project.categories.map((category) => category.name),
      gallery: project.screenshots.map((image) => ({
        url: image.url,
        title: image.title ?? undefined,
        description: image.description ?? undefined,
      })),
      versions: contentVersions,
      modpackContent,
      commentsNote: "Comentários não são expostos pela Core API oficial da CurseForge.",
      contentNote: "Arquivos do projeto aparecem em Versions.",
    };
  }

  private async getCurseForgeFiles(
    projectId: string,
    minecraftVersion?: string,
    loader?: LoaderType,
    type?: ContentType,
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

      const shouldFilterByLoader = !type || type === "mod" || type === "modpack";
      const modLoaderType = shouldFilterByLoader ? mapCurseForgeModLoader(loader) : null;

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

  private async getCurseForgeFile(projectId: string, fileId: string | number) {
    const response = await this.fetchCurseForge(
      `/mods/${projectId}/files/${fileId}`,
      "Buscar arquivo exato na CurseForge",
    );

    if (!response.ok) {
      throw new Error(`CurseForge retornou erro ${response.status} ao buscar o arquivo exato.`);
    }

    return curseForgeFileSchema.parse(await response.json()).data;
  }

  private async installCurseForge(
    input: z.infer<typeof installInputSchema>,
    installedProjectIds = new Set<string>(),
  ): Promise<InstalledContent> {
    const instance = await this.instances.getById(input.instanceId);
    assertContentManagementEnabled(instance.contentManagementEnabled, input.type);

    if (!canInstallContentInInstance(input.type, instance)) {
      throw new Error(contentInstallBlockReason(input.type, instance));
    }

    if (installedProjectIds.has(input.projectId)) {
      const existing = this.database.get<InstalledContentRow>(
        "SELECT * FROM installed_content WHERE instance_id = ? AND provider = ? AND project_id = ? ORDER BY installed_at DESC LIMIT 1",
        [input.instanceId, "curseforge", input.projectId],
      );

      if (existing) {
        return rowToInstalledContent(existing);
      }
    }

    installedProjectIds.add(input.projectId);
    const loader = normalizeContentLoader(instance.loader) ?? instance.loader;
    const file = input.versionId
      ? await this.getCurseForgeFile(input.projectId, input.versionId)
      : await this.findLatestCurseForgeFileForInstall(input.projectId, input.type, instance.minecraftVersion, loader);

    if (!file || !isCurseForgeFileCompatible(file, input.type, instance.minecraftVersion, loader)) {
      throw new Error(
        input.versionId
          ? "A versao CurseForge escolhida nao e compativel com esta instancia."
          : "Nenhum arquivo CurseForge compativel foi encontrado.",
      );
    }

    const downloadUrl =
      file.downloadUrl ?? (await this.getCurseForgeDownloadUrl(input.projectId, file.id).catch(() =>
        curseForgeCdnDownloadUrl(file),
      ));

    const installed = await this.installFile({
      instanceId: instance.id,
      provider: "curseforge",
      type: input.type,
      projectId: input.projectId,
      versionId: String(file.id),
      name: file.displayName ?? file.fileName,
      fileName: file.fileName,
      url: downloadUrl,
      sha1: curseForgeSha1(file),
      gameDir: instance.gameDir,
    });

    if (input.type !== "mod") {
      return installed;
    }

    for (const dependency of file.dependencies) {
      if (dependency.relationType !== 3) {
        continue;
      }

      await this.installCurseForge(
        {
          provider: "curseforge",
          type: "mod",
          projectId: String(dependency.modId),
          instanceId: input.instanceId,
        },
        installedProjectIds,
      );
    }

    return installed;
  }

  private async findLatestCurseForgeFileForInstall(
    projectId: string,
    type: ContentType,
    minecraftVersion: string,
    loader: LoaderType,
  ) {
    let files = await this.getCurseForgeFiles(projectId, minecraftVersion, loader, type);

    if (files.length === 0) {
      files = await this.getCurseForgeFiles(projectId, minecraftVersion, undefined, type);
    }

    if (files.length === 0) {
      files = await this.getCurseForgeFiles(projectId, undefined, undefined, type);
    }

    const compatibleFiles = files.filter((candidate) =>
      isCurseForgeFileCompatible(candidate, type, minecraftVersion, loader),
    );

    return compatibleFiles.find((candidate) =>
      candidate.gameVersions.some((version) => isMinecraftVersionCompatible(version, minecraftVersion)),
    ) ?? compatibleFiles.at(0);
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

  private async getCurseForgeModpackContent(
    projectId: number,
    file: z.infer<typeof curseForgeFileDataSchema>,
  ): Promise<ModpackContentEntry[]> {
    const cacheKey = `curseforge:${projectId}:${file.id}`;
    const cached = this.modpackContentCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const downloadUrl =
      file.downloadUrl ??
      (await this.getCurseForgeDownloadUrl(String(projectId), file.id).catch(() =>
        curseForgeCdnDownloadUrl(file),
      ));
    const archive = await this.downloadArchiveForInspection(
      downloadUrl,
      file.fileName,
      `Inspecionar ${file.displayName ?? file.fileName}`,
    );

    try {
      const zip = new AdmZip(archive);
      const manifestEntry = zip.getEntry("manifest.json");

      if (!manifestEntry) {
        return [];
      }

      const manifest = curseForgeManifestPreviewSchema.parse(
        JSON.parse(manifestEntry.getData().toString("utf8")),
      );
      const projectIds = Array.from(new Set(manifest.files.map((item) => item.projectID)));
      const projects = await this.getCurseForgeProjects(projectIds);
      const projectMap = new Map(projects.map((project) => [project.id, project]));
      const fallbackFiles = new Map<
        string,
        z.infer<typeof curseForgeFileDataSchema>
      >();
      const missingRefs = manifest.files.filter(
        (item) => !projectMap.has(item.projectID),
      );

      await runPool(missingRefs, 8, async (item) => {
        const resolved = await this.getCurseForgeFile(
          String(item.projectID),
          item.fileID,
        ).catch(() => null);

        if (resolved) {
          fallbackFiles.set(`${item.projectID}:${item.fileID}`, resolved);
        }
      });
      const entries: ModpackContentEntry[] = manifest.files.map((item) => {
        const project = projectMap.get(item.projectID);
        const fallbackFile = fallbackFiles.get(`${item.projectID}:${item.fileID}`);

        return {
          provider: "curseforge",
          projectId: String(item.projectID),
          versionId: String(item.fileID),
          category: contentCategoryFromCurseForgeClassId(project?.classId),
          name:
            project?.name ??
            fallbackFile?.displayName ??
            fallbackFile?.fileName ??
            `Projeto ${item.projectID}`,
          fileName: fallbackFile?.fileName,
          iconUrl: project?.logo?.url,
          required: item.required,
        };
      });

      entries.push(
        ...listOverrideContent(
          zip,
          manifest.overrides,
          "curseforge",
          String(projectId),
          String(file.id),
        ),
      );
      this.modpackContentCache.set(cacheKey, entries);
      return entries;
    } finally {
      await rm(path.dirname(archive), { recursive: true, force: true });
    }
  }

  private async getModrinthModpackContent(
    projectId: string,
    version: z.infer<typeof modrinthVersionSchema>,
  ): Promise<ModpackContentEntry[]> {
    const cacheKey = `modrinth:${projectId}:${version.id}`;
    const cached = this.modpackContentCache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const primary = version.files.find((file) => file.primary) ?? version.files[0];

    if (!primary) {
      return [];
    }

    const archive = await this.downloadArchiveForInspection(
      primary.url,
      primary.filename,
      `Inspecionar ${version.name}`,
    );

    try {
      const zip = new AdmZip(archive);
      const indexEntry = zip.getEntry("modrinth.index.json");

      if (!indexEntry) {
        return [];
      }

      const index = modrinthIndexPreviewSchema.parse(
        JSON.parse(indexEntry.getData().toString("utf8")),
      );
      const hashes = index.files
        .map((file) => file.hashes?.sha1)
        .filter((hash): hash is string => Boolean(hash));
      const versionsByHash = new Map<
        string,
        z.infer<typeof modrinthVersionSchema> | null
      >();

      for (const group of chunk(hashes, 100)) {
        const response = await fetchWithElectronNet(
          `${MODRINTH_API}/version_files`,
          {
            context: "Resolver conteudo do modpack no Modrinth",
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ hashes: group, algorithm: "sha1" }),
          },
        );

        if (response.ok) {
          const resolved = z
            .record(z.string(), modrinthVersionSchema.nullable())
            .parse(await response.json());

          for (const [hash, resolvedVersion] of Object.entries(resolved)) {
            versionsByHash.set(hash, resolvedVersion);
          }
        }
      }

      const resolvedProjectIds = Array.from(
        new Set(
          [...versionsByHash.values()]
            .map((item) => item?.project_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const projects = await this.getModrinthContentProjects(resolvedProjectIds);
      const projectMap = new Map(projects.map((project) => [project.id, project]));
      const entries: ModpackContentEntry[] = index.files.map((file) => {
        const resolved = file.hashes?.sha1
          ? versionsByHash.get(file.hashes.sha1)
          : undefined;
        const project = resolved?.project_id
          ? projectMap.get(resolved.project_id)
          : undefined;

        return {
          provider: "modrinth",
          projectId: resolved?.project_id ?? projectId,
          versionId: resolved?.id ?? version.id,
          category: categoryFromArchivePath(file.path),
          name: project?.title ?? displayNameFromFile(file.path),
          fileName: path.basename(file.path),
          iconUrl: project?.icon_url ?? undefined,
          required: file.env?.client !== "unsupported",
        };
      });

      entries.push(
        ...listOverrideContent(zip, "overrides", "modrinth", projectId, version.id),
        ...listOverrideContent(
          zip,
          "client-overrides",
          "modrinth",
          projectId,
          version.id,
        ),
      );
      const uniqueEntries = dedupeModpackContent(entries);
      this.modpackContentCache.set(cacheKey, uniqueEntries);
      return uniqueEntries;
    } finally {
      await rm(path.dirname(archive), { recursive: true, force: true });
    }
  }

  private async downloadArchiveForInspection(url: string, fileName: string, label: string) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mlultimate-inspect-"));
    const destination = path.join(directory, sanitizeFileName(fileName));

    await this.downloads.download({
      label,
      url,
      destination,
      visible: false,
    });

    return destination;
  }

  private async getCurseForgeProjects(projectIds: number[]) {
    const projects: z.infer<typeof curseForgeProjectSchema>["data"][] = [];
    let bulkSupported = true;

    for (const group of chunk(projectIds, 50)) {
      if (!bulkSupported) {
        break;
      }

      const response = await this.fetchCurseForge(
        "/mods",
        "Buscar projetos do modpack na CurseForge",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modIds: group }),
        },
      );

      if (response.ok) {
        projects.push(...curseForgeProjectsSchema.parse(await response.json()).data);
      } else {
        bulkSupported = false;
      }
    }

    if (!bulkSupported || projects.length < projectIds.length) {
      const known = new Set(projects.map((project) => project.id));
      const missing = projectIds.filter((projectId) => !known.has(projectId));

      await runPool(missing, 12, async (projectId) => {
        const response = await this.fetchCurseForge(
          `/mods/${projectId}`,
          "Buscar item do modpack na CurseForge",
        ).catch(() => null);

        if (response?.ok) {
          projects.push(curseForgeProjectSchema.parse(await response.json()).data);
        }
      });
    }

    return projects;
  }

  private async getModrinthContentProjects(projectIds: string[]) {
    const projects: z.infer<typeof modrinthContentProjectSchema>[] = [];

    for (const group of chunk(projectIds, 100)) {
      const params = new URLSearchParams({ ids: JSON.stringify(group) });
      const response = await fetchWithElectronNet(
        `${MODRINTH_API}/projects?${params}`,
        "Buscar projetos do modpack no Modrinth",
      );

      if (response.ok) {
        projects.push(
          ...z.array(modrinthContentProjectSchema).parse(await response.json()),
        );
      }
    }

    return projects;
  }

  private fetchCurseForge(
    pathAndQuery: string,
    context: string,
    init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ) {
    const proxyBase = CURSEFORGE_PROXY_URL.trim().replace(/\/$/, "");

    if (proxyBase) {
      return fetchWithElectronNet(`${proxyBase}${pathAndQuery}`, {
        context,
        method: init?.method,
        body: init?.body,
        headers: { Accept: "application/json", ...init?.headers },
      });
    }

    return fetchWithElectronNet(`${CURSEFORGE_API}${pathAndQuery}`, {
      context,
      method: init?.method,
      body: init?.body,
      headers: {
        Accept: "application/json",
        "x-api-key": this.requireCurseForgeKey(),
        ...init?.headers,
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

const canInstallContentInInstance = (
  type: ContentType,
  instance: LauncherInstance,
) => {
  if (type === "resourcepack") {
    return true;
  }

  if (type === "shader") {
    return instance.shaderSupport.supported;
  }

  return instance.loader !== "vanilla";
};

const contentInstallBlockReason = (
  type: ContentType,
  instance: LauncherInstance,
) => {
  if (type === "shader") {
    return `A instancia ${instance.name} nao possui um motor de shader reconhecido. Instale Iris, Iris + Sodium, OptiFine, Oculus, Angelica ou ShadersMod antes de adicionar shaders.`;
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

const listOverrideContent = (
  zip: AdmZip,
  overrideRoot: string,
  provider: "modrinth" | "curseforge",
  projectId: string,
  versionId: string,
): ModpackContentEntry[] => {
  const normalizedRoot = overrideRoot.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const entries = new Map<string, ModpackContentEntry>();

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const normalized = entry.entryName.replaceAll("\\", "/");

    if (!normalized.startsWith(`${normalizedRoot}/`)) {
      continue;
    }

    const relative = normalized.slice(normalizedRoot.length + 1);
    const category = categoryFromArchivePath(relative);

    if (category === "mod" && !relative.toLowerCase().startsWith("mods/")) {
      continue;
    }

    const parts = relative.split("/");
    const categoryFolder = parts[0]?.toLowerCase();

    if (
      !["mods", "resourcepacks", "shaderpacks", "datapacks"].includes(
        categoryFolder ?? "",
      ) ||
      parts.length !== 2
    ) {
      continue;
    }

    const fileName = parts[1];

    if (!fileName) {
      continue;
    }

    const normalizedFileName = fileName.toLowerCase();
    const validContentFile =
      category === "mod"
        ? /\.(jar|zip)$/i.test(normalizedFileName)
        : /\.zip$/i.test(normalizedFileName);

    if (!validContentFile) {
      continue;
    }

    entries.set(`${category}:${fileName.toLowerCase()}`, {
      provider,
      projectId,
      versionId,
      category,
      name: displayNameFromFile(fileName),
      fileName,
      required: true,
    });
  }

  return [...entries.values()];
};

const categoryFromArchivePath = (
  archivePath: string,
): ModpackContentEntry["category"] => {
  const normalized = archivePath.replaceAll("\\", "/").toLowerCase();

  if (normalized.startsWith("resourcepacks/")) return "resourcepack";
  if (normalized.startsWith("shaderpacks/")) return "shader";
  if (normalized.startsWith("datapacks/") || normalized.includes("/datapacks/")) {
    return "datapack";
  }
  return "mod";
};

const contentCategoryFromCurseForgeClassId = (
  classId?: number,
): ModpackContentEntry["category"] => {
  if (classId === 12) return "resourcepack";
  if (classId === 6552) return "shader";
  if (classId === 6945) return "datapack";
  return "mod";
};

const displayNameFromFile = (filePath: string) =>
  path
    .basename(filePath)
    .replace(/\.(disabled|jar|zip|mrpack)$/gi, "")
    .replace(/[-_]+/g, " ")
    .trim();

const dedupeModpackContent = (entries: ModpackContentEntry[]) => {
  const unique = new Map<string, ModpackContentEntry>();

  for (const entry of entries) {
    const key = `${entry.category}:${entry.projectId}:${entry.versionId}:${entry.fileName ?? entry.name}`;
    unique.set(key.toLowerCase(), entry);
  }

  return [...unique.values()];
};

const htmlToPlainText = (html: string) =>
  html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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

const curseForgeSha1 = (file: z.infer<typeof curseForgeFilesSchema>["data"][number]) =>
  file.hashes.find((hash) => hash.algo === 1)?.value;

const curseForgeCdnDownloadUrl = (file: z.infer<typeof curseForgeFilesSchema>["data"][number]) => {
  if (!file.isAvailable) {
    throw new Error(`Arquivo CurseForge indisponivel: ${file.fileName}.`);
  }

  const folder = Math.floor(file.id / 1000);
  const fileSlot = String(file.id % 1000).padStart(3, "0");

  return `https://edge.forgecdn.net/files/${folder}/${fileSlot}/${encodeURIComponent(file.fileName)}`;
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
        providerProjects: result.providerProjects ?? {
          [result.provider]: {
            projectId: result.projectId,
            slug: result.slug,
          },
        },
      });
      continue;
    }

    existing.providers = Array.from(
      new Set([...(existing.providers ?? [existing.provider]), result.provider]),
    );
    existing.providerProjects = {
      ...(existing.providerProjects ?? {
        [existing.provider]: {
          projectId: existing.projectId,
          slug: existing.slug,
        },
      }),
      ...(result.providerProjects ?? {
        [result.provider]: {
          projectId: result.projectId,
          slug: result.slug,
        },
      }),
    };
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
    releaseType: version.version_type,
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
  releaseType:
    file.releaseType === 3 ? "alpha" : file.releaseType === 2 ? "beta" : "release",
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
  iconUrl: row.icon_url ?? undefined,
  enabled: row.enabled !== 0,
  installedAt: row.installed_at,
});

const isSha1 = (value: string) => /^[a-f0-9]{40}$/i.test(value);

const chunk = <T>(items: T[], size: number) => {
  const groups: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
};

const runPool = async <T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) => {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();

      if (item !== undefined) {
        await task(item);
      }
    }
  });

  await Promise.all(workers);
};

const assertContentManagementEnabled = (enabled: boolean, type?: ContentType) => {
  if (!enabled && type !== "resourcepack") {
    throw new Error(
      "Gerenciamento de conteudo desativado para este perfil. Ative nas opcoes da instancia antes de alterar mods, texturas ou shaders.",
    );
  }
};

const fetchWithElectronNet = async (
  url: string,
  options:
    | string
    | {
        context: string;
        headers?: Record<string, string>;
        method?: string;
        body?: string;
      },
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
    return await net.fetch(url, {
      headers,
      method: typeof options === "string" ? undefined : options.method,
      body: typeof options === "string" ? undefined : options.body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} falhou: ${message}`, { cause: error });
  }
};
