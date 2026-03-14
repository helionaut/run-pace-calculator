import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile
} from "node:fs/promises";
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

test("verifyManifest rejects mismatched SHA256SUMS entries", async () => {
  const handoffDir = await mkdtemp(path.join(os.tmpdir(), "hel-18-handoff-checksums."));
  const artifactPath = path.join(handoffDir, "artifact.txt");
  const manifestPath = path.join(handoffDir, "manifest.json");
  const checksumsPath = path.join(handoffDir, "SHA256SUMS");

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
            sha256: sha256("actual content\n"),
            size: Buffer.byteLength("actual content\n")
          }
        ]
      },
      null,
      2
    )
  );
  await writeFile(checksumsPath, `${"0".repeat(64)}  artifact.txt\n`, "utf8");

  await assert.rejects(
    () => verifyManifest(manifestPath),
    /SHA256SUMS mismatch for artifact\.txt/
  );
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
  assert.doesNotMatch(summary, /## Current blocker snapshot \(\d{4}-\d{2}-\d{2}\)\n\n\n-/);
});

test("prepare-handoff preserves an existing blocker snapshot when none is provided", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-handoff-preserve."));
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
  git(["switch", "-c", "eugeniy/hel-99-handoff-preserve"], repoDir);

  let result = spawnSync("./scripts/prepare-handoff.sh", [outputDir], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      HANDOFF_BLOCKER_SNAPSHOT: blockerSnapshot
    }
  });

  assert.equal(result.status, 0, result.stderr);

  result = spawnSync("./scripts/prepare-handoff.sh", [outputDir], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`
    }
  });

  assert.equal(result.status, 0, result.stderr);

  const summary = await readFile(path.join(outputDir, "SUMMARY.md"), "utf8");

  assert.match(summary, /## Current blocker snapshot \(\d{4}-\d{2}-\d{2}\)/);
  assert.match(summary, /- GitHub auth is not ready\./);
  assert.match(summary, /- GitHub DNS resolution failed\./);
  assert.doesNotMatch(summary, /## Current blocker snapshot \(\d{4}-\d{2}-\d{2}\)\n\n\n-/);
});

test("prepare-handoff uses GITHUB_HEAD_REF when the checkout is detached", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-handoff-detached."));
  const repoDir = path.join(tempRoot, "repo");
  const scriptsDir = path.join(repoDir, "scripts");
  const docsDir = path.join(repoDir, "docs");
  const bootstrapDir = path.join(repoDir, ".bootstrap");
  const binDir = path.join(tempRoot, "bin");
  const outputDir = path.join(tempRoot, "handoff");
  const branch = "eugeniy/hel-99-detached-handoff";

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
branch=$(git branch --show-current)
if [ -z "$branch" ] && [ -n "$GITHUB_HEAD_REF" ]; then
  branch="$GITHUB_HEAD_REF"
fi
if [ "$1" = "run" ] && [ "$2" = "pr:dry-run" ]; then
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
  git(["switch", "-c", branch], repoDir);
  git(["checkout", "--detach"], repoDir);

  const result = spawnSync("./scripts/prepare-handoff.sh", [outputDir], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      GITHUB_HEAD_REF: branch
    }
  });

  assert.equal(result.status, 0, result.stderr);

  const summary = await readFile(path.join(outputDir, "SUMMARY.md"), "utf8");
  const manifest = JSON.parse(
    await readFile(path.join(outputDir, "HEL-99-handoff-manifest.json"), "utf8")
  );

  assert.match(summary, new RegExp(`- Branch: ${branch}`));
  assert.equal(manifest.branch, branch);
});

test("prepare-handoff generates resume artifacts that restore a fresh main clone", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-handoff-resume."));
  const repoDir = path.join(tempRoot, "repo");
  const targetRepo = path.join(tempRoot, "target");
  const scriptsDir = path.join(repoDir, "scripts");
  const docsDir = path.join(repoDir, "docs");
  const bootstrapDir = path.join(repoDir, ".bootstrap");
  const binDir = path.join(tempRoot, "bin");
  const outputDir = path.join(tempRoot, "handoff");
  const branch = "eugeniy/hel-99-handoff-resume";

  await mkdir(repoDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(bootstrapDir, { recursive: true });
  await mkdir(binDir, { recursive: true });

  git(["init", "-b", "main"], repoDir);
  git(["config", "user.name", "Codex"], repoDir);
  git(["config", "user.email", "codex@example.com"], repoDir);
  git(["remote", "add", "origin", "https://github.com/helionaut/run-pace-calculator.git"], repoDir);

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
if [ "$1" = "run" ] && [ "$2" = "check" ]; then
  exit 0
fi
echo "unexpected npm invocation: $*" >&2
exit 1
`
  );

  git(["add", "."], repoDir);
  git(["commit", "-m", "Initial fixture"], repoDir);
  git(["switch", "-c", branch], repoDir);
  await writeFile(path.join(repoDir, "feature.txt"), "feature branch\n");
  git(["add", "feature.txt"], repoDir);
  git(["commit", "-m", "Add feature"], repoDir);

  const featureHead = git(["rev-parse", "HEAD"], repoDir);
  git(["clone", "--single-branch", "--branch", "main", repoDir, targetRepo], tempRoot);

  const prepareResult = spawnSync("./scripts/prepare-handoff.sh", [outputDir], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`
    }
  });

  assert.equal(prepareResult.status, 0, prepareResult.stderr);
  assert.match(prepareResult.stdout, /Resume script:/);
  assert.match(prepareResult.stdout, /Checksums:/);
  assert.match(prepareResult.stdout, /Archive:/);

  const resumeScriptPath = path.join(outputDir, "resume-handoff.sh");
  const checksumsPath = path.join(outputDir, "SHA256SUMS");
  const archivePath = path.join(outputDir, "HEL-99-handoff.tar.gz");

  await stat(resumeScriptPath);
  await stat(checksumsPath);
  await stat(archivePath);
  const checksums = await readFile(checksumsPath, "utf8");
  const checksumEntries = Object.fromEntries(
    checksums
      .trim()
      .split("\n")
      .map((line) => {
        const [digest, artifact] = line.split(/\s{2,}/);

        return [artifact, digest];
      })
  );

  assert.equal(checksumEntries["resume-handoff.sh"], sha256(await readFile(resumeScriptPath)));
  assert.equal(
    checksumEntries["HEL-99-handoff-manifest.json"],
    sha256(await readFile(path.join(outputDir, "HEL-99-handoff-manifest.json")))
  );

  const resumeResult = spawnSync(resumeScriptPath, [targetRepo, "--validate", "--dry-run-publish"], {
    cwd: outputDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`
    }
  });

  assert.equal(resumeResult.status, 0, resumeResult.stderr);
  assert.match(resumeResult.stdout, /Verified handoff artifacts from:/);
  assert.match(resumeResult.stdout, new RegExp(`Imported branch: ${branch}`));
  assert.match(resumeResult.stdout, /Would create a PR with: gh pr create --head/);
  assert.equal(git(["rev-parse", "HEAD"], targetRepo), featureHead);

  const summary = await readFile(path.join(outputDir, "SUMMARY.md"), "utf8");
  const manifest = JSON.parse(
    await readFile(path.join(outputDir, "HEL-99-handoff-manifest.json"), "utf8")
  );
  const verifyResult = await verifyManifest(path.join(outputDir, "HEL-99-handoff-manifest.json"));

  assert.match(summary, /- Resume helper: resume-handoff\.sh/);
  assert.match(summary, /- Checksums: SHA256SUMS/);
  assert.match(summary, /- Packaged archive: HEL-99-handoff\.tar\.gz/);
  assert.equal(manifest.artifacts.some((artifact) => artifact.name === "resume_script"), true);
  assert.equal(verifyResult.checksumCount, 7);
});

test("prepare-handoff resume helper succeeds when the target already has the handoff branch checked out", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-handoff-existing-branch."));
  const repoDir = path.join(tempRoot, "repo");
  const targetRepo = path.join(tempRoot, "target");
  const scriptsDir = path.join(repoDir, "scripts");
  const docsDir = path.join(repoDir, "docs");
  const bootstrapDir = path.join(repoDir, ".bootstrap");
  const binDir = path.join(tempRoot, "bin");
  const outputDir = path.join(tempRoot, "handoff");
  const branch = "eugeniy/hel-99-existing-branch";

  await mkdir(repoDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(bootstrapDir, { recursive: true });
  await mkdir(binDir, { recursive: true });

  git(["init", "-b", "main"], repoDir);
  git(["config", "user.name", "Codex"], repoDir);
  git(["config", "user.email", "codex@example.com"], repoDir);
  git(["remote", "add", "origin", "https://github.com/helionaut/run-pace-calculator.git"], repoDir);

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
if [ "$1" = "run" ] && [ "$2" = "check" ]; then
  exit 0
fi
echo "unexpected npm invocation: $*" >&2
exit 1
`
  );

  git(["add", "."], repoDir);
  git(["commit", "-m", "Initial fixture"], repoDir);
  git(["switch", "-c", branch], repoDir);
  await writeFile(path.join(repoDir, "feature.txt"), "feature branch\n");
  git(["add", "feature.txt"], repoDir);
  git(["commit", "-m", "Add feature"], repoDir);

  const featureHead = git(["rev-parse", "HEAD"], repoDir);
  git(["clone", repoDir, targetRepo], tempRoot);

  const prepareResult = spawnSync("./scripts/prepare-handoff.sh", [outputDir], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`
    }
  });

  assert.equal(prepareResult.status, 0, prepareResult.stderr);

  const resumeResult = spawnSync(
    path.join(outputDir, "resume-handoff.sh"),
    [targetRepo, "--validate", "--dry-run-publish"],
    {
      cwd: outputDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`
      }
    }
  );

  assert.equal(resumeResult.status, 0, resumeResult.stderr);
  assert.match(resumeResult.stdout, /Verified handoff artifacts from:/);
  assert.match(resumeResult.stdout, new RegExp(`Imported branch: ${branch}`));
  assert.match(resumeResult.stdout, /Would create a PR with: gh pr create --head/);
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"], targetRepo), branch);
  assert.equal(git(["rev-parse", "HEAD"], targetRepo), featureHead);
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
