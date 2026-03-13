# Run Pace Calculator

Static web app for runners to convert between pace and speed and project finish
times for common race distances.

## Features

- Pace input in `m:ss /km`
- Speed input in `km/h`
- Distance input with quick presets for `5K`, `10K`, `Half marathon`, and
  `Marathon`
- Predicted finish time for the selected distance
- Responsive layout for mobile and desktop
- Inline validation with readable formatting

## Scripts

- `npm test` runs the Node test suite for the calculator logic
- `npm run build` copies the static site into `dist/`
- `npm run preview` serves `dist/` locally on `http://127.0.0.1:4173`

## Project structure

- `index.html` contains the static app shell
- `styles.css` defines the responsive visual design
- `app.js` wires DOM events and rendering
- `calculator.js` contains the shared conversion and formatting logic
- `scripts/build.mjs` produces the static build output
- `scripts/preview.mjs` serves the built site for local review
