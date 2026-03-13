# Run Pace Calculator PRD

## 1. Document Status

- Ticket: `HEL-9`
- Repository: `helionaut/run-pace-calculator`
- Status: Draft for implementation
- Last updated: 2026-03-12

## 2. Product Summary

Run Pace Calculator is a lightweight web app that helps runners convert between
distance, finish time, pace, and speed without needing an account, backend, or
native app. The first public release is a single-page calculator hosted on
GitHub Pages and optimized for fast use on mobile and desktop.

The product must answer three common questions:

1. "What was my pace for this run?"
2. "If I can hold this pace, what finish time will I get?"
3. "How do pace and speed convert between kilometers and miles?"

## 3. Goals

- Provide trustworthy pace, speed, and finish-time calculations for common
  running distances.
- Make the calculator usable in under 10 seconds for a returning user.
- Work well on mobile browsers without login, ads, or installation.
- Be simple enough to deploy as a static site on GitHub Pages.

## 4. Target Users

### Primary Users

- Recreational runners who want a quick answer after a workout or before a race
- Race participants comparing goal times for 5K, 10K, half marathon, and
  marathon distances
- Coaches, pacers, or friends helping someone translate a target pace into a
  finish time

### Secondary Users

- Treadmill runners converting between displayed speed and outdoor pace
- New runners who are more comfortable with either miles or kilometers and need
  the other unit translated

## 5. Primary Use Cases

1. A runner enters a race distance and finish time to see average pace and
   speed.
2. A runner enters a race distance and target pace to see predicted finish
   time.
3. A runner enters a pace or speed value and converts it to the matching value
   in the current and alternate unit systems.
4. A runner taps a preset distance and adjusts it slightly for a custom route.
5. A runner switches between kilometers and miles without re-entering all
   values.

## 6. Scope

### In Scope for v1

- A single-page calculator with three modes:
  - `Pace`
  - `Finish Time`
  - `Convert`
- Kilometer and mile support
- Race-distance presets plus custom distance entry
- Automatic recalculation when inputs are valid
- Inline validation and clear empty/stale states
- Static deployment on GitHub Pages

### Out of Scope and Non-Goals

- User accounts, saved history, cloud sync, or sharing links with persisted
  state
- Training plans, workouts, splits, grade-adjusted pace, VO2 max, or calorie
  estimates
- Support for server-side computation or any backend API
- Localization beyond English in v1
- Advanced units such as meters per second, minutes per 100 meters, or track
  split tables
- Native mobile apps or offline/PWA support

## 7. Functional Requirements

### 7.1 Global UI Requirements

| Area | Requirement |
| --- | --- |
| Layout | The app is a single page with a title, mode selector, input panel, results panel, and reset control. |
| Mode selector | The mode selector uses three visible tabs: `Pace`, `Finish Time`, and `Convert`. |
| Default state | On first load, the app opens in `Pace` mode with distance unit `km`. |
| Calculation trigger | Results update automatically whenever all required inputs for the current mode are valid. No submit button is required in v1. |
| Reset | Reset clears editable inputs and results, resets the preset selector to `Custom`, and preserves the current mode and distance unit. In `Convert` mode it also preserves the selected source type. |
| Results empty state | Before the first successful calculation, the results panel shows placeholder text: `Enter valid values to calculate.` |
| Results stale state | If the user had valid results and then changes a required input to an incomplete or invalid value, the last results remain visible but are marked `Out of date` until the inputs become valid again. |
| Accessibility | Every input has a visible label, keyboard focus order is logical, and validation text is exposed as text instead of color alone. |
| Responsive behavior | The layout must remain usable at 320 px width and scale cleanly through desktop widths without horizontal scrolling. |

### 7.2 Units and Shared Inputs

| Input | Requirement |
| --- | --- |
| Distance unit toggle | The user can select `km` or `mi`. The selected unit controls distance input, pace labels, and speed labels. |
| Distance input | Distance accepts decimal numeric input only, uses `.` as the decimal separator, must be greater than `0`, and must be less than or equal to `1000`. |
| Decimal parsing | Distance and speed fields accept only digits and one decimal point. Commas and localized separators are out of scope for v1. |
| Distance precision | Manual distance entry must support up to 5 decimal places. |
| Presets | The preset selector contains `Custom`, `5K`, `10K`, `Half Marathon`, and `Marathon`. |
| Preset behavior | Selecting a preset fills the distance field using the exact canonical distance. Editing the distance field manually changes the preset back to `Custom`. |
| Preset plus unit switch | If a named preset is selected and the user changes units, the preset remains selected and the displayed distance updates from the same canonical value. |

### 7.3 Mode Requirements

| Mode | Required user inputs | Primary result | Secondary results |
| --- | --- | --- | --- |
| `Pace` | Distance, finish time | Pace in the selected unit | Speed in the selected unit and pace in the alternate unit |
| `Finish Time` | Distance, pace | Finish time | Speed in the selected unit and pace in the alternate unit |
| `Convert` | Exactly one source type: `Pace` or `Speed` | Matching converted value in the selected unit | Matching values in the alternate unit system |

#### `Pace` mode

- Finish time uses three whole-number fields: hours, minutes, seconds.
- Allowed ranges are:
  - hours: `0` to `99`
  - minutes: `0` to `59`
  - seconds: `0` to `59`
- At least one finish-time field must be non-zero.
- When all required inputs are valid, the app computes pace and speed.

#### `Finish Time` mode

- Pace uses two whole-number fields: minutes, seconds.
- Allowed ranges are:
  - minutes: `0` to `59`
  - seconds: `0` to `59`
- Pace cannot be `00:00`.
- When all required inputs are valid, the app computes finish time and speed.

#### `Convert` mode

- The user selects exactly one source type:
  - `Pace`
  - `Speed`
- When `Pace` is selected:
  - the app shows the structured pace input and hides the speed input
  - pace input uses minutes `0` to `59` and seconds `0` to `59`
  - pace cannot be `00:00`
  - the primary result is speed in the selected unit
- When `Speed` is selected:
  - the app shows the numeric speed input and hides the pace input
  - speed accepts decimal numeric input only
  - speed must be greater than `0` and less than or equal to `60`
  - the primary result is pace in the selected unit
- In all `Convert` mode cases, the secondary results show the alternate-unit
  pace and speed values.
- Changing the source type clears the newly hidden source input and marks any
  previous results as stale until a new valid source value is entered.

## 8. Conversion and Calculation Rules

### 8.1 Canonical Values

- Internal distance calculations use kilometers.
- Internal time calculations use seconds.
- Mile-to-kilometer conversion uses the exact factor `1 mi = 1.609344 km`.
- Speed is derived from distance per hour.

### 8.2 Exact Preset Distances

| Preset | Canonical kilometers | Exact miles for display when `mi` is selected |
| --- | --- | --- |
| `5K` | `5` | `3.10686` |
| `10K` | `10` | `6.21371` |
| `Half Marathon` | `21.0975` | `13.10938` |
| `Marathon` | `42.195` | `26.21876` |

### 8.3 Formulas

- `pace_seconds_per_selected_unit = finish_time_seconds / distance_in_selected_unit`
- `speed_in_selected_unit_per_hour = distance_in_selected_unit / (finish_time_seconds / 3600)`
- `finish_time_seconds = pace_seconds_per_selected_unit * distance_in_selected_unit`
- `speed_in_selected_unit_per_hour = 3600 / pace_seconds_per_selected_unit`
- `pace_seconds_per_selected_unit = 3600 / speed_in_selected_unit_per_hour`

### 8.4 Unit Toggle Behavior

When the user changes the distance unit toggle, the app converts already entered
values instead of clearing them.

- Distance values convert in place between kilometers and miles.
- Pace values convert in place between `min/km` and `min/mi`.
- Speed values convert in place between `km/h` and `mph`.
- Finish time values do not change when units change.
- If the converted values still satisfy the current mode requirements, results
  recalculate immediately.

### 8.5 Rounding and Display Rules

- Finish time results round to the nearest whole second and display as
  `hh:mm:ss`.
- Pace results round to the nearest whole second and display as `mm:ss /unit`.
- Speed results display with 2 decimal places.
- Converted distance values displayed after a unit switch round to at most
  5 decimal places and trim trailing zeros.
- Preset-derived distances must use the exact canonical value before rounding
  for display.

### 8.6 Validation and Error Rules

- Any required field that is empty, out of range, or non-numeric blocks fresh
  calculation.
- Validation messages appear inline next to or below the relevant field.
- The app must never silently coerce an invalid field into a valid one.
- Leading zeros are allowed in structured time fields.
- Partial structured inputs are treated as incomplete, not as zero-filled valid
  input.

## 9. Non-Functional Requirements

- The app must be fully client-side and require no backend service.
- The app must load and function in current Chrome, Safari, Firefox, and Edge.
- The initial static payload should stay small enough that first load feels
  instant on a normal mobile connection; no framework is required.
- The implementation must avoid external dependencies that are unnecessary for a
  static calculator.

## 10. GitHub Pages Deployment Assumptions

- v1 ships as a static site compatible with GitHub Pages; no server-side
  language runtime is available.
- Deployment should use GitHub Pages with GitHub Actions as the publishing
  source.
- The published artifact must expose a top-level entry file such as
  `index.html`.
- If the project uses a branch-and-folder publishing source instead of a custom
  workflow, the published branch must retain a `/docs` folder containing the
  deployable `index.html`.
- If prebuilt static assets are published from a branch source, the deployable
  output should include `.nojekyll` unless the project intentionally relies on a
  Jekyll build.
- The app must work when served from a project-site subpath such as
  `/run-pace-calculator/`, so asset paths should be relative or otherwise base
  path aware.
- The v1 site should remain a single-route page. If a client-side router is
  added later, a Pages-compatible fallback strategy will be required.
- The deployed site and build process must stay within GitHub Pages limits for
  a static site, including the current documented 1 GB site size limit and
  10-minute deployment timeout.

## 11. Acceptance Criteria for the First Public Release

1. The repository contains `docs/PRD.md` with the requirements in this document.
2. A developer can implement the v1 UI without needing follow-up decisions on:
   - available modes
   - default mode and units
   - required inputs per mode
   - validation ranges
   - race-distance presets
   - conversion formulas
   - rounding rules
   - reset behavior
   - empty and stale result states
3. The app supports the following release flows:
   - calculate pace from distance plus finish time
   - calculate finish time from distance plus pace
   - convert pace and speed between kilometer and mile units
4. Unit changes convert already-entered values instead of wiping them.
5. Preset distance selection and fallback to `Custom` after manual edits behave
   as specified.
6. GitHub Pages deployment assumptions are documented clearly enough to guide
   the implementation and deployment setup.
