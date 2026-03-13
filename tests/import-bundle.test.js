import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importScript = path.join(repoRoot, "scripts", "import_bundle.sh");

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

test("import_bundle.sh accepts a relative bundle path", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-8-import-bundle."));
  const sourceRepo = path.join(tempRoot, "source");
  const targetRepo = path.join(tempRoot, "target");
  const bundleDir = path.join(tempRoot, "bundle-dir");
  const bundlePath = path.join(bundleDir, "feature.bundle");

  git(["init", "-b", "main", sourceRepo], tempRoot);
  git(["config", "user.name", "Codex"], sourceRepo);
  git(["config", "user.email", "codex@example.com"], sourceRepo);

  await writeFile(path.join(sourceRepo, "README.md"), "# temp repo\n");
  git(["add", "README.md"], sourceRepo);
  git(["commit", "-m", "Initial commit"], sourceRepo);

  git(["clone", sourceRepo, targetRepo], tempRoot);

  git(["switch", "-c", "feature/test"], sourceRepo);
  await writeFile(path.join(sourceRepo, "feature.txt"), "feature branch\n");
  git(["add", "feature.txt"], sourceRepo);
  git(["commit", "-m", "Add feature"], sourceRepo);

  const featureHead = git(["rev-parse", "HEAD"], sourceRepo);

  await mkdir(bundleDir, { recursive: true });
  git(["bundle", "create", bundlePath, "feature/test"], sourceRepo);

  run(importScript, [path.basename(bundlePath), targetRepo], bundleDir);

  assert.equal(git(["rev-parse", "feature/test"], targetRepo), featureHead);
});
