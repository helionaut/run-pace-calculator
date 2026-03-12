import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveCalculatorState,
  findRacePreset,
  formatDuration,
  formatPace,
  parsePaceInput,
  paceToSpeedKmh,
  speedToPaceSeconds,
} from "./calculator.js";

test("parsePaceInput accepts m:ss values", () => {
  assert.deepEqual(parsePaceInput("4:35"), { error: null, value: 275 });
});

test("parsePaceInput rejects malformed values", () => {
  assert.equal(parsePaceInput("4-35").error, "Use m:ss for pace, for example 4:45.");
});

test("parsePaceInput accepts pace values with single-digit seconds", () => {
  assert.deepEqual(parsePaceInput("4:5"), { error: null, value: 245 });
});

test("parsePaceInput ignores surrounding whitespace", () => {
  assert.deepEqual(parsePaceInput(" 4:05 "), { error: null, value: 245 });
});

test("pace and speed conversions stay in sync", () => {
  const speed = paceToSpeedKmh(300);
  assert.equal(speed.toFixed(2), "12.00");
  assert.equal(Math.round(speedToPaceSeconds(speed)), 300);
});

test("deriveCalculatorState uses pace when it is the preferred valid source", () => {
  const state = deriveCalculatorState({
    distanceInput: "10",
    paceInput: "5:00",
    source: "pace",
    speedInput: "11",
  });

  assert.equal(state.sourceUsed, "pace");
  assert.equal(state.metrics.finishSeconds, 3000);
  assert.equal(formatPace(state.metrics.paceSeconds), "5:00 /km");
});

test("deriveCalculatorState falls back to speed when pace is invalid", () => {
  const state = deriveCalculatorState({
    distanceInput: "21.0975",
    paceInput: "oops",
    source: "pace",
    speedInput: "12",
  });

  assert.equal(state.sourceUsed, "speed");
  assert.equal(state.status, "Using speed because the pace input needs attention.");
  assert.equal(formatDuration(state.metrics.finishSeconds), "1:45:29");
});

test("deriveCalculatorState reports invalid numeric distance input", () => {
  const state = deriveCalculatorState({
    distanceInput: "ten",
    paceInput: "5:00",
    source: "pace",
    speedInput: "",
  });

  assert.equal(state.errors.distance, "Distance must be a number, for example 10.");
  assert.equal(state.metrics.finishSeconds, null);
});

test("deriveCalculatorState reminds users which valid source is active", () => {
  const state = deriveCalculatorState({
    distanceInput: "10",
    paceInput: "5:00",
    source: "speed",
    speedInput: "",
  });

  assert.equal(state.status, "Using pace as the active source.");
});

test("deriveCalculatorState points to an invalid pace when no fallback source exists", () => {
  const state = deriveCalculatorState({
    distanceInput: "10",
    paceInput: "oops",
    source: "pace",
    speedInput: "",
  });

  assert.equal(state.sourceUsed, null);
  assert.equal(state.status, "Fix the pace input to start converting.");
});

test("deriveCalculatorState points to an invalid speed when no fallback source exists", () => {
  const state = deriveCalculatorState({
    distanceInput: "10",
    paceInput: "",
    source: "speed",
    speedInput: "fast",
  });

  assert.equal(state.sourceUsed, null);
  assert.equal(state.status, "Fix the speed input to start converting.");
});

test("deriveCalculatorState points to both invalid inputs when neither source is usable", () => {
  const state = deriveCalculatorState({
    distanceInput: "10",
    paceInput: "oops",
    source: "pace",
    speedInput: "fast",
  });

  assert.equal(state.sourceUsed, null);
  assert.equal(state.status, "Fix the pace and speed inputs to start converting.");
});

test("deriveCalculatorState accepts comma decimals for speed-driven projections", () => {
  const state = deriveCalculatorState({
    distanceInput: "10,0",
    paceInput: "",
    source: "speed",
    speedInput: "12,5",
  });

  assert.equal(formatDuration(state.metrics.finishSeconds), "48:00");
  assert.equal(state.errors.speed, null);
  assert.equal(state.errors.distance, null);
});

test("findRacePreset recognises the marathon distance", () => {
  assert.equal(findRacePreset(42.195)?.label, "Marathon");
});
