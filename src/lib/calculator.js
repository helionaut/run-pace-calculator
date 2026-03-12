export const KM_PER_MILE = 1.609344;

export const DISTANCES = [
  { id: "mile", name: "1 Mile", kilometers: KM_PER_MILE, shortLabel: "1 mi" },
  { id: "5k", name: "5K", kilometers: 5, shortLabel: "5K" },
  { id: "10k", name: "10K", kilometers: 10, shortLabel: "10K" },
  {
    id: "10mile",
    name: "10 Miles",
    kilometers: KM_PER_MILE * 10,
    shortLabel: "10 mi"
  },
  {
    id: "half",
    name: "Half Marathon",
    kilometers: 21.0975,
    shortLabel: "13.1 mi"
  },
  {
    id: "marathon",
    name: "Marathon",
    kilometers: 42.195,
    shortLabel: "26.2 mi"
  }
];

const SPLIT_GUIDE = [
  { label: "1 km", kilometers: 1 },
  { label: "1 mi", kilometers: KM_PER_MILE },
  { label: "5K", kilometers: 5 }
];

export function getDistanceById(id) {
  return DISTANCES.find((distance) => distance.id === id) ?? DISTANCES[1];
}

export function timePartsToSeconds({ hours = 0, minutes = 0, seconds = 0 }) {
  const totalSeconds =
    (Number(hours) || 0) * 3600 +
    (Number(minutes) || 0) * 60 +
    (Number(seconds) || 0);

  return totalSeconds > 0 ? totalSeconds : 0;
}

export function finishTimeFromSpeed(speedKmh, distanceKm) {
  return (distanceKm / speedKmh) * 3600;
}

export function speedFromFinishTime(totalSeconds, distanceKm) {
  return distanceKm / (totalSeconds / 3600);
}

export function toKilometersPerHour(speed, unit = "kmh") {
  return unit === "mph" ? speed * KM_PER_MILE : speed;
}

export function fromKilometersPerHour(speedKmh, unit = "kmh") {
  return unit === "mph" ? speedKmh / KM_PER_MILE : speedKmh;
}

export function paceSecondsToSpeed(paceSeconds, unit = "km") {
  const unitDistance = unit === "mi" ? KM_PER_MILE : 1;
  return unitDistance / (paceSeconds / 3600);
}

export function speedToPaceSeconds(speedKmh, unit = "km") {
  const unitDistance = unit === "mi" ? KM_PER_MILE : 1;
  return (unitDistance / speedKmh) * 3600;
}

export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "--";
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

export function formatPace(secondsPerUnit, unit = "km") {
  return `${formatDuration(secondsPerUnit)} /${unit}`;
}

export function formatSpeed(speedKmh, unit = "kmh") {
  const value = fromKilometersPerHour(speedKmh, unit);
  const suffix = unit === "mph" ? "mph" : "km/h";
  const decimals = value >= 10 ? 1 : 2;

  return `${value.toFixed(decimals)} ${suffix}`;
}

export function calculatePerformance(input) {
  const selectedDistance = getDistanceById(input.distanceId);
  let speedKmh = 0;

  if (input.mode === "pace") {
    const paceSeconds =
      (Number(input.paceMinutes) || 0) * 60 + (Number(input.paceSeconds) || 0);

    if (paceSeconds <= 0) {
      return { error: "Enter a pace greater than zero." };
    }

    speedKmh = paceSecondsToSpeed(paceSeconds, input.paceUnit);
  } else if (input.mode === "speed") {
    const speedValue = Number(input.speedValue);

    if (!Number.isFinite(speedValue) || speedValue <= 0) {
      return { error: "Enter a speed greater than zero." };
    }

    speedKmh = toKilometersPerHour(speedValue, input.speedUnit);
  } else if (input.mode === "finish") {
    const finishSeconds = timePartsToSeconds({
      hours: input.finishHours,
      minutes: input.finishMinutes,
      seconds: input.finishSeconds
    });

    if (finishSeconds <= 0) {
      return { error: "Enter a finish time greater than zero." };
    }

    speedKmh = speedFromFinishTime(finishSeconds, selectedDistance.kilometers);
  } else {
    return { error: "Unsupported calculation mode." };
  }

  if (!Number.isFinite(speedKmh) || speedKmh <= 0) {
    return { error: "Input values produced an invalid result." };
  }

  return {
    selectedDistance,
    selectedFinishSeconds: finishTimeFromSpeed(
      speedKmh,
      selectedDistance.kilometers
    ),
    pacePerKilometerSeconds: speedToPaceSeconds(speedKmh, "km"),
    pacePerMileSeconds: speedToPaceSeconds(speedKmh, "mi"),
    projections: DISTANCES.map((distance) => ({
      ...distance,
      finishSeconds: finishTimeFromSpeed(speedKmh, distance.kilometers)
    })),
    splits: SPLIT_GUIDE.map((split) => ({
      ...split,
      finishSeconds: finishTimeFromSpeed(speedKmh, split.kilometers)
    })),
    speedKmh
  };
}
