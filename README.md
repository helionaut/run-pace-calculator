# Run Pace Calculator

Static web app for runners to convert between pace and speed and project finish
times for common race distances. This repo now has one canonical engineering
path for local setup, app preview, and pull-request validation before more
feature work lands.

## Features

- Pace input in `m:ss /km`
- Speed input in `km/h`
- Distance input with quick presets for `5K`, `10K`, `Half marathon`, and
  `Marathon`
- Predicted finish time for the selected distance
- Responsive layout for mobile and desktop
- Inline validation with readable formatting

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

   The app is served from the repo root at `http://127.0.0.1:3000`.

3. Build the production artifact:

   ```sh
   npm run build
   ```

   This recreates `dist/` from the tracked static app files.

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

## Day-To-Day Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the exact toolchain from `package-lock.json` |
| `npm run dev` | Serve the source app locally |
| `npm run build` | Rebuild the deployable `dist/` directory |
| `npm run preview` | Build and serve the production artifact |
| `npm test` | Run the Node test suite |
| `npm run check` | Run the canonical validation flow used by CI |

GitHub Actions runs `npm run check` for every pull request.

## Intended Repo Structure

- `index.html` contains the calculator UI shell.
- `styles.css` defines the responsive visual design.
- `app.js` wires DOM events and rendering.
- `calculator.js` contains the shared conversion and formatting logic.
- `scripts/build.mjs` produces the static build output.
- `scripts/preview.mjs` serves the built site for local review.
- `scripts/serve.mjs` serves the source app or another static directory locally.
- `scripts/check-dist.mjs` smoke-checks the built artifact.
- `calculator.test.js` and `test/` contain the Node-based test harness.
- `.github/workflows/` contains CI definitions.
- `.codex/skills/` contains repo-local Symphony/Codex workflows.
