import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceScript = path.join(repoRoot, "scripts", "create_pr.sh");

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

function git(args, cwd) {
  return run("git", args, cwd);
}

async function createFixtureRepo(branchName, draftBody = "## Summary\n\n- fixture\n") {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "run-pace-calculator-pr."));
  const repoDir = path.join(tempRoot, "repo");

  git(["init", "-b", branchName, repoDir], tempRoot);
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
          url: "https://github.com/helionaut/run-pace-calculator"
        },
        linear: {
          starter_issue_identifier: "HEL-8"
        }
      },
      null,
      2
    ) + "\n"
  );
  await writeFile(
    path.join(repoDir, "docs", "pull-request-draft.md"),
    draftBody
  );
  await writeFile(path.join(repoDir, "README.md"), "# fixture\n");
  await writeFile(
    path.join(repoDir, "scripts", "create_pr.sh"),
    await readFile(sourceScript, "utf8")
  );
  await chmod(path.join(repoDir, "scripts", "create_pr.sh"), 0o755);
  git(["add", "."], repoDir);
  git(["commit", "-m", "Initial fixture"], repoDir);

  return {
    repoDir,
    tempRoot
  };
}

test("create_pr.sh dry-run infers a PR title from the current issue branch", async (t) => {
  const { repoDir, tempRoot } = await createFixtureRepo(
    "eugeniy/hel-19-add-confidence-focused-result-presentation-and-input"
  );
  t.after(async () => {
    await rm(tempRoot, { force: true, recursive: true });
  });
  const output = run("./scripts/create_pr.sh", ["--dry-run"], repoDir);

  assert.match(
    output,
    /Using PR title: Add confidence focused result presentation and input/
  );
  assert.match(
    output,
    /Would create a PR with: gh pr create --head eugeniy\/hel-19-add-confidence-focused-result-presentation-and-input --title "Add confidence focused result presentation and input"/
  );
});

test("create_pr.sh dry-run prefers PR draft title metadata over branch inference", async (t) => {
  const { repoDir, tempRoot } = await createFixtureRepo(
    "eugeniy/hel-19-add-confidence-focused-result-presentation-and-input",
    [
      "<!-- PR_TITLE: Add confidence-focused result presentation and input provenance styling -->",
      "",
      "## Summary",
      "",
      "- fixture",
      ""
    ].join("\n")
  );
  t.after(async () => {
    await rm(tempRoot, { force: true, recursive: true });
  });
  const output = run("./scripts/create_pr.sh", ["--dry-run"], repoDir);

  assert.match(
    output,
    /Using PR title: Add confidence-focused result presentation and input provenance styling/
  );
});

test("create_pr.sh dry-run lets PR_TITLE override the draft title", async (t) => {
  const { repoDir, tempRoot } = await createFixtureRepo(
    "eugeniy/hel-19-add-confidence-focused-result-presentation-and-input",
    [
      "<!-- PR_TITLE: Add confidence-focused result presentation and input provenance styling -->",
      "",
      "## Summary",
      "",
      "- fixture",
      ""
    ].join("\n")
  );
  t.after(async () => {
    await rm(tempRoot, { force: true, recursive: true });
  });
  const output = run(
    "./scripts/create_pr.sh",
    ["--dry-run"],
    repoDir,
    {
      ...process.env,
      PR_TITLE: "Add provenance and locked-state cues to calculator results"
    }
  );

  assert.match(
    output,
    /Using PR title: Add provenance and locked-state cues to calculator results/
  );
});
