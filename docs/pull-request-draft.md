<!-- PR_TITLE: Normalize the canonical PRD path to docs/PRD.md -->

## Summary

- rename the shipped product requirements document to `docs/PRD.md` so the
  repo matches the canonical control-plane path
- update the repository docs reference in `README.md` to the uppercase PRD path
- add a regression test that enforces the canonical tracked path and rejects
  tracked references to the legacy lowercase filename

## Testing

- [x] `npm run check`
- [x] `node --test tests/prd-path.test.js`
- [x] `git ls-files docs/PRD.md` returns only the canonical uppercase file
- [x] Verified the uppercase PRD path exists and the lowercase alias does not

## Risks

- Low: case-only renames can be awkward on case-insensitive filesystems, but
  git now tracks the uppercase path and the new guard test will fail if the
  lowercase filename becomes the source of truth again

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Maintenance-only change; no UI preview was required for this docs-path
  normalization.
