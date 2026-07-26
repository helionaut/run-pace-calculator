import assert from "node:assert/strict";
import test from "node:test";

import {
  checkSupplyChainPolicy,
  MINIMUM_RELEASE_AGE_DAYS
} from "../scripts/check-supply-chain.mjs";

test("repository preserves a lockfile-backed seven-day zero-dependency policy", async () => {
  const result = await checkSupplyChainPolicy();

  assert.equal(MINIMUM_RELEASE_AGE_DAYS, 7);
  assert.equal(result.minimumReleaseAgeDays, 7);
  assert.equal(result.npmMinimumReleaseAgeDays, 7);
  assert.deepEqual(result.declaredDependencies, []);
});
