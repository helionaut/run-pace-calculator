## Summary

- label result values as `Entered`, `Derived`, `Locked`, and `Last valid`
  so provenance stays obvious across pace, finish-time, and convert modes
- add matching provenance cues to the active input clusters and a dedicated
  locked-value summary in the compact context card
- preserve stale-result clarity and accessibility with explicit text labels,
  screen-reader-friendly provenance regions, and tests for entered-vs-derived
  plus stale-state rendering paths

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] `npm run handoff:verify -- .handoff/HEL-19/HEL-19-handoff-manifest.json`
- [ ] Other:

## Risks

- The UI change was validated through automated tests and static asset checks,
  but not through an interactive browser session in this sandbox.

## Preview notes

- Input panels now show compact provenance badges so the active entered source
  reads differently from calculator-derived fields.
- The summary area adds provenance badges beside result values and a dedicated
  locked-input block that stays readable when the result is stale.
- Stale results continue to show the last valid answer, now explicitly marked
  as `Last valid` instead of looking like fresh output.

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

## Publish notes

If GitHub access is still blocked in the current checkout:

1. Reuse the verified handoff directory at
   `.handoff/HEL-19/` or regenerate it with `npm run handoff:prepare`.
2. Import the bundle into another writable clone with:
   `git -C <target-repo-dir> fetch .handoff/HEL-19/run-pace-calculator-eugeniy-hel-19-add-confidence-focused-result-presentation-and-input.bundle eugeniy/hel-19-add-confidence-focused-result-presentation-and-input:eugeniy/hel-19-add-confidence-focused-result-presentation-and-input`
   `git -C <target-repo-dir> switch eugeniy/hel-19-add-confidence-focused-result-presentation-and-input`
3. Push branch `eugeniy/hel-19-add-confidence-focused-result-presentation-and-input`.
4. Create the PR with a title matching this change, for example:
   `Add provenance and locked-state cues to calculator results`
