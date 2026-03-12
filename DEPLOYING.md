# Deploying Run Pace Calculator

## GitHub Pages

This repository deploys to GitHub Pages through
[`deploy-pages.yml`](.github/workflows/deploy-pages.yml).

One-time repository setup:

1. Open `Settings -> Pages` in the GitHub repository.
2. Set `Source` to `GitHub Actions`.

Release flow:

1. Push the branch with the intended site changes.
2. Open and merge a pull request into `main`.
3. Wait for the `Deploy GitHub Pages` workflow on `main` to finish.
   The workflow runs `scripts/verify-pages-content.sh` against the deployed
   `page_url` and checks for the calculator heading before succeeding.
4. Verify the production URL loads:
   `https://helionaut.github.io/run-pace-calculator/`

Local validation before pushing:

- `npm run validate`
- `npm run verify:pages -- https://helionaut.github.io/run-pace-calculator/`
