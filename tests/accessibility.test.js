import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../src/index.html", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

test("calculator markup keeps the compact control flow in DOM order", async () => {
  const html = await readFixture(htmlPath);
  const orderedIds = [
    "distance-input",
    "distance-slider",
    "pace-lock-button",
    "pace-driver-button",
    "pace-minutes",
    "pace-seconds",
    "speed-driver-button",
    "speed-input",
    "time-lock-button",
    "time-driver-button",
    "time-hours",
    "time-minutes",
    "time-seconds"
  ];

  let previousIndex = -1;

  for (const id of orderedIds) {
    const index = html.indexOf(`id="${id}"`);

    assert.ok(index > previousIndex, `${id} should keep the expected DOM order`);
    previousIndex = index;
  }

  assert.match(html, /<span id="distance-label">Distance \(km\)<\/span>/);
  assert.match(html, /id="distance-slider"[\s\S]*type="range"/);
  assert.match(html, /<span>Minutes<\/span>[\s\S]*id="pace-minutes"/);
  assert.match(html, /<span>Seconds<\/span>[\s\S]*id="pace-seconds"/);
  assert.match(html, /<span>Value<\/span>[\s\S]*id="speed-input"/);
  assert.match(html, /<span>Hours<\/span>[\s\S]*id="time-hours"/);
  assert.match(html, /<span>Minutes<\/span>[\s\S]*id="time-minutes"/);
  assert.match(html, /<span>Seconds<\/span>[\s\S]*id="time-seconds"/);
  assert.match(html, /<summary>Selected-distance splits<\/summary>/);
  assert.match(html, /id="split-copy"/);
  assert.match(html, /id="split-heading"/);
  assert.match(html, /id="split-rows"/);
});

test("status messaging, lock affordances, and responsive safeguards are present", async () => {
  const [html, css] = await Promise.all([
    readFixture(htmlPath),
    readFixture(cssPath)
  ]);

  assert.match(html, /id="distance-error" aria-live="polite"/);
  assert.match(html, /id="pace-error" aria-live="polite"/);
  assert.match(html, /id="speed-error" aria-live="polite"/);
  assert.match(html, /id="time-error" aria-live="polite"/);
  assert.match(
    html,
    /id="status-message"[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/
  );
  assert.match(html, /id="pace-lock-button"[\s\S]*aria-pressed="false"/);
  assert.match(html, /id="time-lock-button"[\s\S]*aria-pressed="false"/);
  assert.match(css, /input\[aria-invalid="true"\]/);
  assert.match(css, /input:disabled/);
  assert.match(css, /\.metrics-grid\s*{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.projection-copy,\s*caption/);
  assert.match(css, /\.is-final-partial th,\s*\.is-final-partial td/);
  assert.match(css, /table\s*{\s*width: 100%;[\s\S]*table-layout: fixed;/);
  assert.match(
    css,
    /@media \(max-width: 420px\)[\s\S]*?\.page-shell\s*{\s*padding: 12px;/
  );
});
