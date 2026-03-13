import {
  COMMON_RACES,
  describeFinishCaption,
  deriveCalculatorState,
  findRacePreset,
  formatDistance,
  formatDuration,
  formatPace,
  formatSpeed,
} from "./calculator.js";

const elements = {
  distanceError: document.querySelector("#distance-error"),
  distanceInput: document.querySelector("#distance"),
  finishCaption: document.querySelector("#finish-caption"),
  finishOutput: document.querySelector("#finish-output"),
  paceError: document.querySelector("#pace-error"),
  paceInput: document.querySelector("#pace"),
  paceOutput: document.querySelector("#pace-output"),
  projections: document.querySelector("#projections"),
  resetButton: document.querySelector("#reset-button"),
  sourceBadge: document.querySelector("#source-badge"),
  speedError: document.querySelector("#speed-error"),
  speedInput: document.querySelector("#speed"),
  speedOutput: document.querySelector("#speed-output"),
};

const state = {
  lastEdited: "pace",
};

function pairField(input, error) {
  return { error, input };
}

const fieldPairs = [
  pairField(elements.paceInput, elements.paceError),
  pairField(elements.speedInput, elements.speedError),
  pairField(elements.distanceInput, elements.distanceError),
];

function renderProjectionCards() {
  elements.projections.innerHTML = COMMON_RACES.map((race) => `
    <button
      class="projection-card"
      data-preset-distance="${race.distanceKm}"
      type="button"
    >
      <span class="projection-label">${race.label}</span>
      <span class="projection-detail">${race.detail}</span>
      <strong class="projection-time" data-projection-time="${race.id}">—</strong>
      <span class="projection-distance">${formatDistance(race.distanceKm)}</span>
    </button>
  `).join("");
}

function setError(element, message) {
  element.textContent = message ?? "";
  element.classList.toggle("is-visible", Boolean(message));

  const matchingField = fieldPairs.find((field) => field.error === element);

  if (matchingField) {
    matchingField.input.setAttribute("aria-invalid", String(Boolean(message)));
  }
}

function updatePresetSelection(distanceKm) {
  const preset = findRacePreset(distanceKm);
  const activeDistance = preset?.distanceKm;

  document.querySelectorAll("[data-preset-distance]").forEach((button) => {
    const isSelected = Number(button.dataset.presetDistance) === activeDistance;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function updateProjectionTimes(projections) {
  projections.forEach((projection) => {
    const timeSlot = document.querySelector(`[data-projection-time="${projection.id}"]`);
    const card = timeSlot?.closest(".projection-card");

    if (!timeSlot || !card) {
      return;
    }

    timeSlot.textContent = formatDuration(projection.finishSeconds);
    card.classList.toggle("is-selected", projection.isSelected);
  });
}

function updateOutputs() {
  const snapshot = deriveCalculatorState({
    distanceInput: elements.distanceInput.value,
    paceInput: elements.paceInput.value,
    source: state.lastEdited,
    speedInput: elements.speedInput.value,
  });

  setError(elements.paceError, snapshot.errors.pace);
  setError(elements.speedError, snapshot.errors.speed);
  setError(elements.distanceError, snapshot.errors.distance);

  elements.sourceBadge.textContent = snapshot.status;
  elements.paceOutput.textContent = formatPace(snapshot.metrics.paceSeconds);
  elements.speedOutput.textContent = formatSpeed(snapshot.metrics.speedKmh);
  elements.finishOutput.textContent = formatDuration(snapshot.metrics.finishSeconds);
  elements.finishCaption.textContent = describeFinishCaption({
    distanceError: snapshot.errors.distance,
    distanceKm: snapshot.metrics.distanceKm,
    finishSeconds: snapshot.metrics.finishSeconds,
    paceError: snapshot.errors.pace,
    speedError: snapshot.errors.speed,
    speedKmh: snapshot.metrics.speedKmh,
  });

  updatePresetSelection(snapshot.metrics.distanceKm);
  updateProjectionTimes(snapshot.projections);
}

function setDistance(distanceKm) {
  elements.distanceInput.value = String(distanceKm);
  updateOutputs();
}

function bindEvents() {
  elements.paceInput.addEventListener("input", () => {
    state.lastEdited = "pace";
    updateOutputs();
  });

  elements.speedInput.addEventListener("input", () => {
    state.lastEdited = "speed";
    updateOutputs();
  });

  elements.distanceInput.addEventListener("input", updateOutputs);

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset-distance]");

    if (!button) {
      return;
    }

    setDistance(button.dataset.presetDistance);
  });

  elements.resetButton.addEventListener("click", () => {
    elements.paceInput.value = "5:00";
    elements.speedInput.value = "";
    elements.distanceInput.value = "10";
    state.lastEdited = "pace";
    updateOutputs();
  });
}

renderProjectionCards();
bindEvents();
elements.paceInput.value = "5:00";
elements.distanceInput.value = "10";
updateOutputs();
