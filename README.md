# Run Pace Calculator

Static run pace calculator that converts pace, speed, and projected finish
times for common race distances.

Production URL: https://helionaut.github.io/run-pace-calculator/

## Deployment

Pushes to `main` trigger the GitHub Pages workflow in
[deploy-pages.yml](.github/workflows/deploy-pages.yml).
That workflow also verifies the deployed `page_url` after publish.
See [DEPLOYING.md](DEPLOYING.md) for the
publish and verification checklist.

One-time repository setup in GitHub:

1. Open `Settings -> Pages`.
2. Set `Source` to `GitHub Actions`.

## Local use

Run `python3 -m http.server 4173` in the repo root, then open
`http://localhost:4173/` for manual testing.

Run `npm run validate` for the full local validation pass.
