import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const [, , manifestArg] = process.argv;

if (!manifestArg) {
  console.error("Usage: node scripts/verify-handoff.mjs <manifest-path>");
  process.exit(1);
}

const manifestPath = path.resolve(manifestArg);
const manifestDir = path.dirname(manifestPath);

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
let failures = 0;

for (const artifact of manifest.artifacts) {
  const artifactPath = path.resolve(manifestDir, artifact.path);

  try {
    const [digest, fileStat] = await Promise.all([sha256(artifactPath), stat(artifactPath)]);

    if (digest !== artifact.sha256) {
      console.error(`SHA mismatch for ${artifact.name}: expected ${artifact.sha256}, got ${digest}`);
      failures += 1;
    }

    if (fileStat.size !== artifact.size) {
      console.error(`Size mismatch for ${artifact.name}: expected ${artifact.size}, got ${fileStat.size}`);
      failures += 1;
    }
  } catch (error) {
    console.error(`Missing or unreadable artifact ${artifact.name}: ${artifactPath}`);
    failures += 1;
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`Verified handoff manifest: ${manifestPath}`);
console.log(`Artifacts: ${manifest.artifacts.length}`);
console.log(`Head: ${manifest.head}`);
