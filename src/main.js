import {
  DRIVER_METRICS,
  applyPresetSelection,
  applyUnitChange,
  createFormState,
  deriveCalculatorView,
  resetFormState,
  restoreCalculatorState,
  serializeCalculatorState,
  setActiveMetric,
  toggleMetricLock,
  updateDistanceInput,
  updateInputValue
} from "./lib/calculator.js";

function setTextContent(element, value) {
  element.textContent = value;
}

function setInputValue(element, value) {
  if (element.value !== value) {
    element.value = value;
  }
}

function setInvalid(inputs, message) {
  const hasError = Boolean(message);

  for (const input of inputs) {
    input.setAttribute("aria-invalid", String(hasError));
  }
}

function renderError(errorElement, inputs, message) {
  errorElement.textContent = message ?? "";
  errorElement.classList.toggle("is-visible", Boolean(message));
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

function renderDriverButton(button, view) {
  setTextContent(button, view.label);
  button.disabled = view.disabled;
}

function renderLockButton(button, cardView) {
  setTextContent(button, cardView.lockLabel);
  button.disabled = cardView.lockDisabled;
  button.classList.toggle("is-active", cardView.lockPressed);
  button.setAttribute("aria-pressed", String(cardView.lockPressed));
}

function renderCardState(card, stateLabel) {
  const isInput = stateLabel === "Input";
  const isLocked = stateLabel === "Locked";
  const isDerived = stateLabel === "Derived";
  const isWaiting = stateLabel === "Waiting";

  card.classList.toggle("metric-card--input", isInput);
  card.classList.toggle("metric-card--locked", isLocked);
  card.classList.toggle("metric-card--derived", isDerived || isWaiting);
}

function renderPaceCard(elements, view, driverButtonView) {
  renderCardState(elements.paceCard, view.stateLabel);
  setTextContent(elements.paceLabel, view.label);
  setTextContent(elements.paceState, view.stateLabel);
  renderDriverButton(elements.paceDriverButton, driverButtonView);
  renderLockButton(elements.paceLockButton, view);
  setInputValue(elements.paceMinutes, view.inputValues.minutes);
  setInputValue(elements.paceSeconds, view.inputValues.seconds);
  elements.paceMinutes.disabled = !view.editable;
  elements.paceSeconds.disabled = !view.editable;
  setTextContent(elements.paceSecondary, view.secondary);
  renderError(
    elements.paceError,
    [elements.paceMinutes, elements.paceSeconds],
    view.error
  );
}

function renderSpeedCard(elements, view, driverButtonView) {
  renderCardState(elements.speedCard, view.stateLabel);
  setTextContent(elements.speedLabel, view.label);
  setTextContent(elements.speedState, view.stateLabel);
  renderDriverButton(elements.speedDriverButton, driverButtonView);
  setInputValue(elements.speedInput, view.inputValue);
  elements.speedInput.disabled = !view.editable;
  setTextContent(elements.speedSecondary, view.secondary);
  renderError(elements.speedError, [elements.speedInput], view.error);
}

function renderTimeCard(elements, view, driverButtonView) {
  renderCardState(elements.timeCard, view.stateLabel);
  setTextContent(elements.timeState, view.stateLabel);
  renderDriverButton(elements.timeDriverButton, driverButtonView);
  renderLockButton(elements.timeLockButton, view);
  setInputValue(elements.timeHours, view.inputValues.hours);
  setInputValue(elements.timeMinutes, view.inputValues.minutes);
  setInputValue(elements.timeSeconds, view.inputValues.seconds);
  elements.timeHours.disabled = !view.editable;
  elements.timeMinutes.disabled = !view.editable;
  elements.timeSeconds.disabled = !view.editable;
  setTextContent(elements.timeSecondary, view.secondary);
  renderError(
    elements.timeError,
    [elements.timeHours, elements.timeMinutes, elements.timeSeconds],
    view.error
  );
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

function createPlaceholderRow(message) {
  const placeholderRow = document.createElement("tr");
  const placeholderCell = document.createElement("td");

  placeholderRow.className = "table-placeholder";
  placeholderCell.colSpan = 2;
  placeholderCell.textContent = message;
  placeholderRow.append(placeholderCell);
  return placeholderRow;
}

function renderSplitRows(elements, view) {
  setTextContent(elements.splitHeading, view.heading);
  setTextContent(elements.splitCopy, view.meta);

  if (view.rows.length === 0) {
    elements.splitRows.replaceChildren(createPlaceholderRow(view.placeholder));
    return;
  }

  elements.splitRows.replaceChildren(
    ...view.rows.map((row) => {
      const tableRow = document.createElement("tr");
      const splitCell = document.createElement("th");
      const finishCell = document.createElement("td");

      if (row.isPartial) {
        tableRow.classList.add("is-final-partial");
      }

      splitCell.scope = "row";
      splitCell.textContent = row.label;
      finishCell.textContent = row.finishLabel;

      tableRow.append(splitCell, finishCell);
      return tableRow;
    })
  );
}

function render(elements, state) {
  const view = deriveCalculatorView(state);
  const hasError = Boolean(
    view.distance.error ||
      view.cards.pace.error ||
      view.cards.speed.error ||
      view.cards.time.error
  );

  renderUnitButtons(elements, view.unit);
  renderPresetButtons(elements, view.distance.presetId);

  setTextContent(elements.distanceLabel, view.distance.label);
  setTextContent(elements.selectedDistance, view.selectedDistanceLabel);
  setInputValue(elements.distanceInput, view.distance.inputValue);
  setInputValue(elements.distanceSlider, view.distance.sliderValue);
  elements.distanceSlider.min = view.distance.sliderMinimum;
  elements.distanceSlider.max = view.distance.sliderMaximum;
  elements.distanceSlider.step = view.distance.sliderStep;
  renderError(elements.distanceError, [elements.distanceInput], view.distance.error);

  renderPaceCard(elements, view.cards.pace, view.driverButtons.pace);
  renderSpeedCard(elements, view.cards.speed, view.driverButtons.speed);
  renderTimeCard(elements, view.cards.time, view.driverButtons.time);

  setTextContent(elements.statusMessage, view.statusMessage);
  elements.statusMessage.classList.toggle("status-message--error", hasError);

  renderProjections(elements, view.projectionRows);
  renderSplitRows(elements, view.split);

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
      updateInputValue(
        setActiveMetric(getState(), DRIVER_METRICS.PACE),
        "paceMinutes",
        elements.paceMinutes.value
      )
    );
  });

  elements.paceSeconds.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(
        setActiveMetric(getState(), DRIVER_METRICS.PACE),
        "paceSeconds",
        elements.paceSeconds.value
      )
    );
  });

  elements.speedInput.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(
        setActiveMetric(getState(), DRIVER_METRICS.SPEED),
        "speed",
        elements.speedInput.value
      )
    );
  });

  elements.timeHours.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(
        setActiveMetric(getState(), DRIVER_METRICS.TIME),
        "timeHours",
        elements.timeHours.value
      )
    );
  });

  elements.timeMinutes.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(
        setActiveMetric(getState(), DRIVER_METRICS.TIME),
        "timeMinutes",
        elements.timeMinutes.value
      )
    );
  });

  elements.timeSeconds.addEventListener("input", () => {
    setStateAndRender(
      updateInputValue(
        setActiveMetric(getState(), DRIVER_METRICS.TIME),
        "timeSeconds",
        elements.timeSeconds.value
      )
    );
  });
}

export function getElements(root) {
  const distanceInput = root.querySelector("#distance-input");

  if (!distanceInput) {
    return null;
  }

  return {
    distanceError: root.querySelector("#distance-error"),
    distanceInput,
    distanceLabel: root.querySelector("#distance-label"),
    distanceSlider: root.querySelector("#distance-slider"),
    paceCard: root.querySelector("#pace-card"),
    paceDriverButton: root.querySelector("#pace-driver-button"),
    paceError: root.querySelector("#pace-error"),
    paceLabel: root.querySelector("#pace-label"),
    paceLockButton: root.querySelector("#pace-lock-button"),
    paceMinutes: root.querySelector("#pace-minutes"),
    paceSecondary: root.querySelector("#pace-secondary"),
    paceSeconds: root.querySelector("#pace-seconds"),
    paceState: root.querySelector("#pace-state"),
    presetButtons: root.querySelectorAll("[data-preset-button]"),
    projectionValues: {
      "5k": root.querySelector("#projection-5k"),
      "10k": root.querySelector("#projection-10k"),
      half: root.querySelector("#projection-half"),
      marathon: root.querySelector("#projection-marathon")
    },
    resetButton: root.querySelector("#reset-button"),
    selectedDistance: root.querySelector("#selected-distance"),
    splitCopy: root.querySelector("#split-copy"),
    splitHeading: root.querySelector("#split-heading"),
    splitRows: root.querySelector("#split-rows"),
    speedCard: root.querySelector("#speed-card"),
    speedDriverButton: root.querySelector("#speed-driver-button"),
    speedError: root.querySelector("#speed-error"),
    speedInput: root.querySelector("#speed-input"),
    speedLabel: root.querySelector("#speed-label"),
    speedSecondary: root.querySelector("#speed-secondary"),
    speedState: root.querySelector("#speed-state"),
    statusMessage: root.querySelector("#status-message"),
    timeCard: root.querySelector("#time-card"),
    timeDriverButton: root.querySelector("#time-driver-button"),
    timeError: root.querySelector("#time-error"),
    timeHours: root.querySelector("#time-hours"),
    timeLockButton: root.querySelector("#time-lock-button"),
    timeMinutes: root.querySelector("#time-minutes"),
    timeSecondary: root.querySelector("#time-secondary"),
    timeSeconds: root.querySelector("#time-seconds"),
    timeState: root.querySelector("#time-state"),
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

  elements.paceDriverButton.addEventListener("click", () => {
    setStateAndRender(setActiveMetric(getState(), DRIVER_METRICS.PACE));
  });

  elements.speedDriverButton.addEventListener("click", () => {
    setStateAndRender(setActiveMetric(getState(), DRIVER_METRICS.SPEED));
  });

  elements.timeDriverButton.addEventListener("click", () => {
    setStateAndRender(setActiveMetric(getState(), DRIVER_METRICS.TIME));
  });

  elements.paceLockButton.addEventListener("click", () => {
    setStateAndRender(toggleMetricLock(getState(), DRIVER_METRICS.PACE));
  });

  elements.timeLockButton.addEventListener("click", () => {
    setStateAndRender(toggleMetricLock(getState(), DRIVER_METRICS.TIME));
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
