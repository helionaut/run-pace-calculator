import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "hel-16-publish-test."));
  const cloneDir = path.join(tempRoot, "repo");

  run("git", ["clone", repoRoot, cloneDir], tempRoot);
  return cloneDir;
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
  assert.ok(manifestPathMatch, "prepare-handoff should print the manifest path");

  run("node", ["scripts/verify-handoff.mjs", manifestPathMatch[1]], cloneDir);
});
