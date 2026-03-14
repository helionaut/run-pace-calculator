<!-- PR_TITLE: Tighten top row and normalize unit-specific distance controls -->

## Summary

- tighten the calculator header so the helper/status copy sits inline with
  the unit toggle and reset controls instead of taking its own row
- swap the quick distance chips to unit-aware labels and values in miles
  mode, while preserving the existing kilometer-side presets
- round slider-driven distance selections to at most two decimals in the
  active unit and add calculator/DOM tests for the new behavior

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`

## Risks

- Low: the inline status copy now truncates on narrow widths to keep the top
  row compact, so future helper text should stay short
- Low: mile-mode quick chips intentionally use native mile distances, so a
  converted kilometer default remains a custom selection after a unit switch
- Low: slider interaction now snaps to two-decimal precision in the active
  unit, which trades a small amount of fine-grained range control for cleaner
  displayed values

## Checklist

- [x] Scope matches the linked Linear issue
- [ ] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop screenshot reviewed at
  `/home/helionaut/workspaces/HEL-26/screenshots/hel-26-desktop-default.png`.
- Desktop miles-state screenshot reviewed at
  `/home/helionaut/workspaces/HEL-26/screenshots/hel-26-desktop-mi.png`.
- Mobile miles-state screenshot reviewed at
  `/home/helionaut/workspaces/HEL-26/screenshots/hel-26-mobile-mi.png`.
- The screenshots matched the issue request: thinner top row, inline helper
  copy, unit-aware mile chips, and two-decimal distance display after the
  slider-driven selection.
