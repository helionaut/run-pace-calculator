export const KM_PER_MILE = 1.609344;
export const MAX_DISTANCE = 1000;
export const MAX_DISTANCE_DECIMALS = 5;
export const MAX_SPEED = 60;
export const RESULT_PLACEHOLDER =
  "Choose a distance, then edit pace, speed, or time.";

export const DRIVER_METRICS = Object.freeze({
  PACE: "pace",
  SPEED: "speed",
  TIME: "time"
});

export const LOCK_METRICS = Object.freeze({
  PACE: "pace",
  TIME: "time"
});

export const DISTANCE_PRESETS = Object.freeze([
  { id: "custom", label: "Custom", distanceKm: null },
  { id: "5k", label: "5K", distanceKm: 5 },
  { id: "10k", label: "10K", distanceKm: 10 },
  { id: "half", label: "Half Marathon", distanceKm: 21.0975 },
  { id: "marathon", label: "Marathon", distanceKm: 42.195 }
]);

const DEFAULT_PRESET_ID = "10k";
const ALTERNATE_UNIT = Object.freeze({
  km: "mi",
  mi: "km"
});
const LOCKABLE_METRICS = new Set(Object.values(LOCK_METRICS));
const PRESET_MATCH_TOLERANCE = 1e-5;
const SLIDER_MIN = 0.5;
const SLIDER_BASE_MAX = 60;
const SLIDER_STEP = "0.00001";
const VALID_UNITS = Object.freeze(["km", "mi"]);
const URL_STATE_KEYS = Object.freeze({
  DISTANCE: "distance",
  LOCK: "lock",
  METRIC: "metric",
  PACE_MINUTES: "pm",
  PACE_SECONDS: "ps",
  PRESET: "preset",
  SPEED: "speed",
  TIME_HOURS: "th",
  TIME_MINUTES: "tm",
  TIME_SECONDS: "ts",
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

function getDefaultPreset() {
  return getPresetById(DEFAULT_PRESET_ID);
}

function isSupportedUnit(unit) {
  return VALID_UNITS.includes(unit);
}

function isSupportedDriverMetric(metric) {
  return Object.values(DRIVER_METRICS).includes(metric);
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

function almostEqual(a, b) {
  return Math.abs(a - b) <= PRESET_MATCH_TOLERANCE;
}

function getPresetIdForDistanceKm(distanceKm) {
  return (
    DISTANCE_PRESETS.find(
      (preset) =>
        preset.distanceKm !== null && almostEqual(preset.distanceKm, distanceKm)
    )?.id ?? "custom"
  );
}

function getMetricFields(metric) {
  if (metric === DRIVER_METRICS.PACE) {
    return ["paceMinutes", "paceSeconds"];
  }

  if (metric === DRIVER_METRICS.TIME) {
    return ["timeHours", "timeMinutes", "timeSeconds"];
  }

  return ["speed"];
}

function shouldShowRequiredError(state, metric) {
  return getMetricFields(metric).some((field) => hasValue(state.inputs[field]));
}

function getEffectiveDriverMetric(state) {
  return state.lockMetric ?? state.driverMetric;
}

function deriveCanonicalSpeedKmh(state) {
  const driverMetric = getEffectiveDriverMetric(state);

  if (driverMetric === DRIVER_METRICS.PACE) {
    const pace = parsePaceInput(state.inputs, {
      showRequiredError: false
    });

    return !pace.error && pace.value !== null
      ? paceToSpeedKmh(pace.value, state.unit)
      : null;
  }

  if (driverMetric === DRIVER_METRICS.SPEED) {
    const speed = parseSpeedInput(state.inputs.speed, {
      showRequiredError: false
    });

    return !speed.error && speed.value !== null
      ? toKilometersPerHour(speed.value, state.unit)
      : null;
  }

  const distance = parseDistanceInput(state.inputs.distance, {
    showRequiredError: false
  });
  const time = parseTimeInput(state.inputs, {
    showRequiredError: false
  });

  if (
    distance.error ||
    distance.value === null ||
    time.error ||
    time.value === null
  ) {
    return null;
  }

  return speedFromFinishTime(
    time.value,
    distanceToKilometers(distance.value, state.unit)
  );
}

function syncCanonicalSpeed(state) {
  const canonicalSpeedKmh = deriveCanonicalSpeedKmh(state);

  return {
    ...state,
    canonicalSpeedKmh:
      Number.isFinite(canonicalSpeedKmh) && canonicalSpeedKmh > 0
        ? canonicalSpeedKmh
        : null
  };
}

function getSelectedDistanceUnitValue(distanceKm, unit) {
  return distanceFromKilometers(distanceKm, unit);
}

function getSliderMaximum(distanceKm, unit) {
  const selectedUnitDistance = getSelectedDistanceUnitValue(distanceKm, unit);

  return formatEditableNumber(
    Math.max(SLIDER_BASE_MAX, selectedUnitDistance),
    MAX_DISTANCE_DECIMALS
  );
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

function seedMetricInputs(inputs, metric, calculation, unit) {
  if (metric === DRIVER_METRICS.PACE) {
    if (!Number.isFinite(calculation.speedKmh) || calculation.speedKmh <= 0) {
      return inputs;
    }

    const pace = formatPaceFields(speedToPaceSeconds(calculation.speedKmh, unit));

    return {
      ...inputs,
      paceMinutes: pace.minutes,
      paceSeconds: pace.seconds
    };
  }

  if (metric === DRIVER_METRICS.SPEED) {
    if (!Number.isFinite(calculation.speedKmh) || calculation.speedKmh <= 0) {
      return inputs;
    }

    return {
      ...inputs,
      speed: formatSpeedInputValue(
        fromKilometersPerHour(calculation.speedKmh, unit)
      )
    };
  }

  if (!Number.isFinite(calculation.finishSeconds) || calculation.finishSeconds <= 0) {
    return inputs;
  }

  const time = formatTimeFields(calculation.finishSeconds);

  return {
    ...inputs,
    timeHours: time.hours,
    timeMinutes: time.minutes,
    timeSeconds: time.seconds
  };
}

function getMetricStateLabel(metric, driverMetric, lockMetric, hasDerivedValue) {
  if (lockMetric === metric) {
    return "Locked";
  }

  if (driverMetric === metric) {
    return "Input";
  }

  if (hasDerivedValue) {
    return "Derived";
  }

  return "Waiting";
}

function getDriverButtonLabel(metric, driverMetric, lockMetric) {
  if (metric === driverMetric && lockMetric === metric) {
    return "Locked input";
  }

  if (metric === driverMetric) {
    return "Editing";
  }

  if (lockMetric) {
    return "Unlock to edit";
  }

  return "Use as input";
}

function buildProjectionRows(speedKmh, unit) {
  return DISTANCE_PRESETS.filter((preset) => preset.distanceKm !== null).map(
    (preset) => ({
      id: preset.id,
      label: preset.label,
      detail: formatDistance(preset.distanceKm, unit),
      finishLabel: Number.isFinite(speedKmh) && speedKmh > 0
        ? formatDuration(finishTimeFromSpeed(speedKmh, preset.distanceKm))
        : "--:--:--"
    })
  );
}

function deriveCalculation(state) {
  const driverMetric = getEffectiveDriverMetric(state);
  const errors = {
    distance: null,
    pace: null,
    speed: null,
    time: null
  };
  const distance = parseDistanceInput(state.inputs.distance, {
    showRequiredError: true
  });
  const hasDistance = !distance.error && distance.value !== null;
  const distanceKm = hasDistance
    ? distanceToKilometers(distance.value, state.unit)
    : null;
  let speedKmh = null;
  let finishSeconds = null;

  errors.distance = distance.error;

  if (driverMetric === DRIVER_METRICS.PACE) {
    const pace = parsePaceInput(state.inputs, {
      showRequiredError: shouldShowRequiredError(state, DRIVER_METRICS.PACE)
    });

    errors.pace = pace.error;

    if (!errors.pace && pace.value !== null) {
      speedKmh =
        Number.isFinite(state.canonicalSpeedKmh) && state.canonicalSpeedKmh > 0
          ? state.canonicalSpeedKmh
          : paceToSpeedKmh(pace.value, state.unit);
    }

    if (Number.isFinite(speedKmh) && speedKmh > 0 && distanceKm !== null) {
      finishSeconds = finishTimeFromSpeed(speedKmh, distanceKm);
    }
  } else if (driverMetric === DRIVER_METRICS.SPEED) {
    const speed = parseSpeedInput(state.inputs.speed, {
      showRequiredError: shouldShowRequiredError(state, DRIVER_METRICS.SPEED)
    });

    errors.speed = speed.error;

    if (!errors.speed && speed.value !== null) {
      speedKmh =
        Number.isFinite(state.canonicalSpeedKmh) && state.canonicalSpeedKmh > 0
          ? state.canonicalSpeedKmh
          : toKilometersPerHour(speed.value, state.unit);
    }

    if (Number.isFinite(speedKmh) && speedKmh > 0 && distanceKm !== null) {
      finishSeconds = finishTimeFromSpeed(speedKmh, distanceKm);
    }
  } else {
    const time = parseTimeInput(state.inputs, {
      showRequiredError: shouldShowRequiredError(state, DRIVER_METRICS.TIME)
    });

    errors.time = time.error;

    if (!errors.time && time.value !== null && distanceKm !== null) {
      speedKmh = speedFromFinishTime(time.value, distanceKm);
      finishSeconds = time.value;
    }
  }

  return {
    distanceKm,
    driverMetric,
    errors,
    finishSeconds,
    speedKmh
  };
}

function canLockMetric(metric, calculation) {
  if (metric === LOCK_METRICS.PACE) {
    return Number.isFinite(calculation.speedKmh) && calculation.speedKmh > 0;
  }

  if (metric === LOCK_METRICS.TIME) {
    return (
      Number.isFinite(calculation.finishSeconds) && calculation.finishSeconds > 0
    );
  }

  return false;
}

function createDistanceView(state, calculation) {
  return {
    error: calculation.errors.distance,
    inputValue: state.inputs.distance,
    label: `Distance (${state.unit})`,
    presetId: state.presetId,
    presets: DISTANCE_PRESETS.filter((preset) => preset.distanceKm !== null).map(
      (preset) => ({
        ...preset,
        isSelected: state.presetId === preset.id
      })
    ),
    sliderMaximum: getSliderMaximum(state.canonicalDistanceKm, state.unit),
    sliderMinimum: formatEditableNumber(SLIDER_MIN, MAX_DISTANCE_DECIMALS),
    sliderStep: SLIDER_STEP,
    sliderValue: formatDistanceInputValue(state.canonicalDistanceKm, state.unit),
    summary: formatDistance(state.canonicalDistanceKm, state.unit)
  };
}

function createPaceCardView(state, calculation) {
  const driverMetric = getEffectiveDriverMetric(state);
  const alternateUnit = getAlternateUnit(state.unit);
  const isEditable = driverMetric === DRIVER_METRICS.PACE;
  const derivedPaceSeconds = Number.isFinite(calculation.speedKmh)
    ? speedToPaceSeconds(calculation.speedKmh, state.unit)
    : null;
  const displayInputs = isEditable
    ? {
        minutes: state.inputs.paceMinutes,
        seconds: state.inputs.paceSeconds
      }
    : formatPaceFields(derivedPaceSeconds);

  return {
    editable: isEditable,
    error: isEditable ? calculation.errors.pace : null,
    inputValues: displayInputs,
    label: `Pace /${state.unit}`,
    lockDisabled:
      state.lockMetric === LOCK_METRICS.PACE
        ? false
        : !canLockMetric(LOCK_METRICS.PACE, calculation),
    lockLabel:
      state.lockMetric === LOCK_METRICS.PACE ? "Unlock" : "Lock",
    lockPressed: state.lockMetric === LOCK_METRICS.PACE,
    secondary: Number.isFinite(calculation.speedKmh)
      ? `Also ${formatPace(
          speedToPaceSeconds(calculation.speedKmh, alternateUnit),
          alternateUnit
        )}`
      : `Also --:-- /${alternateUnit}`,
    stateLabel: getMetricStateLabel(
      DRIVER_METRICS.PACE,
      driverMetric,
      state.lockMetric,
      Number.isFinite(derivedPaceSeconds)
    )
  };
}

function createSpeedCardView(state, calculation) {
  const driverMetric = getEffectiveDriverMetric(state);
  const alternateUnit = getAlternateUnit(state.unit);
  const isEditable = driverMetric === DRIVER_METRICS.SPEED;

  return {
    editable: isEditable,
    error: isEditable ? calculation.errors.speed : null,
    inputValue: isEditable
      ? state.inputs.speed
      : Number.isFinite(calculation.speedKmh)
        ? formatSpeedInputValue(fromKilometersPerHour(calculation.speedKmh, state.unit))
        : "",
    label: state.unit === "mi" ? "Speed (mph)" : "Speed (km/h)",
    secondary: Number.isFinite(calculation.speedKmh)
      ? `Also ${formatSpeed(calculation.speedKmh, alternateUnit)}`
      : alternateUnit === "mi"
        ? "Also --.-- mph"
        : "Also --.-- km/h",
    stateLabel: getMetricStateLabel(
      DRIVER_METRICS.SPEED,
      driverMetric,
      state.lockMetric,
      Number.isFinite(calculation.speedKmh)
    )
  };
}

function createTimeCardView(state, calculation) {
  const driverMetric = getEffectiveDriverMetric(state);
  const isEditable = driverMetric === DRIVER_METRICS.TIME;
  const displayInputs = isEditable
    ? {
        hours: state.inputs.timeHours,
        minutes: state.inputs.timeMinutes,
        seconds: state.inputs.timeSeconds
      }
    : formatTimeFields(calculation.finishSeconds);
  const distanceText = calculation.distanceKm !== null
    ? `For ${formatDistance(calculation.distanceKm, state.unit)}`
    : "Set a valid distance to project finish time.";

  return {
    editable: isEditable,
    error: isEditable ? calculation.errors.time : null,
    inputValues: displayInputs,
    label: "Finish time",
    lockDisabled:
      state.lockMetric === LOCK_METRICS.TIME
        ? false
        : !canLockMetric(LOCK_METRICS.TIME, calculation),
    lockLabel:
      state.lockMetric === LOCK_METRICS.TIME ? "Unlock" : "Lock",
    lockPressed: state.lockMetric === LOCK_METRICS.TIME,
    secondary: distanceText,
    stateLabel: getMetricStateLabel(
      DRIVER_METRICS.TIME,
      driverMetric,
      state.lockMetric,
      Number.isFinite(calculation.finishSeconds)
    )
  };
}

function createStatusMessage(state, calculation) {
  const driverMetric = getEffectiveDriverMetric(state);
  const driverError =
    driverMetric === DRIVER_METRICS.PACE
      ? calculation.errors.pace
      : driverMetric === DRIVER_METRICS.SPEED
        ? calculation.errors.speed
        : calculation.errors.time;

  if (calculation.errors.distance || driverError) {
    return "Fix the highlighted fields to keep live results moving.";
  }

  if (state.lockMetric === LOCK_METRICS.TIME) {
    return "Time locked. Drag distance to see the required pace and speed.";
  }

  if (state.lockMetric === LOCK_METRICS.PACE) {
    return "Pace locked. Drag distance to update the finish time.";
  }

  if (driverMetric === DRIVER_METRICS.PACE) {
    return "Edit pace to update speed and finish time instantly.";
  }

  if (driverMetric === DRIVER_METRICS.SPEED) {
    return "Edit speed to update pace and finish time instantly.";
  }

  return "Edit finish time to see the pace and speed needed for this distance.";
}

export function getPresetById(id) {
  return DISTANCE_PRESETS.find((preset) => preset.id === id) ?? DISTANCE_PRESETS[0];
}

export function createFormState() {
  const preset = getDefaultPreset();

  return {
    canonicalDistanceKm: preset.distanceKm,
    canonicalSpeedKmh: null,
    driverMetric: DRIVER_METRICS.PACE,
    inputs: {
      distance: formatDistanceInputValue(preset.distanceKm, "km"),
      paceMinutes: "",
      paceSeconds: "",
      speed: "",
      timeHours: "",
      timeMinutes: "",
      timeSeconds: ""
    },
    lockMetric: null,
    presetId: preset.id,
    unit: "km"
  };
}

function buildUrlStateParams(state) {
  const view = deriveCalculatorView(state);
  const driverMetric = getEffectiveDriverMetric(state);

  if (
    !view.hasLiveResult ||
    !isSupportedDriverMetric(driverMetric) ||
    (state.lockMetric !== null && state.lockMetric !== driverMetric)
  ) {
    return null;
  }

  const params = new URLSearchParams();

  params.set(URL_STATE_KEYS.METRIC, driverMetric);
  params.set(URL_STATE_KEYS.PRESET, state.presetId);
  params.set(URL_STATE_KEYS.UNIT, state.unit);

  if (state.presetId === "custom") {
    params.set(URL_STATE_KEYS.DISTANCE, state.inputs.distance);
  }

  if (driverMetric === DRIVER_METRICS.PACE) {
    params.set(URL_STATE_KEYS.PACE_MINUTES, state.inputs.paceMinutes);
    params.set(URL_STATE_KEYS.PACE_SECONDS, state.inputs.paceSeconds);
  } else if (driverMetric === DRIVER_METRICS.SPEED) {
    params.set(URL_STATE_KEYS.SPEED, state.inputs.speed);
  } else {
    params.set(URL_STATE_KEYS.TIME_HOURS, state.inputs.timeHours);
    params.set(URL_STATE_KEYS.TIME_MINUTES, state.inputs.timeMinutes);
    params.set(URL_STATE_KEYS.TIME_SECONDS, state.inputs.timeSeconds);
  }

  if (state.lockMetric) {
    params.set(URL_STATE_KEYS.LOCK, state.lockMetric);
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

  const metric = params.get(URL_STATE_KEYS.METRIC);
  const unit = params.get(URL_STATE_KEYS.UNIT);
  const presetId = params.get(URL_STATE_KEYS.PRESET);
  const lockMetric = params.get(URL_STATE_KEYS.LOCK);

  if (
    !isSupportedDriverMetric(metric) ||
    !isSupportedUnit(unit) ||
    !isSupportedPresetId(presetId) ||
    (lockMetric !== null &&
      (!LOCKABLE_METRICS.has(lockMetric) || lockMetric !== metric))
  ) {
    return defaultState;
  }

  const allowedKeys = new Set([
    URL_STATE_KEYS.METRIC,
    URL_STATE_KEYS.PRESET,
    URL_STATE_KEYS.UNIT
  ]);
  let state = applyUnitChange(defaultState, unit);

  if (presetId === "custom") {
    allowedKeys.add(URL_STATE_KEYS.DISTANCE);

    if (!params.has(URL_STATE_KEYS.DISTANCE)) {
      return defaultState;
    }

    state = updateDistanceInput(state, params.get(URL_STATE_KEYS.DISTANCE));
  } else {
    state = applyPresetSelection(state, presetId);
  }

  state = setActiveMetric(state, metric);

  if (metric === DRIVER_METRICS.PACE) {
    allowedKeys.add(URL_STATE_KEYS.PACE_MINUTES);
    allowedKeys.add(URL_STATE_KEYS.PACE_SECONDS);

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
  } else if (metric === DRIVER_METRICS.SPEED) {
    allowedKeys.add(URL_STATE_KEYS.SPEED);

    if (!params.has(URL_STATE_KEYS.SPEED)) {
      return defaultState;
    }

    state = applyRestoredInputValues(state, {
      speed: params.get(URL_STATE_KEYS.SPEED)
    });
  } else {
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

    state = applyRestoredInputValues(state, {
      timeHours: params.get(URL_STATE_KEYS.TIME_HOURS),
      timeMinutes: params.get(URL_STATE_KEYS.TIME_MINUTES),
      timeSeconds: params.get(URL_STATE_KEYS.TIME_SECONDS)
    });
  }

  if (lockMetric !== null) {
    allowedKeys.add(URL_STATE_KEYS.LOCK);
    state = toggleMetricLock(state, lockMetric);
  }

  if (hasUnexpectedUrlStateKeys(params, allowedKeys)) {
    return defaultState;
  }

  return deriveCalculatorView(state).hasLiveResult ? state : defaultState;
}

export function resetFormState(state) {
  const nextState = createFormState();

  return state.unit === nextState.unit
    ? nextState
    : applyUnitChange(nextState, state.unit);
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

  if (preset.distanceKm === null) {
    return syncCanonicalSpeed({
      ...state,
      presetId: "custom"
    });
  }

  return syncCanonicalSpeed({
    ...state,
    canonicalDistanceKm: preset.distanceKm,
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

  if (parsed.error || parsed.value === null) {
    return syncCanonicalSpeed({
      ...state,
      inputs: {
        ...state.inputs,
        distance
      },
      presetId: "custom"
    });
  }

  const distanceKm = distanceToKilometers(parsed.value, state.unit);

  return syncCanonicalSpeed({
    ...state,
    canonicalDistanceKm: distanceKm,
    inputs: {
      ...state.inputs,
      distance
    },
    presetId: getPresetIdForDistanceKm(distanceKm)
  });
}

export function updateInputValue(state, field, value) {
  return syncCanonicalSpeed({
    ...state,
    inputs: {
      ...state.inputs,
      [field]: value
    }
  });
}

export function setActiveMetric(state, metric) {
  if (!Object.values(DRIVER_METRICS).includes(metric)) {
    return state;
  }

  if (state.lockMetric && state.lockMetric !== metric) {
    return state;
  }

  if (getEffectiveDriverMetric(state) === metric) {
    return {
      ...state,
      driverMetric: metric
    };
  }

  const calculation = deriveCalculation(state);

  return {
    ...state,
    canonicalSpeedKmh:
      Number.isFinite(calculation.speedKmh) && calculation.speedKmh > 0
        ? calculation.speedKmh
        : null,
    driverMetric: metric,
    inputs: seedMetricInputs(state.inputs, metric, calculation, state.unit)
  };
}

export function toggleMetricLock(state, metric) {
  if (!LOCKABLE_METRICS.has(metric)) {
    return state;
  }

  if (state.lockMetric === metric) {
    return {
      ...state,
      lockMetric: null
    };
  }

  const calculation = deriveCalculation(state);

  if (!canLockMetric(metric, calculation)) {
    return state;
  }

  const unlockedState = {
    ...state,
    lockMetric: null
  };
  const nextState = setActiveMetric(unlockedState, metric);

  return {
    ...nextState,
    lockMetric: metric
  };
}

export function applyUnitChange(state, nextUnit) {
  if (nextUnit === state.unit) {
    return state;
  }

  const calculation = deriveCalculation(state);
  const driverMetric = getEffectiveDriverMetric(state);
  let nextInputs = {
    ...state.inputs,
    distance: formatDistanceInputValue(state.canonicalDistanceKm, nextUnit)
  };

  if (
    driverMetric === DRIVER_METRICS.PACE &&
    Number.isFinite(calculation.speedKmh) &&
    calculation.speedKmh > 0
  ) {
    nextInputs = seedMetricInputs(
      nextInputs,
      DRIVER_METRICS.PACE,
      calculation,
      nextUnit
    );
  } else if (
    driverMetric === DRIVER_METRICS.SPEED &&
    Number.isFinite(calculation.speedKmh) &&
    calculation.speedKmh > 0
  ) {
    nextInputs = seedMetricInputs(
      nextInputs,
      DRIVER_METRICS.SPEED,
      calculation,
      nextUnit
    );
  }

  return {
    ...state,
    inputs: nextInputs,
    unit: nextUnit
  };
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

export function deriveCalculatorView(state) {
  const calculation = deriveCalculation(state);
  const driverMetric = getEffectiveDriverMetric(state);

  return {
    cards: {
      pace: createPaceCardView(state, calculation),
      speed: createSpeedCardView(state, calculation),
      time: createTimeCardView(state, calculation)
    },
    distance: createDistanceView(state, calculation),
    driverButtons: {
      pace: {
        disabled:
          driverMetric === DRIVER_METRICS.PACE ||
          Boolean(state.lockMetric && state.lockMetric !== DRIVER_METRICS.PACE),
        label: getDriverButtonLabel(
          DRIVER_METRICS.PACE,
          driverMetric,
          state.lockMetric
        )
      },
      speed: {
        disabled:
          driverMetric === DRIVER_METRICS.SPEED || Boolean(state.lockMetric),
        label: getDriverButtonLabel(
          DRIVER_METRICS.SPEED,
          driverMetric,
          state.lockMetric
        )
      },
      time: {
        disabled:
          driverMetric === DRIVER_METRICS.TIME ||
          Boolean(state.lockMetric && state.lockMetric !== DRIVER_METRICS.TIME),
        label: getDriverButtonLabel(
          DRIVER_METRICS.TIME,
          driverMetric,
          state.lockMetric
        )
      }
    },
    driverMetric,
    hasLiveResult:
      (Number.isFinite(calculation.speedKmh) && calculation.speedKmh > 0) ||
      (Number.isFinite(calculation.finishSeconds) && calculation.finishSeconds > 0),
    lockMetric: state.lockMetric,
    projectionRows: buildProjectionRows(calculation.speedKmh, state.unit),
    selectedDistanceLabel: calculation.distanceKm !== null
      ? formatDistance(calculation.distanceKm, state.unit)
      : formatDistance(state.canonicalDistanceKm, state.unit),
    statusMessage: createStatusMessage(state, calculation),
    unit: state.unit
  };
}
