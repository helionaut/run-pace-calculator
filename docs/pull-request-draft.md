<!-- PR_TITLE: Repoint the shared checkout to a clean replacement path -->

## Summary

- repoint the default shared checkout metadata to
  `/home/helionaut/src/projects/run-pace-calculator-shared`
- update `WORKFLOW.md` so future Symphony issue runs advertise the replacement
  repo root instead of the dirty legacy clone
- document the exact HEL-62 cleanup and validation commands in `README.md`

## Testing

- [x] `npm run check`
- [x] `npm run build`
- [x] Other: `node --test tests/repair-shared-checkout.test.js`
- [x] Other: `npm run checkout:repair`
- [x] Other:
  `git -C /home/helionaut/src/projects/run-pace-calculator-shared status --short --branch`
- [x] Other:
  `git -C /home/helionaut/src/projects/run-pace-calculator-shared rev-parse HEAD origin/main`
- [x] Other:
  `git -C /home/helionaut/src/projects/run-pace-calculator-shared diff --exit-code origin/main -- WORKFLOW.md`

## Risks

- Low: after the PR merges, the replacement checkout needs one more refresh
  against merged `origin/main` so its local `WORKFLOW.md` picks up the new repo
  root metadata too

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [ ] Screenshots or preview notes added when UI changed
