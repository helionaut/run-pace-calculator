## Summary

- add cumulative kilometer and mile split targets for the currently selected
  distance
- render a compact selected-distance split table in the summary area and
  include final partial rows for half marathon and marathon distances
- expand automated coverage for metric, imperial, half-marathon, and marathon
  split behavior plus compact split-table markup
- strengthen the blocked-publish handoff flow so regenerated handoff summaries
  keep the latest auth and network blocker snapshot automatically

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] Other: `npm run check`
- [x] Other: `npm run handoff:prepare`
- [x] Other: `npm run handoff:verify -- .handoff/HEL-18/HEL-18-handoff-manifest.json`
- [x] Other: `npm run pr:publish` (falls back to verified handoff because GitHub auth/network are blocked in this environment)

## Risks

- GitHub push and PR creation are still blocked in this sandbox because
  `github.com` DNS resolution and `gh` auth are unavailable here.
- Long custom distances rely on the split table's bounded scroll area to stay
  within the one-screen layout.
- The branch includes handoff-workflow polish alongside the calculator feature,
  so the eventual PR body should be published from this updated draft rather
  than an earlier feature-only version.

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed
