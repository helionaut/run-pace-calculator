import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_ISSUE_IDENTIFIER = "HEL-9999";
const FIXTURE_BRANCH = `codex/${FIXTURE_ISSUE_IDENTIFIER.toLowerCase()}-publish-test-fixture`;

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

function deriveExpectedTitle(branch) {
  const branchBase = branch.split("/").at(-1) ?? branch;
  const branchSlug = branchBase.replace(/^[A-Za-z]+-\d+-/, "");
  const sentence = branchSlug.replace(/[-_]+/g, " ").trim();

  if (sentence === "") {
    return "Update the run pace calculator";
  }

  return sentence[0].toUpperCase() + sentence.slice(1);
}

async function cloneRepo() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "publish-test."));
  const cloneDir = path.join(tempRoot, "repo");

  run("git", ["clone", repoRoot, cloneDir], tempRoot);
  await syncWorkingTree(cloneDir);
  normalizeFixtureRepo(cloneDir);
  return cloneDir;
}

async function syncWorkingTree(cloneDir) {
  const trackedOutput = run("git", ["ls-files", "-z"], repoRoot);
  const untrackedOutput = run(
    "git",
    ["ls-files", "-z", "--others", "--exclude-standard"],
    repoRoot
  );
  const relativePaths = `${trackedOutput}\0${untrackedOutput}`
    .split("\0")
    .filter(Boolean);

  for (const relativePath of relativePaths) {
    const sourcePath = path.join(repoRoot, relativePath);
    const targetPath = path.join(cloneDir, relativePath);

    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { force: true });
  }
}

function snapshotWorkingTree(cloneDir, hasChanges) {
  if (!hasChanges) {
    return;
  }

  run("git", ["add", "--all"], cloneDir);
  run("git", ["commit", "-m", "test: snapshot working tree"], cloneDir);
}

function hasParentCommit(cloneDir) {
  return spawnSync("git", ["rev-parse", "--verify", "HEAD~1"], {
    cwd: cloneDir
  }).status === 0;
}

function normalizeFixtureRepo(cloneDir) {
  run("git", ["config", "user.name", "Codex Test"], cloneDir);
  run("git", ["config", "user.email", "codex-test@example.com"], cloneDir);
  run("git", ["switch", "-C", FIXTURE_BRANCH], cloneDir);

  const hasChanges =
    spawnSync("git", ["diff", "--quiet"], { cwd: cloneDir }).status !== 0 ||
    spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: cloneDir }).status !== 0 ||
    run("git", ["status", "--short"], cloneDir) !== "";

  snapshotWorkingTree(cloneDir, hasChanges);

  // CI checkouts can be depth-1 and detached, so make HEAD~1 exist explicitly.
  if (!hasParentCommit(cloneDir)) {
    run("git", ["commit", "--allow-empty", "-m", "test: add fixture parent"], cloneDir);
  }
}

test("create_pr.sh dry run uses a branch-derived PR title", async () => {
  const cloneDir = await cloneRepo();
  const branch = run("git", ["branch", "--show-current"], cloneDir);
  const expectedTitle = deriveExpectedTitle(branch);
  const output = run("./scripts/create_pr.sh", ["--dry-run"], cloneDir);

  assert.match(
    output,
    new RegExp(`--title "${expectedTitle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"`)
  );
  assert.doesNotMatch(output, /Build the first Run Pace Calculator slice/);
});

test("prepare_handoff summary includes preview notes from the PR draft", async () => {
  const cloneDir = await cloneRepo();
  const outputDir = path.join(cloneDir, ".handoff-test");
  const output = run("./scripts/prepare-handoff.sh", [outputDir], cloneDir);
  const summary = await readFile(path.join(outputDir, "SUMMARY.md"), "utf8");
  const manifestPathMatch = output.match(/^Manifest: (.+)$/m);

  assert.match(summary, /## Preview notes/);
  assert.match(
    summary,
    /Interaction: entering pace immediately reveals speed and finish time/
  );
  assert.doesNotMatch(summary, /## Preview notes\n\n\n-/);
  assert.match(summary, /## Demo script/);
  assert.match(summary, /Turn on the finish-time lock, set the time to `1:45:00`/);
  assert.match(
    summary,
    new RegExp(
      `Attach the resulting PR to \`${FIXTURE_ISSUE_IDENTIFIER}\` and move the issue to`
    )
  );
  assert.match(summary, /\.\/resume-from-handoff\.sh <target-repo-dir>/);
  assert.match(summary, /- `SUMMARY.md`/);
  assert.match(summary, /- `verify-handoff\.mjs`/);
  assert.match(summary, /- `resume-from-handoff\.sh`/);
  assert.match(summary, /In a browser-enabled environment, use the demo script above/);
  assert.ok(manifestPathMatch, "prepare-handoff should print the manifest path");

  run("node", ["scripts/verify-handoff.mjs", manifestPathMatch[1]], cloneDir);
});

test("prepare_handoff can package optional preview capture artifacts", async () => {
  const cloneDir = await cloneRepo();
  const outputDir = path.join(cloneDir, ".handoff-test");
  const beforeRef = run("git", ["rev-parse", "HEAD~1"], cloneDir);
  const afterRef = run("git", ["rev-parse", "HEAD"], cloneDir);
  const output = run("./scripts/prepare-handoff.sh", [outputDir], cloneDir, {
    env: {
      ...process.env,
      HANDOFF_PREVIEW_BEFORE_REF: beforeRef,
      HANDOFF_PREVIEW_AFTER_REF: afterRef
    }
  });
  const summary = await readFile(path.join(outputDir, "SUMMARY.md"), "utf8");
  const captureNote = await readFile(path.join(outputDir, "PREVIEW-CAPTURE.md"), "utf8");
  const previewArchivePath = path.join(outputDir, "preview-snapshots.tar");
  const manifestPathMatch = output.match(/^Manifest: (.+)$/m);
  const previewArchiveEntries = run("tar", ["-tf", previewArchivePath], cloneDir);

  assert.match(captureNote, new RegExp(beforeRef));
  assert.match(captureNote, new RegExp(afterRef));
  assert.match(captureNote, /python3 -m http\.server 4301/);
  assert.match(captureNote, /python3 -m http\.server 4302/);
  assert.match(summary, /- `PREVIEW-CAPTURE\.md`/);
  assert.match(summary, /- `preview-snapshots\.tar`/);
  assert.match(summary, /- `previews\/before\/`/);
  assert.match(summary, /- `previews\/after\/`/);
  await stat(path.join(outputDir, "previews", "before", "index.html"));
  await stat(path.join(outputDir, "previews", "after", "index.html"));
  await stat(previewArchivePath);
  assert.match(previewArchiveEntries, /^before\/index\.html$/m);
  assert.match(previewArchiveEntries, /^after\/index\.html$/m);
  assert.ok(manifestPathMatch, "prepare-handoff should print the manifest path");

  run("node", ["scripts/verify-handoff.mjs", manifestPathMatch[1]], cloneDir);
});

test("prepare_handoff exports a self-contained resume script", async () => {
  const cloneDir = await cloneRepo();
  const outputDir = path.join(cloneDir, ".handoff-test");
  const output = run("./scripts/prepare-handoff.sh", [outputDir], cloneDir);
  const summary = await readFile(path.join(outputDir, "SUMMARY.md"), "utf8");
  const resumeScriptPath = path.join(outputDir, "resume-from-handoff.sh");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "resume-test."));
  const targetRepo = path.join(tempRoot, "target");

  run("git", ["clone", cloneDir, targetRepo], tempRoot);
  run("git", ["switch", "-c", "scratch", "HEAD~1"], targetRepo);
  run(
    "git",
    [
      "branch",
      "-D",
      run("git", ["branch", "--show-current"], cloneDir)
    ],
    targetRepo
  );

  const resumeOutput = run(resumeScriptPath, [targetRepo], outputDir);
  const manifestPathMatch = output.match(/^Manifest: (.+)$/m);

  assert.match(summary, /\.\/resume-from-handoff\.sh <target-repo-dir>/);
  assert.match(resumeOutput, /Verified manifest:/);
  assert.match(resumeOutput, /Imported branch:/);
  assert.equal(
    run("git", ["branch", "--show-current"], targetRepo),
    run("git", ["branch", "--show-current"], cloneDir)
  );
  assert.ok(manifestPathMatch, "prepare-handoff should print the manifest path");
});
