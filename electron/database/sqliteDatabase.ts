import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { getLauncherDataSubpath } from "../utils/launcherPaths";

type SqlValue = string | number | Uint8Array | null;

export class LauncherDatabase {
  private database: Database | null = null;
  private databasePath = "";

  async initialize() {
    const dataDir = getLauncherDataSubpath("Data");

    mkdirSync(dataDir, { recursive: true });
    this.databasePath = path.join(dataDir, "mlultimate.sqlite");

    const SQL = await this.createSqlRuntime();
    this.database = existsSync(this.databasePath)
      ? new SQL.Database(readFileSync(this.databasePath))
      : new SQL.Database();

    this.migrate();
    this.save();
  }

  run(sql: string, params: SqlValue[] = []) {
    const database = this.requireDatabase();
    database.run(sql, params);
    this.save();
  }

  get<T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []) {
    const database = this.requireDatabase();
    const statement = database.prepare(sql, params);

    try {
      return statement.step() ? (statement.getAsObject() as T) : null;
    } finally {
      statement.free();
    }
  }

  all<T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []) {
    const database = this.requireDatabase();
    const statement = database.prepare(sql, params);
    const rows: T[] = [];

    try {
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }
    } finally {
      statement.free();
    }

    return rows;
  }

  private async createSqlRuntime(): Promise<SqlJsStatic> {
    return initSqlJs({
      locateFile: (file) => {
        const bundled = path.join(__dirname, file);

        if (existsSync(bundled)) {
          return bundled;
        }

        return path.join(process.cwd(), "node_modules", "sql.js", "dist", file);
      },
    });
  }

  private migrate() {
    const database = this.requireDatabase();

    database.run(`
      CREATE TABLE IF NOT EXISTS secure_records (
        key TEXT PRIMARY KEY,
        value BLOB NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS offline_profiles (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS launcher_events (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS installed_minecraft_versions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        release_time TEXT NOT NULL,
        json_path TEXT NOT NULL,
        jar_path TEXT NOT NULL,
        installed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        minecraft_version TEXT NOT NULL,
        loader TEXT NOT NULL,
        ram_mb INTEGER NOT NULL,
        java_path TEXT,
        game_dir TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS installed_content (
        id TEXT PRIMARY KEY,
        instance_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        type TEXT NOT NULL,
        project_id TEXT NOT NULL,
        version_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        installed_at TEXT NOT NULL,
        UNIQUE(instance_id, provider, project_id, version_id, file_name)
      );

      CREATE TABLE IF NOT EXISTS avatar_skins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        nickname TEXT,
        uuid TEXT,
        skin_url TEXT,
        preview_url TEXT,
        local_path TEXT,
        created_at TEXT NOT NULL,
        equipped_at TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const instanceColumns = this.all<{ name: string }>("PRAGMA table_info(instances)").map(
      (column) => column.name,
    );

    if (!instanceColumns.includes("icon_path")) {
      database.run("ALTER TABLE instances ADD COLUMN icon_path TEXT");
    }
  }

  private save() {
    const database = this.requireDatabase();
    writeFileSync(this.databasePath, Buffer.from(database.export()));
  }

  private requireDatabase() {
    if (!this.database) {
      throw new Error("SQLite database was not initialized.");
    }

    return this.database;
  }
}
