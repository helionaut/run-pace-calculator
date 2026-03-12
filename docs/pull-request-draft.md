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
- add product docs, deployment workflow, PR template, and offline handoff
  scripts for blocked publish environments

## Testing

- [x] `npm test`
- [x] `npm run build`
- [x] `npm run pr:dry-run`
- [x] `./scripts/export_bundle.sh /tmp/run-pace-calculator-hel-8.bundle`
- [x] `./scripts/import_bundle.sh /tmp/run-pace-calculator-hel-8.bundle <repo>`
- [x] `npm run handoff:prepare -- /tmp/hel-8-handoff`
- [x] `npm run handoff:verify -- /tmp/hel-8-handoff/HEL-8-handoff-manifest.json`
- [x] `npm test` covers calculator logic and handoff manifest verification
- [x] `npm run dev` (expected explicit bind error in this sandbox)
- [x] `npm run preview` (expected explicit bind error in this sandbox)

## Risks

- Local HTTP serving could not be exercised in this sandbox because socket
  binding fails with `PermissionError: [Errno 1] Operation not permitted`.
- GitHub PR creation and branch push remain blocked in this environment until
  `gh` auth is restored and the repo is available through a pushable remote.

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [ ] Screenshots or preview notes added when UI changed

## Publish notes

If GitHub access is still blocked in the current checkout:

1. Run `npm run bundle:export` from this repo, or reuse the verified bundle
   exported during this run.
2. Import the bundle into a writable clone with
   `./scripts/import_bundle.sh <bundle-path> <target-repo-dir>`.
3. Push branch `eugeniy/hel-8-initial-build-run-pace-calculator`.
4. Create the PR using the title and body above.
