export const KM_PER_MILE = 1.609344;
export const MAX_DISTANCE = 1000;
export const MAX_DISTANCE_DECIMALS = 5;
export const MAX_SPEED = 60;
export const RESULT_PLACEHOLDER = "Enter valid values to calculate.";

export const MODES = Object.freeze({
  PACE: "pace",
  FINISH: "finish",
  CONVERT: "convert"
});

export const CONVERT_SOURCES = Object.freeze({
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

const ALTERNATE_UNIT = Object.freeze({
  km: "mi",
  mi: "km"
});
const VALID_UNITS = Object.freeze(["km", "mi"]);
const URL_STATE_KEYS = Object.freeze({
  CONVERT_SOURCE: "source",
  DISTANCE: "distance",
  FINISH_HOURS: "fh",
  FINISH_MINUTES: "fm",
  FINISH_SECONDS: "fs",
  MODE: "mode",
  PACE_MINUTES: "pm",
  PACE_SECONDS: "ps",
  PRESET: "preset",
  SPEED: "speed",
  UNIT: "unit"
});
const URL_STATE_KEY_SET = new Set(Object.values(URL_STATE_KEYS));

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

function getAlternateUnit(unit) {
  return ALTERNATE_UNIT[unit] ?? "km";
}

function isSupportedUnit(unit) {
  return VALID_UNITS.includes(unit);
}

function isSupportedMode(mode) {
  return Object.values(MODES).includes(mode);
}

function isSupportedConvertSource(source) {
  return Object.values(CONVERT_SOURCES).includes(source);
}

function isSupportedPresetId(presetId) {
  return DISTANCE_PRESETS.some((preset) => preset.id === presetId);
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

function getRelevantFieldGroups(state) {
  if (state.mode === MODES.PACE) {
    return [
      [state.inputs.distance],
      [
        state.inputs.finishHours,
        state.inputs.finishMinutes,
        state.inputs.finishSeconds
      ]
    ];
  }

  if (state.mode === MODES.FINISH) {
    return [
      [state.inputs.distance],
      [state.inputs.paceMinutes, state.inputs.paceSeconds]
    ];
  }

  if (state.convertSource === CONVERT_SOURCES.SPEED) {
    return [[state.inputs.speed]];
  }

  return [[state.inputs.paceMinutes, state.inputs.paceSeconds]];
}

function shouldShowRequiredErrors(state, previousResult) {
  return (
    Boolean(previousResult) ||
    getRelevantFieldGroups(state).some((group) => group.some(hasValue))
  );
}

export function getPresetById(id) {
  return DISTANCE_PRESETS.find((preset) => preset.id === id) ?? DISTANCE_PRESETS[0];
}

function createCanonicalState() {
  return {
    distanceKm: null,
    paceSpeedKmh: null,
    speedKmh: null
  };
}

function deriveCanonicalValues(state) {
  const distance = parseDistanceInput(state.inputs.distance, {
    showRequiredError: false
  });
  const pace = parsePaceInput(state.inputs, {
    showRequiredError: false
  });
  const speed = parseSpeedInput(state.inputs.speed, {
    showRequiredError: false
  });

  return {
    distanceKm:
      !distance.error && distance.value != null
        ? distanceToKilometers(distance.value, state.unit)
        : null,
    paceSpeedKmh:
      !pace.error && pace.value != null
        ? paceToSpeedKmh(pace.value, state.unit)
        : null,
    speedKmh:
      !speed.error && speed.value != null
        ? toKilometersPerHour(speed.value, state.unit)
        : null
  };
}

function getCanonicalValues(state) {
  const derived = deriveCanonicalValues(state);

  return {
    distanceKm: Number.isFinite(state.canonical?.distanceKm)
      ? state.canonical.distanceKm
      : derived.distanceKm,
    paceSpeedKmh: Number.isFinite(state.canonical?.paceSpeedKmh)
      ? state.canonical.paceSpeedKmh
      : derived.paceSpeedKmh,
    speedKmh: Number.isFinite(state.canonical?.speedKmh)
      ? state.canonical.speedKmh
      : derived.speedKmh
  };
}

function syncCanonicalValues(state) {
  return {
    ...state,
    canonical: deriveCanonicalValues(state)
  };
}

export function createFormState() {
  return {
    canonical: createCanonicalState(),
    mode: MODES.PACE,
    unit: "km",
    convertSource: CONVERT_SOURCES.PACE,
    presetId: "custom",
    inputs: {
      distance: "",
      finishHours: "",
      finishMinutes: "",
      finishSeconds: "",
      paceMinutes: "",
      paceSeconds: "",
      speed: ""
    }
  };
}

function buildUrlStateParams(state) {
  const view = deriveCalculatorView(state);

  if (!view.currentResult) {
    return null;
  }

  const params = new URLSearchParams();

  params.set(URL_STATE_KEYS.MODE, state.mode);
  params.set(URL_STATE_KEYS.UNIT, state.unit);

  if (state.mode === MODES.CONVERT) {
    params.set(URL_STATE_KEYS.CONVERT_SOURCE, state.convertSource);

    if (state.convertSource === CONVERT_SOURCES.PACE) {
      params.set(URL_STATE_KEYS.PACE_MINUTES, state.inputs.paceMinutes);
      params.set(URL_STATE_KEYS.PACE_SECONDS, state.inputs.paceSeconds);
    } else {
      params.set(URL_STATE_KEYS.SPEED, state.inputs.speed);
    }

    return params;
  }

  params.set(URL_STATE_KEYS.PRESET, state.presetId);

  if (state.presetId === "custom") {
    params.set(URL_STATE_KEYS.DISTANCE, state.inputs.distance);
  }

  if (state.mode === MODES.PACE) {
    params.set(URL_STATE_KEYS.FINISH_HOURS, state.inputs.finishHours);
    params.set(URL_STATE_KEYS.FINISH_MINUTES, state.inputs.finishMinutes);
    params.set(URL_STATE_KEYS.FINISH_SECONDS, state.inputs.finishSeconds);
  } else {
    params.set(URL_STATE_KEYS.PACE_MINUTES, state.inputs.paceMinutes);
    params.set(URL_STATE_KEYS.PACE_SECONDS, state.inputs.paceSeconds);
  }

  return params;
}

function applyRestoredInputValues(state, inputValues) {
  return Object.entries(inputValues).reduce(
    (nextState, [field, value]) => updateInputValue(nextState, field, value),
    state
  );
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

  const mode = params.get(URL_STATE_KEYS.MODE);
  const unit = params.get(URL_STATE_KEYS.UNIT);

  if (!isSupportedMode(mode) || !isSupportedUnit(unit)) {
    return defaultState;
  }

  let state = applyUnitChange(applyModeChange(defaultState, mode), unit);

  if (mode === MODES.CONVERT) {
    const convertSource = params.get(URL_STATE_KEYS.CONVERT_SOURCE);

    if (!isSupportedConvertSource(convertSource)) {
      return defaultState;
    }

    const allowedKeys = new Set([
      URL_STATE_KEYS.MODE,
      URL_STATE_KEYS.UNIT,
      URL_STATE_KEYS.CONVERT_SOURCE
    ]);

    if (convertSource === CONVERT_SOURCES.PACE) {
      allowedKeys.add(URL_STATE_KEYS.PACE_MINUTES);
      allowedKeys.add(URL_STATE_KEYS.PACE_SECONDS);
    } else {
      allowedKeys.add(URL_STATE_KEYS.SPEED);
    }

    if (hasUnexpectedUrlStateKeys(params, allowedKeys)) {
      return defaultState;
    }

    state = applyConvertSourceChange(state, convertSource);

    if (convertSource === CONVERT_SOURCES.PACE) {
      if (
        !params.has(URL_STATE_KEYS.PACE_MINUTES) ||
        !params.has(URL_STATE_KEYS.PACE_SECONDS)
      ) {
        return defaultState;
      }

      state = applyRestoredInputValues(state, {
        paceMinutes: params.get(URL_STATE_KEYS.PACE_MINUTES),
        paceSeconds: params.get(URL_STATE_KEYS.PACE_SECONDS)
      });
    } else {
      if (!params.has(URL_STATE_KEYS.SPEED)) {
        return defaultState;
      }

      state = applyRestoredInputValues(state, {
        speed: params.get(URL_STATE_KEYS.SPEED)
      });
    }
  } else {
    const presetId = params.get(URL_STATE_KEYS.PRESET);

    if (!isSupportedPresetId(presetId)) {
      return defaultState;
    }

    const allowedKeys = new Set([
      URL_STATE_KEYS.MODE,
      URL_STATE_KEYS.UNIT,
      URL_STATE_KEYS.PRESET
    ]);

    if (presetId === "custom") {
      allowedKeys.add(URL_STATE_KEYS.DISTANCE);
    }

    if (mode === MODES.PACE) {
      allowedKeys.add(URL_STATE_KEYS.FINISH_HOURS);
      allowedKeys.add(URL_STATE_KEYS.FINISH_MINUTES);
      allowedKeys.add(URL_STATE_KEYS.FINISH_SECONDS);
    } else {
      allowedKeys.add(URL_STATE_KEYS.PACE_MINUTES);
      allowedKeys.add(URL_STATE_KEYS.PACE_SECONDS);
    }

    if (hasUnexpectedUrlStateKeys(params, allowedKeys)) {
      return defaultState;
    }

    if (presetId === "custom") {
      if (!params.has(URL_STATE_KEYS.DISTANCE)) {
        return defaultState;
      }

      state = updateDistanceInput(state, params.get(URL_STATE_KEYS.DISTANCE));
    } else {
      state = applyPresetSelection(state, presetId);
    }

    if (mode === MODES.PACE) {
      if (
        !params.has(URL_STATE_KEYS.FINISH_HOURS) ||
        !params.has(URL_STATE_KEYS.FINISH_MINUTES) ||
        !params.has(URL_STATE_KEYS.FINISH_SECONDS)
      ) {
        return defaultState;
      }

      state = applyRestoredInputValues(state, {
        finishHours: params.get(URL_STATE_KEYS.FINISH_HOURS),
        finishMinutes: params.get(URL_STATE_KEYS.FINISH_MINUTES),
        finishSeconds: params.get(URL_STATE_KEYS.FINISH_SECONDS)
      });
    } else {
      if (
        !params.has(URL_STATE_KEYS.PACE_MINUTES) ||
        !params.has(URL_STATE_KEYS.PACE_SECONDS)
      ) {
        return defaultState;
      }

      state = applyRestoredInputValues(state, {
        paceMinutes: params.get(URL_STATE_KEYS.PACE_MINUTES),
        paceSeconds: params.get(URL_STATE_KEYS.PACE_SECONDS)
      });
    }
  }

  return deriveCalculatorView(state).currentResult ? state : defaultState;
}

export function resetFormState(state) {
  return {
    ...createFormState(),
    mode: state.mode,
    unit: state.unit,
    convertSource: state.convertSource
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

export function formatDistanceInputValue(distanceKm, unit = "km") {
  return formatEditableNumber(distanceFromKilometers(distanceKm, unit), 5);
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

export function applyPresetSelection(state, presetId) {
  const preset = getPresetById(presetId);
  const canonical = getCanonicalValues(state);

  if (preset.distanceKm === null) {
    return {
      ...state,
      canonical,
      presetId: preset.id
    };
  }

  return {
    ...state,
    canonical: {
      ...canonical,
      distanceKm: preset.distanceKm
    },
    presetId: preset.id,
    inputs: {
      ...state.inputs,
      distance: formatDistanceInputValue(preset.distanceKm, state.unit)
    }
  };
}

export function updateDistanceInput(state, distance) {
  return syncCanonicalValues({
    ...state,
    presetId: "custom",
    inputs: {
      ...state.inputs,
      distance
    }
  });
}

export function updateInputValue(state, field, value) {
  return syncCanonicalValues({
    ...state,
    inputs: {
      ...state.inputs,
      [field]: value
    }
  });
}

export function applyModeChange(state, mode) {
  return {
    ...state,
    mode
  };
}

export function applyConvertSourceChange(state, source) {
  const nextInputs = {
    ...state.inputs
  };

  if (source === CONVERT_SOURCES.PACE) {
    nextInputs.speed = "";
  } else {
    nextInputs.paceMinutes = "";
    nextInputs.paceSeconds = "";
  }

  return syncCanonicalValues({
    ...state,
    convertSource: source,
    inputs: nextInputs
  });
}

function convertPaceInputs(inputs, fromUnit, toUnit) {
  const parsed = parsePaceInput(inputs, { showRequiredError: false });

  if (parsed.error || parsed.value === null) {
    return {
      minutes: inputs.paceMinutes,
      seconds: inputs.paceSeconds
    };
  }

  const converted = speedToPaceSeconds(paceToSpeedKmh(parsed.value, fromUnit), toUnit);
  const rounded = Math.round(converted);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return {
    minutes: String(minutes),
    seconds: padTwoDigits(seconds)
  };
}

export function applyUnitChange(state, nextUnit) {
  if (nextUnit === state.unit) {
    return state;
  }

  const canonical = getCanonicalValues(state);
  const nextInputs = {
    ...state.inputs
  };

  if (state.presetId !== "custom") {
    const preset = getPresetById(state.presetId);
    nextInputs.distance = formatDistanceInputValue(preset.distanceKm, nextUnit);
  } else if (Number.isFinite(canonical.distanceKm)) {
    nextInputs.distance = formatDistanceInputValue(canonical.distanceKm, nextUnit);
  }

  if (Number.isFinite(canonical.paceSpeedKmh)) {
    const converted = speedToPaceSeconds(canonical.paceSpeedKmh, nextUnit);
    const rounded = Math.round(converted);

    nextInputs.paceMinutes = String(Math.floor(rounded / 60));
    nextInputs.paceSeconds = padTwoDigits(rounded % 60);
  }

  if (Number.isFinite(canonical.speedKmh)) {
    const convertedSpeed = fromKilometersPerHour(
      canonical.speedKmh,
      nextUnit
    );
    nextInputs.speed = formatSpeedInputValue(convertedSpeed);
  }

  return {
    ...state,
    canonical: {
      distanceKm:
        state.presetId !== "custom"
          ? getPresetById(state.presetId).distanceKm
          : canonical.distanceKm,
      paceSpeedKmh: canonical.paceSpeedKmh,
      speedKmh: canonical.speedKmh
    },
    unit: nextUnit,
    inputs: nextInputs
  };
}

export function parseDistanceInput(value, { showRequiredError = true } = {}) {
  const raw = trimValue(value);

  if (raw === "") {
    return {
      error: showRequiredError ? "Enter a distance." : null
    };
  }

  if (!isDecimalText(raw)) {
    return {
      error: "Distance must use digits and one decimal point only."
    };
  }

  const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;

  if (decimals > MAX_DISTANCE_DECIMALS) {
    return {
      error: "Distance must use 5 decimal places or fewer."
    };
  }

  const numericValue = Number(raw);

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > MAX_DISTANCE) {
    return {
      error: "Distance must be greater than 0 and no more than 1000."
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

  if (minutes < 0 || minutes > 59) {
    return {
      error: "Pace minutes must stay between 0 and 59.",
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

export function parseFinishInput(inputs, { showRequiredError = true } = {}) {
  const hoursRaw = trimValue(inputs.finishHours);
  const minutesRaw = trimValue(inputs.finishMinutes);
  const secondsRaw = trimValue(inputs.finishSeconds);
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

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > MAX_SPEED) {
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

function buildProjectionRows(speedKmh, unit, distanceKm, presetId) {
  const namedPresets = DISTANCE_PRESETS.filter((preset) => preset.distanceKm !== null);
  const rows = namedPresets.map((preset) => ({
    id: preset.id,
    label: preset.label,
    detail: formatDistance(preset.distanceKm, unit),
    finishSeconds: finishTimeFromSpeed(speedKmh, preset.distanceKm),
    isSelected: preset.id === presetId
  }));

  if (Number.isFinite(distanceKm) && presetId === "custom") {
    rows.unshift({
      id: "selected",
      label: "Custom",
      detail: formatDistance(distanceKm, unit),
      finishSeconds: finishTimeFromSpeed(speedKmh, distanceKm),
      isSelected: true
    });
  }

  return rows;
}

function createResult(state, speedKmh, distanceKm) {
  return {
    distanceKm,
    finishSeconds: Number.isFinite(distanceKm)
      ? finishTimeFromSpeed(speedKmh, distanceKm)
      : null,
    paceKmSeconds: speedToPaceSeconds(speedKmh, "km"),
    paceMiSeconds: speedToPaceSeconds(speedKmh, "mi"),
    projectionRows: buildProjectionRows(
      speedKmh,
      state.unit,
      distanceKm,
      state.presetId
    ),
    sourceConvertSource: state.convertSource,
    sourceMode: state.mode,
    speedKmh
  };
}

function createDisplaySummary(state, result) {
  const selectedUnit = state.unit;
  const alternateUnit = getAlternateUnit(selectedUnit);
  const displayMode = result.sourceMode ?? state.mode;
  const displayConvertSource = result.sourceConvertSource ?? state.convertSource;
  const selectedPace = formatPace(
    speedToPaceSeconds(result.speedKmh, selectedUnit),
    selectedUnit
  );
  const alternatePace = formatPace(
    speedToPaceSeconds(result.speedKmh, alternateUnit),
    alternateUnit
  );
  const selectedSpeed = formatSpeed(result.speedKmh, selectedUnit);
  const alternateSpeed = formatSpeed(result.speedKmh, alternateUnit);
  const selectedDistanceLabel = Number.isFinite(result.distanceKm)
    ? formatDistance(result.distanceKm, selectedUnit)
    : null;
  let primaryLabel = "Result";
  let primaryValue = RESULT_PLACEHOLDER;
  let primaryMeta = "Enter valid values to calculate.";

  if (displayMode === MODES.PACE) {
    primaryLabel = "Pace";
    primaryValue = selectedPace;
    primaryMeta = `From ${formatDuration(result.finishSeconds)} over ${selectedDistanceLabel}.`;
  } else if (displayMode === MODES.FINISH) {
    primaryLabel = "Finish time";
    primaryValue = formatDuration(result.finishSeconds);
    primaryMeta = `At ${selectedPace} over ${selectedDistanceLabel}.`;
  } else if (displayConvertSource === CONVERT_SOURCES.PACE) {
    primaryLabel = "Speed";
    primaryValue = selectedSpeed;
    primaryMeta = `Converted from ${selectedPace}.`;
  } else {
    primaryLabel = "Pace";
    primaryValue = selectedPace;
    primaryMeta = `Converted from ${selectedSpeed}.`;
  }

  return {
    alternatePace,
    alternateSpeed,
    primaryLabel,
    primaryMeta,
    primaryValue,
    projectionRows: result.projectionRows.map((row) => ({
      ...row,
      finishLabel: formatDuration(row.finishSeconds)
    })),
    selectedDistanceLabel,
    selectedPace,
    selectedSpeed
  };
}

export function deriveCalculatorView(state, previousResult = null) {
  const showRequiredErrors = shouldShowRequiredErrors(state, previousResult);
  const canonical = getCanonicalValues(state);
  const errors = {
    distance: null,
    finish: null,
    pace: null,
    speed: null
  };
  let distanceKm = null;
  let currentResult = null;

  if (state.mode === MODES.PACE || state.mode === MODES.FINISH) {
    const distance = parseDistanceInput(state.inputs.distance, {
      showRequiredError: showRequiredErrors
    });

    errors.distance = distance.error;

    if (!distance.error && distance.value != null) {
      distanceKm = canonical.distanceKm;
    }
  }

  if (state.mode === MODES.PACE) {
    const finish = parseFinishInput(state.inputs, {
      showRequiredError: showRequiredErrors
    });

    errors.finish = finish.error;

    if (!errors.distance && !errors.finish && Number.isFinite(distanceKm)) {
      const speedKmh = speedFromFinishTime(finish.value, distanceKm);

      if (Number.isFinite(speedKmh) && speedKmh > 0) {
        currentResult = createResult(state, speedKmh, distanceKm);
      }
    }
  } else if (state.mode === MODES.FINISH) {
    const pace = parsePaceInput(state.inputs, {
      showRequiredError: showRequiredErrors
    });

    errors.pace = pace.error;

    if (
      !errors.distance &&
      !errors.pace &&
      Number.isFinite(distanceKm) &&
      Number.isFinite(canonical.paceSpeedKmh) &&
      canonical.paceSpeedKmh > 0
    ) {
      const speedKmh = canonical.paceSpeedKmh;
      currentResult = createResult(state, speedKmh, distanceKm);
    }
  } else if (state.convertSource === CONVERT_SOURCES.PACE) {
    const pace = parsePaceInput(state.inputs, {
      showRequiredError: showRequiredErrors
    });

    errors.pace = pace.error;

    if (
      !errors.pace &&
      Number.isFinite(canonical.paceSpeedKmh) &&
      canonical.paceSpeedKmh > 0
    ) {
      const speedKmh = canonical.paceSpeedKmh;
      currentResult = createResult(state, speedKmh, null);
    }
  } else {
    const speed = parseSpeedInput(state.inputs.speed, {
      showRequiredError: showRequiredErrors
    });

    errors.speed = speed.error;

    if (
      !errors.speed &&
      Number.isFinite(canonical.speedKmh) &&
      canonical.speedKmh > 0
    ) {
      currentResult = createResult(state, canonical.speedKmh, null);
    }
  }

  const displayedResult = currentResult ?? previousResult;
  const resultState = currentResult
    ? "current"
    : displayedResult
      ? "stale"
      : "empty";
  let statusMessage = RESULT_PLACEHOLDER;

  if (resultState === "current") {
    statusMessage = "Results are current.";
  } else if (resultState === "stale") {
    statusMessage = "Out of date. Fix the highlighted fields to recalculate.";
  }

  return {
    currentResult,
    display: displayedResult ? createDisplaySummary(state, displayedResult) : null,
    errors,
    resultState,
    showDistanceFields: state.mode !== MODES.CONVERT,
    showFinishFields: state.mode === MODES.PACE,
    showPaceFields:
      state.mode === MODES.FINISH ||
      (state.mode === MODES.CONVERT &&
        state.convertSource === CONVERT_SOURCES.PACE),
    showSpeedFields:
      state.mode === MODES.CONVERT &&
      state.convertSource === CONVERT_SOURCES.SPEED,
    statusMessage
  };
}
