<!-- PR_TITLE: Stabilize publish fixtures on main -->

## Summary

- stabilize the publish fixture tests by forcing cloned repos onto a
  deterministic issue-like branch
- replace the stale hardcoded ticket assertion with the fixture issue
  identifier so the generated handoff summary is branch-independent
- unblock the follow-up GitHub Pages deploy for the compact calculator
  redesign already merged in PR #10

## Testing

- [x] `node --test tests/publish.test.js`
- [x] `npm run check`

## Risks

- Low: this changes test fixture setup only; application code and shipped
  assets are unchanged.
