import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { APP_FILES, DIST_DIR } from "./build.mjs";

async function assertFileExists(filePath) {
  await access(filePath);
}

async function main() {
  for (const file of APP_FILES) {
    await assertFileExists(path.join(DIST_DIR, file));
  }

  const html = await readFile(path.join(DIST_DIR, "index.html"), "utf8");
  const requiredSnippets = [
    "<title>Run Pace Calculator</title>",
    '<link rel="stylesheet" href="./styles.css" />',
    '<script type="module" src="./script.js"></script>',
    "Engineering harness ready for calculator feature work.",
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
