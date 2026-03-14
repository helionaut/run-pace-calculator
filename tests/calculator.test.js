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
  parsePaceInput,
  resetFormState,
  restoreCalculatorState,
  serializeCalculatorState,
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
  assert.equal(view.cards.pace.stateLabel, "Adjust");
  assert.equal(view.cards.speed.stateLabel, "Ready");
  assert.equal(view.cards.time.stateLabel, "Ready");
  assert.equal(view.cards.pace.editorHidden, false);
  assert.equal(view.cards.speed.editorHidden, true);
  assert.equal(view.cards.time.editorHidden, true);
  assert.equal(view.cards.speed.displayValue, "--.-- km/h");
  assert.equal(view.cards.time.displayValue, "--:--:--");
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
  assert.equal(view.cards.pace.stateLabel, "Adjust");
  assert.equal(view.cards.speed.stateLabel, "Auto");
  assert.equal(view.cards.time.stateLabel, "Auto");
  assert.equal(view.cards.pace.editorHidden, false);
  assert.equal(view.cards.speed.editorHidden, true);
  assert.equal(view.cards.time.editorHidden, true);
  assert.equal(view.cards.speed.displayValue, "12.00 km/h");
  assert.equal(view.cards.time.displayValue, "00:50:00");
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
  assert.equal(view.cards.speed.stateLabel, "Adjust");
  assert.equal(view.cards.pace.stateLabel, "Auto");
  assert.equal(view.cards.time.stateLabel, "Auto");
  assert.equal(view.cards.speed.editorHidden, false);
  assert.equal(view.cards.pace.editorHidden, true);
  assert.equal(view.cards.time.editorHidden, true);
  assert.equal(view.cards.pace.displayValue, "05:00 /km");
  assert.equal(view.cards.time.displayValue, "00:50:00");
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

test("time input derives the pace and speed required for the selected distance", () => {
  const view = deriveCalculatorView(enterTime(createFormState(), "0", "50", "0"));

  assert.equal(view.driverMetric, DRIVER_METRICS.TIME);
  assert.equal(view.cards.time.stateLabel, "Adjust");
  assert.equal(view.cards.pace.stateLabel, "Auto");
  assert.equal(view.cards.speed.stateLabel, "Auto");
  assert.equal(view.cards.time.editorHidden, false);
  assert.equal(view.cards.pace.editorHidden, true);
  assert.equal(view.cards.speed.editorHidden, true);
  assert.equal(view.cards.pace.displayValue, "05:00 /km");
  assert.equal(view.cards.speed.displayValue, "12.00 km/h");
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
  assert.equal(view.cards.time.stateLabel, "Goal");
  assert.equal(view.cards.time.editorHidden, true);
  assert.equal(view.cards.time.displayValue, "00:50:00");
  assert.equal(view.cards.pace.stateLabel, "Auto");
  assert.equal(view.cards.speed.stateLabel, "Auto");
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
    "Time goal locked. Drag distance to see the pace and speed you need."
  );
});

test("locking pace keeps the effort fixed while distance changes", () => {
  let state = enterTime(createFormState(), "0", "50", "0");

  state = toggleMetricLock(state, "pace");
  state = updateDistanceInput(state, "5");

  const view = deriveCalculatorView(state);

  assert.equal(view.lockMetric, "pace");
  assert.equal(view.driverMetric, DRIVER_METRICS.PACE);
  assert.equal(view.cards.pace.stateLabel, "Goal");
  assert.equal(view.cards.pace.editorHidden, true);
  assert.equal(view.cards.pace.displayValue, "05:00 /km");
  assert.equal(view.cards.time.stateLabel, "Auto");
  assert.equal(view.cards.speed.stateLabel, "Auto");
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
    "Pace goal locked. Drag distance to see the finish time it produces."
  );
});

test("split rows follow the selected distance and include a final partial segment", () => {
  const tenKView = deriveCalculatorView(enterPace(createFormState(), "5", "0"));
  const halfView = deriveCalculatorView(
    enterPace(applyPresetSelection(createFormState(), "half"), "5", "0")
  );

  assert.equal(tenKView.split.heading, "Kilometer splits");
  assert.deepEqual(
    tenKView.split.rows.slice(0, 2).map((row) => [row.label, row.finishLabel, row.isPartial]),
    [
      ["1 km", "00:05:00", false],
      ["2 km", "00:10:00", false]
    ]
  );
  assert.equal(tenKView.split.rows.at(-1).label, "10 km");
  assert.equal(tenKView.split.rows.at(-1).finishLabel, "00:50:00");

  assert.match(halfView.split.meta, /final partial split/i);
  assert.deepEqual(
    halfView.split.rows.slice(-2).map((row) => [row.label, row.finishLabel, row.isPartial]),
    [
      ["21 km", "01:45:00", false],
      ["21.0975 km", "01:45:29", true]
    ]
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

  assert.equal(
    search,
    "metric=pace&preset=custom&unit=mi&distance=6.5&pm=8&ps=15"
  );
  assert.equal(restored.unit, "mi");
  assert.equal(restored.presetId, "custom");
  assert.equal(restored.driverMetric, DRIVER_METRICS.PACE);
  assert.equal(restored.inputs.distance, "6.5");
  assert.equal(restored.inputs.paceMinutes, "8");
  assert.equal(restored.inputs.paceSeconds, "15");
  assert.equal(deriveCalculatorView(restored).hasLiveResult, true);
});

test("serialize and restore preserve a locked time scenario", () => {
  let state = enterTime(createFormState(), "1", "45", "0");

  state = toggleMetricLock(state, DRIVER_METRICS.TIME);
  state = applyPresetSelection(state, "half");

  const search = serializeCalculatorState(state);
  const restored = restoreCalculatorState(new URLSearchParams(search));

  assert.equal(
    search,
    "metric=time&preset=half&unit=km&th=1&tm=45&ts=0&lock=time"
  );
  assert.equal(restored.driverMetric, DRIVER_METRICS.TIME);
  assert.equal(restored.lockMetric, DRIVER_METRICS.TIME);
  assert.equal(restored.presetId, "half");
  assert.equal(restored.inputs.timeHours, "1");
  assert.equal(restored.inputs.timeMinutes, "45");
  assert.equal(restored.inputs.timeSeconds, "0");
  assert.equal(deriveCalculatorView(restored).hasLiveResult, true);
});

test("malformed URL state falls back to the default calculator", () => {
  const restored = restoreCalculatorState(
    new URLSearchParams("metric=speed&preset=10k&unit=km&speed=12&lock=time")
  );

  assert.deepEqual(restored, createFormState());
});

test("blank or invalid calculator state serializes to a clean URL", () => {
  let partialState = createFormState();

  partialState = updateDistanceInput(partialState, "10");
  partialState = updateInputValue(
    setActiveMetric(partialState, DRIVER_METRICS.PACE),
    "paceMinutes",
    "5"
  );

  assert.equal(serializeCalculatorState(createFormState()), "");
  assert.equal(serializeCalculatorState(partialState), "");
});
