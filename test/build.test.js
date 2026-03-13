import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { APP_FILES, REPO_ROOT, buildStaticSite } from "../scripts/build.mjs";

test("buildStaticSite copies the tracked app files into dist", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "run-pace-calculator-build-"));
  const distDir = path.join(tempRoot, "dist");

  t.after(async () => {
    await rm(tempRoot, { force: true, recursive: true });
  });

  const result = await buildStaticSite({ repoRoot: REPO_ROOT, distDir });

  assert.deepEqual(result.files, APP_FILES);

  for (const file of APP_FILES) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    const built = await readFile(path.join(distDir, file), "utf8");

    assert.equal(built, source);
  }
});
