# Requirements

## Functional Requirements

- The app must support three calculation modes:
  - Pace to speed and projected finish times.
  - Speed to pace and projected finish times.
  - Finish time for a selected race distance to pace and speed.
- The app must support both metric and imperial inputs:
  - Pace in minutes per kilometer or mile.
  - Speed in km/h or mph.
- The app must expose common race distances:
  - 1 mile
  - 5K
  - 10K
  - 10 miles
  - Half marathon
  - Marathon
- The app must show the projected finish time for the selected distance.
- The app must show equivalent pace in both `/km` and `/mi`.
- The app must show equivalent speed in both `km/h` and `mph`.
- The app must show a projection list for all supported race distances.
- Inputs must validate against zero or missing values with a clear inline
  message.

## Non-Functional Requirements

- The repository must remain deployable as a static site on GitHub Pages.
- The implementation must not rely on a server.
- The site must be responsive from mobile widths upward.
- Core calculation logic must live in pure functions that can be tested in Node.
- The site must run without an install step beyond the built-in Node runtime.

## Delivery Requirements

- Provide a `README` with local run and build instructions.
- Provide `PRD`, requirements, and implementation-plan documents in-repo.
- Provide a GitHub Actions workflow that can publish the static build output to
  GitHub Pages.
