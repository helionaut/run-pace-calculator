export const KM_PER_MILE = 1.609344;

export const COMMON_DISTANCES = [
  { label: "1 Mile", distanceKm: KM_PER_MILE, display: "1 mi" },
  { label: "5K", distanceKm: 5, display: "5 km" },
  { label: "10K", distanceKm: 10, display: "10 km" },
  { label: "10 Miles", distanceKm: KM_PER_MILE * 10, display: "10 mi" },
  { label: "Half Marathon", distanceKm: 21.0975, display: "21.1 km" },
  { label: "Marathon", distanceKm: 42.195, display: "42.2 km" },
];

export function convertSpeed(value, fromUnit, toUnit) {
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  if (fromUnit === toUnit) {
    return value;
  }

  if (fromUnit === "km" && toUnit === "mi") {
    return value / KM_PER_MILE;
  }

  if (fromUnit === "mi" && toUnit === "km") {
    return value * KM_PER_MILE;
  }

  return Number.NaN;
}

export function distanceToKm(distance, unit) {
  if (!Number.isFinite(distance) || distance <= 0) {
    return Number.NaN;
  }

  return unit === "mi" ? distance * KM_PER_MILE : distance;
}

export function paceSecondsToSpeedKph(paceSeconds, unit) {
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) {
    return Number.NaN;
  }

  const pacePerKm = unit === "mi" ? paceSeconds / KM_PER_MILE : paceSeconds;
  return 3600 / pacePerKm;
}

export function speedKphToPaceSeconds(speedKph, unit) {
  if (!Number.isFinite(speedKph) || speedKph <= 0) {
    return Number.NaN;
  }

  const speedInRequestedUnit =
    unit === "mi" ? convertSpeed(speedKph, "km", "mi") : speedKph;

  return 3600 / speedInRequestedUnit;
}

export function splitPaceSeconds(paceSeconds) {
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) {
    return null;
  }

  const rounded = Math.round(paceSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;

  return { minutes, seconds };
}

export function formatPace(speedKph, unit) {
  const parts = splitPaceSeconds(speedKphToPaceSeconds(speedKph, unit));

  if (!parts) {
    return "--";
  }

  return `${parts.minutes}:${String(parts.seconds).padStart(2, "0")} /${unit}`;
}

export function predictedTimeSeconds(speedKph, distanceKm) {
  if (
    !Number.isFinite(speedKph) ||
    speedKph <= 0 ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0
  ) {
    return Number.NaN;
  }

  return (distanceKm / speedKph) * 3600;
}

export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
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

export function formatDistance(distanceKm, unit) {
  const value = unit === "mi" ? distanceKm / KM_PER_MILE : distanceKm;
  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const normalized = value.toFixed(precision).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");

  return `${normalized} ${unit}`;
}
