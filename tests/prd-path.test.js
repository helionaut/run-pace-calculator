import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = path.posix.join("docs", "PRD.md");
const legacyPath = path.posix.join("docs", "prd.md");

function git(args) {
  return spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("repo tracks the canonical uppercase PRD path", async () => {
  await access(path.join(repoRoot, canonicalPath), constants.F_OK);

  await assert.rejects(
    () => access(path.join(repoRoot, legacyPath), constants.F_OK),
    {
      code: "ENOENT"
    }
  );

  const trackedFiles = git(["ls-files"]);
  assert.equal(trackedFiles.status, 0, trackedFiles.stderr);

  const relativePaths = trackedFiles.stdout.split("\n").filter(Boolean);

  assert.ok(relativePaths.includes(canonicalPath));
  assert.ok(!relativePaths.includes(legacyPath));
});

test("tracked content avoids the legacy lowercase PRD reference", () => {
  const grepResult = git(["grep", "-n", legacyPath, "--", "."]);

  assert.equal(
    grepResult.status,
    1,
    grepResult.stdout.trim() ||
      grepResult.stderr.trim() ||
      "git grep unexpectedly found a legacy PRD path reference"
  );
});
