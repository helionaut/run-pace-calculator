import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repairScript = path.join(repoRoot, "scripts", "repair-shared-checkout.sh");
const conflictedBranch =
  "eugeniy/hel-16-redesign-calculator-into-a-compact-one-screen-interactive";

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

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

function runExpectFailure(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8"
  });
}

async function createSourceRepo() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "repair-shared-checkout."));
  const sourceRepo = path.join(tempRoot, "source");

  git(["init", "-b", "main", sourceRepo], tempRoot);
  git(["config", "user.name", "Codex"], sourceRepo);
  git(["config", "user.email", "codex@example.com"], sourceRepo);

  await writeFile(path.join(sourceRepo, "README.md"), "# shared checkout source\n");
  git(["add", "README.md"], sourceRepo);
  git(["commit", "-m", "Initial commit"], sourceRepo);

  git(["switch", "-c", conflictedBranch], sourceRepo);
  await writeFile(path.join(sourceRepo, "feature.txt"), "feature branch\n");
  git(["add", "feature.txt"], sourceRepo);
  git(["commit", "-m", "Add feature branch state"], sourceRepo);
  git(["switch", "main"], sourceRepo);

  return {
    tempRoot,
    sourceRepo
  };
}

test("repair-shared-checkout backs up the previous checkout and reclones main", async () => {
  const { tempRoot, sourceRepo } = await createSourceRepo();
  const targetRepo = path.join(tempRoot, "shared-checkout");

  git(["clone", sourceRepo, targetRepo], tempRoot);
  git(["switch", "-c", conflictedBranch], targetRepo);
  await writeFile(path.join(targetRepo, "dirty.txt"), "stale local state\n");

  const output = run(
    repairScript,
    ["--repo-url", sourceRepo, "--target-dir", targetRepo],
    repoRoot
  );
  const backupName = (await readdir(tempRoot)).find((entry) =>
    entry.startsWith("shared-checkout.backup.")
  );

  assert.match(output, /Backed up existing checkout:/);
  assert.ok(backupName, "expected the previous checkout to be preserved as a backup");

  const backupRepo = path.join(tempRoot, backupName);
  const mainHead = git(["rev-parse", "main"], sourceRepo);

  assert.equal(git(["branch", "--show-current"], targetRepo), "main");
  assert.equal(git(["rev-parse", "HEAD"], targetRepo), mainHead);
  assert.equal(git(["status", "--short"], targetRepo), "");
  assert.equal(git(["branch", "--show-current"], backupRepo), conflictedBranch);
  await stat(path.join(backupRepo, "dirty.txt"));
  await assert.rejects(stat(path.join(targetRepo, "dirty.txt")));
});

test("repair-shared-checkout restores the previous checkout if cloning fails", async () => {
  const { tempRoot, sourceRepo } = await createSourceRepo();
  const targetRepo = path.join(tempRoot, "shared-checkout");

  git(["clone", sourceRepo, targetRepo], tempRoot);
  git(["switch", "-c", conflictedBranch], targetRepo);
  await writeFile(path.join(targetRepo, "dirty.txt"), "stale local state\n");

  const result = runExpectFailure(
    repairScript,
    ["--repo-url", sourceRepo, "--target-dir", targetRepo, "--branch", "missing-branch"],
    repoRoot
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Restored original checkout after failure:/);
  assert.equal(git(["branch", "--show-current"], targetRepo), conflictedBranch);
  await stat(path.join(targetRepo, "dirty.txt"));
  assert.equal(
    (await readdir(tempRoot)).filter((entry) => entry.startsWith("shared-checkout.backup."))
      .length,
    0
  );
});

test("repair-shared-checkout can recreate a missing target on an explicit branch", async () => {
  const { tempRoot, sourceRepo } = await createSourceRepo();
  const targetRepo = path.join(tempRoot, "shared-checkout");
  const featureHead = git(["rev-parse", conflictedBranch], sourceRepo);

  const output = run(
    repairScript,
    [
      "--repo-url",
      sourceRepo,
      "--target-dir",
      targetRepo,
      "--branch",
      conflictedBranch
    ],
    repoRoot
  );

  assert.match(output, new RegExp(`Using branch: ${conflictedBranch}`));
  assert.equal(git(["branch", "--show-current"], targetRepo), conflictedBranch);
  assert.equal(git(["rev-parse", "HEAD"], targetRepo), featureHead);
  assert.equal(git(["status", "--short"], targetRepo), "");
});
