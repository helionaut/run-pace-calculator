import test from "node:test";
import assert from "node:assert/strict";

import { getModeFromNavigationKey } from "../src/lib/mode-navigation.js";

const modes = ["pace", "finish", "convert"];

test("mode navigation advances and wraps with arrow keys", () => {
  assert.equal(getModeFromNavigationKey(modes, "pace", "ArrowRight"), "finish");
  assert.equal(getModeFromNavigationKey(modes, "convert", "ArrowRight"), "pace");
  assert.equal(getModeFromNavigationKey(modes, "pace", "ArrowLeft"), "convert");
  assert.equal(getModeFromNavigationKey(modes, "finish", "ArrowDown"), "convert");
  assert.equal(getModeFromNavigationKey(modes, "pace", "ArrowUp"), "convert");
});

test("mode navigation supports home and end keys", () => {
  assert.equal(getModeFromNavigationKey(modes, "convert", "Home"), "pace");
  assert.equal(getModeFromNavigationKey(modes, "pace", "End"), "convert");
});

test("mode navigation ignores unrelated keys and empty mode lists", () => {
  assert.equal(getModeFromNavigationKey(modes, "pace", "Enter"), null);
  assert.equal(getModeFromNavigationKey([], "pace", "ArrowRight"), null);
});
