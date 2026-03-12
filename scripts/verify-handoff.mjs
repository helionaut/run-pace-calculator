import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function verifyManifest(manifestArg) {
  if (!manifestArg) {
    throw new Error("Usage: node scripts/verify-handoff.mjs <manifest-path>");
  }

  const manifestPath = path.resolve(manifestArg);
  const manifestDir = path.dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const artifact of manifest.artifacts) {
    const artifactPath = path.resolve(manifestDir, artifact.path);

    try {
      const [digest, fileStat] = await Promise.all([
        sha256(artifactPath),
        stat(artifactPath)
      ]);

      if (digest !== artifact.sha256) {
        throw new Error(
          `SHA mismatch for ${artifact.name}: expected ${artifact.sha256}, got ${digest}`
        );
      }

      if (fileStat.size !== artifact.size) {
        throw new Error(
          `Size mismatch for ${artifact.name}: expected ${artifact.size}, got ${fileStat.size}`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`Missing or unreadable artifact ${artifact.name}: ${artifactPath}`);
    }
  }

  return {
    artifactCount: manifest.artifacts.length,
    head: manifest.head,
    manifestPath
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const result = await verifyManifest(process.argv[2]);
    console.log(`Verified handoff manifest: ${result.manifestPath}`);
    console.log(`Artifacts: ${result.artifactCount}`);
    console.log(`Head: ${result.head}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
