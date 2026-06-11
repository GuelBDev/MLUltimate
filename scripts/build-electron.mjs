import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const outDir = join(projectRoot, "dist-electron");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
  sourcemap: true,
  format: "cjs",
  logLevel: "info",
  external: ["electron", "sql.js"],
};

await Promise.all([
  build({
    ...shared,
    entryPoints: [join(projectRoot, "electron/main.ts")],
    outfile: join(outDir, "main.cjs"),
  }),
  build({
    ...shared,
    entryPoints: [join(projectRoot, "electron/preload.ts")],
    outfile: join(outDir, "preload.cjs"),
  }),
]);

await copyFile(
  join(projectRoot, "node_modules/sql.js/dist/sql-wasm.wasm"),
  join(outDir, "sql-wasm.wasm"),
);
