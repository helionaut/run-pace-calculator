<!-- PR_TITLE: Replace lock-based calculator with implicit last-two-input solving -->

## Summary

- replace the lock-based calculator state with implicit last-two-input
  solving across distance, movement rate, and time
- combine pace and speed into a single movement-rate card and tighten the
  mobile layout so the calculator fits on one phone screen
- update deep-link serialization, dist verification, and reducer/DOM
  tests for the new interaction model

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`

## Risks

- Medium: the calculator state and URL model changed substantially, so any
  saved deep links from the old lock-based format should be rechecked
- Low: the layout is intentionally tight on mobile, so extra copy or new
  controls could push the projection strip below the first viewport again
- Low: pace/speed displays round to user-facing precision while a
  canonical internal rate preserves exact time math across unit switches

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop screenshot reviewed at `/tmp/hel24-shots/desktop-pace.png`.
- Mobile screenshots reviewed at `/tmp/hel24-shots/mobile-pace.png` and
  `/tmp/hel24-shots/mobile-time.png`; both fit an iPhone 13 viewport with
  no scrolling.
- The same mobile review screenshots were posted to Telegram topic `7`
  before publishing.
