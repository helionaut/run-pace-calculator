## Summary

- add URL serialization for valid calculator scenarios so users can copy a
  deep link and reopen the same state later
- restore calculator state from `location.search` on load for mode, unit,
  preset or custom distance, convert source, and entered metrics
- reject malformed or contradictory query state by falling back to the default
  calculator and keep empty or invalid edits off the URL

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] `npm run handoff:verify -- /home/helionaut/workspaces/HEL-17/.handoff/HEL-17/HEL-17-handoff-manifest.json`

## Risks

- the Linear issue text references a redesigned calculator with slider and lock
  controls, but this checkout only contains the current preset or custom
  distance and convert-source state model, so URL persistence covers that
  shipped UI rather than absent controls
- GitHub publishing is still blocked in this environment by invalid `gh`
  auth and failed DNS resolution for `github.com`

## Preview Notes

- no visual UI was added; the behavior change is that valid calculator states
  now populate the query string and reload into the same scenario
- resetting to an empty calculator removes the query string and returns the
  page to a clean URL

## Checklist

- [x] Scope matches the linked Linear issue as far as this checkout's current
  state model allows
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

## Publish Notes

If GitHub access is still blocked in the current checkout:

1. Import the handoff bundle into a writable clone with:
   `git -C <target-repo-dir> fetch /home/helionaut/workspaces/HEL-17/.handoff/HEL-17/run-pace-calculator-eugeniy-hel-17-add-shareable-url-state-for-calculator-inputs-and-lock-mode.bundle eugeniy/hel-17-add-shareable-url-state-for-calculator-inputs-and-lock-mode:eugeniy/hel-17-add-shareable-url-state-for-calculator-inputs-and-lock-mode`
   `git -C <target-repo-dir> switch eugeniy/hel-17-add-shareable-url-state-for-calculator-inputs-and-lock-mode`
2. Push branch `eugeniy/hel-17-add-shareable-url-state-for-calculator-inputs-and-lock-mode`.
3. Create the PR with title `Add shareable URL state for calculator inputs`,
   or rerun `./scripts/create_pr.sh` after import to use
   `docs/pull-request-title.txt` and the body above.
