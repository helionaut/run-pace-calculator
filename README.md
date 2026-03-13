# Run Pace Calculator

Static web app repository for the Run Pace Calculator. This repo now has one
canonical engineering path for local setup, app preview, and pull-request
validation before more product work lands.

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

4. Run the full non-interactive validation gate:

   ```sh
   npm run check
   ```

   This runs syntax checks, the Node test suite, a production build, and a
   smoke check against the built artifact.

Use `npm run preview` when you want to inspect the built `dist/` output locally
at `http://127.0.0.1:4173`.

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

- `index.html` contains the static app shell.
- `styles.css` contains the base page layout and component styles.
- `script.js` contains browser-side bootstrapping for the static shell.
- `scripts/` contains build, local serving, and validation utilities.
- `test/` contains the Node-based harness tests.
- `.github/workflows/` contains CI definitions.
- `.codex/skills/` contains repo-local Symphony/Codex workflows.
