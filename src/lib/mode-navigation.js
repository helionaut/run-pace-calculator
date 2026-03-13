export function getModeFromNavigationKey(modes, currentMode, key) {
  if (!Array.isArray(modes) || modes.length === 0) {
    return null;
  }

  const currentIndex = Math.max(modes.indexOf(currentMode), 0);

  if (key === "ArrowRight" || key === "ArrowDown") {
    return modes[(currentIndex + 1) % modes.length];
  }

  if (key === "ArrowLeft" || key === "ArrowUp") {
    return modes[(currentIndex - 1 + modes.length) % modes.length];
  }

  if (key === "Home") {
    return modes[0];
  }

  if (key === "End") {
    return modes[modes.length - 1];
  }

  return null;
}
