## Summary

- add cumulative kilometer and mile split targets for the currently selected
  distance
- render a compact selected-distance split table in the summary area and
  include final partial rows for half marathon and marathon distances
- expand automated coverage for metric, imperial, half-marathon, marathon,
  immediate split-update behavior, compact split-table markup, and
  `main.js` DOM wiring
- strengthen publish and handoff automation so detached-HEAD CI runs keep the
  correct branch metadata, same-branch handoff restores succeed, and
  regenerated handoff summaries preserve the latest auth and network blocker
  snapshot automatically

## Testing

- [x] `node --test tests/handoff.test.js`
- [x] `npm test -- tests/calculator.test.js`
- [x] `node --test tests/main.test.js`
- [x] `npm test`
- [x] `npm run build`
- [x] Other: `npm run check`
- [x] Other: `npm run pr:dry-run`
- [x] Other: `npm run handoff:prepare`
- [x] Other: `npm run handoff:verify -- .handoff/HEL-18/HEL-18-handoff-manifest.json`
- [x] Other: `./.handoff/HEL-18/resume-handoff.sh <fresh-main-clone> --validate --dry-run-publish`
- [x] Other: `./.handoff/HEL-18/resume-handoff.sh <same-branch-clone> --validate --dry-run-publish`

## Risks

- Long custom distances rely on the split table's bounded scroll area to stay
  within the one-screen layout.
- The branch includes handoff-workflow polish alongside the calculator feature,
  so the eventual PR should be published from this updated draft rather than an
  earlier feature-only version.

## Preview Notes

- the summary area now shows a compact selected-distance split table directly
  beside the primary result cards
- metric mode renders kilometer rows, imperial mode renders mile rows, and
  non-whole race distances end with a highlighted final partial split row
- long split lists rely on the bounded table area to stay within the one-screen
  layout

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed
