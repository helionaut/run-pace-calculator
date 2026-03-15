<!-- PR_TITLE: Add compact split reordering controls -->

## Summary

- add explicit move earlier and move later controls to each saved split row
- preserve split selection/save state by reordering rows around the split id
  instead of the current row position
- tighten split-row spacing and button sizing so four row controls still fit
  the compact single-line mobile layout
- cover reorder behavior, control labeling, and selection preservation in
  `tests/main.test.js`

## Testing

- [x] `npm run check`
- [x] Chromium preview review against the built `dist/` output
- [x] Other: desktop/mobile split-builder screenshots reviewed locally plus a
  `360px` overflow check (`scrollWidth === viewport`)

## Risks

- Medium: split-row controls now activate before blur-driven rerenders, so
  pointer and keyboard activation need to stay aligned if the row actions grow
- Low: the tighter mobile spacing may need another pass if future split rows add
  more content or longer metric strings

## Checklist

- [x] Scope matches the linked Linear issue
- [ ] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop review: after selecting split 2, editing its distance, and moving it
  earlier, the summary switched to `Update split 1` and the saved row order
  changed to 5K / 10K / 1K without losing the dirty state.
- Mobile review at 360px: after saving that edit and moving the split back
  later, the split rows stayed on one line with all four row actions visible
  and no horizontal overflow.
