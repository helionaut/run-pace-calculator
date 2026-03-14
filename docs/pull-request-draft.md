<!-- PR_TITLE: Fix mobile input zoom and restore single-row distance chips -->

## Summary

- raise calculator input text to the Safari-safe `16px` threshold while keeping
  the compact mobile control sizing
- restore the distance preset chips to a single row on mobile and keep the chip
  labels from wrapping within their pills
- add a CSS regression test that prevents the 4-column wrapped preset layout
  and undersized mobile inputs from returning

## Testing

- [x] `npm run check`
- [x] Built-preview desktop/mobile verification via a temporary Playwright
  Chromium run against `dist`
- [x] Mobile preset row measured at `390px` width in both km and mi modes with
  `rowCount = 1`

## Risks

- Low: the mobile preset row still depends on a fixed 7-chip grid, so any
  future preset additions will need a deliberate responsive pass
- Low: Safari zoom prevention is achieved through the standard `16px` input
  threshold, so future restyling must avoid shrinking focused input text below
  that size again

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop built-preview screenshot reviewed against the compact single-screen
  calculator layout; no new wrapping or clipping was introduced.
- Mobile built-preview screenshots reviewed for default km view, focused-input
  view, and mi view at `390px` width; the quick preset chips stayed on one row
  in each state and the focused input remained fully in-layout.
- Computed mobile input font sizes were verified at `16px`; Safari no-zoom
  behavior is inferred from that threshold because WebKit could not run on this
  host due missing native libraries.
