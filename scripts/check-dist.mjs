import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { DIST_DIR, DIST_FILES } from "./build.mjs";

async function assertFileExists(filePath) {
  await access(filePath);
}

async function main() {
  for (const file of DIST_FILES) {
    await assertFileExists(path.join(DIST_DIR, file));
  }

  const html = await readFile(path.join(DIST_DIR, "index.html"), "utf8");
  const requiredSnippets = [
    "<title>Run Pace Calculator</title>",
    '<link rel="icon" type="image/svg+xml" href="./favicon.svg" />',
    '<script type="module" src="./main.js"></script>',
    'id="distance-card"',
    'id="distance-slider"',
    'id="rate-card"',
    'id="time-card"',
    'id="pace-minutes"',
    'id="speed-input"',
    'id="projection-marathon"',
  ];

  for (const snippet of requiredSnippets) {
    if (!html.includes(snippet)) {
      throw new Error(`dist/index.html is missing required content: ${snippet}`);
    }
  }

  console.log(`Verified dist output in ${DIST_DIR}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
