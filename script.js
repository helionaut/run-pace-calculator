import {
  COMMON_DISTANCES,
  convertSpeed,
  distanceToKm,
  formatDistance,
  formatDuration,
  formatPace,
  paceSecondsToSpeedKph,
  predictedTimeSeconds,
  speedKphToPaceSeconds,
  splitPaceSeconds,
} from "./calculator.js";

function formatNumber(value, digits = 2) {
  return value
    .toFixed(digits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function readNumberInput(element) {
  const rawValue = element.value.trim();

  if (rawValue === "") {
    return Number.NaN;
  }

  return Number(rawValue);
}

export function createApp(rootDocument = document) {
  const state = {
    speedKph: paceSecondsToSpeedKph(330, "km"),
    customDistanceKm: 10,
    errors: {
      pace: "",
      speed: "",
      distance: "",
    },
  };

  const elements = {
    paceMinutes: rootDocument.querySelector("#pace-minutes"),
    paceSeconds: rootDocument.querySelector("#pace-seconds"),
    paceUnit: rootDocument.querySelector("#pace-unit"),
    paceMessage: rootDocument.querySelector("#pace-message"),
    speedValue: rootDocument.querySelector("#speed-value"),
    speedUnit: rootDocument.querySelector("#speed-unit"),
    speedMessage: rootDocument.querySelector("#speed-message"),
    distanceValue: rootDocument.querySelector("#distance-value"),
    distanceUnit: rootDocument.querySelector("#distance-unit"),
    distanceMessage: rootDocument.querySelector("#distance-message"),
    statusLine: rootDocument.querySelector("#status-line"),
    customDistanceLabel: rootDocument.querySelector("#custom-distance-label"),
    customFinish: rootDocument.querySelector("#custom-finish"),
    customDetail: rootDocument.querySelector("#custom-detail"),
    heroPace: rootDocument.querySelector("#hero-pace"),
    heroSpeed: rootDocument.querySelector("#hero-speed"),
    paceKmValue: rootDocument.querySelector("#pace-km-value"),
    paceKmDetail: rootDocument.querySelector("#pace-km-detail"),
    paceMiValue: rootDocument.querySelector("#pace-mi-value"),
    paceMiDetail: rootDocument.querySelector("#pace-mi-detail"),
    speedKmValue: rootDocument.querySelector("#speed-km-value"),
    speedKmDetail: rootDocument.querySelector("#speed-km-detail"),
    speedMiValue: rootDocument.querySelector("#speed-mi-value"),
    speedMiDetail: rootDocument.querySelector("#speed-mi-detail"),
    predictionTableBody: rootDocument.querySelector("#prediction-table-body"),
  };

  function setInvalidState(inputs, messageElement, message) {
    const isInvalid = message.length > 0;

    for (const input of inputs) {
      if (isInvalid) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    }

    messageElement.textContent = message;
    messageElement.setAttribute(
      "data-state",
      isInvalid ? "error" : "default",
    );
  }

  function syncValidationUi() {
    setInvalidState(
      [elements.paceMinutes, elements.paceSeconds],
      elements.paceMessage,
      state.errors.pace,
    );
    setInvalidState(
      [elements.speedValue],
      elements.speedMessage,
      state.errors.speed,
    );
    setInvalidState(
      [elements.distanceValue],
      elements.distanceMessage,
      state.errors.distance,
    );
  }

  function getPaceSecondsFromInputs() {
    const minutes = readNumberInput(elements.paceMinutes);
    const seconds = readNumberInput(elements.paceSeconds);

    if (
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      !Number.isInteger(minutes) ||
      !Number.isFinite(seconds) ||
      seconds < 0 ||
      seconds > 59 ||
      !Number.isInteger(seconds)
    ) {
      return null;
    }

    const totalSeconds = Math.floor(minutes) * 60 + Math.floor(seconds);

    return totalSeconds > 0 ? totalSeconds : null;
  }

  function commitPaceInputs() {
    const totalSeconds = getPaceSecondsFromInputs();

    if (!totalSeconds) {
      state.errors.pace =
        "Enter a pace greater than 0:00 with whole seconds from 0 to 59.";
      syncValidationUi();
      render();
      return;
    }

    const nextSpeed = paceSecondsToSpeedKph(
      totalSeconds,
      elements.paceUnit.value,
    );

    if (Number.isFinite(nextSpeed)) {
      state.errors.pace = "";
      state.speedKph = nextSpeed;
      syncValidationUi();
      render();
    }
  }

  function commitSpeedInput() {
    const rawValue = readNumberInput(elements.speedValue);

    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      state.errors.speed = "Enter a speed greater than 0.";
      syncValidationUi();
      render();
      return;
    }

    state.errors.speed = "";
    state.speedKph =
      elements.speedUnit.value === "mph"
        ? convertSpeed(rawValue, "mi", "km")
        : rawValue;

    syncValidationUi();
    render();
  }

  function commitDistanceInput() {
    const rawValue = readNumberInput(elements.distanceValue);
    const nextDistance = distanceToKm(rawValue, elements.distanceUnit.value);

    if (Number.isFinite(nextDistance)) {
      state.errors.distance = "";
      state.customDistanceKm = nextDistance;
      syncValidationUi();
      render();
      return;
    }

    state.errors.distance = "Enter a distance greater than 0.";
    syncValidationUi();
    render();
  }

  function setPaceInputs(speedKph) {
    if (state.errors.pace) {
      return;
    }

    const parts = splitPaceSeconds(
      speedKphToPaceSeconds(speedKph, elements.paceUnit.value),
    );

    if (!parts) {
      return;
    }

    elements.paceMinutes.value = String(parts.minutes);
    elements.paceSeconds.value = String(parts.seconds).padStart(2, "0");
  }

  function setSpeedInput(speedKph) {
    if (state.errors.speed) {
      return;
    }

    const displayedSpeed =
      elements.speedUnit.value === "mph"
        ? convertSpeed(speedKph, "km", "mi")
        : speedKph;

    elements.speedValue.value = formatNumber(displayedSpeed);
  }

  function setDistanceInput(distanceKm) {
    if (state.errors.distance) {
      return;
    }

    const displayedDistance =
      elements.distanceUnit.value === "mi"
        ? convertSpeed(distanceKm, "km", "mi")
        : distanceKm;

    elements.distanceValue.value = formatNumber(displayedDistance);
  }

  function renderPredictionTable(speedKph) {
    const tableRows = [
      ...COMMON_DISTANCES,
      {
        label: "Custom",
        distanceKm: state.customDistanceKm,
        display: formatDistance(state.customDistanceKm, elements.distanceUnit.value),
      },
    ];

    elements.predictionTableBody.replaceChildren(
      ...tableRows.map((row) => {
        const tableRow = rootDocument.createElement("tr");
        const finish = formatDuration(
          predictedTimeSeconds(speedKph, row.distanceKm),
        );

        tableRow.innerHTML = `
        <th scope="row">${row.label}</th>
        <td>${row.display}</td>
        <td>${finish}</td>
      `;

        return tableRow;
      }),
    );
  }

  function render() {
    const speedKph = state.speedKph;
    const speedMph = convertSpeed(speedKph, "km", "mi");
    const paceKm = formatPace(speedKph, "km");
    const paceMi = formatPace(speedKph, "mi");
    const errorCount = Object.values(state.errors).filter(Boolean).length;
    const customDistanceLabel = formatDistance(
      state.customDistanceKm,
      elements.distanceUnit.value,
    );
    const customFinish = formatDuration(
      predictedTimeSeconds(speedKph, state.customDistanceKm),
    );

    setPaceInputs(speedKph);
    setSpeedInput(speedKph);
    setDistanceInput(state.customDistanceKm);
    renderPredictionTable(speedKph);

    elements.heroPace.textContent = paceKm;
    elements.heroSpeed.textContent = `${formatNumber(speedKph)} km/h`;
    elements.statusLine.textContent = errorCount > 0
      ? `Showing the last valid projection while you correct the marked ${errorCount === 1 ? "field" : "fields"}.`
      : `${paceKm} equals ${paceMi} at ${formatNumber(speedKph)} km/h or ${formatNumber(speedMph)} mph.`;
    elements.statusLine.setAttribute(
      "data-state",
      errorCount > 0 ? "error" : "default",
    );
    elements.customDistanceLabel.textContent = customDistanceLabel;
    elements.customFinish.textContent = customFinish;
    elements.customDetail.textContent = `Based on ${paceKm} or ${formatNumber(speedMph)} mph.`;

    elements.paceKmValue.textContent = paceKm;
    elements.paceKmDetail.textContent = `${formatNumber(speedKph)} km/h`;
    elements.paceMiValue.textContent = paceMi;
    elements.paceMiDetail.textContent = `${formatNumber(speedMph)} mph`;
    elements.speedKmValue.textContent = `${formatNumber(speedKph)} km/h`;
    elements.speedKmDetail.textContent = paceKm;
    elements.speedMiValue.textContent = `${formatNumber(speedMph)} mph`;
    elements.speedMiDetail.textContent = paceMi;
  }

  elements.paceMinutes.addEventListener("input", commitPaceInputs);
  elements.paceSeconds.addEventListener("input", commitPaceInputs);
  elements.paceUnit.addEventListener("change", render);
  elements.speedValue.addEventListener("input", commitSpeedInput);
  elements.speedUnit.addEventListener("change", render);
  elements.distanceValue.addEventListener("input", commitDistanceInput);
  elements.distanceUnit.addEventListener("change", render);

  render();
  syncValidationUi();

  return { elements, render, state };
}

if (typeof document !== "undefined") {
  createApp(document);
}
