export const COMMON_RACES = [
  {
    id: "5k",
    label: "5K",
    distanceKm: 5,
    detail: "Sharp benchmark",
  },
  {
    id: "10k",
    label: "10K",
    distanceKm: 10,
    detail: "Tempo checkpoint",
  },
  {
    id: "half-marathon",
    label: "Half marathon",
    distanceKm: 21.0975,
    detail: "Long-race predictor",
  },
  {
    id: "marathon",
    label: "Marathon",
    distanceKm: 42.195,
    detail: "Full-distance target",
  },
];

const DISTANCE_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const SPEED_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function parseNumberInput(rawValue, label, options = {}) {
  const value = rawValue.trim().replace(",", ".");
  const { min = 0, max = Number.POSITIVE_INFINITY, example = "12" } = options;

  if (!value) {
    return { error: null, value: null };
  }

  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) {
    return { error: `${label} must be a number, for example ${example}.`, value: null };
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return { error: `${label} must be a number, for example ${example}.`, value: null };
  }

  if (parsed < min) {
    return { error: `${label} must be at least ${min}.`, value: null };
  }

  if (parsed > max) {
    return { error: `${label} must be ${max} or lower.`, value: null };
  }

  return { error: null, value: parsed };
}

export function parsePaceInput(rawValue) {
  const value = rawValue.trim();

  if (!value) {
    return { error: null, value: null };
  }

  const match = /^(\d{1,3})(?::([0-5]?\d))?$/.exec(value);

  if (!match) {
    return { error: "Use m:ss for pace, for example 4:45.", value: null };
  }

  const minutes = Number.parseInt(match[1], 10);
  const seconds = match[2] === undefined ? 0 : Number.parseInt(match[2], 10);
  const totalSeconds = (minutes * 60) + seconds;

  if (totalSeconds <= 0) {
    return { error: "Pace must be greater than zero.", value: null };
  }

  return { error: null, value: totalSeconds };
}

export function paceToSpeedKmh(secondsPerKm) {
  return 3600 / secondsPerKm;
}

export function speedToPaceSeconds(speedKmh) {
  return 3600 / speedKmh;
}

export function finishTimeSeconds(distanceKm, speedKmh) {
  return distanceKm * speedToPaceSeconds(speedKmh);
}

export function formatPaceInput(secondsPerKm) {
  if (secondsPerKm === null || secondsPerKm === undefined) {
    return "";
  }

  const rounded = Math.round(secondsPerKm);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPace(secondsPerKm) {
  if (secondsPerKm === null || secondsPerKm === undefined) {
    return "—";
  }

  return `${formatPaceInput(secondsPerKm)} /km`;
}

export function formatSpeedInput(speedKmh) {
  if (speedKmh === null || speedKmh === undefined) {
    return "";
  }

  return SPEED_FORMATTER.format(speedKmh);
}

export function formatSpeed(speedKmh) {
  if (speedKmh === null || speedKmh === undefined) {
    return "—";
  }

  return `${formatSpeedInput(speedKmh)} km/h`;
}

export function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined) {
    return "—";
  }

  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDistance(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) {
    return "Custom distance";
  }

  return `${DISTANCE_FORMATTER.format(distanceKm)} km`;
}

export function findRacePreset(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) {
    return null;
  }

  return COMMON_RACES.find((race) => Math.abs(race.distanceKm - distanceKm) < 0.001) ?? null;
}

export function describeFinishCaption({ distanceError, distanceKm, finishSeconds, speedKmh }) {
  if (distanceError) {
    return "Fix the distance input to project a finish time.";
  }

  if (finishSeconds !== null && distanceKm !== null) {
    const distanceLabel = findRacePreset(distanceKm)?.label ?? formatDistance(distanceKm);
    return `${distanceLabel} projection`;
  }

  if (speedKmh === null) {
    return "Add a pace or a speed to project a finish time.";
  }

  return "Add a distance to project a finish time.";
}

function describeSource(preferredSource, sourceUsed, paceState, speedState) {
  if (!sourceUsed) {
    if (paceState.error && speedState.error) {
      return "Fix the pace and speed inputs to start converting.";
    }

    if (paceState.error) {
      return "Fix the pace input to start converting.";
    }

    if (speedState.error) {
      return "Fix the speed input to start converting.";
    }

    return "Enter a pace or a speed to start converting.";
  }

  if (sourceUsed !== preferredSource) {
    const preferredError = preferredSource === "pace" ? paceState.error : speedState.error;

    if (preferredError) {
      return `Using ${sourceUsed} because the ${preferredSource} input needs attention.`;
    }

    return `Using ${sourceUsed} as the active source.`;
  }

  if (paceState.value !== null && speedState.value !== null) {
    return `Using ${sourceUsed} as the active source. Edit the other field to switch.`;
  }

  return `Using ${sourceUsed} as the active source.`;
}

export function deriveCalculatorState({ distanceInput, paceInput, source, speedInput }) {
  const paceState = parsePaceInput(paceInput);
  const speedState = parseNumberInput(speedInput, "Speed", {
    example: "12.4",
    max: 60,
    min: 0.1,
  });
  const distanceState = parseNumberInput(distanceInput, "Distance", {
    example: "10",
    max: 500,
    min: 0.1,
  });

  const preferredSource = source === "speed" ? "speed" : "pace";
  const paceValid = paceState.value !== null;
  const speedValid = speedState.value !== null;

  let sourceUsed = null;

  if (preferredSource === "pace" && paceValid) {
    sourceUsed = "pace";
  } else if (preferredSource === "speed" && speedValid) {
    sourceUsed = "speed";
  } else if (paceValid) {
    sourceUsed = "pace";
  } else if (speedValid) {
    sourceUsed = "speed";
  }

  const paceSeconds = sourceUsed === "speed"
    ? speedToPaceSeconds(speedState.value)
    : paceState.value;
  const speedKmh = sourceUsed === "pace"
    ? paceToSpeedKmh(paceState.value)
    : speedState.value;
  const finishSeconds = (distanceState.value !== null && speedKmh !== null)
    ? finishTimeSeconds(distanceState.value, speedKmh)
    : null;

  return {
    errors: {
      distance: distanceState.error,
      pace: paceState.error,
      speed: speedState.error,
    },
    metrics: {
      distanceKm: distanceState.value,
      finishSeconds,
      paceSeconds,
      speedKmh,
    },
    projections: COMMON_RACES.map((race) => ({
      ...race,
      finishSeconds: speedKmh === null ? null : finishTimeSeconds(race.distanceKm, speedKmh),
      isSelected: Math.abs((distanceState.value ?? -1) - race.distanceKm) < 0.001,
    })),
    sourceUsed,
    status: describeSource(preferredSource, sourceUsed, paceState, speedState),
  };
}
