import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout;
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

test("prepare-handoff includes the resume helper in the verified package", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-19-handoff-prepare."));
  const repoDir = path.join(tempRoot, "repo");
  const outputDir = path.join(repoDir, ".handoff", "HEL-19");
  const takeoverDir = path.join(tempRoot, "takeover");

  t.after(async () => {
    await rm(tempRoot, { force: true, recursive: true });
  });

  git(["init", "-b", "eugeniy/hel-19-handoff-fixture", repoDir], tempRoot);
  git(["config", "user.name", "Codex"], repoDir);
  git(["config", "user.email", "codex@example.com"], repoDir);

  await mkdir(path.join(repoDir, ".bootstrap"), { recursive: true });
  await mkdir(path.join(repoDir, "docs"), { recursive: true });
  await mkdir(path.join(repoDir, "scripts"), { recursive: true });
  await writeFile(
    path.join(repoDir, ".bootstrap", "project.json"),
    JSON.stringify(
      {
        repo: {
          slug: "run-pace-calculator",
          url: "https://github.com/helionaut/run-pace-calculator"
        },
        linear: {
          starter_issue_identifier: "HEL-19"
        }
      },
      null,
      2
    ) + "\n"
  );
  await writeFile(
    path.join(repoDir, "docs", "pull-request-draft.md"),
    [
      "<!-- PR_TITLE: Fixture handoff title -->",
      "",
      "## Summary",
      "",
      "- fixture",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(repoDir, "package.json"),
    JSON.stringify(
      {
        name: "handoff-fixture",
        private: true,
        scripts: {
          "pr:dry-run": "./scripts/create_pr.sh --dry-run"
        }
      },
      null,
      2
    ) + "\n"
  );

  for (const scriptName of [
    "create_pr.sh",
    "export_bundle.sh",
    "prepare-handoff.sh",
    "verify-handoff.mjs"
  ]) {
    const sourcePath = path.join(repoRoot, "scripts", scriptName);
    const targetPath = path.join(repoDir, "scripts", scriptName);

    await writeFile(targetPath, await readFile(sourcePath, "utf8"));
    if (scriptName.endsWith(".sh")) {
      await chmod(targetPath, 0o755);
    }
  }

  await writeFile(path.join(repoDir, "README.md"), "# fixture\n");
  git(["add", "."], repoDir);
  git(["commit", "-m", "Initial fixture"], repoDir);

  run("./scripts/prepare-handoff.sh", [outputDir], repoDir);

  const manifestPath = path.join(outputDir, "HEL-19-handoff-manifest.json");
  const helperPath = path.join(outputDir, "resume-on-another-machine.sh");
  const helperScript = await readFile(helperPath, "utf8");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = await verifyManifest(manifestPath);

  assert.equal(result.artifactCount, 6);
  assert.equal(manifest.head, git(["rev-parse", "HEAD"], repoDir));
  assert.ok(
    manifest.artifacts.some(
      (artifact) =>
        artifact.name === "resume_helper" &&
        artifact.path === "resume-on-another-machine.sh"
    )
  );
  assert.match(helperScript, /npm run pr:publish/);
  assert.match(helperScript, /--skip-publish/);
  assert.match(
    await readFile(path.join(outputDir, "SUMMARY.md"), "utf8"),
    /resume-on-another-machine\.sh/
  );

  git(["clone", "--quiet", `file://${repoDir}`, takeoverDir], tempRoot);
  run(helperPath, [takeoverDir, "--skip-publish"], repoDir);

  assert.equal(git(["branch", "--show-current"], takeoverDir), manifest.branch);
  assert.equal(git(["rev-parse", "HEAD"], takeoverDir), manifest.head);
});
