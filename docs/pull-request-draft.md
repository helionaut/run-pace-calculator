<!-- PR_TITLE: Add a compact workout split builder below the calculator -->

## Summary

- add a workout split builder below the calculator with dense single-line split
  rows that show distance, pace, and time together
- support adding the current calculator state as a split, then selecting,
  copying, deleting, and saving edits back into an existing split
- tighten headings, padding, and spacing so the extra planning UI fits cleanly
  on mobile and desktop without horizontal overflow

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] Built-preview desktop/mobile verification via a temporary Puppeteer run
  against `dist`

## Risks

- Low: split plans are intentionally in-memory only for now, so refreshing the
  page still resets the lower split list even though the main calculator state
  remains shareable via the URL
- Low: split rows are rendered from saved calculator snapshots, so future
  calculator-state shape changes need to preserve that snapshot compatibility

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop built-preview screenshot reviewed with two saved workout splits; both
  split rows rendered as dense single-line rows with inline actions, while
  distance, pace, and time all stayed visible without horizontal overflow.
- Mobile built-preview screenshot reviewed in the selected-split edit state;
  the bottom action switched to `Save split` with the save styling, and both
  saved split rows still rendered as dense single-line rows with inline actions
  and no horizontal overflow at 390px width.
- The screenshots matched the issue request: the calculator stayed compact
  while the new split-builder flow supported add/save/edit semantics below the
  main calculator.
