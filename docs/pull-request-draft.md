## Summary

- redesign the calculator into a compact one-screen tool with the distance
  slider, active metric card, and live derived outputs visible together
- replace the old mode-based state model with a unified calculator engine that
  supports live pace, speed, and finish-time derivation plus pace/time locks
- preserve valid one-screen calculator scenarios in the query string and clear
  malformed or contradictory URL state back to the default calculator
- add a compact selected-distance split disclosure that updates live with the
  current pace, speed, time, and distance state
- add DOM integration coverage for slider and lock behavior, update layout
  accessibility checks, and refresh repo smoke checks for the new markup
- refresh product docs and the publish helper so the shipped repo and eventual
  PR metadata match the redesigned one-screen calculator

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] `npm run pr:dry-run`
- [x] Other: added unit coverage for pace -> speed/time, speed -> pace/time,
      locked time + distance changes, and locked pace + distance changes
- [x] Other: added DOM integration coverage for slider-driven recalculation and
      lock interactions
- [x] Other: added URL-state coverage for restoring valid scenarios, clearing
      malformed query state, and syncing lock-driven edits without reloads
- [x] Other: added split-row coverage for derived values and the selected
      distance disclosure in both calculator and DOM tests

## Risks

- The sandbox has no browser or image-capture binary available, so I could not
  attach before/after screenshots from this environment.

## Preview notes

- Before: the page opened with a large editorial hero and mode-based form
  panels that pushed the main interaction below the fold on common laptop
  viewports.
- After: the primary view is a single compact frame with a live distance
  slider, preset chips, three visible metric cards, and compact disclosures
  for both common race projections and selected-distance splits.
- Interaction: entering pace immediately reveals speed and finish time for the
  selected distance; locking time or pace keeps that metric fixed while the
  slider recomputes the others.

## Demo script

- Open the page on the default calculator view and show that the distance
  slider plus the pace, speed, and finish-time cards are visible together
  without scrolling.
- Enter a pace of `8:00 /mi`, then drag the distance slider from `5K` through
  `Half Marathon` to show speed stays visible while finish time updates live.
- Turn on the finish-time lock, set the time to `1:45:00`, then drag the
  slider toward `Marathon` to show the required pace and speed recompute
  against the fixed time target.

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed
