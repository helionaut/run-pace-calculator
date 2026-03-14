<!-- PR_TITLE: Make calculator a single-card one-screen mobile tool -->

## Summary

- collapse the mobile UI into one dense calculator card instead of a
  header plus separate metric and disclosure sections
- keep distance, pace, speed, finish time, and common race projections
  visible together while shortening status and lock copy
- drop the rendered split section, keep the DOM renderer tolerant of the
  compact shell, and update the tests/docs to match the new layout

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`

## Risks

- Medium: the markup and CSS changed substantially, so visual regressions
  on small screens are the main thing to watch
- Low: the calculator math and deep-link serialization stay on the
  existing logic path and remain covered by automated tests
- Low: this environment could not complete a browser screenshot capture
  because the host is missing Playwright browser dependencies

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- The calculator now opens as a single dense card with no standalone
  header or extra disclosure panels.
- Locked pace and time stay visually distinct while the projection strip
  remains visible inside the same card.
- Browser screenshot capture was attempted, but the host is missing the
  Playwright runtime libraries needed to launch Chromium here.
