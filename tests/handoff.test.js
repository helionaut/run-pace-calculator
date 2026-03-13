import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { verifyManifest } from "../scripts/verify-handoff.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

test("verifyManifest accepts matching artifact metadata", async () => {
  const handoffDir = await mkdtemp(path.join(os.tmpdir(), "hel-8-handoff-verify."));
  const artifactPath = path.join(handoffDir, "artifact.txt");
  const artifactContent = "hello handoff\n";
  const manifestPath = path.join(handoffDir, "manifest.json");

  await writeFile(artifactPath, artifactContent);
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        head: "abc123",
        artifacts: [
          {
            name: "artifact",
            path: "artifact.txt",
            sha256: sha256(artifactContent),
            size: Buffer.byteLength(artifactContent)
          }
        ]
      },
      null,
      2
    )
  );

  const result = await verifyManifest(manifestPath);

  assert.equal(result.artifactCount, 1);
  assert.equal(result.head, "abc123");
});

test("verifyManifest confirms bundle branch and head metadata", async () => {
  const handoffDir = await mkdtemp(path.join(os.tmpdir(), "hel-8-handoff-verify."));
  const sourceRepo = path.join(handoffDir, "source");
  const bundlePath = path.join(handoffDir, "feature.bundle");
  const manifestPath = path.join(handoffDir, "manifest.json");

  git(["init", "-b", "main", sourceRepo], handoffDir);
  git(["config", "user.name", "Codex"], sourceRepo);
  git(["config", "user.email", "codex@example.com"], sourceRepo);

  await writeFile(path.join(sourceRepo, "README.md"), "# temp repo\n");
  git(["add", "README.md"], sourceRepo);
  git(["commit", "-m", "Initial commit"], sourceRepo);

  git(["switch", "-c", "feature/test"], sourceRepo);
  await writeFile(path.join(sourceRepo, "feature.txt"), "feature branch\n");
  git(["add", "feature.txt"], sourceRepo);
  git(["commit", "-m", "Add feature"], sourceRepo);

  const featureHead = git(["rev-parse", "HEAD"], sourceRepo);
  git(["bundle", "create", bundlePath, "feature/test"], sourceRepo);

  const bundleStat = await stat(bundlePath);
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        branch: "feature/test",
        head: featureHead,
        artifacts: [
          {
            name: "bundle",
            path: "feature.bundle",
            sha256: sha256(await readFile(bundlePath)),
            size: bundleStat.size
          }
        ]
      },
      null,
      2
    )
  );

  const result = await verifyManifest(manifestPath);

  assert.equal(result.branch, "feature/test");
  assert.equal(result.head, featureHead);
});

test("verifyManifest rejects mismatched artifact metadata", async () => {
  const handoffDir = await mkdtemp(path.join(os.tmpdir(), "hel-8-handoff-verify."));
  const artifactPath = path.join(handoffDir, "artifact.txt");
  const manifestPath = path.join(handoffDir, "manifest.json");

  await writeFile(artifactPath, "actual content\n");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        head: "def456",
        artifacts: [
          {
            name: "artifact",
            path: "artifact.txt",
            sha256: "bad-digest",
            size: 1
          }
        ]
      },
      null,
      2
    )
  );

  await assert.rejects(
    () => verifyManifest(manifestPath),
    /SHA mismatch for artifact|Size mismatch for artifact/
  );

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.head, "def456");
});

test("verifyManifest rejects bundles whose recorded head does not match", async () => {
  const handoffDir = await mkdtemp(path.join(os.tmpdir(), "hel-8-handoff-verify."));
  const sourceRepo = path.join(handoffDir, "source");
  const bundlePath = path.join(handoffDir, "feature.bundle");
  const manifestPath = path.join(handoffDir, "manifest.json");

  git(["init", "-b", "main", sourceRepo], handoffDir);
  git(["config", "user.name", "Codex"], sourceRepo);
  git(["config", "user.email", "codex@example.com"], sourceRepo);

  await writeFile(path.join(sourceRepo, "README.md"), "# temp repo\n");
  git(["add", "README.md"], sourceRepo);
  git(["commit", "-m", "Initial commit"], sourceRepo);

  git(["switch", "-c", "feature/test"], sourceRepo);
  await writeFile(path.join(sourceRepo, "feature.txt"), "feature branch\n");
  git(["add", "feature.txt"], sourceRepo);
  git(["commit", "-m", "Add feature"], sourceRepo);

  git(["bundle", "create", bundlePath, "feature/test"], sourceRepo);

  const bundleStat = await stat(bundlePath);
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        branch: "feature/test",
        head: "0000000000000000000000000000000000000000",
        artifacts: [
          {
            name: "bundle",
            path: "feature.bundle",
            sha256: sha256(await readFile(bundlePath)),
            size: bundleStat.size
          }
        ]
      },
      null,
      2
    )
  );

  await assert.rejects(
    () => verifyManifest(manifestPath),
    /Bundle head mismatch for feature\/test/
  );
});

test("prepare-handoff replaces stale bundle names when the branch name changes", async () => {
  const fixtureRoot = process.cwd();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-17-handoff-refresh."));
  const repoDir = path.join(tempRoot, "repo");
  const outputDir = path.join(tempRoot, "handoff");

  await cp(fixtureRoot, repoDir, {
    recursive: true,
    filter(source) {
      const relativePath = path.relative(fixtureRoot, source);

      if (relativePath === "") {
        return true;
      }

      const topLevel = relativePath.split(path.sep)[0];
      return ![".git", ".handoff", "dist", "node_modules"].includes(topLevel);
    }
  });

  git(["init", "-b", "main"], repoDir);
  git(["config", "user.name", "Codex"], repoDir);
  git(["config", "user.email", "codex@example.com"], repoDir);
  git(["add", "."], repoDir);
  git(["commit", "-m", "Fixture commit"], repoDir);
  git(["branch", "-m", "feature/old-name"], repoDir);

  const firstRun = spawnSync("bash", ["scripts/prepare-handoff.sh", outputDir], {
    cwd: repoDir,
    encoding: "utf8"
  });
  assert.equal(firstRun.status, 0, firstRun.stderr);

  git(["branch", "-m", "feature/new-name"], repoDir);

  const secondRun = spawnSync("bash", ["scripts/prepare-handoff.sh", outputDir], {
    cwd: repoDir,
    encoding: "utf8"
  });
  assert.equal(secondRun.status, 0, secondRun.stderr);

  const files = await readdir(outputDir);
  const bundleFiles = files.filter((file) => file.endsWith(".bundle"));
  const manifestPath = path.join(outputDir, "HEL-8-handoff-manifest.json");

  assert.deepEqual(bundleFiles, ["run-pace-calculator-feature-new-name.bundle"]);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.branch, "feature/new-name");
  assert.equal(manifest.artifacts[0].path, "run-pace-calculator-feature-new-name.bundle");

  const result = await verifyManifest(manifestPath);
  assert.equal(result.branch, "feature/new-name");
});
