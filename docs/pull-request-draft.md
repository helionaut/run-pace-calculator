## Summary

- add cumulative kilometer and mile split targets for the currently selected
  distance
- render a compact selected-distance split table in the summary area and
  include final partial rows for half marathon and marathon distances
- cover split generation and compact split-table markup in automated tests

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] Other: `npm run check`

## Risks

- GitHub push and PR creation are still blocked in this sandbox because
  `github.com` DNS resolution and `gh` auth are unavailable here.
- Long custom distances rely on the split table's bounded scroll area to stay
  within the one-screen layout.

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed
