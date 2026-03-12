import test from "node:test";
import assert from "node:assert/strict";

import {
  KM_PER_MILE,
  convertSpeed,
  formatDuration,
  formatPace,
  paceSecondsToSpeedKph,
  predictedTimeSeconds,
  speedKphToPaceSeconds,
} from "../calculator.js";

test("pace converts to metric speed", () => {
  assert.equal(paceSecondsToSpeedKph(300, "km"), 12);
});

test("speed converts between km/h and mph", () => {
  const mph = convertSpeed(12, "km", "mi");

  assert.ok(Math.abs(mph - 7.456454306848007) < 1e-12);
  assert.ok(Math.abs(convertSpeed(mph, "mi", "km") - 12) < 1e-12);
});

test("speed converts to pace in both unit systems", () => {
  assert.equal(formatPace(12, "km"), "5:00 /km");
  assert.equal(formatPace(12, "mi"), "8:03 /mi");
  assert.equal(Math.round(speedKphToPaceSeconds(12, "mi")), 483);
});

test("predicted race times round cleanly", () => {
  const fiveKilometerTime = predictedTimeSeconds(12, 5);
  const halfMarathonTime = predictedTimeSeconds(12, 21.0975);

  assert.equal(formatDuration(fiveKilometerTime), "25:00");
  assert.equal(formatDuration(halfMarathonTime), "1:45:29");
});

test("mile distance constant matches the expected conversion", () => {
  assert.equal(KM_PER_MILE, 1.609344);
});
