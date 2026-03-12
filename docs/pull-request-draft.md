# Pull Request Draft

## Proposed title

Build the first Run Pace Calculator slice

## Proposed body

## Summary

- add a polished static run pace calculator with pace, speed, and finish-time
  input modes
- add pure conversion helpers, Node tests, and a zero-dependency build for
  GitHub Pages
- tighten calculator validation so pace and finish-time fields reject invalid
  decimal or out-of-range time parts without capping long pace minutes
- make the calculator mode switcher keyboard-operable with real tab semantics
- add product docs, deployment workflow, PR template, and offline handoff
  scripts with a repo-local manifest fallback and relative bundle import fixes
  for blocked publish environments
- strengthen handoff verification so copied manifests also confirm the bundled
  branch and head metadata

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run check`
- [x] `npm run pr:dry-run`
- [x] `npm run bundle:export`
- [x] `./scripts/import_bundle.sh .handoff/HEL-8/run-pace-calculator-eugeniy-hel-8-initial-build-run-pace-calculator.bundle <repo>`
- [x] `npm run handoff:prepare`
- [x] `npm run handoff:verify -- .handoff/HEL-8/HEL-8-handoff-manifest.json`
- [x] import the persisted `.handoff/HEL-8` bundle into a fresh clone and run
  `npm run check`
- [x] verify a copied handoff manifest still validates bundle branch/head
  metadata outside the original workspace path
- [x] `npm test` covers calculator logic and handoff manifest verification
- [x] `npm run dev` (expected explicit bind error in this sandbox)
- [x] `npm run preview` (expected explicit bind error in this sandbox)

## Risks

- Local HTTP serving could not be exercised in this sandbox because socket
  binding fails with `PermissionError: [Errno 1] Operation not permitted`.

## Preview notes

- The page opens with a large editorial hero, supported race-distance chips,
  and a dark aside card that calls out the first-slice scope.
- The calculator panel uses three pill-style mode tabs for Pace, Speed, and
  Finish Time, with the active panel swapping inline below the controls.
- The output area shows a highlighted projected finish card, equivalent pace
  and speed cards, a split guide, and a race projection table below.

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

## Publish notes

If GitHub access is still blocked in the current checkout:

1. Run `npm run handoff:prepare` from this repo, or reuse the verified
   handoff directory exported during this run.
2. Import the included bundle into a writable clone with:
   `git -C <target-repo-dir> fetch .handoff/HEL-8/run-pace-calculator-eugeniy-hel-8-initial-build-run-pace-calculator.bundle eugeniy/hel-8-initial-build-run-pace-calculator:eugeniy/hel-8-initial-build-run-pace-calculator`
   `git -C <target-repo-dir> switch eugeniy/hel-8-initial-build-run-pace-calculator`
3. Push branch `eugeniy/hel-8-initial-build-run-pace-calculator`.
4. Create the PR using the title and body above.
