import {
  CONVERT_SOURCES,
  DISTANCE_PRESETS,
  MODES,
  RESULT_PLACEHOLDER,
  applyConvertSourceChange,
  applyModeChange,
  applyPresetSelection,
  applyUnitChange,
  deriveCalculatorView,
  resetFormState,
  restoreCalculatorState,
  serializeCalculatorState,
  updateDistanceInput,
  updateInputValue
} from "./lib/calculator.js";
import { getModeFromNavigationKey } from "./lib/mode-navigation.js";
import {
  renderProvenanceBadges,
  setClusterState
} from "./lib/provenance-ui.js";

const elements = {
  alternatePaceLabel: document.querySelector("#alternate-pace-label"),
  alternatePaceProvenance: document.querySelector("#alternate-pace-provenance"),
  alternatePaceValue: document.querySelector("#alternate-pace-value"),
  alternateSpeedLabel: document.querySelector("#alternate-speed-label"),
  alternateSpeedProvenance: document.querySelector("#alternate-speed-provenance"),
  alternateSpeedValue: document.querySelector("#alternate-speed-value"),
  convertSourceButtons: document.querySelectorAll("[data-convert-source-button]"),
  convertSourceCluster: document.querySelector("#convert-source-cluster"),
  distanceCluster: document.querySelector("#distance-cluster"),
  distanceClusterProvenance: document.querySelector("#distance-cluster-provenance"),
  distanceError: document.querySelector("#distance-error"),
  distanceInput: document.querySelector("#distance-input"),
  distanceLabel: document.querySelector("#distance-label"),
  distanceProvenance: document.querySelector("#distance-provenance"),
  finishCluster: document.querySelector("#finish-cluster"),
  finishClusterProvenance: document.querySelector("#finish-cluster-provenance"),
  finishError: document.querySelector("#finish-error"),
  finishHours: document.querySelector("#finish-hours"),
  finishMinutes: document.querySelector("#finish-minutes"),
  finishSeconds: document.querySelector("#finish-seconds"),
  heroChips: document.querySelector("#hero-chips"),
  lockedLabel: document.querySelector("#locked-label"),
  lockedMeta: document.querySelector("#locked-meta"),
  lockedProvenance: document.querySelector("#locked-provenance"),
  lockedValue: document.querySelector("#locked-value"),
  modeButtons: document.querySelectorAll("[data-mode-button]"),
  paceCluster: document.querySelector("#pace-cluster"),
  paceClusterProvenance: document.querySelector("#pace-cluster-provenance"),
  paceCopy: document.querySelector("#pace-copy"),
  paceError: document.querySelector("#pace-error"),
  paceMinutes: document.querySelector("#pace-minutes"),
  paceSeconds: document.querySelector("#pace-seconds"),
  presetSelect: document.querySelector("#preset-select"),
  primaryLabel: document.querySelector("#primary-label"),
  primaryMeta: document.querySelector("#primary-meta"),
  primaryProvenance: document.querySelector("#primary-provenance"),
  primaryValue: document.querySelector("#primary-value"),
  projectionRows: document.querySelector("#projection-rows"),
  resetButton: document.querySelector("#reset-button"),
  resultBadge: document.querySelector("#result-badge"),
  resultNote: document.querySelector("#result-note"),
  selectedDistance: document.querySelector("#selected-distance"),
  selectedPaceLabel: document.querySelector("#selected-pace-label"),
  selectedPaceProvenance: document.querySelector("#selected-pace-provenance"),
  selectedPaceValue: document.querySelector("#selected-pace-value"),
  selectedSpeedLabel: document.querySelector("#selected-speed-label"),
  selectedSpeedProvenance: document.querySelector("#selected-speed-provenance"),
  selectedSpeedValue: document.querySelector("#selected-speed-value"),
  speedCluster: document.querySelector("#speed-cluster"),
  speedClusterProvenance: document.querySelector("#speed-cluster-provenance"),
  speedError: document.querySelector("#speed-error"),
  speedInput: document.querySelector("#speed-input"),
  speedLabel: document.querySelector("#speed-label"),
  statusMessage: document.querySelector("#status-message"),
  unitButtons: document.querySelectorAll("[data-unit-button]")
};

const modeButtons = [...elements.modeButtons];
const modeOrder = modeButtons.map((button) => button.dataset.mode);
let state = restoreCalculatorState(window.location.search);
let lastValidResult = null;

function getAlternateUnit(unit) {
  return unit === "km" ? "mi" : "km";
}

function getSpeedUnitLabel(unit) {
  return unit === "km" ? "km/h" : "mph";
}

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

function populateHeroChips() {
  const presets = DISTANCE_PRESETS.filter((preset) => preset.distanceKm !== null);

  elements.heroChips.replaceChildren(
    ...presets.map((preset) => {
      const chip = document.createElement("span");

      chip.className = "chip";
      chip.textContent = preset.label;
      return chip;
    })
  );
}

function populatePresetSelect() {
  elements.presetSelect.replaceChildren(
    ...DISTANCE_PRESETS.map((preset) => {
      const option = document.createElement("option");

      option.value = preset.id;
      option.textContent = preset.label;
      return option;
    })
  );
}

function renderModeButtons() {
  for (const button of modeButtons) {
    const isActive = button.dataset.mode === state.mode;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  }
}

function renderUnitButtons() {
  for (const button of elements.unitButtons) {
    const isActive = button.dataset.unit === state.unit;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderConvertSourceButtons() {
  for (const button of elements.convertSourceButtons) {
    const isActive = button.dataset.convertSource === state.convertSource;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderStaticLabels() {
  const alternateUnit = getAlternateUnit(state.unit);
  const selectedSpeedUnit = getSpeedUnitLabel(state.unit);
  const alternateSpeedUnit = getSpeedUnitLabel(alternateUnit);

  setTextContent(elements.distanceLabel, `Distance (${state.unit})`);
  setTextContent(
    elements.speedLabel,
    `Speed (${selectedSpeedUnit})`
  );
  setTextContent(
    elements.selectedPaceLabel,
    `Pace /${state.unit}`
  );
  setTextContent(
    elements.selectedSpeedLabel,
    `Speed ${selectedSpeedUnit}`
  );
  setTextContent(
    elements.alternatePaceLabel,
    `Pace /${alternateUnit}`
  );
  setTextContent(
    elements.alternateSpeedLabel,
    `Speed ${alternateSpeedUnit}`
  );

  if (state.mode === MODES.CONVERT) {
    setTextContent(
      elements.paceCopy,
      `Enter pace in /${state.unit}. Switching the convert source keeps the last valid result visible but marks it out of date.`
    );
  } else {
    setTextContent(
      elements.paceCopy,
      `Enter pace in /${state.unit}. Both fields must be present before the calculator can project a finish time.`
    );
  }
}

function renderInputValues() {
  setInputValue(elements.distanceInput, state.inputs.distance);
  setInputValue(elements.finishHours, state.inputs.finishHours);
  setInputValue(elements.finishMinutes, state.inputs.finishMinutes);
  setInputValue(elements.finishSeconds, state.inputs.finishSeconds);
  setInputValue(elements.paceMinutes, state.inputs.paceMinutes);
  setInputValue(elements.paceSeconds, state.inputs.paceSeconds);
  setInputValue(elements.speedInput, state.inputs.speed);
  elements.presetSelect.value = state.presetId;
}

function renderVisibility(view) {
  elements.distanceCluster.hidden = !view.showDistanceFields;
  elements.convertSourceCluster.hidden = state.mode !== MODES.CONVERT;
  elements.finishCluster.hidden = !view.showFinishFields;
  elements.paceCluster.hidden = !view.showPaceFields;
  elements.speedCluster.hidden = !view.showSpeedFields;
}

function renderInputProvenance(view) {
  setClusterState(elements.distanceCluster, view.inputProvenance.distance);
  setClusterState(elements.finishCluster, view.inputProvenance.finish);
  setClusterState(elements.paceCluster, view.inputProvenance.pace);
  setClusterState(elements.speedCluster, view.inputProvenance.speed);

  renderProvenanceBadges(
    elements.distanceClusterProvenance,
    view.inputProvenance.distance,
    "Distance input state"
  );
  renderProvenanceBadges(
    elements.finishClusterProvenance,
    view.inputProvenance.finish,
    "Finish time input state"
  );
  renderProvenanceBadges(
    elements.paceClusterProvenance,
    view.inputProvenance.pace,
    "Pace input state"
  );
  renderProvenanceBadges(
    elements.speedClusterProvenance,
    view.inputProvenance.speed,
    "Speed input state"
  );
}

function renderBadge(resultState) {
  elements.resultBadge.className = "result-badge";

  if (resultState === "current") {
    elements.resultBadge.classList.add("result-badge--current");
    setTextContent(elements.resultBadge, "Current");
    return;
  }

  if (resultState === "stale") {
    elements.resultBadge.classList.add("result-badge--stale");
    setTextContent(elements.resultBadge, "Out of date");
    return;
  }

  setTextContent(elements.resultBadge, "Awaiting input");
}

function renderProjectionTable(display) {
  if (!display) {
    const placeholderRow = document.createElement("tr");
    const placeholderCell = document.createElement("td");

    placeholderRow.className = "table-placeholder";
    placeholderCell.colSpan = 2;
    placeholderCell.textContent = RESULT_PLACEHOLDER;
    placeholderRow.append(placeholderCell);
    elements.projectionRows.replaceChildren(placeholderRow);
    return;
  }

  elements.projectionRows.replaceChildren(
    ...display.projectionRows.map((row) => {
      const tableRow = document.createElement("tr");
      const distanceCell = document.createElement("th");
      const finishCell = document.createElement("td");

      if (row.isSelected) {
        tableRow.classList.add("is-selected");
      }

      distanceCell.scope = "row";
      distanceCell.textContent = `${row.label} (${row.detail})`;
      finishCell.textContent = row.finishLabel;

      tableRow.append(distanceCell, finishCell);
      return tableRow;
    })
  );
}

function renderResultSummary(view) {
  renderBadge(view.resultState);

  if (!view.display) {
    setTextContent(elements.primaryLabel, "Result");
    setTextContent(elements.primaryValue, "--");
    setTextContent(elements.primaryMeta, RESULT_PLACEHOLDER);
    renderProvenanceBadges(elements.primaryProvenance, null, "Result provenance");
    setTextContent(elements.selectedPaceValue, "--");
    setTextContent(elements.selectedSpeedValue, "--");
    setTextContent(elements.alternatePaceValue, "--");
    setTextContent(elements.alternateSpeedValue, "--");
    renderProvenanceBadges(
      elements.selectedPaceProvenance,
      null,
      "Selected pace provenance"
    );
    renderProvenanceBadges(
      elements.selectedSpeedProvenance,
      null,
      "Selected speed provenance"
    );
    renderProvenanceBadges(
      elements.alternatePaceProvenance,
      null,
      "Alternate pace provenance"
    );
    renderProvenanceBadges(
      elements.alternateSpeedProvenance,
      null,
      "Alternate speed provenance"
    );
    setTextContent(elements.lockedLabel, "Locked input");
    setTextContent(elements.lockedValue, "--");
    setTextContent(
      elements.lockedMeta,
      "The active driving value appears here after the first valid result."
    );
    renderProvenanceBadges(
      elements.lockedProvenance,
      null,
      "Locked value provenance"
    );
    setTextContent(elements.selectedDistance, "--");
    renderProvenanceBadges(
      elements.distanceProvenance,
      null,
      "Distance provenance"
    );
    setTextContent(
      elements.resultNote,
      "Common-race projections appear below after the first valid result."
    );
    renderProjectionTable(null);
    return;
  }

  setTextContent(elements.primaryLabel, view.display.primaryLabel);
  setTextContent(elements.primaryValue, view.display.primaryValue);
  setTextContent(elements.primaryMeta, view.display.primaryMeta);
  renderProvenanceBadges(
    elements.primaryProvenance,
    view.display.provenance.primary,
    "Result provenance"
  );
  setTextContent(elements.selectedPaceValue, view.display.selectedPace);
  setTextContent(elements.selectedSpeedValue, view.display.selectedSpeed);
  setTextContent(elements.alternatePaceValue, view.display.alternatePace);
  setTextContent(elements.alternateSpeedValue, view.display.alternateSpeed);
  renderProvenanceBadges(
    elements.selectedPaceProvenance,
    view.display.provenance.selectedPace,
    "Selected pace provenance"
  );
  renderProvenanceBadges(
    elements.selectedSpeedProvenance,
    view.display.provenance.selectedSpeed,
    "Selected speed provenance"
  );
  renderProvenanceBadges(
    elements.alternatePaceProvenance,
    view.display.provenance.alternatePace,
    "Alternate pace provenance"
  );
  renderProvenanceBadges(
    elements.alternateSpeedProvenance,
    view.display.provenance.alternateSpeed,
    "Alternate speed provenance"
  );
  setTextContent(elements.lockedLabel, view.display.lockedSummary.label);
  setTextContent(elements.lockedValue, view.display.lockedSummary.value);
  setTextContent(elements.lockedMeta, view.display.lockedSummary.meta);
  renderProvenanceBadges(
    elements.lockedProvenance,
    view.display.lockedSummary.provenance,
    "Locked value provenance"
  );
  setTextContent(elements.selectedDistance, view.display.distanceSummary.value);
  renderProvenanceBadges(
    elements.distanceProvenance,
    view.display.distanceSummary.provenance,
    "Distance provenance"
  );
  setTextContent(elements.resultNote, view.display.distanceSummary.meta);

  renderProjectionTable(view.display);
}

function syncUrlState() {
  const search = serializeCalculatorState(state);
  const nextUrl = search
    ? `${window.location.pathname}?${search}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function render() {
  const view = deriveCalculatorView(state, lastValidResult);

  if (view.currentResult) {
    lastValidResult = view.currentResult;
  }

  renderModeButtons();
  renderUnitButtons();
  renderConvertSourceButtons();
  renderStaticLabels();
  renderInputValues();
  renderVisibility(view);
  renderInputProvenance(view);

  renderError(elements.distanceError, [elements.distanceInput], view.errors.distance);
  renderError(
    elements.finishError,
    [elements.finishHours, elements.finishMinutes, elements.finishSeconds],
    view.errors.finish
  );
  renderError(
    elements.paceError,
    [elements.paceMinutes, elements.paceSeconds],
    view.errors.pace
  );
  renderError(elements.speedError, [elements.speedInput], view.errors.speed);

  setTextContent(elements.statusMessage, view.statusMessage);
  elements.statusMessage.classList.toggle(
    "status-message--error",
    view.resultState === "stale"
  );

  renderResultSummary(view);
  syncUrlState();
}

function bindModeEvents() {
  for (const button of modeButtons) {
    button.addEventListener("click", () => {
      state = applyModeChange(state, button.dataset.mode);
      render();
    });

    button.addEventListener("keydown", (event) => {
      const nextMode = getModeFromNavigationKey(
        modeOrder,
        state.mode,
        event.key
      );

      if (!nextMode) {
        return;
      }

      event.preventDefault();
      state = applyModeChange(state, nextMode);
      render();

      const activeButton = modeButtons.find(
        (candidate) => candidate.dataset.mode === nextMode
      );

      activeButton?.focus();
    });
  }
}

function bindUnitEvents() {
  for (const button of elements.unitButtons) {
    button.addEventListener("click", () => {
      state = applyUnitChange(state, button.dataset.unit);
      render();
    });
  }
}

function bindConvertSourceEvents() {
  for (const button of elements.convertSourceButtons) {
    button.addEventListener("click", () => {
      state = applyConvertSourceChange(state, button.dataset.convertSource);
      render();
    });
  }
}

function bindInputEvents() {
  elements.presetSelect.addEventListener("change", () => {
    state = applyPresetSelection(state, elements.presetSelect.value);
    render();
  });

  elements.distanceInput.addEventListener("input", () => {
    state = updateDistanceInput(state, elements.distanceInput.value);
    render();
  });

  elements.finishHours.addEventListener("input", () => {
    state = updateInputValue(state, "finishHours", elements.finishHours.value);
    render();
  });

  elements.finishMinutes.addEventListener("input", () => {
    state = updateInputValue(state, "finishMinutes", elements.finishMinutes.value);
    render();
  });

  elements.finishSeconds.addEventListener("input", () => {
    state = updateInputValue(state, "finishSeconds", elements.finishSeconds.value);
    render();
  });

  elements.paceMinutes.addEventListener("input", () => {
    state = updateInputValue(state, "paceMinutes", elements.paceMinutes.value);
    render();
  });

  elements.paceSeconds.addEventListener("input", () => {
    state = updateInputValue(state, "paceSeconds", elements.paceSeconds.value);
    render();
  });

  elements.speedInput.addEventListener("input", () => {
    state = updateInputValue(state, "speed", elements.speedInput.value);
    render();
  });

  elements.resetButton.addEventListener("click", () => {
    state = resetFormState(state);
    lastValidResult = null;
    render();
  });
}

populateHeroChips();
populatePresetSelect();
bindModeEvents();
bindUnitEvents();
bindConvertSourceEvents();
bindInputEvents();
render();
