import test from "node:test";
import assert from "node:assert/strict";

import {
  DRIVER_METRICS,
  DISTANCE_PRESETS,
  applyPresetSelection,
  applyUnitChange,
  createFormState,
  deriveCalculatorView,
  formatDistanceInputValue,
  resetFormState,
  setActiveMetric,
  toggleMetricLock,
  updateDistanceInput,
  updateInputValue
} from "../src/lib/calculator.js";

function enterPace(state, minutes, seconds) {
  let nextState = setActiveMetric(state, DRIVER_METRICS.PACE);

  nextState = updateInputValue(nextState, "paceMinutes", minutes);
  nextState = updateInputValue(nextState, "paceSeconds", seconds);
  return nextState;
}

function enterSpeed(state, speed) {
  let nextState = setActiveMetric(state, DRIVER_METRICS.SPEED);

  nextState = updateInputValue(nextState, "speed", speed);
  return nextState;
}

function enterTime(state, hours, minutes, seconds) {
  let nextState = setActiveMetric(state, DRIVER_METRICS.TIME);

  nextState = updateInputValue(nextState, "timeHours", hours);
  nextState = updateInputValue(nextState, "timeMinutes", minutes);
  nextState = updateInputValue(nextState, "timeSeconds", seconds);
  return nextState;
}

test("default state keeps a 10K distance selected and waits for input", () => {
  const view = deriveCalculatorView(createFormState());

  assert.equal(view.selectedDistanceLabel, "10 km");
  assert.equal(view.distance.inputValue, "10");
  assert.equal(view.distance.presetId, "10k");
  assert.equal(view.cards.pace.stateLabel, "Input");
  assert.equal(view.cards.speed.stateLabel, "Waiting");
  assert.equal(view.cards.time.stateLabel, "Waiting");
  assert.equal(view.cards.speed.inputValue, "");
  assert.deepEqual(view.cards.time.inputValues, {
    hours: "",
    minutes: "",
    seconds: ""
  });
});

test("pace input derives speed and finish time for the selected distance", () => {
  const view = deriveCalculatorView(enterPace(createFormState(), "5", "0"));

  assert.equal(view.driverMetric, DRIVER_METRICS.PACE);
  assert.equal(view.cards.pace.stateLabel, "Input");
  assert.equal(view.cards.speed.stateLabel, "Derived");
  assert.equal(view.cards.time.stateLabel, "Derived");
  assert.equal(view.cards.speed.inputValue, "12");
  assert.equal(view.cards.speed.secondary, "Also 7.46 mph");
  assert.deepEqual(view.cards.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
  assert.equal(view.cards.time.secondary, "For 10 km");
});

test("speed input derives pace and finish time for the selected distance", () => {
  const view = deriveCalculatorView(enterSpeed(createFormState(), "12"));

  assert.equal(view.driverMetric, DRIVER_METRICS.SPEED);
  assert.equal(view.cards.speed.stateLabel, "Input");
  assert.equal(view.cards.pace.stateLabel, "Derived");
  assert.deepEqual(view.cards.pace.inputValues, {
    minutes: "5",
    seconds: "00"
  });
  assert.deepEqual(view.cards.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
});

test("time input derives the pace and speed required for the selected distance", () => {
  const view = deriveCalculatorView(enterTime(createFormState(), "0", "50", "0"));

  assert.equal(view.driverMetric, DRIVER_METRICS.TIME);
  assert.equal(view.cards.time.stateLabel, "Input");
  assert.deepEqual(view.cards.pace.inputValues, {
    minutes: "5",
    seconds: "00"
  });
  assert.equal(view.cards.speed.inputValue, "12");
});

test("locking time keeps the target fixed while distance changes", () => {
  let state = enterPace(createFormState(), "5", "0");

  state = toggleMetricLock(state, "time");
  state = updateDistanceInput(state, "5");

  const view = deriveCalculatorView(state);

  assert.equal(view.lockMetric, "time");
  assert.equal(view.driverMetric, DRIVER_METRICS.TIME);
  assert.equal(view.cards.time.stateLabel, "Locked");
  assert.deepEqual(view.cards.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
  assert.deepEqual(view.cards.pace.inputValues, {
    minutes: "10",
    seconds: "00"
  });
  assert.equal(view.cards.speed.inputValue, "6");
  assert.equal(
    view.statusMessage,
    "Time locked. Drag distance to see the required pace and speed."
  );
});

test("locking pace keeps the effort fixed while distance changes", () => {
  let state = enterTime(createFormState(), "0", "50", "0");

  state = toggleMetricLock(state, "pace");
  state = updateDistanceInput(state, "5");

  const view = deriveCalculatorView(state);

  assert.equal(view.lockMetric, "pace");
  assert.equal(view.driverMetric, DRIVER_METRICS.PACE);
  assert.equal(view.cards.pace.stateLabel, "Locked");
  assert.deepEqual(view.cards.pace.inputValues, {
    minutes: "5",
    seconds: "00"
  });
  assert.deepEqual(view.cards.time.inputValues, {
    hours: "0",
    minutes: "25",
    seconds: "00"
  });
  assert.equal(view.cards.speed.inputValue, "12");
  assert.equal(
    view.statusMessage,
    "Pace locked. Drag distance to update the finish time."
  );
});

test("unit changes convert the selected distance and preserve the live result", () => {
  const paceState = enterPace(createFormState(), "5", "0");
  const switched = applyUnitChange(paceState, "mi");
  const view = deriveCalculatorView(switched);

  assert.equal(switched.unit, "mi");
  assert.equal(switched.inputs.distance, "6.21371");
  assert.equal(view.selectedDistanceLabel, "6.21371 mi");
  assert.deepEqual(view.cards.pace.inputValues, {
    minutes: "8",
    seconds: "03"
  });
  assert.equal(view.cards.speed.inputValue, "7.46");
  assert.deepEqual(view.cards.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
});

test("reset restores the default distance and unlocks the calculator while preserving unit", () => {
  let state = enterTime(createFormState(), "0", "50", "0");

  state = toggleMetricLock(state, "time");
  state = applyUnitChange(state, "mi");
  state = resetFormState(state);

  assert.equal(state.unit, "mi");
  assert.equal(state.lockMetric, null);
  assert.equal(state.driverMetric, DRIVER_METRICS.PACE);
  assert.equal(state.inputs.distance, formatDistanceInputValue(10, "mi"));
  assert.equal(state.presetId, "10k");
  assert.deepEqual(state.inputs, {
    distance: formatDistanceInputValue(10, "mi"),
    paceMinutes: "",
    paceSeconds: "",
    speed: "",
    timeHours: "",
    timeMinutes: "",
    timeSeconds: ""
  });
});

test("manual distance edits leave presets active only on exact canonical matches", () => {
  const presetState = applyPresetSelection(createFormState(), "half");
  const customState = updateDistanceInput(presetState, "21.1");

  assert.equal(presetState.presetId, "half");
  assert.equal(customState.presetId, "custom");
});

test("distance presets keep the PRD canonical kilometers", () => {
  assert.deepEqual(
    DISTANCE_PRESETS
      .filter((preset) => preset.distanceKm !== null)
      .map(({ label, distanceKm }) => [label, distanceKm]),
    [
      ["5K", 5],
      ["10K", 10],
      ["Half Marathon", 21.0975],
      ["Marathon", 42.195]
    ]
  );
});
