import test from "node:test";
import assert from "node:assert/strict";

import { getModeFromNavigationKey } from "../src/lib/mode-navigation.js";

const modes = ["pace", "speed", "finish"];

test("mode navigation advances and wraps with arrow keys", () => {
  assert.equal(getModeFromNavigationKey(modes, "pace", "ArrowRight"), "speed");
  assert.equal(getModeFromNavigationKey(modes, "finish", "ArrowRight"), "pace");
  assert.equal(getModeFromNavigationKey(modes, "pace", "ArrowLeft"), "finish");
  assert.equal(getModeFromNavigationKey(modes, "speed", "ArrowDown"), "finish");
  assert.equal(getModeFromNavigationKey(modes, "pace", "ArrowUp"), "finish");
});

test("mode navigation supports home and end keys", () => {
  assert.equal(getModeFromNavigationKey(modes, "finish", "Home"), "pace");
  assert.equal(getModeFromNavigationKey(modes, "pace", "End"), "finish");
});

test("mode navigation ignores unrelated keys and empty mode lists", () => {
  assert.equal(getModeFromNavigationKey(modes, "pace", "Enter"), null);
  assert.equal(getModeFromNavigationKey([], "pace", "ArrowRight"), null);
});
