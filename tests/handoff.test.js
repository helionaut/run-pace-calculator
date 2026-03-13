import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyManifest } from "../scripts/verify-handoff.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

async function writeExecutable(filePath, content) {
  await writeFile(filePath, content, "utf8");
  await chmod(filePath, 0o755);
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

test("prepare-handoff includes an optional blocker snapshot in the summary", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-handoff-script."));
  const repoDir = path.join(tempRoot, "repo");
  const scriptsDir = path.join(repoDir, "scripts");
  const docsDir = path.join(repoDir, "docs");
  const bootstrapDir = path.join(repoDir, ".bootstrap");
  const binDir = path.join(tempRoot, "bin");
  const outputDir = path.join(tempRoot, "handoff");
  const blockerSnapshot = [
    "- GitHub auth is not ready.",
    "- GitHub DNS resolution failed."
  ].join("\n");

  await mkdir(repoDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(bootstrapDir, { recursive: true });
  await mkdir(binDir, { recursive: true });

  git(["init", "-b", "main"], repoDir);
  git(["config", "user.name", "Codex"], repoDir);
  git(["config", "user.email", "codex@example.com"], repoDir);

  await writeFile(path.join(repoDir, "README.md"), "# fixture repo\n");
  await writeFile(
    path.join(docsDir, "pull-request-draft.md"),
    await readFile(path.join(repoRoot, "docs", "pull-request-draft.md"), "utf8")
  );
  await writeFile(
    path.join(bootstrapDir, "project.json"),
    JSON.stringify(
      {
        repo: {
          slug: "run-pace-calculator",
          url: "https://github.com/helionaut/run-pace-calculator"
        },
        linear: {
          starter_issue_identifier: "HEL-99"
        }
      },
      null,
      2
    )
  );
  await writeExecutable(
    path.join(scriptsDir, "prepare-handoff.sh"),
    await readFile(path.join(repoRoot, "scripts", "prepare-handoff.sh"), "utf8")
  );
  await writeExecutable(
    path.join(scriptsDir, "export_bundle.sh"),
    await readFile(path.join(repoRoot, "scripts", "export_bundle.sh"), "utf8")
  );
  await writeExecutable(
    path.join(binDir, "npm"),
    `#!/bin/sh
if [ "$1" = "run" ] && [ "$2" = "pr:dry-run" ]; then
  branch=$(git branch --show-current)
  printf '%s\n' "Would create a PR with: gh pr create --head $branch --title \\"Fixture title\\" --body-file docs/pull-request-draft.md"
  printf '%s\n' "Would use body file: docs/pull-request-draft.md"
  exit 0
fi
echo "unexpected npm invocation: $*" >&2
exit 1
`
  );

  git(["add", "."], repoDir);
  git(["commit", "-m", "Initial fixture"], repoDir);
  git(["switch", "-c", "eugeniy/hel-99-handoff-fixture"], repoDir);

  const result = spawnSync("./scripts/prepare-handoff.sh", [outputDir], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      HANDOFF_BLOCKER_SNAPSHOT: blockerSnapshot
    }
  });

  assert.equal(result.status, 0, result.stderr);

  const summary = await readFile(path.join(outputDir, "SUMMARY.md"), "utf8");

  assert.match(summary, /## Current blocker snapshot \(\d{4}-\d{2}-\d{2}\)/);
  assert.match(summary, /- GitHub auth is not ready\./);
  assert.match(summary, /- GitHub DNS resolution failed\./);
});
