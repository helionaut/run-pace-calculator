import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

async function writeExecutable(filePath, content) {
  await writeFile(filePath, content, "utf8");
  await chmod(filePath, 0o755);
}

function deriveExpectedTitle(branch) {
  const branchName = branch.split("/").at(-1) ?? branch;
  const issueMatch = /^[A-Za-z]+-\d+-(.+)$/.exec(branchName);
  const slug = (issueMatch?.[1] ?? branchName).replaceAll("-", " ");

  return slug.charAt(0).toUpperCase() + slug.slice(1);
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

test("imported bundle can run pr:dry-run from a fresh main clone", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-import-dry-run."));
  const sourceRepo = path.join(tempRoot, "source");
  const targetRepo = path.join(tempRoot, "target");
  const scriptsDir = path.join(sourceRepo, "scripts");
  const docsDir = path.join(sourceRepo, "docs");
  const bootstrapDir = path.join(sourceRepo, ".bootstrap");
  const bundleDir = path.join(tempRoot, "bundle-dir");
  const bundlePath = path.join(bundleDir, "feature.bundle");
  const branch = "eugeniy/hel-99-import-dry-run";

  await mkdir(sourceRepo, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(bootstrapDir, { recursive: true });
  await mkdir(bundleDir, { recursive: true });

  git(["init", "-b", "main"], sourceRepo);
  git(["config", "user.name", "Codex"], sourceRepo);
  git(["config", "user.email", "codex@example.com"], sourceRepo);
  git(["remote", "add", "origin", "https://github.com/helionaut/run-pace-calculator.git"], sourceRepo);

  await writeFile(path.join(sourceRepo, "README.md"), "# fixture repo\n");
  await writeFile(
    path.join(sourceRepo, "package.json"),
    await readFile(path.join(repoRoot, "package.json"), "utf8")
  );
  await writeFile(
    path.join(sourceRepo, "package-lock.json"),
    await readFile(path.join(repoRoot, "package-lock.json"), "utf8")
  );
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
    path.join(scriptsDir, "create_pr.sh"),
    await readFile(path.join(repoRoot, "scripts", "create_pr.sh"), "utf8")
  );

  git(["add", "."], sourceRepo);
  git(["commit", "-m", "Initial fixture"], sourceRepo);

  git(["clone", "--single-branch", "--branch", "main", sourceRepo, targetRepo], tempRoot);

  git(["switch", "-c", branch], sourceRepo);
  await writeFile(path.join(sourceRepo, "feature.txt"), "feature branch\n");
  git(["add", "feature.txt"], sourceRepo);
  git(["commit", "-m", "Add feature"], sourceRepo);

  const featureHead = git(["rev-parse", "HEAD"], sourceRepo);

  git(["bundle", "create", bundlePath, branch], sourceRepo);

  run(importScript, [bundlePath, targetRepo], sourceRepo);
  git(["switch", branch], targetRepo);

  assert.equal(git(["rev-parse", "HEAD"], targetRepo), featureHead);

  const output = run("./scripts/create_pr.sh", ["--dry-run"], targetRepo);

  assert.match(output, new RegExp(`Using branch: ${branch}`));
  assert.match(
    output,
    new RegExp(
      `Would create a PR with: gh pr create --head ${branch} --title \"${deriveExpectedTitle(branch)}\"`
    )
  );
  assert.match(output, /Would use body file: docs\/pull-request-draft\.md/);
});
