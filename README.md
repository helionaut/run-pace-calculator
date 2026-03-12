# Run Pace Calculator

Static run pace calculator that converts pace, speed, and projected finish
times for common race distances.

Production URL: https://helionaut.github.io/run-pace-calculator/

## Deployment

Pushes to `main` trigger the GitHub Pages workflow in
[deploy-pages.yml](/home/helionaut/workspaces/HEL-11/.github/workflows/deploy-pages.yml).
See [DEPLOYING.md](/home/helionaut/workspaces/HEL-11/DEPLOYING.md) for the
publish and verification checklist.

One-time repository setup in GitHub:

1. Open `Settings -> Pages`.
2. Set `Source` to `GitHub Actions`.

## Local use

Run `python3 -m http.server 4173` in the repo root, then open
`http://localhost:4173/` for manual testing.

Run `npm test` to validate the calculation helpers.
