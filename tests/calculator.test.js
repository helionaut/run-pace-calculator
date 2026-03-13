import test from "node:test";
import assert from "node:assert/strict";

import {
  KM_PER_MILE,
  calculatePerformance,
  finishTimeFromSpeed,
  formatDuration,
  paceSecondsToSpeed,
  speedFromFinishTime,
  speedToPaceSeconds,
  validateTimeParts
} from "../src/lib/calculator.js";

test("pace mode converts five-minute kilometers into consistent outputs", () => {
  const result = calculatePerformance({
    distanceId: "marathon",
    mode: "pace",
    paceMinutes: 5,
    paceSeconds: 0,
    paceUnit: "km"
  });

  assert.equal(result.error, undefined);
  assert.equal(Number(result.speedKmh.toFixed(2)), 12);
  assert.equal(formatDuration(result.selectedFinishSeconds), "3:30:59");
  assert.equal(formatDuration(result.pacePerMileSeconds), "8:03");
});

test("speed mode converts miles per hour into kilometer pace", () => {
  const result = calculatePerformance({
    distanceId: "10k",
    mode: "speed",
    speedUnit: "mph",
    speedValue: 6
  });

  assert.equal(result.error, undefined);
  assert.equal(Number(result.speedKmh.toFixed(3)), Number((6 * KM_PER_MILE).toFixed(3)));
  assert.equal(formatDuration(result.pacePerKilometerSeconds), "6:13");
});

test("finish mode derives speed from a target time and distance", () => {
  const result = calculatePerformance({
    distanceId: "5k",
    finishHours: 0,
    finishMinutes: 25,
    finishSeconds: 0,
    mode: "finish"
  });

  assert.equal(result.error, undefined);
  assert.equal(Number(result.speedKmh.toFixed(1)), 12);
  assert.equal(formatDuration(result.pacePerKilometerSeconds), "5:00");
});

test("pure helpers agree on round-trip conversions", () => {
  const speed = paceSecondsToSpeed(300, "km");
  const finish = finishTimeFromSpeed(speed, 10);
  const reconstructedSpeed = speedFromFinishTime(finish, 10);

  assert.equal(Number(speed.toFixed(3)), 12);
  assert.equal(Number(reconstructedSpeed.toFixed(3)), 12);
  assert.equal(Number(speedToPaceSeconds(speed, "mi").toFixed(1)), 482.8);
});

test("pace mode rejects seconds outside the expected range", () => {
  const result = calculatePerformance({
    distanceId: "10k",
    mode: "pace",
    paceMinutes: 4,
    paceSeconds: 75,
    paceUnit: "km"
  });

  assert.equal(result.error, "Pace seconds must stay between 0 and 59.");
});

test("pace mode allows minute values above an hour", () => {
  const result = calculatePerformance({
    distanceId: "5k",
    mode: "pace",
    paceMinutes: 75,
    paceSeconds: 0,
    paceUnit: "km"
  });

  assert.equal(result.error, undefined);
  assert.equal(formatDuration(result.selectedFinishSeconds), "6:15:00");
});

test("finish mode rejects minutes outside the expected range", () => {
  const result = calculatePerformance({
    distanceId: "5k",
    finishHours: 0,
    finishMinutes: 61,
    finishSeconds: 0,
    mode: "finish"
  });

  assert.equal(result.error, "Minutes must stay between 0 and 59.");
});

test("time part validation requires whole numbers", () => {
  const result = validateTimeParts({
    hours: 0,
    minutes: 12.5,
    seconds: 0
  });

  assert.equal(result.error, "Use whole numbers for hours, minutes, and seconds.");
});
