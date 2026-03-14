import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || `git ${args.join(" ")} failed`));
    });
  });
}

async function verifyBundle(bundlePath, branch, head) {
  const bundleHeads = await runGit(["bundle", "list-heads", bundlePath]);
  const expectedRef = `refs/heads/${branch}`;
  const bundleRefs = bundleHeads
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [bundleHead, ref] = line.split(/\s+/, 2);
      return { head: bundleHead, ref };
    });

  const branchRef = bundleRefs.find((ref) => ref.ref === expectedRef);
  if (!branchRef) {
    throw new Error(`Bundle is missing expected branch ${branch}.`);
  }

  if (branchRef.head !== head) {
    throw new Error(
      `Bundle head mismatch for ${branch}: expected ${head}, got ${branchRef.head}`
    );
  }
}

async function verifyChecksumsFile(checksumsPath, baseDir) {
  const content = await readFile(checksumsPath, "utf8");
  const entries = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([a-f0-9]{64})\s{2,}(.+)$/.exec(line);

      if (!match) {
        throw new Error(`Malformed SHA256SUMS entry: ${line}`);
      }

      return {
        digest: match[1],
        relativePath: match[2]
      };
    });

  for (const entry of entries) {
    const artifactPath = path.resolve(baseDir, entry.relativePath);
    const digest = await sha256(artifactPath);

    if (digest !== entry.digest) {
      throw new Error(
        `SHA256SUMS mismatch for ${entry.relativePath}: expected ${entry.digest}, got ${digest}`
      );
    }
  }

  return entries.length;
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

  const bundleArtifact = manifest.artifacts.find((artifact) => artifact.name === "bundle");
  if (bundleArtifact && manifest.branch && manifest.head) {
    const bundlePath = path.resolve(manifestDir, bundleArtifact.path);
    await verifyBundle(bundlePath, manifest.branch, manifest.head);
  }

  let checksumCount = 0;
  const checksumsPath = path.resolve(manifestDir, "SHA256SUMS");
  try {
    await access(checksumsPath);
    checksumCount = await verifyChecksumsFile(checksumsPath, manifestDir);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      checksumCount = 0;
    } else {
      throw error;
    }
  }

  return {
    artifactCount: manifest.artifacts.length,
    branch: manifest.branch,
    checksumCount,
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
    if (result.checksumCount > 0) {
      console.log(`Checksums: ${result.checksumCount}`);
    }
    if (result.branch) {
      console.log(`Branch: ${result.branch}`);
    }
    console.log(`Head: ${result.head}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
