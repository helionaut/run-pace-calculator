import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_DIR = path.join(REPO_ROOT, "src");
export const DIST_DIR = path.join(REPO_ROOT, "dist");
export const DIST_FILES = [
  "index.html",
  "styles.css",
  "main.js",
  "favicon.svg",
  "lib/calculator.js",
  "lib/mode-navigation.js",
];

export async function buildStaticSite({
  sourceDir = SOURCE_DIR,
  distDir = DIST_DIR,
  files = DIST_FILES,
} = {}) {
  await rm(distDir, { force: true, recursive: true });
  await mkdir(distDir, { recursive: true });
  await cp(sourceDir, distDir, { recursive: true });

  return { distDir, files };
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const { distDir, files } = await buildStaticSite();
  console.log(`Built ${files.length} files into ${distDir}`);
}
