import {
  applyDistanceIncrement,
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

const PACE_FIELDS = Object.freeze(["paceMinutes", "paceSeconds"]);
const SPLIT_URL_KEY = "splits";
const SPLIT_URL_VERSION = 1;
const TIME_FIELDS = Object.freeze(["timeHours", "timeMinutes", "timeSeconds"]);
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const GROUP_AUTO_FILL_DEFAULTS = Object.freeze({
  paceMinutes: "0",
  paceSeconds: "00",
  timeHours: "0",
  timeMinutes: "00",
  timeSeconds: "00"
});

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
      button.dataset.preset = "";
      setTextContent(button, "");
      button.hidden = true;
      button.disabled = true;
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
      continue;
    }

    button.hidden = false;
    button.disabled = false;
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

function cloneCalculatorState(state) {
  return {
    ...state,
    editOrder: [...state.editOrder],
    inputs: { ...state.inputs }
  };
}

function serializeCalculatorStateSnapshot(state) {
  if (!state) {
    return "";
  }

  return JSON.stringify({
    canonicalDistanceKm: state.canonicalDistanceKm,
    canonicalSpeedKmh: state.canonicalSpeedKmh,
    editOrder: state.editOrder,
    inputs: state.inputs,
    presetId: state.presetId,
    rateInputMode: state.rateInputMode,
    unit: state.unit
  });
}

function serializeSplitBuilderState(splits, selectedSplitId) {
  if (!Array.isArray(splits) || splits.length === 0) {
    return null;
  }

  const rows = [];

  for (const split of splits) {
    const serializedSnapshot = serializeCalculatorState(split.snapshot);

    if (!serializedSnapshot) {
      return null;
    }

    rows.push(serializedSnapshot);
  }

  const payload = {
    v: SPLIT_URL_VERSION,
    r: rows
  };
  const selectedIndex = splits.findIndex((split) => split.id === selectedSplitId);

  if (selectedIndex >= 0) {
    payload.s = selectedIndex;
  }

  return JSON.stringify(payload);
}

function restoreSplitBuilderState(searchParams) {
  const params = new URLSearchParams(searchParams);
  const rawPayload = params.get(SPLIT_URL_KEY);

  if (!rawPayload) {
    return {
      selectedSplitId: null,
      splitCounter: 0,
      splits: []
    };
  }

  try {
    const payload = JSON.parse(rawPayload);

    if (
      !payload ||
      payload.v !== SPLIT_URL_VERSION ||
      !Array.isArray(payload.r)
    ) {
      throw new Error("Invalid split URL payload.");
    }

    const splits = payload.r.map((serializedSnapshot, index) => {
      if (typeof serializedSnapshot !== "string" || serializedSnapshot.length === 0) {
        throw new Error("Invalid split snapshot.");
      }

      const snapshot = restoreCalculatorState(serializedSnapshot);

      if (!serializeCalculatorState(snapshot)) {
        throw new Error("Split snapshot did not restore to a live calculator state.");
      }

      return {
        id: `split-${index + 1}`,
        snapshot
      };
    });
    const selectedIndex =
      Number.isInteger(payload.s) && payload.s >= 0 && payload.s < splits.length
        ? payload.s
        : null;

    return {
      selectedSplitId: selectedIndex === null ? null : splits[selectedIndex].id,
      splitCounter: splits.length,
      splits
    };
  } catch {
    return {
      selectedSplitId: null,
      splitCounter: 0,
      splits: []
    };
  }
}

function formatSplitPaceLabel(paceInputValues, unit) {
  const minutes = parseNumberGroup(paceInputValues.minutes);
  const seconds = parseNumberGroup(paceInputValues.seconds);
  const minuteLabel = minutes === null ? "--" : String(minutes);
  const secondLabel = seconds === null ? "--" : String(seconds).padStart(2, "0");

  return `${minuteLabel}:${secondLabel} min/${unit}`;
}

function formatSplitTimeLabel(timeInputValues) {
  const hours = parseNumberGroup(timeInputValues.hours) ?? 0;
  const minutes = parseNumberGroup(timeInputValues.minutes) ?? 0;
  const seconds = parseNumberGroup(timeInputValues.seconds);

  if (seconds === null) {
    return "--";
  }

  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, "0")}m${String(seconds).padStart(2, "0")}s`;
  }

  if (minutes > 0) {
    return `${minutes}m${String(seconds).padStart(2, "0")}s`;
  }

  return `${seconds}s`;
}

function resolveDocument(elements) {
  return (
    elements.documentRef ??
    elements.splitList?.ownerDocument ??
    (typeof document !== "undefined" ? document : null)
  );
}

function parseNumberGroup(value) {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function createSvgElement(documentRef, tagName) {
  if (typeof documentRef.createElementNS === "function") {
    return documentRef.createElementNS(SVG_NAMESPACE, tagName);
  }

  return documentRef.createElement(tagName);
}

function createSplitActionIcon(documentRef, icon) {
  const svg = createSvgElement(documentRef, "svg");

  svg.setAttribute("class", "split-card__action-icon");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const paths =
    icon === "duplicate"
      ? [
          { tagName: "rect", attributes: { x: "2", y: "2", width: "7", height: "7", rx: "1.25" } },
          { tagName: "rect", attributes: { x: "7", y: "7", width: "7", height: "7", rx: "1.25" } }
        ]
      : [
          { tagName: "path", attributes: { d: "M3.5 4.5h9" } },
          { tagName: "path", attributes: { d: "M6 2.5h4" } },
          { tagName: "path", attributes: { d: "M5 4.5v7.25a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4.5" } },
          { tagName: "path", attributes: { d: "M7 7v4" } },
          { tagName: "path", attributes: { d: "M9 7v4" } }
        ];

  for (const { tagName, attributes } of paths) {
    const shape = createSvgElement(documentRef, tagName);

    for (const [name, value] of Object.entries(attributes)) {
      shape.setAttribute(name, value);
    }

    svg.append(shape);
  }

  return svg;
}

function createSplitMetric(documentRef, shortLabel, fullLabel, value) {
  const metric = documentRef.createElement("span");
  const metricLabel = documentRef.createElement("span");
  const metricValue = documentRef.createElement("strong");

  metric.className = "split-card__metric";
  metric.setAttribute("aria-label", `${fullLabel}: ${value}`);
  metricLabel.className = "split-card__metric-label";
  metricValue.className = "split-card__metric-value";
  metricLabel.textContent = shortLabel;
  metricValue.textContent = value;
  metric.append(metricLabel, metricValue);

  return metric;
}

function renderSplitBuilder(
  elements,
  view,
  {
    canCommitSplit,
    onDeleteSplit,
    onDuplicateSplit,
    onSelectSplit,
    selectedSplitId,
    selectedSplitDirty,
    splits
  }
) {
  const hasSplitUi = elements.splitActionButton && elements.splitList && elements.splitSummary;

  if (!hasSplitUi) {
    return;
  }

  const hasSelectedSplit = selectedSplitId !== null;
  const actionLabel =
    hasSelectedSplit && selectedSplitDirty ? "Save split" : "Add split";
  const selectedIndex = splits.findIndex((split) => split.id === selectedSplitId);

  setTextContent(elements.splitActionButton, actionLabel);
  elements.splitActionButton.disabled = !canCommitSplit;
  elements.splitActionButton.classList.toggle(
    "split-action-button--save",
    hasSelectedSplit && selectedSplitDirty
  );

  if (splits.length === 0) {
    setTextContent(elements.splitSummary, "No splits yet");
  } else if (selectedIndex >= 0) {
    setTextContent(
      elements.splitSummary,
      `${selectedSplitDirty ? "Update" : "Editing"} split ${selectedIndex + 1}`
    );
  } else {
    setTextContent(elements.splitSummary, "No split selected");
  }

  if (elements.splitEmptyState) {
    elements.splitEmptyState.hidden = splits.length > 0;
  }

  const documentRef = resolveDocument(elements);

  if (!documentRef) {
    return;
  }

  const rows = splits.map((split, index) => {
    const item = documentRef.createElement("li");
    const selectButton = documentRef.createElement("button");
    const indexLabel = documentRef.createElement("span");
    const metrics = documentRef.createElement("span");
    const actions = documentRef.createElement("span");
    const duplicateButton = documentRef.createElement("button");
    const deleteButton = documentRef.createElement("button");
    const splitView = deriveCalculatorView(split.snapshot);
    const isSelected = split.id === selectedSplitId;

    item.className = "split-list__item";

    selectButton.className = "split-card";
    selectButton.type = "button";
    selectButton.setAttribute("aria-pressed", String(isSelected));
    selectButton.classList.toggle("is-selected", isSelected);
    selectButton.setAttribute(
      "aria-label",
      `Edit split ${index + 1}: distance ${splitView.selectedDistanceLabel}, pace ${formatSplitPaceLabel(
        splitView.rate.paceInputValues,
        splitView.unit
      )}, time ${formatSplitTimeLabel(splitView.time.inputValues)}`
    );
    selectButton.addEventListener("click", () => {
      onSelectSplit(split.id);
    });

    indexLabel.className = "split-card__index";
    indexLabel.textContent = String(index + 1);

    metrics.className = "split-card__metrics";
    metrics.append(
      createSplitMetric(documentRef, "D", "Distance", splitView.selectedDistanceLabel),
      createSplitMetric(
        documentRef,
        "P",
        "Pace",
        formatSplitPaceLabel(splitView.rate.paceInputValues, splitView.unit)
      ),
      createSplitMetric(
        documentRef,
        "T",
        "Time",
        formatSplitTimeLabel(splitView.time.inputValues)
      )
    );
    selectButton.append(indexLabel, metrics);

    actions.className = "split-card__actions";

    duplicateButton.className = "split-card__action";
    duplicateButton.type = "button";
    duplicateButton.setAttribute("aria-label", `Duplicate split ${index + 1}`);
    duplicateButton.setAttribute("title", `Duplicate split ${index + 1}`);
    duplicateButton.append(createSplitActionIcon(documentRef, "duplicate"));
    duplicateButton.addEventListener("click", () => {
      onDuplicateSplit(split.id);
    });

    deleteButton.className = "split-card__action split-card__action--danger";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete split ${index + 1}`);
    deleteButton.setAttribute("title", `Delete split ${index + 1}`);
    deleteButton.append(createSplitActionIcon(documentRef, "delete"));
    deleteButton.addEventListener("click", () => {
      onDeleteSplit(split.id);
    });

    actions.append(duplicateButton, deleteButton);
    item.append(selectButton, actions);
    return item;
  });

  elements.splitList.replaceChildren(...rows);
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

function syncUrlState(state, splits, selectedSplitId) {
  if (
    typeof window === "undefined" ||
    !window.location ||
    !window.history ||
    typeof window.history.replaceState !== "function"
  ) {
    return;
  }

  const params = new URLSearchParams(serializeCalculatorState(state));
  const serializedSplitBuilderState = serializeSplitBuilderState(
    splits,
    selectedSplitId
  );

  if (serializedSplitBuilderState) {
    params.set(SPLIT_URL_KEY, serializedSplitBuilderState);
  }

  const search = params.toString();
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
  function updateGroupedField(field, value, groupFields) {
    const shouldAutoFill =
      hasValue(value) &&
      groupFields
        .filter((name) => name !== field)
        .every((name) => !hasValue(getState().inputs[name]));

    let nextState = updateInputValue(getState(), field, value);

    if (!shouldAutoFill) {
      setStateAndRender(nextState);
      return;
    }

    for (const name of groupFields) {
      if (name === field || hasValue(nextState.inputs[name])) {
        continue;
      }

      nextState = updateInputValue(
        nextState,
        name,
        GROUP_AUTO_FILL_DEFAULTS[name]
      );
    }

    setStateAndRender(nextState);
  }

  elements.paceMinutes.addEventListener("input", () => {
    updateGroupedField("paceMinutes", elements.paceMinutes.value, PACE_FIELDS);
  });

  elements.paceSeconds.addEventListener("input", () => {
    updateGroupedField("paceSeconds", elements.paceSeconds.value, PACE_FIELDS);
  });

  elements.speedInput.addEventListener("input", () => {
    setStateAndRender(updateInputValue(getState(), "speed", elements.speedInput.value));
  });

  elements.timeHours.addEventListener("input", () => {
    updateGroupedField("timeHours", elements.timeHours.value, TIME_FIELDS);
  });

  elements.timeMinutes.addEventListener("input", () => {
    updateGroupedField("timeMinutes", elements.timeMinutes.value, TIME_FIELDS);
  });

  elements.timeSeconds.addEventListener("input", () => {
    updateGroupedField("timeSeconds", elements.timeSeconds.value, TIME_FIELDS);
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
    distanceIncrementButtons: root.querySelectorAll("[data-distance-increment-button]"),
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
    splitActionButton: root.querySelector("#split-action-button"),
    splitEmptyState: root.querySelector("#split-empty-state"),
    splitList: root.querySelector("#split-list"),
    splitSummary: root.querySelector("#split-summary"),
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
  let splitCounter = 0;
  let splits = [];
  let selectedSplitId = null;

  if (typeof window !== "undefined") {
    const restoredSplitBuilderState = restoreSplitBuilderState(window.location.search);

    splitCounter = restoredSplitBuilderState.splitCounter;
    splits = restoredSplitBuilderState.splits;
    selectedSplitId = restoredSplitBuilderState.selectedSplitId;
  }

  function getState() {
    return state;
  }

  function getSelectedSplit() {
    return splits.find((split) => split.id === selectedSplitId) ?? null;
  }

  function getComparableState(view) {
    return normalizeStateFromView(state, view);
  }

  function getSelectedSplitDirty(view) {
    const selectedSplit = getSelectedSplit();

    if (!selectedSplit) {
      return false;
    }

    return (
      serializeCalculatorStateSnapshot(getComparableState(view)) !==
      serializeCalculatorStateSnapshot(selectedSplit.snapshot)
    );
  }

  function syncAppUrlState() {
    syncUrlState(state, splits, selectedSplitId);
  }

  function refreshSplitBuilder(view) {
    renderSplitBuilder(elements, view, {
      canCommitSplit: view.hasLiveResult && !hasViewErrors(view),
      onDeleteSplit(splitId) {
        const deleteIndex = splits.findIndex((split) => split.id === splitId);

        if (deleteIndex < 0) {
          return;
        }

        splits = splits.filter((split) => split.id !== splitId);

        if (selectedSplitId !== splitId) {
          refreshSplitBuilder(lastView ?? deriveCalculatorView(state));
          syncAppUrlState();
          return;
        }

        const fallbackSplit = splits[deleteIndex] ?? splits[deleteIndex - 1] ?? null;

        if (!fallbackSplit) {
          selectedSplitId = null;
          refreshSplitBuilder(lastView ?? deriveCalculatorView(state));
          syncAppUrlState();
          return;
        }

        selectedSplitId = fallbackSplit.id;
        setStateAndRender(cloneCalculatorState(fallbackSplit.snapshot));
      },
      onDuplicateSplit(splitId) {
        const duplicateIndex = splits.findIndex((split) => split.id === splitId);

        if (duplicateIndex < 0) {
          return;
        }

        splitCounter += 1;
        const duplicate = {
          id: `split-${splitCounter}`,
          snapshot: cloneCalculatorState(splits[duplicateIndex].snapshot)
        };

        splits = [
          ...splits.slice(0, duplicateIndex + 1),
          duplicate,
          ...splits.slice(duplicateIndex + 1)
        ];
        selectedSplitId = duplicate.id;
        setStateAndRender(cloneCalculatorState(duplicate.snapshot));
      },
      onSelectSplit(splitId) {
        const selectedSplit = splits.find((split) => split.id === splitId);

        if (!selectedSplit) {
          return;
        }

        selectedSplitId = splitId;
        setStateAndRender(cloneCalculatorState(selectedSplit.snapshot));
      },
      selectedSplitDirty: getSelectedSplitDirty(view),
      selectedSplitId,
      splits
    });
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

    refreshSplitBuilder(view);
    syncAppUrlState();
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

  for (const button of elements.distanceIncrementButtons ?? []) {
    button.addEventListener("click", () => {
      const incrementKm = Number(button.dataset.incrementKm);

      if (!Number.isFinite(incrementKm) || incrementKm === 0) {
        return;
      }

      setStateAndRender(applyDistanceIncrement(getState(), incrementKm));
    });
  }

  elements.distanceInput.addEventListener("input", () => {
    setStateAndRender(updateDistanceInput(getState(), elements.distanceInput.value));
  });

  elements.distanceSlider.addEventListener("input", () => {
    setStateAndRender(updateDistanceSlider(getState(), elements.distanceSlider.value));
  });

  elements.resetButton.addEventListener("click", () => {
    splitCounter = 0;
    splits = [];
    selectedSplitId = null;
    setStateAndRender(resetFormState(getState()));
  });

  if (elements.splitActionButton) {
    elements.splitActionButton.addEventListener("click", () => {
      const view = lastView ?? deriveCalculatorView(state);

      if (!view.hasLiveResult || hasViewErrors(view)) {
        refreshSplitBuilder(view);
        syncAppUrlState();
        return;
      }

      const selectedSplit = getSelectedSplit();

      if (selectedSplit && getSelectedSplitDirty(view)) {
        splits = splits.map((split) =>
          split.id === selectedSplitId
            ? {
                ...split,
                snapshot: cloneCalculatorState(lastStableState)
              }
            : split
        );
        refreshSplitBuilder(view);
        syncAppUrlState();
        return;
      }

      splitCounter += 1;
      splits = [
        ...splits,
        {
          id: `split-${splitCounter}`,
          snapshot: cloneCalculatorState(lastStableState)
        }
      ];
      refreshSplitBuilder(view);
      syncAppUrlState();
    });
  }

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
  refreshSplitBuilder(lastView);
  syncAppUrlState();

  return {
    getState,
    render() {
      const view = render(elements, state);

      refreshSplitBuilder(view);
      syncAppUrlState();
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
