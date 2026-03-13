# Run Pace Calculator

Run Pace Calculator is a static web app for converting running pace, speed, and
projected finish time across common race distances. This repo now has one
canonical Node-based install, run, build, preview, check, and Pages-deploy
verification flow for local work and pull-request validation.

Production URL: https://helionaut.github.io/run-pace-calculator/

## What Ships In The Current Slice

- A compact one-screen calculator with pace, speed, and finish-time cards
- A live distance slider with common race preset chips
- Pace and finish-time locks that keep one driving value fixed while distance moves
- Metric and imperial conversions
- A compact projection disclosure for common race distances
- Responsive layout with inline validation and keyboard-operable inputs, slider, and lock controls
- Zero-dependency static build suitable for GitHub Pages
- Product docs for the PRD, requirements, and implementation plan

## Prerequisites

- Node.js 22
- npm 10

## Canonical Local Workflow

1. Install the lockfile-defined toolchain:

   ```sh
   npm ci
   ```

2. Run the source app locally:

   ```sh
   npm run dev
   ```

   The source app is served from `src/` at `http://127.0.0.1:3000`.

3. Build the production artifact:

   ```sh
   npm run build
   ```

   This recreates `dist/` from the tracked files in `src/`.

4. Preview the built artifact locally:

   ```sh
   npm run preview
   ```

   This rebuilds `dist/` and serves it at `http://127.0.0.1:4173`.

5. Run the full non-interactive validation gate:

   ```sh
   npm run check
   ```

   This runs syntax checks, the Node test suite, a production build, and a
   smoke check against the built artifact.

6. Run the Pages deployment validation or compare the live site to `dist/`:

   ```sh
   npm run validate
   npm run verify:pages -- https://helionaut.github.io/run-pace-calculator/
   ```

   `npm run validate` reuses the deploy gate before GitHub Pages upload, and
   `npm run verify:pages` compares the deployed site with the local `dist/`
   artifact.

## Day-To-Day Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the exact toolchain from `package-lock.json` |
| `npm run dev` | Serve the source app from `src/` locally |
| `npm run build` | Rebuild the deployable `dist/` directory |
| `npm run preview` | Build and serve the production artifact |
| `npm test` | Run the full Node test suite |
| `npm run check` | Run the canonical validation flow used by CI |
| `npm run validate` | Run the Pages pre-deploy validation path |
| `npm run verify:pages -- <url>` | Compare a deployed site to local `dist/` |

GitHub Actions runs `npm run check` for every pull request.

If the environment blocks local socket binding, `dev` and `preview` exit with a
short explicit error instead of a server traceback.

## Project Structure

- `src/index.html` contains the calculator UI shell.
- `src/styles.css` defines the calculator interface and responsive layout.
- `src/main.js` wires DOM events and rendering.
- `src/lib/calculator.js` contains the shared conversion and formatting logic.
- `tests/*.test.js` covers calculator logic, DOM interaction behavior,
  build/serve harness behavior, handoff verification, and import flow.
- `scripts/build.mjs` produces the static build output.
- `scripts/serve.mjs` serves either `src/` or `dist/` locally.
- `scripts/check-dist.mjs` smoke-checks the built artifact.
- `scripts/verify-pages-content.mjs` compares the live Pages site to `dist/`.
- `.github/workflows/` contains CI and deployment definitions.
- `.codex/skills/` contains repo-local Symphony/Codex workflows.

## Repository Docs

- `docs/prd.md`
- `docs/requirements.md`
- `docs/implementation-plan.md`
- `docs/pull-request-draft.md`

## Deployment

`.github/workflows/deploy-pages.yml` builds the static site and publishes `dist/`
to GitHub Pages on pushes to `main`, then verifies that the published site
matches the artifact built from that same commit.

One-time repository setup in GitHub:

1. Open `Settings -> Pages`.
2. Set `Source` to `GitHub Actions`.

See [DEPLOYING.md](DEPLOYING.md) for the release checklist and post-deploy
verification flow.

## Offline Handoff

If GitHub push or PR creation is blocked in the current environment, prepare a
manifest-backed handoff directory:

```sh
npm run handoff:prepare
```

By default that writes verified artifacts into `.handoff/<issue-key>`, using
the issue key parsed from the current branch name. That directory stays in the
workspace and is ignored by git. You can still pass an explicit output path:

```sh
npm run handoff:prepare -- /tmp/hel-16-handoff
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
available, you can also use
`./scripts/import_bundle.sh <bundle-path> <target-repo-dir>`.

If you only want the raw branch bundle without the full manifest package:

```sh
npm run bundle:export
```

That writes the bundle into `.handoff/<issue-key>/` by default, and still
accepts an explicit output path when needed.

## Publish When GitHub Access Is Restored

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
