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

## Publish when GitHub access is restored

```sh
npm run pr:publish
```

The publish helper runs `npm test` and `npm run build`, resets `origin` to the
GitHub repository URL if the workspace was bootstrapped from the local mirror,
then pushes the current branch and creates or updates the PR from
`docs/pull-request-draft.md`.

To rehearse that flow without network access:

```sh
npm run pr:dry-run
```

## Prepare a handoff bundle

When publication is still blocked, export a resumable handoff directory:

```sh
npm run handoff:prepare -- /tmp/hel-8-handoff
```

That writes a verified branch bundle, the PR draft, publish dry-run output, a
commit summary, and a machine-readable manifest into the target directory.

To verify those artifacts before resuming from another environment:

```sh
npm run handoff:verify -- /tmp/hel-8-handoff/HEL-8-handoff-manifest.json
```
