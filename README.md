# Run Pace Calculator

Run Pace Calculator is a static web app for converting running pace, speed, and
projected finish time across common race distances.

## What ships in this first slice

- Pace, speed, and finish-time driven calculator modes
- Metric and imperial conversions
- Projection table from one mile through the marathon
- Responsive layout for mobile and desktop
- Inline validation and keyboard-operable mode tabs
- Zero-dependency static build suitable for GitHub Pages
- Product docs for the PRD, requirements, and implementation plan

## Local usage

```sh
npm run check
npm test
npm run build
npm run dev
```

- `npm run check` runs the local validation stack: tests, build, and PR
  publish dry-run
- `npm run dev` serves the source files locally at `http://localhost:4173`
- `npm run build` copies the static site into `dist/`
- `npm run preview` serves the built output from `dist/`
- If the environment blocks local socket binding, `dev` and `preview` exit with
  a short explicit error instead of a server traceback

## Project structure

- `src/index.html` contains the static app shell
- `src/styles.css` defines the calculator interface and responsive layout
- `src/main.js` wires DOM events and rendering
- `src/lib/calculator.js` contains the shared conversion and formatting logic
- `src/lib/mode-navigation.js` contains the keyboard tab-navigation helper
- `tests/*.test.js` covers calculator logic, handoff verification, import flow,
  and mode navigation
- `scripts/build.mjs` produces the static build output
- `scripts/serve.mjs` serves either `src/` or `dist/` locally

## Repository docs

- `docs/prd.md`
- `docs/requirements.md`
- `docs/implementation-plan.md`
- `docs/pull-request-draft.md`

## Deployment

`.github/workflows/deploy-pages.yml` builds the static site and publishes `dist/`
to GitHub Pages on pushes to `main`.

## Offline handoff

If GitHub push or PR creation is blocked in the current environment, prepare a
manifest-backed handoff directory:

```sh
npm run handoff:prepare
```

By default that writes verified artifacts into `.handoff/<issue-key>`, using
the issue key parsed from the current branch name. That directory stays in the
workspace and is ignored by git. You can still pass an explicit output path:

```sh
npm run handoff:prepare -- /tmp/hel-8-handoff
```

To verify the exported handoff before resuming elsewhere:

```sh
npm run handoff:verify -- .handoff/<issue-key>/<issue-key>-handoff-manifest.json
```

To import the included bundle into another writable checkout and publish it
from there:

```sh
git -C /path/to/repo fetch .handoff/<issue-key>/<bundle-name>.bundle <branch>:<branch>
git -C /path/to/repo switch <branch>
```

If you already have a checkout of this feature branch with the helper scripts
available, you can also use `./scripts/import_bundle.sh <bundle-path> <target-repo-dir>`.

If you only want the raw branch bundle without the full manifest package:

```sh
npm run bundle:export
```

That now writes the bundle into `.handoff/<issue-key>/` by default, and still
accepts an explicit output path when needed.

## Publish when GitHub access is restored

```sh
npm run pr:publish
```

The publish helper runs `npm test` and `npm run build`, resets `origin` to the
GitHub repository URL if the workspace was bootstrapped from the local mirror,
then pushes the current branch and creates or updates the PR from
`docs/pull-request-draft.md`. If GitHub auth or network checks fail first, it
now writes a full handoff directory to `.handoff/<issue-key>` by default
instead of only exporting a raw bundle to `/tmp`.

To rehearse that flow without network access:

```sh
npm run pr:dry-run
```
