import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveRequestPath } from "../scripts/serve.mjs";

test("resolveRequestPath maps the root request to index.html", () => {
  assert.equal(resolveRequestPath("/tmp/app", "/"), path.join("/tmp/app", "index.html"));
});

test("resolveRequestPath keeps nested asset paths inside the provided root", () => {
  assert.equal(
    resolveRequestPath("/tmp/app", "/assets/site.css"),
    path.join("/tmp/app", "assets", "site.css"),
  );
});

test("resolveRequestPath rejects traversal attempts", () => {
  assert.throws(
    () => resolveRequestPath("/tmp/app", "/../README.md"),
    /Path traversal is not allowed/,
  );
});

test("resolveRequestPath rejects encoded traversal attempts", () => {
  assert.throws(
    () => resolveRequestPath("/tmp/app", "/%2E%2E/README.md"),
    /Path traversal is not allowed/,
  );
});
