import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { DIST_FILES, SOURCE_DIR, buildStaticSite } from "../scripts/build.mjs";

test("buildStaticSite copies the tracked app files from src into dist", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "run-pace-calculator-build-"));
  const distDir = path.join(tempRoot, "dist");

  t.after(async () => {
    await rm(tempRoot, { force: true, recursive: true });
  });

  const result = await buildStaticSite({ distDir });

  assert.deepEqual(result.files, DIST_FILES);

  for (const file of DIST_FILES) {
    const source = await readFile(path.join(SOURCE_DIR, file));
    const built = await readFile(path.join(distDir, file));

    assert.deepEqual(built, source);
  }
});
