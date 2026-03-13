import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVERT_SOURCES,
  DISTANCE_PRESETS,
  MODES,
  applyConvertSourceChange,
  applyPresetSelection,
  applyUnitChange,
  createFormState,
  deriveCalculatorView,
  formatDistanceInputValue,
  resetFormState,
  updateDistanceInput
} from "../src/lib/calculator.js";

function buildState(overrides = {}, inputOverrides = {}) {
  const state = createFormState();

  return {
    ...state,
    ...overrides,
    inputs: {
      ...state.inputs,
      ...inputOverrides
    }
  };
}

function getBadgeLabels(item) {
  return item.badges.map((badge) => badge.label);
}

test("blank state stays empty without showing required-field errors", () => {
  const view = deriveCalculatorView(createFormState());

  assert.equal(view.resultState, "empty");
  assert.equal(view.display, null);
  assert.equal(view.errors.distance, null);
  assert.equal(view.errors.finish, null);
});

test("pace mode calculates pace and speed from distance plus finish time", () => {
  const view = deriveCalculatorView(
    buildState(
      { mode: MODES.PACE },
      {
        distance: "10",
        finishHours: "0",
        finishMinutes: "50",
        finishSeconds: "0"
      }
    )
  );

  assert.equal(view.resultState, "current");
  assert.equal(view.display.primaryLabel, "Pace");
  assert.equal(view.display.primaryValue, "05:00 /km");
  assert.equal(view.display.selectedSpeed, "12.00 km/h");
  assert.equal(view.errors.distance, null);
  assert.equal(view.errors.finish, null);
});

test("finish mode calculates finish time from distance plus pace", () => {
  const view = deriveCalculatorView(
    buildState(
      { mode: MODES.FINISH },
      {
        distance: "10",
        paceMinutes: "5",
        paceSeconds: "0"
      }
    )
  );

  assert.equal(view.resultState, "current");
  assert.equal(view.display.primaryLabel, "Finish time");
  assert.equal(view.display.primaryValue, "00:50:00");
  assert.equal(view.display.selectedSpeed, "12.00 km/h");
});

test("finish mode exposes entered versus derived provenance and the locked pace", () => {
  const view = deriveCalculatorView(
    buildState(
      { mode: MODES.FINISH },
      {
        distance: "10",
        paceMinutes: "5",
        paceSeconds: "0"
      }
    )
  );

  assert.deepEqual(
    getBadgeLabels(view.display.provenance.primary),
    ["Derived"]
  );
  assert.deepEqual(
    getBadgeLabels(view.display.provenance.selectedPace),
    ["Entered", "Locked"]
  );
  assert.deepEqual(
    getBadgeLabels(view.display.provenance.selectedSpeed),
    ["Derived"]
  );
  assert.deepEqual(
    getBadgeLabels(view.display.provenance.distance),
    ["Entered"]
  );
  assert.equal(view.display.lockedSummary.label, "Locked pace");
  assert.equal(view.display.lockedSummary.value, "05:00 /km");
  assert.deepEqual(
    getBadgeLabels(view.display.lockedSummary.provenance),
    ["Entered", "Locked"]
  );
  assert.deepEqual(
    getBadgeLabels(view.inputProvenance.pace),
    ["Entered", "Locked"]
  );
  assert.deepEqual(
    getBadgeLabels(view.inputProvenance.distance),
    ["Entered"]
  );
});

test("incomplete structured finish time blocks a fresh calculation", () => {
  const view = deriveCalculatorView(
    buildState(
      { mode: MODES.PACE },
      {
        distance: "10",
        finishHours: "0",
        finishMinutes: "",
        finishSeconds: "0"
      }
    )
  );

  assert.equal(view.resultState, "empty");
  assert.equal(view.currentResult, null);
  assert.equal(view.display, null);
  assert.equal(
    view.errors.finish,
    "Complete finish hours, minutes, and seconds."
  );
});

test("invalid distance and speed inputs produce inline validation messages", () => {
  const distanceView = deriveCalculatorView(
    buildState(
      { mode: MODES.FINISH },
      {
        distance: "10,5",
        paceMinutes: "5",
        paceSeconds: "0"
      }
    )
  );
  const speedView = deriveCalculatorView(
    buildState(
      {
        mode: MODES.CONVERT,
        convertSource: CONVERT_SOURCES.SPEED
      },
      {
        speed: "fast"
      }
    )
  );

  assert.equal(
    distanceView.errors.distance,
    "Distance must use digits and one decimal point only."
  );
  assert.equal(
    speedView.errors.speed,
    "Speed must use digits and one decimal point only."
  );
});

test("stale mode preserves the last valid result when a required field becomes invalid", () => {
  const validState = buildState(
    { mode: MODES.PACE },
    {
      distance: "10",
      finishHours: "0",
      finishMinutes: "50",
      finishSeconds: "0"
    }
  );
  const validView = deriveCalculatorView(validState);
  const staleView = deriveCalculatorView(
    buildState(
      { mode: MODES.PACE },
      {
        distance: "10",
        finishHours: "0",
        finishMinutes: "50",
        finishSeconds: "75"
      }
    ),
    validView.currentResult
  );

  assert.equal(staleView.resultState, "stale");
  assert.equal(staleView.display.primaryValue, validView.display.primaryValue);
  assert.match(
    staleView.display.primaryMeta,
    /Last valid result derived from locked finish time/
  );
  assert.deepEqual(
    getBadgeLabels(staleView.display.provenance.primary),
    ["Derived", "Last valid"]
  );
  assert.deepEqual(
    getBadgeLabels(staleView.display.lockedSummary.provenance),
    ["Entered", "Locked", "Last valid"]
  );
  assert.equal(
    staleView.errors.finish,
    "Finish seconds must stay between 0 and 59."
  );
});

test("convert mode can mark the last answer stale after source changes", () => {
  const paceSourceState = buildState(
    {
      mode: MODES.CONVERT,
      convertSource: CONVERT_SOURCES.PACE
    },
    {
      paceMinutes: "5",
      paceSeconds: "0"
    }
  );
  const validView = deriveCalculatorView(paceSourceState);
  const speedSourceState = applyConvertSourceChange(
    paceSourceState,
    CONVERT_SOURCES.SPEED
  );
  const staleView = deriveCalculatorView(speedSourceState, validView.currentResult);

  assert.equal(speedSourceState.inputs.paceMinutes, "");
  assert.equal(speedSourceState.inputs.paceSeconds, "");
  assert.equal(staleView.resultState, "stale");
  assert.equal(staleView.display.primaryLabel, "Speed");
  assert.equal(staleView.errors.speed, "Enter a speed.");
});

test("reset clears editable fields and results while preserving mode, unit, and convert source", () => {
  const resetState = resetFormState(
    buildState(
      {
        mode: MODES.CONVERT,
        unit: "mi",
        convertSource: CONVERT_SOURCES.SPEED,
        presetId: "10k"
      },
      {
        distance: "6.21371",
        finishHours: "1",
        finishMinutes: "2",
        finishSeconds: "3",
        paceMinutes: "8",
        paceSeconds: "3",
        speed: "7.46"
      }
    )
  );

  assert.equal(resetState.mode, MODES.CONVERT);
  assert.equal(resetState.unit, "mi");
  assert.equal(resetState.convertSource, CONVERT_SOURCES.SPEED);
  assert.equal(resetState.presetId, "custom");
  assert.deepEqual(resetState.inputs, {
    distance: "",
    finishHours: "",
    finishMinutes: "",
    finishSeconds: "",
    paceMinutes: "",
    paceSeconds: "",
    speed: ""
  });
});

test("unit changes convert preset distance, pace, and speed inputs in place", () => {
  const initialState = buildState(
    {
      mode: MODES.FINISH,
      presetId: "10k"
    },
    {
      distance: "10",
      paceMinutes: "5",
      paceSeconds: "0",
      speed: "12.5"
    }
  );
  const finishBefore = deriveCalculatorView(initialState).display.primaryValue;
  const nextState = applyUnitChange(
    initialState,
    "mi"
  );
  const finishAfter = deriveCalculatorView(nextState).display.primaryValue;

  assert.equal(nextState.unit, "mi");
  assert.equal(nextState.inputs.distance, "6.21371");
  assert.equal(nextState.inputs.paceMinutes, "8");
  assert.equal(nextState.inputs.paceSeconds, "03");
  assert.equal(nextState.inputs.speed, "7.77");
  assert.equal(finishAfter, finishBefore);
});

test("named presets stay selected across unit switches and keep canonical miles", () => {
  const presetState = applyPresetSelection(createFormState(), "half");
  const switchedState = applyUnitChange(
    buildState(
      {
        mode: MODES.FINISH,
        presetId: presetState.presetId,
        canonical: presetState.canonical
      },
      {
        distance: presetState.inputs.distance,
        paceMinutes: "5",
        paceSeconds: "0"
      }
    ),
    "mi"
  );

  assert.equal(switchedState.presetId, "half");
  assert.equal(switchedState.inputs.distance, "13.10938");
});

test("manual distance edits switch the preset back to custom", () => {
  const presetState = applyPresetSelection(createFormState(), "marathon");
  const nextState = updateDistanceInput(presetState, "43");

  assert.equal(nextState.presetId, "custom");
  assert.equal(nextState.inputs.distance, "43");
});

test("named presets use the PRD canonical distances", () => {
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
