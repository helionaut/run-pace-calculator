<!-- PR_TITLE: Repair the shared checkout from current remote state -->

## Summary

- add `scripts/repair-shared-checkout.sh` and `npm run checkout:repair` so the
  shared local repo in `.bootstrap/project.json` can be rebuilt from the
  current remote branch state
- preserve the previous checkout as a timestamped backup and restore it
  automatically if the reclone step fails
- cover the maintenance flow with regression tests for backup-and-reclone,
  restore-on-failure, and explicit branch recreation, and document the command
  in `README.md`

## Testing

- [x] `npm run check`
- [x] `node --test tests/repair-shared-checkout.test.js`
- [x] Repaired `/home/helionaut/src/projects/run-pace-calculator` in place and
  confirmed the recreated checkout is back on `main` with a clean status

## Risks

- Low: the repair flow intentionally replaces the configured shared checkout, so
  anyone who still needs the pre-repair state must use the timestamped backup
- Low: the helper defaults to `main`, so one-off maintenance on another branch
  should call the script directly with `--branch`

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Maintenance-only change; no UI preview was required for this checkout repair
  flow.
