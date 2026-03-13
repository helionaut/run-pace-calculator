import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVERT_SOURCES,
  MODES,
  applyConvertSourceChange,
  applyUnitChange,
  createFormState,
  deriveCalculatorView,
  resetFormState
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
  const nextState = applyUnitChange(
    buildState(
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
    ),
    "mi"
  );

  assert.equal(nextState.unit, "mi");
  assert.equal(nextState.inputs.distance, "6.21371");
  assert.equal(nextState.inputs.paceMinutes, "8");
  assert.equal(nextState.inputs.paceSeconds, "03");
  assert.equal(nextState.inputs.speed, "7.77");
});
