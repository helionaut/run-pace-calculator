<!-- PR_TITLE: Persist workout split rows in the shareable URL state -->

## Summary

- persist workout split rows and selected-row state into the shareable URL so
  split workouts survive refresh, copy, and reopen flows
- restore split-builder state safely on load, while keeping malformed or
  partial split query data from breaking the existing calculator restore path
- clear split-builder state during reset and cover the new URL behavior with
  regression tests plus desktop/mobile verification

## Testing

- [x] `npm run check`
- [x] `node --test tests/url-state.test.js`
- [x] Verified in a clean browser context that a copied URL restored 2 split
  rows, kept split 1 selected in `Save split` / `Update split 1` state, and
  restored the editor to `12 km`, `5:00`, `1:00:00`

## Risks

- Low: split rows are stored in a JSON-encoded query param, so very large
  workouts will grow the share URL accordingly
- Low: malformed split payloads are intentionally dropped on restore, which
  favors a safe calculator load over partial split reconstruction

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop and mobile screenshots were captured against the built app after
  restoring a shared workout URL; both matched the requested outcome and kept
  the split builder intact.
