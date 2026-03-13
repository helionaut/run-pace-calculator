import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const pageUrl = process.argv[2];

if (!pageUrl) {
  console.error("Usage: node scripts/verify-pages-content.mjs <page-url>");
  process.exit(1);
}

async function listFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listFiles(rootDir, absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(path.relative(rootDir, absolutePath));
    }
  }

  return files.sort();
}

async function fetchFile(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;

      if (attempt < 5) {
        await sleep(5_000);
      }
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? String(lastError)}`);
}

async function compareUrlToFile(url, relativePath) {
  const expected = await readFile(path.join(distDir, relativePath));
  const actual = await fetchFile(url);

  if (!actual.equals(expected)) {
    throw new Error(`Deployed file mismatch for ${relativePath}`);
  }
}

const normalizedPageUrl = pageUrl.endsWith("/") ? pageUrl : `${pageUrl}/`;
const distFiles = await listFiles(distDir);

if (distFiles.length === 0) {
  throw new Error(`No built files found in ${distDir}. Run npm run build first.`);
}

await compareUrlToFile(normalizedPageUrl, "index.html");

for (const relativePath of distFiles) {
  if (relativePath === "index.html") {
    continue;
  }

  const urlPath = relativePath.split(path.sep).join("/");
  const assetUrl = new URL(urlPath, normalizedPageUrl).toString();
  await compareUrlToFile(assetUrl, relativePath);
}

console.log(`Verified ${distFiles.length} deployed files against ${distDir}`);
