import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

function deriveExpectedTitle(branch) {
  const branchName = branch.split("/").at(-1) ?? branch;
  const issueMatch = /^[A-Za-z]+-\d+-(.+)$/.exec(branchName);
  const slug = (issueMatch?.[1] ?? branchName).replaceAll("-", " ");

  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

test("create_pr.sh dry run uses a title derived from the current branch", () => {
  const branch = run("git", ["branch", "--show-current"]).trim();
  const output = run(publishScript, ["--dry-run"]);
  const expectedTitle = deriveExpectedTitle(branch);

  assert.match(output, new RegExp(`Would create a PR with: gh pr create --head ${branch} --title "${expectedTitle}"`));
  assert.doesNotMatch(output, /Build the first Run Pace Calculator slice/);
  assert.match(output, /Would use body file: docs\/pull-request-draft\.md/);
});
