import {
  applyPresetSelection,
  applyUnitChange,
  createFormState,
  deriveCalculatorView,
  resetFormState,
  restoreCalculatorState,
  serializeCalculatorState,
  updateDistanceInput,
  updateDistanceSlider,
  updateInputValue
} from "./lib/calculator.js";

const TIME_FIELDS = Object.freeze(["timeHours", "timeMinutes", "timeSeconds"]);

function setTextContent(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value;
}

function setInputValue(element, value) {
  if (!element) {
    return;
  }

  if (element.value !== value) {
    element.value = value;
  }
}

function setInvalid(inputs, message) {
  const hasError = Boolean(message);

  for (const input of inputs) {
    if (!input) {
      continue;
    }

    input.setAttribute("aria-invalid", String(hasError));
  }
}

function renderError(errorElement, inputs, message) {
  if (errorElement) {
    errorElement.textContent = message ?? "";
    errorElement.classList.toggle("is-visible", Boolean(message));
  }

  setInvalid(inputs, message);
}

function renderUnitButtons(elements, unit) {
  for (const button of elements.unitButtons) {
    const isActive = button.dataset.unit === unit;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderPresetButtons(elements, distanceView) {
  for (let index = 0; index < elements.presetButtons.length; index += 1) {
    const button = elements.presetButtons[index];
    const preset = distanceView.presets[index];

    if (!preset) {
      continue;
    }

    button.dataset.preset = preset.id;
    setTextContent(button, preset.label);

    const isActive = preset.id === distanceView.presetId;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderMetricTone(card, tone) {
  if (!card) {
    return;
  }

  card.classList.toggle("metric-card--source", tone === "source");
  card.classList.toggle("metric-card--derived", tone === "derived");
  card.classList.toggle("metric-card--idle", tone === "idle");
}

function renderProjections(elements, projectionRows) {
  for (const row of projectionRows) {
    const valueElement = elements.projectionValues[row.id];

    if (!valueElement) {
      continue;
    }

    setTextContent(valueElement, row.finishLabel);
  }
}

function hasValue(value) {
  return String(value ?? "").trim() !== "";
}

function hasViewErrors(view) {
  return Boolean(
    view.distance.error ||
      view.rate.paceError ||
      view.rate.speedError ||
      view.time.error
  );
}

function setFieldTone(field, isActive) {
  if (!field) {
    return;
  }

  field.classList.toggle("field--active", isActive);
  field.classList.toggle("field--linked", !isActive);
}

function renderRateInputMode(elements, rateInputMode) {
  setFieldTone(elements.paceField, rateInputMode === "pace");
  setFieldTone(elements.speedField, rateInputMode === "speed");
}

function syncStateInputsFromView(
  state,
  view,
  { includeDistance = false, includeRate = false, includeTime = false, rateInputMode } = {}
) {
  const nextRateInputMode = rateInputMode ?? state.rateInputMode;
  const nextInputs = { ...state.inputs };
  let changed = nextRateInputMode !== state.rateInputMode;

  if (includeDistance && nextInputs.distance !== view.distance.inputValue) {
    nextInputs.distance = view.distance.inputValue;
    changed = true;
  }

  if (includeRate) {
    if (nextInputs.paceMinutes !== view.rate.paceInputValues.minutes) {
      nextInputs.paceMinutes = view.rate.paceInputValues.minutes;
      changed = true;
    }

    if (nextInputs.paceSeconds !== view.rate.paceInputValues.seconds) {
      nextInputs.paceSeconds = view.rate.paceInputValues.seconds;
      changed = true;
    }

    if (nextInputs.speed !== view.rate.speedInputValue) {
      nextInputs.speed = view.rate.speedInputValue;
      changed = true;
    }
  }

  if (includeTime) {
    if (nextInputs.timeHours !== view.time.inputValues.hours) {
      nextInputs.timeHours = view.time.inputValues.hours;
      changed = true;
    }

    if (nextInputs.timeMinutes !== view.time.inputValues.minutes) {
      nextInputs.timeMinutes = view.time.inputValues.minutes;
      changed = true;
    }

    if (nextInputs.timeSeconds !== view.time.inputValues.seconds) {
      nextInputs.timeSeconds = view.time.inputValues.seconds;
      changed = true;
    }
  }

  return changed
    ? {
        ...state,
        inputs: nextInputs,
        rateInputMode: nextRateInputMode
      }
    : state;
}

function normalizeStateFromView(state, view) {
  return syncStateInputsFromView(state, view, {
    includeDistance: true,
    includeRate: true,
    includeTime: true
  });
}

function render(elements, state) {
  const view = deriveCalculatorView(state);
  const hasError = Boolean(
    view.distance.error ||
      view.rate.paceError ||
      view.rate.speedError ||
      view.time.error
  );

  renderUnitButtons(elements, view.unit);
  renderPresetButtons(elements, view.distance);

  renderMetricTone(elements.distanceCard, view.distance.tone);
  renderMetricTone(elements.rateCard, view.rate.tone);
  renderMetricTone(elements.timeCard, view.time.tone);
  renderRateInputMode(elements, state.rateInputMode);

  setTextContent(elements.distanceLabel, view.distance.label);
  setTextContent(elements.selectedDistance, view.selectedDistanceLabel);
  setInputValue(elements.distanceInput, view.distance.inputValue);
  setInputValue(elements.distanceSlider, view.distance.sliderValue);
  elements.distanceSlider.min = view.distance.sliderMinimum;
  elements.distanceSlider.max = view.distance.sliderMaximum;
  elements.distanceSlider.step = view.distance.sliderStep;
  renderError(elements.distanceError, [elements.distanceInput], view.distance.error);

  setTextContent(elements.paceLabel, view.rate.paceLabel);
  setTextContent(elements.speedLabel, view.rate.speedLabel);
  setInputValue(elements.paceMinutes, view.rate.paceInputValues.minutes);
  setInputValue(elements.paceSeconds, view.rate.paceInputValues.seconds);
  setInputValue(elements.speedInput, view.rate.speedInputValue);
  renderError(
    elements.paceError,
    [elements.paceMinutes, elements.paceSeconds],
    view.rate.paceError
  );
  renderError(elements.speedError, [elements.speedInput], view.rate.speedError);

  setInputValue(elements.timeHours, view.time.inputValues.hours);
  setInputValue(elements.timeMinutes, view.time.inputValues.minutes);
  setInputValue(elements.timeSeconds, view.time.inputValues.seconds);
  renderError(
    elements.timeError,
    [elements.timeHours, elements.timeMinutes, elements.timeSeconds],
    view.time.error
  );

  setTextContent(elements.statusMessage, view.statusMessage);
  elements.statusMessage.classList.toggle("status-message--error", hasError);

  renderProjections(elements, view.projectionRows);

  return view;
}

function syncUrlState(state) {
  if (
    typeof window === "undefined" ||
    !window.location ||
    !window.history ||
    typeof window.history.replaceState !== "function"
  ) {
    return;
  }

  const search = serializeCalculatorState(state);
  const nextUrl = search
    ? `${window.location.pathname}?${search}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  const currentUrl =
    `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function bindMetricInputs(elements, getState, setStateAndRender) {
  function updateTimeField(field, value) {
    const shouldAutoFill =
      hasValue(value) &&
      TIME_FIELDS
        .filter((name) => name !== field)
        .every((name) => !hasValue(getState().inputs[name]));

    let nextState = updateInputValue(getState(), field, value);

    if (!shouldAutoFill) {
      setStateAndRender(nextState);
      return;
    }

    for (const name of TIME_FIELDS) {
      if (name === field || hasValue(nextState.inputs[name])) {
        continue;
      }

      nextState = updateInputValue(
        nextState,
        name,
        name === "timeHours" ? "0" : "00"
      );
    }

    setStateAndRender(nextState);
  }

  elements.paceMinutes.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(getState(), "paceMinutes", elements.paceMinutes.value)
    );
  });

  elements.paceSeconds.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(getState(), "paceSeconds", elements.paceSeconds.value)
    );
  });

  elements.speedInput.addEventListener("input", () => {
    setStateAndRender(updateInputValue(getState(), "speed", elements.speedInput.value));
  });

  elements.timeHours.addEventListener("input", () => {
    updateTimeField("timeHours", elements.timeHours.value);
  });

  elements.timeMinutes.addEventListener("input", () => {
    updateTimeField("timeMinutes", elements.timeMinutes.value);
  });

  elements.timeSeconds.addEventListener("input", () => {
    updateTimeField("timeSeconds", elements.timeSeconds.value);
  });
}

export function getElements(root) {
  const distanceInput = root.querySelector("#distance-input");

  if (!distanceInput) {
    return null;
  }

  return {
    distanceCard: root.querySelector("#distance-card"),
    distanceError: root.querySelector("#distance-error"),
    distanceInput,
    distanceLabel: root.querySelector("#distance-label"),
    distanceSlider: root.querySelector("#distance-slider"),
    paceError: root.querySelector("#pace-error"),
    paceField: root.querySelector("#pace-field"),
    paceLabel: root.querySelector("#pace-label"),
    paceMinutes: root.querySelector("#pace-minutes"),
    paceSeconds: root.querySelector("#pace-seconds"),
    presetButtons: root.querySelectorAll("[data-preset-button]"),
    projectionValues: {
      "5k": root.querySelector("#projection-5k"),
      "10k": root.querySelector("#projection-10k"),
      half: root.querySelector("#projection-half"),
      marathon: root.querySelector("#projection-marathon")
    },
    rateCard: root.querySelector("#rate-card"),
    resetButton: root.querySelector("#reset-button"),
    selectedDistance: root.querySelector("#selected-distance"),
    speedError: root.querySelector("#speed-error"),
    speedField: root.querySelector("#speed-field"),
    speedInput: root.querySelector("#speed-input"),
    speedLabel: root.querySelector("#speed-label"),
    statusMessage: root.querySelector("#status-message"),
    timeCard: root.querySelector("#time-card"),
    timeError: root.querySelector("#time-error"),
    timeHours: root.querySelector("#time-hours"),
    timeMinutes: root.querySelector("#time-minutes"),
    timeSeconds: root.querySelector("#time-seconds"),
    unitButtons: root.querySelectorAll("[data-unit-button]")
  };
}

export function createCalculatorApp(elements) {
  let state =
    typeof window === "undefined"
      ? createFormState()
      : restoreCalculatorState(window.location.search);
  let lastStableState = state;
  let lastView = null;

  function getState() {
    return state;
  }

  function primeViewState(options) {
    const view = lastView ?? deriveCalculatorView(state);
    const nextState = syncStateInputsFromView(state, view, options);

    if (nextState !== state) {
      setStateAndRender(nextState);
    }
  }

  function setStateAndRender(nextState) {
    state = nextState;
    const view = render(elements, state);
    const normalizedState = normalizeStateFromView(state, view);

    lastView = view;

    if (!hasViewErrors(view)) {
      lastStableState = normalizedState;
    }

    syncUrlState(state);
    return view;
  }

  function normalizeAfterBlur(errorMessage) {
    if (errorMessage) {
      setStateAndRender(lastStableState);
      return;
    }

    const nextState = normalizeStateFromView(state, lastView ?? deriveCalculatorView(state));

    if (nextState !== state) {
      setStateAndRender(nextState);
    }
  }

  function bindGroupBlur(inputs, getErrorMessage) {
    for (const input of inputs) {
      input.addEventListener("blur", (event) => {
        if (inputs.includes(event.relatedTarget)) {
          return;
        }

        normalizeAfterBlur(getErrorMessage());
      });
    }
  }

  for (const button of elements.unitButtons) {
    button.addEventListener("click", () => {
      setStateAndRender(applyUnitChange(getState(), button.dataset.unit));
    });
  }

  for (const button of elements.presetButtons) {
    button.addEventListener("click", () => {
      setStateAndRender(applyPresetSelection(getState(), button.dataset.preset));
    });
  }

  elements.distanceInput.addEventListener("input", () => {
    setStateAndRender(updateDistanceInput(getState(), elements.distanceInput.value));
  });

  elements.distanceSlider.addEventListener("input", () => {
    setStateAndRender(updateDistanceSlider(getState(), elements.distanceSlider.value));
  });

  elements.resetButton.addEventListener("click", () => {
    setStateAndRender(resetFormState(getState()));
  });

  bindMetricInputs(elements, getState, setStateAndRender);

  elements.paceMinutes.addEventListener("focus", () => {
    primeViewState({
      includeRate: true,
      rateInputMode: "pace"
    });
  });

  elements.paceSeconds.addEventListener("focus", () => {
    primeViewState({
      includeRate: true,
      rateInputMode: "pace"
    });
  });

  elements.speedInput.addEventListener("focus", () => {
    primeViewState({
      includeRate: true,
      rateInputMode: "speed"
    });
  });

  elements.distanceInput.addEventListener("focus", () => {
    primeViewState({
      includeDistance: true
    });
  });

  elements.timeHours.addEventListener("focus", () => {
    primeViewState({
      includeTime: true
    });
  });

  elements.timeMinutes.addEventListener("focus", () => {
    primeViewState({
      includeTime: true
    });
  });

  elements.timeSeconds.addEventListener("focus", () => {
    primeViewState({
      includeTime: true
    });
  });

  bindGroupBlur(
    [elements.paceMinutes, elements.paceSeconds],
    () => (lastView ?? deriveCalculatorView(state)).rate.paceError
  );
  bindGroupBlur(
    [elements.speedInput],
    () => (lastView ?? deriveCalculatorView(state)).rate.speedError
  );
  bindGroupBlur(
    [elements.timeHours, elements.timeMinutes, elements.timeSeconds],
    () => (lastView ?? deriveCalculatorView(state)).time.error
  );
  bindGroupBlur(
    [elements.distanceInput],
    () => (lastView ?? deriveCalculatorView(state)).distance.error
  );

  lastView = render(elements, state);
  lastStableState = normalizeStateFromView(state, lastView);
  syncUrlState(state);

  return {
    getState,
    render() {
      const view = render(elements, state);

      syncUrlState(state);
      return view;
    }
  };
}

if (typeof document !== "undefined") {
  const elements = getElements(document);

  if (elements) {
    createCalculatorApp(elements);
  }
}
