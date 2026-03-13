import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DIST_DIR = path.join(REPO_ROOT, "dist");
export const APP_FILES = ["index.html", "styles.css", "script.js"];

export async function buildStaticSite({
  repoRoot = REPO_ROOT,
  distDir = DIST_DIR,
  files = APP_FILES,
} = {}) {
  await rm(distDir, { force: true, recursive: true });
  await mkdir(distDir, { recursive: true });

  for (const file of files) {
    await copyFile(path.join(repoRoot, file), path.join(distDir, file));
  }

  return { distDir, files };
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const { distDir, files } = await buildStaticSite();
  console.log(`Built ${files.length} files into ${distDir}`);
}
