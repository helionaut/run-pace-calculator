import {
  applyPresetSelection,
  applyUnitChange,
  createFormState,
  deriveCalculatorView,
  resetFormState,
  restoreCalculatorState,
  serializeCalculatorState,
  updateDistanceInput,
  updateInputValue
} from "./lib/calculator.js";

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

function renderPresetButtons(elements, presetId) {
  for (const button of elements.presetButtons) {
    const isActive = button.dataset.preset === presetId;

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

function render(elements, state) {
  const view = deriveCalculatorView(state);
  const hasError = Boolean(
    view.distance.error ||
      view.rate.paceError ||
      view.rate.speedError ||
      view.time.error
  );

  renderUnitButtons(elements, view.unit);
  renderPresetButtons(elements, view.distance.presetId);

  renderMetricTone(elements.distanceCard, view.distance.tone);
  renderMetricTone(elements.rateCard, view.rate.tone);
  renderMetricTone(elements.timeCard, view.time.tone);

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
    setStateAndRender(
      updateInputValue(getState(), "timeHours", elements.timeHours.value)
    );
  });

  elements.timeMinutes.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(getState(), "timeMinutes", elements.timeMinutes.value)
    );
  });

  elements.timeSeconds.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(getState(), "timeSeconds", elements.timeSeconds.value)
    );
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

  function getState() {
    return state;
  }

  function setStateAndRender(nextState) {
    state = nextState;
    const view = render(elements, state);

    syncUrlState(state);
    return view;
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
    setStateAndRender(updateDistanceInput(getState(), elements.distanceSlider.value));
  });

  elements.resetButton.addEventListener("click", () => {
    setStateAndRender(resetFormState(getState()));
  });

  bindMetricInputs(elements, getState, setStateAndRender);

  render(elements, state);
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
