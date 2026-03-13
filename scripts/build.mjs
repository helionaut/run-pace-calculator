import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const buildFiles = ["index.html", "styles.css", "app.js", "calculator.js"];

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });

for (const file of buildFiles) {
  await cp(path.join(repoRoot, file), path.join(distDir, file));
}

console.log(`Built static site to ${distDir}`);
