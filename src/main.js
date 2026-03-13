import {
  DISTANCES,
  calculatePerformance,
  formatDuration,
  formatPace,
  formatSpeed
} from "./lib/calculator.js";
import { getModeFromNavigationKey } from "./lib/mode-navigation.js";

function getModeLabel(mode) {
  if (mode === "finish") {
    return "finish time";
  }

  return mode;
}

function setTextContent(element, value) {
  element.textContent = value;
}

function setFieldError(inputs, messageElement, message) {
  const isInvalid = Boolean(message);

  messageElement.textContent = message ?? "";
  messageElement.classList.toggle("is-visible", isInvalid);

  for (const input of inputs) {
    if (isInvalid) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }
}

export function createApp(rootDocument = document) {
  const elements = {
    distanceSelect: rootDocument.querySelector("#distance-select"),
    finishCaption: rootDocument.querySelector("#finish-caption"),
    finishError: rootDocument.querySelector("#finish-error"),
    finishHours: rootDocument.querySelector("#finish-hours"),
    finishMinutes: rootDocument.querySelector("#finish-minutes"),
    finishSeconds: rootDocument.querySelector("#finish-seconds"),
    finishValue: rootDocument.querySelector("#finish-value"),
    heroChips: rootDocument.querySelector("#hero-chips"),
    modeButtons: Array.from(rootDocument.querySelectorAll("[data-mode-button]")),
    paceError: rootDocument.querySelector("#pace-error"),
    paceKmValue: rootDocument.querySelector("#pace-km-value"),
    paceMiValue: rootDocument.querySelector("#pace-mi-value"),
    paceMinutes: rootDocument.querySelector("#pace-minutes"),
    paceSeconds: rootDocument.querySelector("#pace-seconds"),
    paceUnit: rootDocument.querySelector("#pace-unit"),
    panels: Array.from(rootDocument.querySelectorAll("[data-input-panel]")),
    projectionRows: rootDocument.querySelector("#projection-rows"),
    speedError: rootDocument.querySelector("#speed-error"),
    speedKmhValue: rootDocument.querySelector("#speed-kmh-value"),
    speedMphValue: rootDocument.querySelector("#speed-mph-value"),
    speedUnit: rootDocument.querySelector("#speed-unit"),
    speedValue: rootDocument.querySelector("#speed-value"),
    splitGrid: rootDocument.querySelector("#split-grid"),
    statusMessage: rootDocument.querySelector("#status-message")
  };
  const modes = elements.modeButtons.map((button) => button.dataset.mode);
  const fieldGroups = {
    finish: {
      errorElement: elements.finishError,
      inputs: [
        elements.finishHours,
        elements.finishMinutes,
        elements.finishSeconds
      ]
    },
    pace: {
      errorElement: elements.paceError,
      inputs: [elements.paceMinutes, elements.paceSeconds, elements.paceUnit]
    },
    speed: {
      errorElement: elements.speedError,
      inputs: [elements.speedValue, elements.speedUnit]
    }
  };
  const state = {
    lastValidResult: null,
    mode: "pace"
  };

  function populateDistances() {
    elements.distanceSelect.replaceChildren(
      ...DISTANCES.map((distance) => {
        const option = rootDocument.createElement("option");

        option.value = distance.id;
        option.textContent = `${distance.name} (${distance.shortLabel})`;
        return option;
      })
    );

    elements.distanceSelect.value = "10k";
  }

  function populateHeroChips() {
    elements.heroChips.replaceChildren(
      ...DISTANCES.map((distance) => {
        const chip = rootDocument.createElement("span");

        chip.className = "chip";
        chip.textContent = distance.shortLabel;
        return chip;
      })
    );
  }

  function readInput() {
    return {
      distanceId: elements.distanceSelect.value,
      finishHours: elements.finishHours.value,
      finishMinutes: elements.finishMinutes.value,
      finishSeconds: elements.finishSeconds.value,
      mode: state.mode,
      paceMinutes: elements.paceMinutes.value,
      paceSeconds: elements.paceSeconds.value,
      paceUnit: elements.paceUnit.value,
      speedUnit: elements.speedUnit.value,
      speedValue: elements.speedValue.value
    };
  }

  function clearValidation() {
    for (const fieldGroup of Object.values(fieldGroups)) {
      setFieldError(fieldGroup.inputs, fieldGroup.errorElement, "");
    }
  }

  function renderValidation(message) {
    clearValidation();

    if (!message) {
      return;
    }

    const activeGroup = fieldGroups[state.mode];

    setFieldError(activeGroup.inputs, activeGroup.errorElement, message);
  }

  function renderProjectionRows(projections) {
    if (!projections) {
      elements.projectionRows.replaceChildren();
      return;
    }

    elements.projectionRows.replaceChildren(
      ...projections.map((projection) => {
        const row = rootDocument.createElement("tr");
        const distanceCell = rootDocument.createElement("th");
        const finishCell = rootDocument.createElement("td");

        distanceCell.scope = "row";
        distanceCell.textContent = projection.name;
        finishCell.textContent = formatDuration(projection.finishSeconds);

        row.append(distanceCell, finishCell);
        return row;
      })
    );
  }

  function renderSplitGuide(splits) {
    if (!splits) {
      elements.splitGrid.replaceChildren();
      return;
    }

    elements.splitGrid.replaceChildren(
      ...splits.map((split) => {
        const card = rootDocument.createElement("div");
        const label = rootDocument.createElement("p");
        const value = rootDocument.createElement("p");

        card.className = "split-card";
        label.className = "split-card__label";
        value.className = "split-card__value";

        label.textContent = split.label;
        value.textContent = formatDuration(split.finishSeconds);

        card.append(label, value);
        return card;
      })
    );
  }

  function resetOutput(statusMessage) {
    setTextContent(elements.finishValue, "--");
    setTextContent(elements.finishCaption, "Select a distance to begin.");
    setTextContent(elements.paceKmValue, "--");
    setTextContent(elements.paceMiValue, "--");
    setTextContent(elements.speedKmhValue, "--");
    setTextContent(elements.speedMphValue, "--");
    setTextContent(elements.statusMessage, statusMessage);
    elements.statusMessage.classList.add("status-message--error");
    renderProjectionRows(null);
    renderSplitGuide(null);
  }

  function renderResult(result, { stale = false } = {}) {
    setTextContent(elements.finishValue, formatDuration(result.selectedFinishSeconds));
    setTextContent(
      elements.finishCaption,
      `${result.selectedDistance.name} at the ${stale ? "last valid" : "current"} steady effort.`
    );
    setTextContent(
      elements.paceKmValue,
      formatPace(result.pacePerKilometerSeconds, "km")
    );
    setTextContent(
      elements.paceMiValue,
      formatPace(result.pacePerMileSeconds, "mi")
    );
    setTextContent(elements.speedKmhValue, formatSpeed(result.speedKmh, "kmh"));
    setTextContent(elements.speedMphValue, formatSpeed(result.speedKmh, "mph"));

    renderProjectionRows(result.projections);
    renderSplitGuide(result.splits);
  }

  function renderStatus(message, isError) {
    setTextContent(elements.statusMessage, message);
    elements.statusMessage.classList.toggle("status-message--error", isError);
  }

  function render() {
    const result = calculatePerformance(readInput());

    renderValidation(result.error ?? "");

    if (result.error) {
      if (state.lastValidResult) {
        renderResult(state.lastValidResult, { stale: true });
        renderStatus(
          `Showing the last valid projection while you fix the active ${getModeLabel(state.mode)} input. ${result.error}`,
          true
        );
        return;
      }

      resetOutput(`Fix the active input to continue. ${result.error}`);
      return;
    }

    state.lastValidResult = result;
    renderResult(result);
    renderStatus(`Calculated from ${getModeLabel(state.mode)} input.`, false);
  }

  function setMode(nextMode, { focusButton = false } = {}) {
    state.mode = nextMode;

    for (const button of elements.modeButtons) {
      const isActive = button.dataset.mode === nextMode;

      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
      button.tabIndex = isActive ? 0 : -1;

      if (isActive && focusButton) {
        button.focus();
      }
    }

    for (const panel of elements.panels) {
      panel.hidden = panel.dataset.inputPanel !== nextMode;
    }

    render();
  }

  function bindEvents() {
    for (const button of elements.modeButtons) {
      button.addEventListener("click", () => {
        setMode(button.dataset.mode);
      });

      button.addEventListener("keydown", (event) => {
        const nextMode = getModeFromNavigationKey(modes, state.mode, event.key);

        if (!nextMode) {
          return;
        }

        event.preventDefault();
        setMode(nextMode, { focusButton: true });
      });
    }

    const inputs = [
      elements.distanceSelect,
      elements.finishHours,
      elements.finishMinutes,
      elements.finishSeconds,
      elements.paceMinutes,
      elements.paceSeconds,
      elements.paceUnit,
      elements.speedUnit,
      elements.speedValue
    ];

    for (const input of inputs) {
      input.addEventListener("input", render);
      input.addEventListener("change", render);
    }
  }

  populateDistances();
  populateHeroChips();
  bindEvents();
  setMode(state.mode);

  return { elements, render, setMode, state };
}

if (typeof document !== "undefined") {
  createApp(document);
}
