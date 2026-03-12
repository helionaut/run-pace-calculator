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

export function createApp(rootDocument = document) {
  const state = {
    speedKph: paceSecondsToSpeedKph(330, "km"),
    customDistanceKm: 10,
  };

  const elements = {
    paceMinutes: rootDocument.querySelector("#pace-minutes"),
    paceSeconds: rootDocument.querySelector("#pace-seconds"),
    paceUnit: rootDocument.querySelector("#pace-unit"),
    speedValue: rootDocument.querySelector("#speed-value"),
    speedUnit: rootDocument.querySelector("#speed-unit"),
    distanceValue: rootDocument.querySelector("#distance-value"),
    distanceUnit: rootDocument.querySelector("#distance-unit"),
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

  function getPaceSecondsFromInputs() {
    const minutes = Number(elements.paceMinutes.value);
    const seconds = Number(elements.paceSeconds.value);

    if (
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      !Number.isFinite(seconds) ||
      seconds < 0
    ) {
      return null;
    }

    return Math.floor(minutes) * 60 + Math.floor(seconds);
  }

  function commitPaceInputs() {
    const totalSeconds = getPaceSecondsFromInputs();

    if (!totalSeconds) {
      return;
    }

    const nextSpeed = paceSecondsToSpeedKph(
      totalSeconds,
      elements.paceUnit.value,
    );

    if (Number.isFinite(nextSpeed)) {
      state.speedKph = nextSpeed;
      render();
    }
  }

  function commitSpeedInput() {
    const rawValue = Number(elements.speedValue.value);

    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      return;
    }

    state.speedKph =
      elements.speedUnit.value === "mph"
        ? convertSpeed(rawValue, "mi", "km")
        : rawValue;

    render();
  }

  function commitDistanceInput() {
    const rawValue = Number(elements.distanceValue.value);
    const nextDistance = distanceToKm(rawValue, elements.distanceUnit.value);

    if (Number.isFinite(nextDistance)) {
      state.customDistanceKm = nextDistance;
      render();
    }
  }

  function setPaceInputs(speedKph) {
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
    const displayedSpeed =
      elements.speedUnit.value === "mph"
        ? convertSpeed(speedKph, "km", "mi")
        : speedKph;

    elements.speedValue.value = formatNumber(displayedSpeed);
  }

  function setDistanceInput(distanceKm) {
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
    elements.statusLine.textContent = `${paceKm} equals ${paceMi} at ${formatNumber(speedKph)} km/h or ${formatNumber(speedMph)} mph.`;
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

  for (const input of [
    elements.paceMinutes,
    elements.paceSeconds,
    elements.speedValue,
    elements.distanceValue,
  ]) {
    input.addEventListener("blur", render);
  }

  render();

  return { elements, render, state };
}

if (typeof document !== "undefined") {
  createApp(document);
}
