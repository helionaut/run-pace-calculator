import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { resolveRequestPath } from "./preview.mjs";

test("resolveRequestPath maps the root path to dist/index.html", () => {
  assert.equal(
    resolveRequestPath("/"),
    path.join(process.cwd(), "dist", "index.html"),
  );
});

test("resolveRequestPath keeps resolved files inside dist", () => {
  assert.equal(
    resolveRequestPath("/../app.js"),
    path.join(process.cwd(), "dist", "app.js"),
  );
});

test("resolveRequestPath normalizes nested asset paths", () => {
  assert.equal(
    resolveRequestPath("/nested/../styles.css"),
    path.join(process.cwd(), "dist", "styles.css"),
  );
});
