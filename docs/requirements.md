# Requirements

## Functional Requirements

- The app must present one compact calculator surface instead of separate
  multi-section modes.
- The app must support three driving inputs:
  - Pace to speed and projected finish time.
  - Speed to pace and projected finish time.
  - Finish time for a selected race distance to required pace and speed.
- The app must support both metric and imperial inputs:
  - Pace in minutes per kilometer or mile.
  - Speed in km/h or mph.
- The app must expose common race distances:
  - 5K
  - 10K
  - Half marathon
  - Marathon
- The app must allow custom distances in addition to the named presets.
- The app must provide a distance slider that updates the selected distance
  continuously.
- The app must show the projected finish time for the selected distance.
- The app must show equivalent pace in both `/km` and `/mi`.
- The app must show equivalent speed in both `km/h` and `mph`.
- The app must show a projection list for all supported race distances inside
  the primary calculator surface.
- The app must support locking at least pace and finish time so distance
  changes can recompute the remaining derived values.
- The app must make user-provided values visually distinct from auto-derived
  values.
- Inputs must validate against zero or missing values with a clear inline
  message.
- Time-part inputs must reject decimal values and invalid minute/second ranges
  with a clear inline message while still allowing long pace minutes.

## Non-Functional Requirements

- The repository must remain deployable as a static site on GitHub Pages.
- The implementation must not rely on a server.
- The site must be responsive from mobile widths upward.
- The primary calculator interaction should fit in a single screen on a common
  laptop viewport.
- Core calculation logic must live in pure functions that can be tested in Node.
- The site must run without an install step beyond the built-in Node runtime.

## Delivery Requirements

- Provide a `README` with local run and build instructions.
- Provide `PRD`, requirements, and implementation-plan documents in-repo.
- Provide a GitHub Actions workflow that can publish the static build output to
  GitHub Pages.
