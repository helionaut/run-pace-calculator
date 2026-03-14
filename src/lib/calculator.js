export const KM_PER_MILE = 1.609344;
export const MAX_DISTANCE = 1000;
export const MAX_DISTANCE_DECIMALS = 5;
export const MAX_SPEED = 60;
export const RESULT_PLACEHOLDER = "Enter any two values to solve the third.";
const SLIDER_DISTANCE_DECIMALS = 2;

export const DRIVER_METRICS = Object.freeze({
  PACE: "pace",
  SPEED: "speed",
  TIME: "time"
});

const SOLVE_METRICS = Object.freeze({
  DISTANCE: "distance",
  RATE: "rate",
  TIME: "time"
});

const RATE_INPUT_MODES = Object.freeze({
  PACE: "pace",
  SPEED: "speed"
});

export const DISTANCE_PRESETS = Object.freeze([
  { id: "custom", label: "Custom", distanceKm: null },
  { id: "5k", label: "5K", distanceKm: 5 },
  { id: "10k", label: "10K", distanceKm: 10 },
  { id: "half", label: "Half Marathon", distanceKm: 21.0975 },
  { id: "marathon", label: "Marathon", distanceKm: 42.195 }
]);
const QUICK_DISTANCE_PRESETS = Object.freeze({
  km: Object.freeze([
    { id: "100m", label: "100m", distanceKm: 0.1 },
    { id: "500m", label: "500m", distanceKm: 0.5 },
    { id: "1k", label: "1 km", distanceKm: 1 },
    { id: "5k", label: "5K", distanceKm: 5 },
    { id: "10k", label: "10K", distanceKm: 10 },
    { id: "half", label: "Half", distanceKm: 21.0975 },
    { id: "marathon", label: "Marathon", distanceKm: 42.195 }
  ]),
  mi: Object.freeze([
    { id: "0.1mi", label: "0.1 mi", distanceKm: 0.1 * KM_PER_MILE },
    { id: "0.5mi", label: "0.5 mi", distanceKm: 0.5 * KM_PER_MILE },
    { id: "1mi", label: "1 mi", distanceKm: 1 * KM_PER_MILE },
    { id: "5mi", label: "5 mi", distanceKm: 5 * KM_PER_MILE },
    { id: "10mi", label: "10 mi", distanceKm: 10 * KM_PER_MILE },
    { id: "half", label: "Half", distanceKm: 13.1 * KM_PER_MILE },
    { id: "marathon", label: "Marathon", distanceKm: 26.2 * KM_PER_MILE }
  ])
});

const DEFAULT_EDIT_ORDER = Object.freeze([
  SOLVE_METRICS.TIME,
  SOLVE_METRICS.RATE,
  SOLVE_METRICS.DISTANCE
]);
const DEFAULT_PRESET_ID = "10k";
const ALL_QUICK_DISTANCE_PRESETS = Object.freeze(
  Object.values(QUICK_DISTANCE_PRESETS).flat()
);
const SUPPORTED_PRESET_IDS = new Set([
  "custom",
  ...ALL_QUICK_DISTANCE_PRESETS.map((preset) => preset.id)
]);
const DISPLAY_METRIC_ORDER = Object.freeze({
  [SOLVE_METRICS.DISTANCE]: 0,
  [SOLVE_METRICS.RATE]: 1,
  [SOLVE_METRICS.TIME]: 2
});
const PRESET_MATCH_TOLERANCE = 1e-5;
const SLIDER_BASE_MAX = 60;
const SLIDER_MIN = 0.5;
const SLIDER_STEP = "0.01";
const URL_STATE_KEYS = Object.freeze({
  DISTANCE: "distance",
  PACE_MINUTES: "pm",
  PACE_SECONDS: "ps",
  PRESET: "preset",
  RATE_MODE: "rate",
  SOLVE: "solve",
  SPEED: "speed",
  TIME_HOURS: "th",
  TIME_MINUTES: "tm",
  TIME_SECONDS: "ts",
  UNIT: "unit"
});
const URL_STATE_KEY_SET = new Set(Object.values(URL_STATE_KEYS));
const VALID_RATE_INPUT_MODES = Object.values(RATE_INPUT_MODES);
const VALID_SOLVE_METRICS = Object.values(SOLVE_METRICS);
const VALID_UNITS = Object.freeze(["km", "mi"]);

function trimValue(value) {
  return String(value ?? "").trim();
}

function hasValue(value) {
  return trimValue(value) !== "";
}

function isWholeNumberText(value) {
  return /^\d+$/.test(value);
}

function isDecimalText(value) {
  return /^\d+(?:\.\d+)?$/.test(value);
}

function trimTrailingZeroes(value) {
  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function padTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function unitDistanceKm(unit) {
  return unit === "mi" ? KM_PER_MILE : 1;
}

function hasAnyUrlState(params) {
  return [...URL_STATE_KEY_SET].some((key) => params.has(key));
}

function hasUnexpectedUrlStateKeys(params, allowedKeys) {
  for (const key of URL_STATE_KEY_SET) {
    if (params.has(key) && !allowedKeys.has(key)) {
      return true;
    }
  }

  return false;
}

function createUrlSearchParams(searchParams) {
  if (searchParams instanceof URLSearchParams) {
    return searchParams;
  }

  return new URLSearchParams(searchParams);
}

function almostEqual(a, b) {
  return Math.abs(a - b) <= PRESET_MATCH_TOLERANCE;
}

function moveSolveMetricToEnd(editOrder, metric) {
  return [...editOrder.filter((item) => item !== metric), metric];
}

function getSolveMetricForDriverMetric(metric) {
  if (
    metric === DRIVER_METRICS.PACE ||
    metric === DRIVER_METRICS.SPEED
  ) {
    return SOLVE_METRICS.RATE;
  }

  if (metric === DRIVER_METRICS.TIME) {
    return SOLVE_METRICS.TIME;
  }

  return null;
}

function getSolveMetricForField(field) {
  if (field === "distance") {
    return SOLVE_METRICS.DISTANCE;
  }

  if (
    field === "paceMinutes" ||
    field === "paceSeconds" ||
    field === "speed"
  ) {
    return SOLVE_METRICS.RATE;
  }

  if (
    field === "timeHours" ||
    field === "timeMinutes" ||
    field === "timeSeconds"
  ) {
    return SOLVE_METRICS.TIME;
  }

  return null;
}

function hasRateInput(state) {
  return state.rateInputMode === RATE_INPUT_MODES.SPEED
    ? hasValue(state.inputs.speed)
    : hasValue(state.inputs.paceMinutes) || hasValue(state.inputs.paceSeconds);
}

function hasTimeInput(state) {
  return (
    hasValue(state.inputs.timeHours) ||
    hasValue(state.inputs.timeMinutes) ||
    hasValue(state.inputs.timeSeconds)
  );
}

function getSourcePair(state) {
  return state.editOrder.slice(-2);
}

function getDerivedSolveMetric(sourcePair) {
  return VALID_SOLVE_METRICS.find((metric) => !sourcePair.includes(metric)) ?? null;
}

function normalizeSolvePair(rawPair) {
  const pair = String(rawPair ?? "")
    .split("-")
    .filter(Boolean);

  if (
    pair.length !== 2 ||
    new Set(pair).size !== 2 ||
    pair.some((metric) => !VALID_SOLVE_METRICS.includes(metric))
  ) {
    return null;
  }

  return pair;
}

function buildEditOrder(sourcePair) {
  const derivedMetric = getDerivedSolveMetric(sourcePair);

  return derivedMetric === null
    ? [...DEFAULT_EDIT_ORDER]
    : [derivedMetric, ...sourcePair];
}

function sortSolveMetrics(metrics) {
  return [...metrics].sort(
    (left, right) => DISPLAY_METRIC_ORDER[left] - DISPLAY_METRIC_ORDER[right]
  );
}

function formatSolveMetricLabel(metric) {
  if (metric === SOLVE_METRICS.RATE) {
    return "movement rate";
  }

  return metric;
}

function formatPaceFields(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return {
      minutes: "",
      seconds: ""
    };
  }

  const rounded = Math.round(totalSeconds);

  return {
    minutes: String(Math.floor(rounded / 60)),
    seconds: padTwoDigits(rounded % 60)
  };
}

function formatTimeFields(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return {
      hours: "",
      minutes: "",
      seconds: ""
    };
  }

  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  return {
    hours: String(hours),
    minutes: padTwoDigits(minutes),
    seconds: padTwoDigits(seconds)
  };
}

export function getPresetById(id) {
  return (
    getQuickDistancePresets("km").find((preset) => preset.id === id) ??
    ALL_QUICK_DISTANCE_PRESETS.find((preset) => preset.id === id) ??
    DISTANCE_PRESETS[0]
  );
}

function getDefaultPreset() {
  return getPresetById(DEFAULT_PRESET_ID);
}

function isSupportedPresetId(presetId) {
  return SUPPORTED_PRESET_IDS.has(presetId);
}

function isSupportedRateInputMode(mode) {
  return VALID_RATE_INPUT_MODES.includes(mode);
}

function isSupportedUnit(unit) {
  return VALID_UNITS.includes(unit);
}

function getQuickDistancePresets(unit = "km") {
  return QUICK_DISTANCE_PRESETS[unit] ?? QUICK_DISTANCE_PRESETS.km;
}

function getPresetIdForDistanceKm(distanceKm, unit = "km") {
  return (
    getQuickDistancePresets(unit).find(
      (preset) =>
        preset.distanceKm !== null && almostEqual(preset.distanceKm, distanceKm)
    )?.id ?? "custom"
  );
}

export function createFormState() {
  const preset = getDefaultPreset();

  return {
    canonicalDistanceKm: preset.distanceKm,
    canonicalSpeedKmh: null,
    editOrder: [...DEFAULT_EDIT_ORDER],
    inputs: {
      distance: formatDistanceInputValue(preset.distanceKm, "km"),
      paceMinutes: "",
      paceSeconds: "",
      speed: "",
      timeHours: "",
      timeMinutes: "",
      timeSeconds: ""
    },
    presetId: preset.id,
    rateInputMode: RATE_INPUT_MODES.PACE,
    unit: "km"
  };
}

export function distanceFromKilometers(distanceKm, unit = "km") {
  return distanceKm / unitDistanceKm(unit);
}

export function distanceToKilometers(distance, unit = "km") {
  return distance * unitDistanceKm(unit);
}

export function toKilometersPerHour(speed, unit = "km") {
  return unit === "mi" ? speed * KM_PER_MILE : speed;
}

export function fromKilometersPerHour(speedKmh, unit = "km") {
  return unit === "mi" ? speedKmh / KM_PER_MILE : speedKmh;
}

export function finishTimeFromSpeed(speedKmh, distanceKm) {
  return (distanceKm / speedKmh) * 3600;
}

export function speedFromFinishTime(totalSeconds, distanceKm) {
  return distanceKm / (totalSeconds / 3600);
}

export function paceToSpeedKmh(paceSecondsPerUnit, unit = "km") {
  return unitDistanceKm(unit) / (paceSecondsPerUnit / 3600);
}

export function speedToPaceSeconds(speedKmh, unit = "km") {
  return (unitDistanceKm(unit) / speedKmh) * 3600;
}

export function formatEditableNumber(value, maxDecimals) {
  return trimTrailingZeroes(value.toFixed(maxDecimals));
}

export function formatDistanceInputValue(
  distanceKm,
  unit = "km",
  maxDecimals = MAX_DISTANCE_DECIMALS
) {
  return formatEditableNumber(distanceFromKilometers(distanceKm, unit), maxDecimals);
}

export function formatSpeedInputValue(speedInUnit) {
  return formatEditableNumber(speedInUnit, 2);
}

export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "--:--:--";
  }

  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  return `${padTwoDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
}

export function formatPace(totalSeconds, unit = "km") {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return `--:-- /${unit}`;
  }

  const rounded = Math.round(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return `${padTwoDigits(minutes)}:${padTwoDigits(seconds)} /${unit}`;
}

export function formatSpeed(speedKmh, unit = "km") {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) {
    return unit === "mi" ? "--.-- mph" : "--.-- km/h";
  }

  const suffix = unit === "mi" ? "mph" : "km/h";
  const speedInUnit = fromKilometersPerHour(speedKmh, unit);

  return `${speedInUnit.toFixed(2)} ${suffix}`;
}

export function formatDistance(distanceKm, unit = "km") {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return `-- ${unit}`;
  }

  return `${formatDistanceInputValue(distanceKm, unit)} ${unit}`;
}

export function parseDistanceInput(value, { showRequiredError = true } = {}) {
  const raw = trimValue(value);

  if (raw === "") {
    return {
      error: showRequiredError ? "Enter a distance." : null,
      value: null
    };
  }

  if (!isDecimalText(raw)) {
    return {
      error: "Distance must use digits and one decimal point only.",
      value: null
    };
  }

  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;

  if (decimals > MAX_DISTANCE_DECIMALS) {
    return {
      error: "Distance must use 5 decimal places or fewer.",
      value: null
    };
  }

  const numericValue = Number(raw);

  if (
    !Number.isFinite(numericValue) ||
    numericValue <= 0 ||
    numericValue > MAX_DISTANCE
  ) {
    return {
      error: "Distance must be greater than 0 and no more than 1000.",
      value: null
    };
  }

  return {
    error: null,
    value: numericValue
  };
}

export function parsePaceInput(inputs, { showRequiredError = true } = {}) {
  const minutesRaw = trimValue(inputs.paceMinutes);
  const secondsRaw = trimValue(inputs.paceSeconds);
  const hasAnyInput = minutesRaw !== "" || secondsRaw !== "";

  if (!hasAnyInput) {
    return {
      error: showRequiredError ? "Enter pace minutes and seconds." : null,
      value: null
    };
  }

  if (minutesRaw === "" || secondsRaw === "") {
    return {
      error: "Complete pace minutes and seconds.",
      value: null
    };
  }

  if (!isWholeNumberText(minutesRaw) || !isWholeNumberText(secondsRaw)) {
    return {
      error: "Use whole numbers for pace minutes and seconds.",
      value: null
    };
  }

  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);

  if (minutes < 0) {
    return {
      error: "Pace minutes must be 0 or greater.",
      value: null
    };
  }

  if (seconds < 0 || seconds > 59) {
    return {
      error: "Pace seconds must stay between 0 and 59.",
      value: null
    };
  }

  if (minutes === 0 && seconds === 0) {
    return {
      error: "Pace must be greater than 00:00.",
      value: null
    };
  }

  return {
    error: null,
    value: (minutes * 60) + seconds
  };
}

export function parseTimeInput(inputs, { showRequiredError = true } = {}) {
  const hoursRaw = trimValue(inputs.timeHours);
  const minutesRaw = trimValue(inputs.timeMinutes);
  const secondsRaw = trimValue(inputs.timeSeconds);
  const hasAnyInput =
    hoursRaw !== "" || minutesRaw !== "" || secondsRaw !== "";

  if (!hasAnyInput) {
    return {
      error: showRequiredError ? "Enter finish hours, minutes, and seconds." : null,
      value: null
    };
  }

  if (hoursRaw === "" || minutesRaw === "" || secondsRaw === "") {
    return {
      error: "Complete finish hours, minutes, and seconds.",
      value: null
    };
  }

  if (
    !isWholeNumberText(hoursRaw) ||
    !isWholeNumberText(minutesRaw) ||
    !isWholeNumberText(secondsRaw)
  ) {
    return {
      error: "Use whole numbers for finish hours, minutes, and seconds.",
      value: null
    };
  }

  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);

  if (hours < 0 || hours > 99) {
    return {
      error: "Finish hours must stay between 0 and 99.",
      value: null
    };
  }

  if (minutes < 0 || minutes > 59) {
    return {
      error: "Finish minutes must stay between 0 and 59.",
      value: null
    };
  }

  if (seconds < 0 || seconds > 59) {
    return {
      error: "Finish seconds must stay between 0 and 59.",
      value: null
    };
  }

  if (hours === 0 && minutes === 0 && seconds === 0) {
    return {
      error: "Finish time must be greater than 00:00:00.",
      value: null
    };
  }

  return {
    error: null,
    value: (hours * 3600) + (minutes * 60) + seconds
  };
}

export function parseFinishInput(inputs, options) {
  return parseTimeInput(inputs, options);
}

export function parseSpeedInput(value, { showRequiredError = true } = {}) {
  const raw = trimValue(value);

  if (raw === "") {
    return {
      error: showRequiredError ? "Enter a speed." : null,
      value: null
    };
  }

  if (!isDecimalText(raw)) {
    return {
      error: "Speed must use digits and one decimal point only.",
      value: null
    };
  }

  const numericValue = Number(raw);

  if (
    !Number.isFinite(numericValue) ||
    numericValue <= 0 ||
    numericValue > MAX_SPEED
  ) {
    return {
      error: "Speed must be greater than 0 and no more than 60.",
      value: null
    };
  }

  return {
    error: null,
    value: numericValue
  };
}

function parseRateInput(state, { showRequiredError = true } = {}) {
  if (state.rateInputMode === RATE_INPUT_MODES.SPEED) {
    const speed = parseSpeedInput(state.inputs.speed, {
      showRequiredError
    });

    return {
      error: speed.error,
      speedKmh:
        !speed.error && speed.value !== null
          ? toKilometersPerHour(speed.value, state.unit)
          : null
    };
  }

  const pace = parsePaceInput(state.inputs, {
    showRequiredError
  });

  return {
    error: pace.error,
    speedKmh:
      !pace.error && pace.value !== null
        ? paceToSpeedKmh(pace.value, state.unit)
        : null
  };
}

function buildProjectionRows(speedKmh) {
  return DISTANCE_PRESETS.filter((preset) => preset.distanceKm !== null).map(
    (preset) => ({
      finishLabel:
        Number.isFinite(speedKmh) && speedKmh > 0
          ? formatDuration(finishTimeFromSpeed(speedKmh, preset.distanceKm))
          : "--:--:--",
      id: preset.id
    })
  );
}

function getSliderMaximum(distanceKm, unit) {
  const safeDistanceKm =
    Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : SLIDER_BASE_MAX;

  return formatEditableNumber(
    Math.max(SLIDER_BASE_MAX, distanceFromKilometers(safeDistanceKm, unit)),
    SLIDER_DISTANCE_DECIMALS
  );
}

function deriveCalculation(state, { preferCanonicalRate = true } = {}) {
  const sourcePair = getSourcePair(state);
  const distance = parseDistanceInput(state.inputs.distance, {
    showRequiredError: false
  });
  const rate = parseRateInput(state, {
    showRequiredError: false
  });
  const time = parseTimeInput(state.inputs, {
    showRequiredError: false
  });

  const parsedDistanceKm =
    !distance.error && distance.value !== null
      ? distanceToKilometers(distance.value, state.unit)
      : null;
  const parsedSpeedKmh =
    !rate.error && rate.speedKmh !== null ? rate.speedKmh : null;
  const parsedTimeSeconds =
    !time.error && time.value !== null ? time.value : null;
  const sourceValues = {
    [SOLVE_METRICS.DISTANCE]: parsedDistanceKm,
    [SOLVE_METRICS.RATE]: parsedSpeedKmh,
    [SOLVE_METRICS.TIME]: parsedTimeSeconds
  };

  if (
    preferCanonicalRate &&
    sourcePair.includes(SOLVE_METRICS.RATE) &&
    parsedSpeedKmh !== null &&
    Number.isFinite(state.canonicalSpeedKmh) &&
    state.canonicalSpeedKmh > 0
  ) {
    sourceValues[SOLVE_METRICS.RATE] = state.canonicalSpeedKmh;
  }
  const sourceValid = sourcePair.every(
    (metric) => sourceValues[metric] !== null
  );
  const derivedMetric = sourceValid ? getDerivedSolveMetric(sourcePair) : null;
  let displayDistanceKm = parsedDistanceKm;
  let displaySpeedKmh = parsedSpeedKmh;
  let displayTimeSeconds = parsedTimeSeconds;

  if (
    sourcePair.includes(SOLVE_METRICS.RATE) &&
    sourceValues[SOLVE_METRICS.RATE] !== null
  ) {
    displaySpeedKmh = sourceValues[SOLVE_METRICS.RATE];
  }

  if (sourceValid && derivedMetric === SOLVE_METRICS.DISTANCE) {
    displayDistanceKm =
      (sourceValues[SOLVE_METRICS.TIME] / 3600) *
      sourceValues[SOLVE_METRICS.RATE];
  }

  if (sourceValid && derivedMetric === SOLVE_METRICS.RATE) {
    displaySpeedKmh = speedFromFinishTime(
      sourceValues[SOLVE_METRICS.TIME],
      sourceValues[SOLVE_METRICS.DISTANCE]
    );
  }

  if (sourceValid && derivedMetric === SOLVE_METRICS.TIME) {
    displayTimeSeconds = finishTimeFromSpeed(
      sourceValues[SOLVE_METRICS.RATE],
      sourceValues[SOLVE_METRICS.DISTANCE]
    );
  }

  if (displayDistanceKm === null) {
    displayDistanceKm = state.canonicalDistanceKm;
  }

  return {
    derivedMetric,
    displayDistanceKm,
    displaySpeedKmh,
    displayTimeSeconds,
    hasLiveResult: derivedMetric !== null,
    parsedDistanceKm,
    parsedSpeedKmh,
    parsedTimeSeconds,
    sourcePair
  };
}

function syncCanonicalSpeed(state) {
  const calculation = deriveCalculation(state, {
    preferCanonicalRate: false
  });

  return {
    ...state,
    canonicalSpeedKmh:
      Number.isFinite(calculation.displaySpeedKmh) &&
      calculation.displaySpeedKmh > 0
        ? calculation.displaySpeedKmh
        : state.canonicalSpeedKmh
  };
}

function deriveErrors(state, calculation) {
  const errors = {
    distance: null,
    pace: null,
    speed: null,
    time: null
  };

  if (calculation.sourcePair.includes(SOLVE_METRICS.DISTANCE)) {
    errors.distance = parseDistanceInput(state.inputs.distance, {
      showRequiredError: true
    }).error;
  }

  if (calculation.sourcePair.includes(SOLVE_METRICS.RATE)) {
    if (state.rateInputMode === RATE_INPUT_MODES.SPEED) {
      errors.speed = parseSpeedInput(state.inputs.speed, {
        showRequiredError: hasRateInput(state)
      }).error;
    } else {
      errors.pace = parsePaceInput(state.inputs, {
        showRequiredError: hasRateInput(state)
      }).error;
    }
  }

  if (calculation.sourcePair.includes(SOLVE_METRICS.TIME)) {
    errors.time = parseTimeInput(state.inputs, {
      showRequiredError: hasTimeInput(state)
    }).error;
  }

  return errors;
}

function hasSourceError(errors) {
  return Boolean(errors.distance || errors.pace || errors.speed || errors.time);
}

function createStatusMessage(calculation, errors) {
  if (hasSourceError(errors)) {
    return "Fix highlighted fields.";
  }

  if (!calculation.hasLiveResult || calculation.derivedMetric === null) {
    return RESULT_PLACEHOLDER;
  }

  const sourceLabels = sortSolveMetrics(calculation.sourcePair)
    .map(formatSolveMetricLabel)
    .join(" + ");

  return `Solving ${formatSolveMetricLabel(
    calculation.derivedMetric
  )} from ${sourceLabels}.`;
}

function getMetricTone(calculation, metric) {
  if (calculation.sourcePair.includes(metric)) {
    return "source";
  }

  if (calculation.hasLiveResult && calculation.derivedMetric === metric) {
    return "derived";
  }

  return "idle";
}

function createDistanceView(state, calculation, errors) {
  const displayDistanceKm =
    Number.isFinite(calculation.displayDistanceKm) &&
    calculation.displayDistanceKm > 0
      ? calculation.displayDistanceKm
      : state.canonicalDistanceKm;
  const isDerived =
    calculation.hasLiveResult && calculation.derivedMetric === SOLVE_METRICS.DISTANCE;
  const inputValue = isDerived
    ? formatDistanceInputValue(displayDistanceKm, state.unit)
    : state.inputs.distance;
  const sliderDistanceKm =
    Number.isFinite(calculation.parsedDistanceKm) && calculation.parsedDistanceKm > 0
      ? calculation.parsedDistanceKm
      : displayDistanceKm;

  return {
    error: errors.distance,
    inputValue,
    label: `Distance (${state.unit})`,
    presetId: getPresetIdForDistanceKm(displayDistanceKm, state.unit),
    presets: getQuickDistancePresets(state.unit).map(({ id, label }) => ({
      id,
      label
    })),
    sliderMaximum: getSliderMaximum(displayDistanceKm, state.unit),
    sliderMinimum: formatEditableNumber(SLIDER_MIN, SLIDER_DISTANCE_DECIMALS),
    sliderStep: SLIDER_STEP,
    sliderValue: formatDistanceInputValue(
      sliderDistanceKm,
      state.unit,
      SLIDER_DISTANCE_DECIMALS
    ),
    summary: formatDistance(displayDistanceKm, state.unit),
    tone: getMetricTone(calculation, SOLVE_METRICS.DISTANCE)
  };
}

function createRateView(state, calculation, errors) {
  let paceInputValues = {
    minutes: "",
    seconds: ""
  };
  let speedInputValue = "";

  if (
    Number.isFinite(calculation.displaySpeedKmh) &&
    calculation.displaySpeedKmh > 0
  ) {
    paceInputValues = formatPaceFields(
      speedToPaceSeconds(calculation.displaySpeedKmh, state.unit)
    );
    speedInputValue = formatSpeedInputValue(
      fromKilometersPerHour(calculation.displaySpeedKmh, state.unit)
    );
  } else if (calculation.sourcePair.includes(SOLVE_METRICS.RATE)) {
    paceInputValues =
      state.rateInputMode === RATE_INPUT_MODES.PACE
        ? {
            minutes: state.inputs.paceMinutes,
            seconds: state.inputs.paceSeconds
          }
        : paceInputValues;
    speedInputValue =
      state.rateInputMode === RATE_INPUT_MODES.SPEED ? state.inputs.speed : "";
  }

  return {
    paceError: errors.pace,
    paceInputValues,
    paceLabel: state.unit === "mi" ? "Pace (min/mi)" : "Pace (min/km)",
    speedError: errors.speed,
    speedInputValue,
    speedLabel: state.unit === "mi" ? "Speed (mph)" : "Speed (km/h)",
    tone: getMetricTone(calculation, SOLVE_METRICS.RATE)
  };
}

function createTimeView(state, calculation, errors) {
  const inputValues =
    Number.isFinite(calculation.displayTimeSeconds) &&
    calculation.displayTimeSeconds > 0
      ? formatTimeFields(calculation.displayTimeSeconds)
      : calculation.sourcePair.includes(SOLVE_METRICS.TIME)
        ? {
            hours: state.inputs.timeHours,
            minutes: state.inputs.timeMinutes,
            seconds: state.inputs.timeSeconds
          }
        : {
            hours: "",
            minutes: "",
            seconds: ""
          };

  return {
    error: errors.time,
    inputValues,
    tone: getMetricTone(calculation, SOLVE_METRICS.TIME)
  };
}

function buildUrlStateParams(state) {
  const calculation = deriveCalculation(state);
  const errors = deriveErrors(state, calculation);

  if (!calculation.hasLiveResult || hasSourceError(errors)) {
    return null;
  }

  const params = new URLSearchParams();

  params.set(URL_STATE_KEYS.SOLVE, calculation.sourcePair.join("-"));
  let pendingCustomDistance = null;

  if (calculation.sourcePair.includes(SOLVE_METRICS.DISTANCE)) {
    const presetId =
      Number.isFinite(calculation.displayDistanceKm) &&
      calculation.displayDistanceKm > 0
        ? getPresetIdForDistanceKm(calculation.displayDistanceKm, state.unit)
        : state.presetId;

    params.set(URL_STATE_KEYS.PRESET, presetId);

    if (presetId === "custom") {
      pendingCustomDistance = state.inputs.distance;
    }
  }

  params.set(URL_STATE_KEYS.UNIT, state.unit);

  if (pendingCustomDistance !== null) {
    params.set(URL_STATE_KEYS.DISTANCE, pendingCustomDistance);
  }

  if (calculation.sourcePair.includes(SOLVE_METRICS.RATE)) {
    params.set(URL_STATE_KEYS.RATE_MODE, state.rateInputMode);

    if (state.rateInputMode === RATE_INPUT_MODES.SPEED) {
      params.set(URL_STATE_KEYS.SPEED, state.inputs.speed);
    } else {
      params.set(URL_STATE_KEYS.PACE_MINUTES, state.inputs.paceMinutes);
      params.set(URL_STATE_KEYS.PACE_SECONDS, state.inputs.paceSeconds);
    }
  }

  if (calculation.sourcePair.includes(SOLVE_METRICS.TIME)) {
    params.set(URL_STATE_KEYS.TIME_HOURS, state.inputs.timeHours);
    params.set(URL_STATE_KEYS.TIME_MINUTES, state.inputs.timeMinutes);
    params.set(URL_STATE_KEYS.TIME_SECONDS, state.inputs.timeSeconds);
  }

  return params;
}

export function serializeCalculatorState(state) {
  return buildUrlStateParams(state)?.toString() ?? "";
}

export function restoreCalculatorState(searchParams) {
  const params = createUrlSearchParams(searchParams);
  const defaultState = createFormState();

  if (!hasAnyUrlState(params)) {
    return defaultState;
  }

  const solve = normalizeSolvePair(params.get(URL_STATE_KEYS.SOLVE));
  const unit = params.get(URL_STATE_KEYS.UNIT);

  if (solve === null || !isSupportedUnit(unit)) {
    return defaultState;
  }

  const allowedKeys = new Set([
    URL_STATE_KEYS.SOLVE,
    URL_STATE_KEYS.UNIT
  ]);
  let state = applyUnitChange(defaultState, unit);
  let rateInputMode = state.rateInputMode;

  if (solve.includes(SOLVE_METRICS.DISTANCE)) {
    const presetId = params.get(URL_STATE_KEYS.PRESET);

    allowedKeys.add(URL_STATE_KEYS.PRESET);

    if (!isSupportedPresetId(presetId)) {
      return defaultState;
    }

    if (presetId === "custom") {
      allowedKeys.add(URL_STATE_KEYS.DISTANCE);

      if (!params.has(URL_STATE_KEYS.DISTANCE)) {
        return defaultState;
      }

      state = updateDistanceInput(state, params.get(URL_STATE_KEYS.DISTANCE));
    } else {
      state = applyPresetSelection(state, presetId);
    }
  }

  if (solve.includes(SOLVE_METRICS.RATE)) {
    rateInputMode = params.get(URL_STATE_KEYS.RATE_MODE);
    allowedKeys.add(URL_STATE_KEYS.RATE_MODE);

    if (!isSupportedRateInputMode(rateInputMode)) {
      return defaultState;
    }

    if (rateInputMode === RATE_INPUT_MODES.SPEED) {
      allowedKeys.add(URL_STATE_KEYS.SPEED);

      if (!params.has(URL_STATE_KEYS.SPEED)) {
        return defaultState;
      }

      state = updateInputValue(state, "speed", params.get(URL_STATE_KEYS.SPEED));
    } else {
      allowedKeys.add(URL_STATE_KEYS.PACE_MINUTES);
      allowedKeys.add(URL_STATE_KEYS.PACE_SECONDS);

      if (
        !params.has(URL_STATE_KEYS.PACE_MINUTES) ||
        !params.has(URL_STATE_KEYS.PACE_SECONDS)
      ) {
        return defaultState;
      }

      state = updateInputValue(
        state,
        "paceMinutes",
        params.get(URL_STATE_KEYS.PACE_MINUTES)
      );
      state = updateInputValue(
        state,
        "paceSeconds",
        params.get(URL_STATE_KEYS.PACE_SECONDS)
      );
    }
  }

  if (solve.includes(SOLVE_METRICS.TIME)) {
    allowedKeys.add(URL_STATE_KEYS.TIME_HOURS);
    allowedKeys.add(URL_STATE_KEYS.TIME_MINUTES);
    allowedKeys.add(URL_STATE_KEYS.TIME_SECONDS);

    if (
      !params.has(URL_STATE_KEYS.TIME_HOURS) ||
      !params.has(URL_STATE_KEYS.TIME_MINUTES) ||
      !params.has(URL_STATE_KEYS.TIME_SECONDS)
    ) {
      return defaultState;
    }

    state = updateInputValue(
      state,
      "timeHours",
      params.get(URL_STATE_KEYS.TIME_HOURS)
    );
    state = updateInputValue(
      state,
      "timeMinutes",
      params.get(URL_STATE_KEYS.TIME_MINUTES)
    );
    state = updateInputValue(
      state,
      "timeSeconds",
      params.get(URL_STATE_KEYS.TIME_SECONDS)
    );
  }

  state = {
    ...state,
    editOrder: buildEditOrder(solve),
    rateInputMode
  };
  state = syncCanonicalSpeed(state);

  if (hasUnexpectedUrlStateKeys(params, allowedKeys)) {
    return defaultState;
  }

  const calculation = deriveCalculation(state);
  const errors = deriveErrors(state, calculation);

  return calculation.hasLiveResult && !hasSourceError(errors) ? state : defaultState;
}

export function resetFormState(state) {
  const nextState = createFormState();

  return state.unit === nextState.unit
    ? nextState
    : applyUnitChange(nextState, state.unit);
}

export function applyPresetSelection(state, presetId) {
  const preset =
    getQuickDistancePresets(state.unit).find((item) => item.id === presetId) ??
    getPresetById(presetId);

  if (preset.distanceKm === null) {
    return syncCanonicalSpeed({
      ...state,
      editOrder: moveSolveMetricToEnd(state.editOrder, SOLVE_METRICS.DISTANCE),
      presetId: "custom"
    });
  }

  return syncCanonicalSpeed({
    ...state,
    canonicalDistanceKm: preset.distanceKm,
    editOrder: moveSolveMetricToEnd(state.editOrder, SOLVE_METRICS.DISTANCE),
    inputs: {
      ...state.inputs,
      distance: formatDistanceInputValue(preset.distanceKm, state.unit)
    },
    presetId: preset.id
  });
}

export function updateDistanceInput(state, distance) {
  const parsed = parseDistanceInput(distance, {
    showRequiredError: false
  });

  return syncCanonicalSpeed({
    ...state,
    canonicalDistanceKm:
      !parsed.error && parsed.value !== null
        ? distanceToKilometers(parsed.value, state.unit)
        : state.canonicalDistanceKm,
    editOrder: moveSolveMetricToEnd(state.editOrder, SOLVE_METRICS.DISTANCE),
    inputs: {
      ...state.inputs,
      distance
    },
    presetId:
      !parsed.error && parsed.value !== null
        ? getPresetIdForDistanceKm(
            distanceToKilometers(parsed.value, state.unit),
            state.unit
          )
        : "custom"
  });
}

export function applyDistanceIncrement(state, incrementKm) {
  if (!Number.isFinite(incrementKm) || incrementKm <= 0) {
    return state;
  }

  const calculation = deriveCalculation(state);
  const baseDistanceKm =
    Number.isFinite(calculation.displayDistanceKm) && calculation.displayDistanceKm > 0
      ? calculation.displayDistanceKm
      : state.canonicalDistanceKm;

  if (!Number.isFinite(baseDistanceKm) || baseDistanceKm <= 0) {
    return state;
  }

  const nextDistanceKm = Math.min(baseDistanceKm + incrementKm, MAX_DISTANCE);

  return updateDistanceInput(
    state,
    formatDistanceInputValue(nextDistanceKm, state.unit)
  );
}

export function updateDistanceSlider(state, distance) {
  const parsed = parseDistanceInput(distance, {
    showRequiredError: false
  });

  if (parsed.error || parsed.value === null) {
    return updateDistanceInput(state, distance);
  }

  return updateDistanceInput(
    state,
    formatEditableNumber(parsed.value, SLIDER_DISTANCE_DECIMALS)
  );
}

export function updateInputValue(state, field, value) {
  const solveMetric = getSolveMetricForField(field);

  if (solveMetric === null) {
    return state;
  }

  return syncCanonicalSpeed({
    ...state,
    editOrder: moveSolveMetricToEnd(state.editOrder, solveMetric),
    inputs: {
      ...state.inputs,
      [field]: value
    },
    rateInputMode:
      field === "speed"
        ? RATE_INPUT_MODES.SPEED
        : field === "paceMinutes" || field === "paceSeconds"
          ? RATE_INPUT_MODES.PACE
          : state.rateInputMode
  });
}

export function setActiveMetric(state, metric) {
  const solveMetric = getSolveMetricForDriverMetric(metric);

  if (solveMetric === null) {
    return state;
  }

  return {
    ...state,
    editOrder: moveSolveMetricToEnd(state.editOrder, solveMetric),
    rateInputMode:
      metric === DRIVER_METRICS.SPEED
        ? RATE_INPUT_MODES.SPEED
        : metric === DRIVER_METRICS.PACE
          ? RATE_INPUT_MODES.PACE
          : state.rateInputMode
  };
}

export function toggleMetricLock(state) {
  return state;
}

export function applyUnitChange(state, nextUnit) {
  if (!isSupportedUnit(nextUnit) || nextUnit === state.unit) {
    return state;
  }

  const calculation = deriveCalculation(state);
  const nextInputs = {
    ...state.inputs,
    distance: formatDistanceInputValue(
      calculation.displayDistanceKm ?? state.canonicalDistanceKm,
      nextUnit
    )
  };

  if (
    Number.isFinite(calculation.displaySpeedKmh) &&
    calculation.displaySpeedKmh > 0
  ) {
    const pace = formatPaceFields(
      speedToPaceSeconds(calculation.displaySpeedKmh, nextUnit)
    );

    nextInputs.paceMinutes = pace.minutes;
    nextInputs.paceSeconds = pace.seconds;
    nextInputs.speed = formatSpeedInputValue(
      fromKilometersPerHour(calculation.displaySpeedKmh, nextUnit)
    );
  }

  if (
    Number.isFinite(calculation.displayTimeSeconds) &&
    calculation.displayTimeSeconds > 0
  ) {
    const time = formatTimeFields(calculation.displayTimeSeconds);

    nextInputs.timeHours = time.hours;
    nextInputs.timeMinutes = time.minutes;
    nextInputs.timeSeconds = time.seconds;
  }

  return {
    ...state,
    canonicalDistanceKm: calculation.displayDistanceKm ?? state.canonicalDistanceKm,
    canonicalSpeedKmh: calculation.displaySpeedKmh ?? state.canonicalSpeedKmh,
    inputs: nextInputs,
    unit: nextUnit
  };
}

export function deriveCalculatorView(state) {
  const calculation = deriveCalculation(state);
  const errors = deriveErrors(state, calculation);
  const distance = createDistanceView(state, calculation, errors);
  const rate = createRateView(state, calculation, errors);
  const time = createTimeView(state, calculation, errors);

  return {
    derivedMetric: calculation.derivedMetric,
    distance,
    hasLiveResult: calculation.hasLiveResult,
    projectionRows: buildProjectionRows(calculation.displaySpeedKmh),
    rate,
    selectedDistanceLabel: distance.summary,
    sourcePair: calculation.sourcePair,
    statusMessage: createStatusMessage(calculation, errors),
    time,
    unit: state.unit
  };
}
