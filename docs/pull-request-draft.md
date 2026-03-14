<!-- PR_TITLE: Compress calculator into a single compact goal-focused surface -->

## Summary

- collapse the calculator body into one compact shared surface instead of
  separate semantic cards
- introduce `Adjust`, `Goal`, `Auto`, and `Ready` states so the target
  metric is clearly distinct from editable inputs and derived values
- render locked pace/time targets as bright readouts with hidden editors
  while preserving the existing pace, speed, finish-time, and URL-state
  calculations

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`

## Risks

- Medium: the markup and CSS changed substantially, so visual regressions
  on small screens are the main thing to watch
- Low: the calculator math and deep-link serialization stay on the
  existing logic path and remain covered by automated tests

## Checklist

- [x] Scope matches the linked Linear issue
- [ ] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Locked pace and time now render as bright goal readouts instead of
  normal editable-looking inputs.
- The distance controls and all three metrics now live in one compact
  calculator surface with row-based state changes.
