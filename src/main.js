import {
  DISTANCES,
  calculatePerformance,
  formatDuration,
  formatPace,
  formatSpeed
} from "./lib/calculator.js";

const elements = {
  distanceSelect: document.querySelector("#distance-select"),
  finishCaption: document.querySelector("#finish-caption"),
  finishHours: document.querySelector("#finish-hours"),
  finishMinutes: document.querySelector("#finish-minutes"),
  finishSeconds: document.querySelector("#finish-seconds"),
  finishValue: document.querySelector("#finish-value"),
  heroChips: document.querySelector("#hero-chips"),
  modeButtons: document.querySelectorAll("[data-mode-button]"),
  paceKmValue: document.querySelector("#pace-km-value"),
  paceMiValue: document.querySelector("#pace-mi-value"),
  paceMinutes: document.querySelector("#pace-minutes"),
  paceSeconds: document.querySelector("#pace-seconds"),
  paceUnit: document.querySelector("#pace-unit"),
  panels: document.querySelectorAll("[data-input-panel]"),
  projectionRows: document.querySelector("#projection-rows"),
  speedKmhValue: document.querySelector("#speed-kmh-value"),
  speedMphValue: document.querySelector("#speed-mph-value"),
  speedUnit: document.querySelector("#speed-unit"),
  speedValue: document.querySelector("#speed-value"),
  splitGrid: document.querySelector("#split-grid"),
  statusMessage: document.querySelector("#status-message")
};

const state = {
  mode: "pace"
};

function populateDistances() {
  for (const distance of DISTANCES) {
    const option = document.createElement("option");
    option.value = distance.id;
    option.textContent = `${distance.name} (${distance.shortLabel})`;
    elements.distanceSelect.append(option);
  }

  elements.distanceSelect.value = "10k";
}

function populateHeroChips() {
  for (const distance of DISTANCES) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = distance.shortLabel;
    elements.heroChips.append(chip);
  }
}

function setMode(nextMode) {
  state.mode = nextMode;

  for (const button of elements.modeButtons) {
    const isActive = button.dataset.mode === nextMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  for (const panel of elements.panels) {
    panel.hidden = panel.dataset.inputPanel !== nextMode;
  }

  render();
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

function renderProjectionRows(projections) {
  elements.projectionRows.replaceChildren(
    ...projections.map((projection) => {
      const row = document.createElement("tr");
      const distanceCell = document.createElement("th");
      const finishCell = document.createElement("td");

      distanceCell.scope = "row";
      distanceCell.textContent = projection.name;
      finishCell.textContent = formatDuration(projection.finishSeconds);

      row.append(distanceCell, finishCell);
      return row;
    })
  );
}

function renderSplitGuide(splits) {
  elements.splitGrid.replaceChildren(
    ...splits.map((split) => {
      const card = document.createElement("div");
      const label = document.createElement("p");
      const value = document.createElement("p");

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

function resetOutput(message) {
  elements.finishValue.textContent = "--";
  elements.finishCaption.textContent = "Fix the active input to continue.";
  elements.paceKmValue.textContent = "--";
  elements.paceMiValue.textContent = "--";
  elements.speedKmhValue.textContent = "--";
  elements.speedMphValue.textContent = "--";
  elements.projectionRows.replaceChildren();
  elements.splitGrid.replaceChildren();
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.add("status-message--error");
}

function render() {
  const result = calculatePerformance(readInput());

  if (result.error) {
    resetOutput(result.error);
    return;
  }

  elements.finishValue.textContent = formatDuration(result.selectedFinishSeconds);
  elements.finishCaption.textContent = `${result.selectedDistance.name} at the current steady effort.`;
  elements.paceKmValue.textContent = formatPace(
    result.pacePerKilometerSeconds,
    "km"
  );
  elements.paceMiValue.textContent = formatPace(result.pacePerMileSeconds, "mi");
  elements.speedKmhValue.textContent = formatSpeed(result.speedKmh, "kmh");
  elements.speedMphValue.textContent = formatSpeed(result.speedKmh, "mph");
  elements.statusMessage.textContent = `Calculated from ${state.mode.replace(
    "-",
    " "
  )} input.`;
  elements.statusMessage.classList.remove("status-message--error");

  renderProjectionRows(result.projections);
  renderSplitGuide(result.splits);
}

function bindEvents() {
  for (const button of elements.modeButtons) {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
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
render();
