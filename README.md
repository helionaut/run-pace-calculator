# Run Pace Calculator

Run Pace Calculator is a static web app for converting running pace, speed, and
projected finish time across common race distances.

## What ships in this first slice

- Pace, speed, and finish-time driven calculator modes
- Metric and imperial conversions
- Projection table from one mile through the marathon
- Zero-dependency static build suitable for GitHub Pages
- Product docs for the PRD, requirements, and implementation plan

## Local usage

```sh
npm test
npm run build
npm run dev
```

- `npm run dev` serves the source files locally at `http://localhost:4173`
- `npm run build` copies the static site into `dist/`
- `npm run preview` serves the built output from `dist/`

## Repository docs

- `docs/prd.md`
- `docs/requirements.md`
- `docs/implementation-plan.md`
- `docs/pull-request-draft.md`

## Deployment

`.github/workflows/deploy-pages.yml` builds the static site and publishes `dist/`
to GitHub Pages on pushes to `main`.

## Offline handoff

If GitHub push or PR creation is blocked in the current environment, export the
current branch as a verified bundle:

```sh
npm run bundle:export
```

You can also pass an explicit output path:

```sh
./scripts/export_bundle.sh /tmp/run-pace-calculator.bundle
```

To import that branch into another writable checkout and publish it from there:

```sh
./scripts/import_bundle.sh /tmp/run-pace-calculator.bundle /path/to/repo
```
