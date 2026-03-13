# Deploying Run Pace Calculator

Production URL: https://helionaut.github.io/run-pace-calculator/

## GitHub Pages setup

This repository deploys through
[`deploy-pages.yml`](.github/workflows/deploy-pages.yml).

One-time repository setup:

1. Open `Settings -> Pages` in the GitHub repository.
2. Set `Source` to `GitHub Actions`.

## Validation before merge

- `npm run validate` runs the test suite, rebuilds `dist/`, and syntax-checks the Pages verification script
- `npm run preview` serves `dist/` locally on `http://localhost:4173`

## Release flow

1. Merge the intended site changes into `main`.
2. Wait for the `Deploy GitHub Pages` workflow on `main` to finish.
3. The workflow rebuilds `dist/`, deploys it to Pages, and then runs `npm run verify:pages -- "$PAGE_URL"` to compare every deployed static file to the artifact produced from the same commit.
4. Open https://helionaut.github.io/run-pace-calculator/ and confirm the calculator loads.

## Manual post-deploy verification

After `dist/` exists locally, run:

- `npm run verify:pages -- https://helionaut.github.io/run-pace-calculator/`
