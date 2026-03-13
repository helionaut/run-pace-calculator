import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publishScript = path.join(repoRoot, "scripts", "create_pr.sh");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout;
}

function resolveCurrentBranch(env = process.env) {
  const branch = run("git", ["branch", "--show-current"]).trim();

  return branch || env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || "";
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

function deriveExpectedTitle(branch) {
  const branchName = branch.split("/").at(-1) ?? branch;
  const issueMatch = /^[A-Za-z]+-\d+-(.+)$/.exec(branchName);
  const slug = (issueMatch?.[1] ?? branchName).replaceAll("-", " ");

  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

test("create_pr.sh dry run uses a title derived from the current branch", () => {
  const branch = resolveCurrentBranch();
  const output = run(publishScript, ["--dry-run"]);
  const expectedTitle = deriveExpectedTitle(branch);

  assert.match(output, new RegExp(`Would create a PR with: gh pr create --head ${branch} --title "${expectedTitle}"`));
  assert.doesNotMatch(output, /Build the first Run Pace Calculator slice/);
  assert.match(output, /Would use body file: docs\/pull-request-draft\.md/);
});

test("create_pr.sh dry run uses GITHUB_HEAD_REF when the checkout is detached", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-publish-detached."));
  const repoDir = path.join(tempRoot, "repo");
  const scriptsDir = path.join(repoDir, "scripts");
  const docsDir = path.join(repoDir, "docs");
  const bootstrapDir = path.join(repoDir, ".bootstrap");
  const branch = "eugeniy/hel-99-detached-publish";

  await mkdir(repoDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  await mkdir(bootstrapDir, { recursive: true });

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
    path.join(scriptsDir, "create_pr.sh"),
    await readFile(path.join(repoRoot, "scripts", "create_pr.sh"), "utf8")
  );

  git(["add", "."], repoDir);
  git(["commit", "-m", "Initial fixture"], repoDir);
  git(["switch", "-c", branch], repoDir);
  git(["checkout", "--detach"], repoDir);

  const result = spawnSync("./scripts/create_pr.sh", ["--dry-run"], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_HEAD_REF: branch
    }
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Using branch: ${branch}`));
  assert.match(
    result.stdout,
    /Would create a PR with: gh pr create --head eugeniy\/hel-99-detached-publish --title "Detached publish"/
  );
  assert.doesNotMatch(result.stdout, /Update run pace calculator/);
});

test("create_pr.sh records combined blocker details in the fallback handoff summary", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-18-publish-script."));
  const repoDir = path.join(tempRoot, "repo");
  const scriptsDir = path.join(repoDir, "scripts");
  const docsDir = path.join(repoDir, "docs");
  const bootstrapDir = path.join(repoDir, ".bootstrap");
  const binDir = path.join(tempRoot, "bin");
  const handoffDir = path.join(tempRoot, "handoff");

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

  for (const scriptName of ["create_pr.sh", "prepare-handoff.sh", "export_bundle.sh"]) {
    await writeExecutable(
      path.join(scriptsDir, scriptName),
      await readFile(path.join(repoRoot, "scripts", scriptName), "utf8")
    );
  }

  await writeExecutable(
    path.join(binDir, "npm"),
    `#!/bin/sh
if [ "$1" = "test" ]; then
  exit 0
fi
if [ "$1" = "run" ] && [ "$2" = "build" ]; then
  exit 0
fi
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
  await writeExecutable(
    path.join(binDir, "gh"),
    `#!/bin/sh
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  exit 1
fi
echo "unexpected gh invocation: $*" >&2
exit 1
`
  );
  await writeExecutable(
    path.join(binDir, "python3"),
    `#!/bin/sh
exit 1
`
  );
  await writeExecutable(
    path.join(binDir, "curl"),
    `#!/bin/sh
exit 1
`
  );

  git(["add", "."], repoDir);
  git(["commit", "-m", "Initial fixture"], repoDir);
  git(["switch", "-c", "eugeniy/hel-99-publish-fixture"], repoDir);

  const result = spawnSync("./scripts/create_pr.sh", [], {
    cwd: repoDir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      HANDOFF_DIR: handoffDir
    }
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /GitHub auth is not ready/);
  assert.match(result.stderr, /GitHub DNS resolution failed/);
  assert.match(result.stderr, /GitHub HTTPS reachability check failed/);

  const summary = await readFile(path.join(handoffDir, "SUMMARY.md"), "utf8");

  assert.match(summary, /## Current blocker snapshot \(\d{4}-\d{2}-\d{2}\)/);
  assert.match(summary, /- GitHub auth is not ready/);
  assert.match(summary, /- GitHub DNS resolution failed/);
  assert.match(summary, /- GitHub HTTPS reachability check failed/);
});
