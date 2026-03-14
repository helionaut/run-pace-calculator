<!-- PR_TITLE: Add short-distance quick presets for km and mile modes -->

## Summary

- add quick distance chips for `100m`, `500m`, and `1 km` in kilometer mode
- add quick distance chips for `0.1 mi`, `0.5 mi`, and `1 mi` in mile mode
- expand the preset strip tests and tighten the mobile chip spacing so the
  larger button set stays compact on small screens

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] `node --test tests/calculator.test.js tests/main.test.js tests/url-state.test.js`

## Risks

- Low: the new mile presets intentionally use native mile distances, so they
  remain separate from the existing converted-kilometer defaults
- Low: the preset strip now wraps into an extra row on narrow screens, so
  future label length increases could require another responsive pass

## Checklist

- [x] Scope matches the linked Linear issue
- [ ] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop km-mode screenshot reviewed against the built app with the new
  `100m`, `500m`, `1 km`, `5K`, `10K`, `Half`, and `Marathon` chips.
- Desktop mile-mode screenshot reviewed against the built app with the new
  `0.1 mi`, `0.5 mi`, `1 mi`, `5 mi`, `10 mi`, `Half Marathon`, and
  `Marathon` chips.
- Mobile km-mode and mile-mode screenshots reviewed at a `390px` viewport.
- The mobile viewport check confirmed `scrollWidth === innerWidth`, and the
  preset row plus projection strip stayed within the viewport.
