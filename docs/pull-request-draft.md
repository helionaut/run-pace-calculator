<!-- PR_TITLE: Keep half-marathon and marathon labels stable across unit switch -->

## Summary

- keep the mile-mode `Half Marathon` and `Marathon` quick preset labels
  canonical instead of renaming them to `13.1 mi` and `26.2 mi`
- leave the generic quick buttons unitized in miles as `5 mi` and `10 mi`
- add calculator-view and DOM regression coverage so the race-name labels stay
  stable while the selected distance summary still shows the native mile value

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] `node --test tests/calculator.test.js tests/main.test.js`

## Risks

- Low: the fix only changes the mile quick-preset labels for half marathon and
  marathon, so any future preset additions still need explicit label coverage
- Low: half-marathon and marathon selections in mile mode still use the native
  `13.1 mi` and `26.2 mi` distances, which remains important for race-name
  buttons that no longer expose the number directly

## Checklist

- [x] Scope matches the linked Linear issue
- [ ] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop miles-state screenshot reviewed locally with the half-marathon preset
  active; the button label stayed `Half Marathon` while the distance summary
  showed `13.1 mi`.
- Mobile miles-state screenshot reviewed locally with the marathon preset
  active; the button label stayed `Marathon` while the distance summary showed
  `26.2 mi`.
- The screenshots matched the issue request: only the generic numeric quick
  buttons changed to mile labels, while the two race-name presets stayed
  canonical across the unit switch.
