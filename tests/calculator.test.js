import test from "node:test";
import assert from "node:assert/strict";

import {
  applyDistanceIncrement,
  DISTANCE_PRESETS,
  applyPresetSelection,
  applyUnitChange,
  createFormState,
  deriveCalculatorView,
  formatDistanceInputValue,
  parsePaceInput,
  resetFormState,
  restoreCalculatorState,
  serializeCalculatorState,
  updateDistanceInput,
  updateInputValue
} from "../src/lib/calculator.js";

function enterPace(state, minutes, seconds) {
  let nextState = updateInputValue(state, "paceMinutes", minutes);

  nextState = updateInputValue(nextState, "paceSeconds", seconds);
  return nextState;
}

function enterSpeed(state, speed) {
  return updateInputValue(state, "speed", speed);
}

function enterTime(state, hours, minutes, seconds) {
  let nextState = updateInputValue(state, "timeHours", hours);

  nextState = updateInputValue(nextState, "timeMinutes", minutes);
  nextState = updateInputValue(nextState, "timeSeconds", seconds);
  return nextState;
}

test("default state keeps a 10K distance selected and waits for two values", () => {
  const view = deriveCalculatorView(createFormState());

  assert.equal(view.selectedDistanceLabel, "10 km");
  assert.equal(view.distance.inputValue, "10");
  assert.equal(view.distance.presetId, "10k");
  assert.equal(view.distance.label, "Distance (km)");
  assert.equal(view.rate.paceLabel, "Pace (min/km)");
  assert.equal(view.rate.speedLabel, "Speed (km/h)");
  assert.equal(view.statusMessage, "Enter any two values to solve the third.");
  assert.equal(view.hasLiveResult, false);
  assert.deepEqual(view.rate.paceInputValues, {
    minutes: "",
    seconds: ""
  });
  assert.equal(view.rate.speedInputValue, "");
  assert.deepEqual(view.time.inputValues, {
    hours: "",
    minutes: "",
    seconds: ""
  });
});

test("pace input derives linked speed and finish time for the selected distance", () => {
  const view = deriveCalculatorView(enterPace(createFormState(), "5", "0"));

  assert.equal(view.hasLiveResult, true);
  assert.equal(view.derivedMetric, "time");
  assert.equal(view.statusMessage, "Solving time from distance + movement rate.");
  assert.equal(view.rate.tone, "source");
  assert.equal(view.time.tone, "derived");
  assert.deepEqual(view.rate.paceInputValues, {
    minutes: "5",
    seconds: "00"
  });
  assert.equal(view.rate.speedInputValue, "12");
  assert.deepEqual(view.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
});

test("speed input derives linked pace and finish time for the selected distance", () => {
  const view = deriveCalculatorView(enterSpeed(createFormState(), "12"));

  assert.equal(view.hasLiveResult, true);
  assert.equal(view.derivedMetric, "time");
  assert.equal(view.statusMessage, "Solving time from distance + movement rate.");
  assert.deepEqual(view.rate.paceInputValues, {
    minutes: "5",
    seconds: "00"
  });
  assert.equal(view.rate.speedInputValue, "12");
  assert.deepEqual(view.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
});

test("pace parsing allows long pace minutes", () => {
  assert.deepEqual(
    parsePaceInput({
      paceMinutes: "65",
      paceSeconds: "30"
    }),
    {
      error: null,
      value: 3930
    }
  );
});

test("time input derives the movement rate required for the selected distance", () => {
  const view = deriveCalculatorView(enterTime(createFormState(), "0", "50", "0"));

  assert.equal(view.hasLiveResult, true);
  assert.equal(view.derivedMetric, "rate");
  assert.equal(
    view.statusMessage,
    "Solving movement rate from distance + time."
  );
  assert.deepEqual(view.rate.paceInputValues, {
    minutes: "5",
    seconds: "00"
  });
  assert.equal(view.rate.speedInputValue, "12");
  assert.deepEqual(view.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
});

test("editing time after pace shifts the dependency and recalculates distance", () => {
  let state = enterPace(createFormState(), "5", "0");

  state = enterTime(state, "0", "40", "0");

  const view = deriveCalculatorView(state);

  assert.equal(view.hasLiveResult, true);
  assert.equal(view.derivedMetric, "distance");
  assert.equal(view.distance.inputValue, "8");
  assert.equal(view.selectedDistanceLabel, "8 km");
  assert.equal(view.distance.presetId, "custom");
  assert.equal(
    view.statusMessage,
    "Solving distance from movement rate + time."
  );
  assert.equal(view.distance.tone, "derived");
  assert.equal(view.rate.tone, "source");
  assert.equal(view.time.tone, "source");
});

test("editing distance after time shifts the dependency and recalculates movement rate", () => {
  let state = enterTime(createFormState(), "0", "50", "0");

  state = updateDistanceInput(state, "5");

  const view = deriveCalculatorView(state);

  assert.equal(view.hasLiveResult, true);
  assert.equal(view.derivedMetric, "rate");
  assert.equal(view.distance.inputValue, "5");
  assert.equal(view.selectedDistanceLabel, "5 km");
  assert.equal(
    view.statusMessage,
    "Solving movement rate from distance + time."
  );
  assert.deepEqual(view.rate.paceInputValues, {
    minutes: "10",
    seconds: "00"
  });
  assert.equal(view.rate.speedInputValue, "6");
});

test("unit changes convert the selected distance and preserve the live result", () => {
  const paceState = enterPace(createFormState(), "5", "0");
  const switched = applyUnitChange(paceState, "mi");
  const view = deriveCalculatorView(switched);

  assert.equal(switched.unit, "mi");
  assert.equal(switched.inputs.distance, "6.21371");
  assert.equal(view.selectedDistanceLabel, "6.21371 mi");
  assert.equal(view.distance.label, "Distance (mi)");
  assert.equal(view.rate.paceLabel, "Pace (min/mi)");
  assert.equal(view.rate.speedLabel, "Speed (mph)");
  assert.deepEqual(view.rate.paceInputValues, {
    minutes: "8",
    seconds: "03"
  });
  assert.equal(view.rate.speedInputValue, "7.46");
  assert.deepEqual(view.time.inputValues, {
    hours: "0",
    minutes: "50",
    seconds: "00"
  });
});

test("kilometer mode exposes short-distance quick-distance chips", () => {
  const view = deriveCalculatorView(createFormState());

  assert.deepEqual(
    view.distance.presets.map(({ id, label }) => [id, label]),
    [
      ["100m", "100m"],
      ["500m", "500m"],
      ["1k", "1 km"],
      ["5k", "5K"],
      ["10k", "10K"],
      ["half", "Half"],
      ["marathon", "Marathon"]
    ]
  );
  assert.equal(view.distance.presetId, "10k");
});

test("mile mode exposes native mile quick-distance chips", () => {
  const state = applyUnitChange(createFormState(), "mi");
  const view = deriveCalculatorView(state);

  assert.deepEqual(
    view.distance.presets.map(({ id, label }) => [id, label]),
    [
      ["0.1mi", "0.1 mi"],
      ["0.5mi", "0.5 mi"],
      ["1mi", "1 mi"],
      ["5mi", "5 mi"],
      ["10mi", "10 mi"],
      ["half", "Half"],
      ["marathon", "Marathon"]
    ]
  );
  assert.equal(view.distance.presetId, "custom");
});

test("short kilometer quick-distance chips select the requested distance", () => {
  const state = applyPresetSelection(createFormState(), "100m");
  const view = deriveCalculatorView(state);

  assert.equal(view.distance.inputValue, "0.1");
  assert.equal(view.selectedDistanceLabel, "0.1 km");
  assert.equal(view.distance.presetId, "100m");
});

test("mile quick-distance chips select native mile values", () => {
  const state = applyPresetSelection(applyUnitChange(createFormState(), "mi"), "10mi");
  const view = deriveCalculatorView(state);

  assert.equal(view.distance.inputValue, "10");
  assert.equal(view.selectedDistanceLabel, "10 mi");
  assert.equal(view.distance.presetId, "10mi");
});

test("short mile quick-distance chips select native mile values", () => {
  const state = applyPresetSelection(applyUnitChange(createFormState(), "mi"), "1mi");
  const view = deriveCalculatorView(state);

  assert.equal(view.distance.inputValue, "1");
  assert.equal(view.selectedDistanceLabel, "1 mi");
  assert.equal(view.distance.presetId, "1mi");
});

test("distance increments add metric distances in either unit mode", () => {
  const kilometerView = deriveCalculatorView(
    applyDistanceIncrement(createFormState(), 0.2)
  );
  const mileView = deriveCalculatorView(
    applyDistanceIncrement(applyUnitChange(createFormState(), "mi"), 0.5)
  );

  assert.equal(kilometerView.distance.inputValue, "10.2");
  assert.equal(kilometerView.selectedDistanceLabel, "10.2 km");
  assert.equal(kilometerView.distance.presetId, "custom");

  assert.equal(mileView.distance.inputValue, "6.5244");
  assert.equal(mileView.selectedDistanceLabel, "6.5244 mi");
  assert.equal(mileView.distance.presetId, "custom");
});

test("mile half and marathon presets keep compact labels while selecting mile distances", () => {
  const halfView = deriveCalculatorView(
    applyPresetSelection(applyUnitChange(createFormState(), "mi"), "half")
  );
  const marathonView = deriveCalculatorView(
    applyPresetSelection(applyUnitChange(createFormState(), "mi"), "marathon")
  );

  assert.equal(
    halfView.distance.presets.find(({ id }) => id === "half")?.label,
    "Half"
  );
  assert.equal(halfView.distance.inputValue, "13.1");
  assert.equal(halfView.selectedDistanceLabel, "13.1 mi");
  assert.equal(halfView.distance.presetId, "half");

  assert.equal(
    marathonView.distance.presets.find(({ id }) => id === "marathon")?.label,
    "Marathon"
  );
  assert.equal(marathonView.distance.inputValue, "26.2");
  assert.equal(marathonView.selectedDistanceLabel, "26.2 mi");
  assert.equal(marathonView.distance.presetId, "marathon");
});

test("reset restores the default distance while preserving unit", () => {
  let state = enterTime(createFormState(), "0", "50", "0");

  state = applyUnitChange(state, "mi");
  state = resetFormState(state);

  assert.equal(state.unit, "mi");
  assert.equal(state.rateInputMode, "pace");
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

test("preset distances render exact converted miles from canonical kilometers", () => {
  assert.equal(formatDistanceInputValue(5, "mi"), "3.10686");
  assert.equal(formatDistanceInputValue(10, "mi"), "6.21371");
  assert.equal(formatDistanceInputValue(21.0975, "mi"), "13.10938");
  assert.equal(formatDistanceInputValue(42.195, "mi"), "26.21876");
});

test("serialize and restore preserve a valid custom-distance pace scenario", () => {
  let state = applyUnitChange(createFormState(), "mi");

  state = updateDistanceInput(state, "6.5");
  state = enterPace(state, "8", "15");

  const search = serializeCalculatorState(state);
  const restored = restoreCalculatorState(new URLSearchParams(search));
  const view = deriveCalculatorView(restored);

  assert.equal(
    search,
    "solve=distance-rate&preset=custom&unit=mi&distance=6.5&rate=pace&pm=8&ps=15"
  );
  assert.equal(restored.unit, "mi");
  assert.equal(restored.presetId, "custom");
  assert.equal(restored.rateInputMode, "pace");
  assert.equal(restored.inputs.distance, "6.5");
  assert.equal(restored.inputs.paceMinutes, "8");
  assert.equal(restored.inputs.paceSeconds, "15");
  assert.equal(view.hasLiveResult, true);
  assert.equal(view.rate.speedInputValue, "7.27");
});

test("serialize and restore preserve a time-driven scenario that derives distance", () => {
  let state = enterPace(createFormState(), "5", "0");

  state = enterTime(state, "0", "40", "0");

  const search = serializeCalculatorState(state);
  const restored = restoreCalculatorState(new URLSearchParams(search));
  const view = deriveCalculatorView(restored);

  assert.equal(
    search,
    "solve=rate-time&unit=km&rate=pace&pm=5&ps=0&th=0&tm=40&ts=0"
  );
  assert.equal(restored.rateInputMode, "pace");
  assert.equal(view.hasLiveResult, true);
  assert.equal(view.derivedMetric, "distance");
  assert.equal(view.distance.inputValue, "8");
});

test("malformed URL state falls back to the default calculator", () => {
  const restored = restoreCalculatorState(
    new URLSearchParams("solve=distance-rate&unit=km&speed=12&rate=pace")
  );

  assert.deepEqual(restored, createFormState());
});

test("blank or invalid calculator state serializes to a clean URL", () => {
  let partialState = createFormState();

  partialState = updateDistanceInput(partialState, "10");
  partialState = updateInputValue(partialState, "paceMinutes", "5");

  assert.equal(serializeCalculatorState(createFormState()), "");
  assert.equal(serializeCalculatorState(partialState), "");
});
