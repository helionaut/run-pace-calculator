<!-- PR_TITLE: Match pace first-entry autofill to time input -->

## Summary

- make the pace minutes/seconds inputs auto-fill untouched zero values on the
  first edit, matching the existing finish-time input behavior
- keep the change in the UI event layer so calculator parsing, validation, URL
  state, and last-valid blur normalization keep their current behavior
- add a regression for the new pace autofill behavior and update the
  incomplete-pace blur test to cover a manually cleared seconds field

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] `node --test tests/calculator.test.js tests/main.test.js`

## Risks

- Low: the shared first-entry autofill helper now drives both pace and time
  groups, so any future grouped-input changes should keep their default zero
  values aligned with the field names
- Low: first-entry edits to pace seconds now auto-fill pace minutes with `0`,
  matching the existing time-group behavior even though the issue example
  focused on pace minutes first

## Checklist

- [x] Scope matches the linked Linear issue
- [ ] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop built-preview screenshot reviewed after typing `5` into pace minutes;
  pace seconds auto-filled to `00`, derived finish time showed `0:50:00`, and
  the calculator still fit the one-screen desktop layout with no overflow.
- Mobile built-preview screenshot reviewed after the same interaction; pace
  seconds auto-filled to `00`, derived finish time showed `0:50:00`, and the
  card stack still fit the intended one-screen mobile presentation with no
  horizontal overflow.
