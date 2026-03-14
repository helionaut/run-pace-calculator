import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../src/index.html", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

test("calculator markup keeps the compact three-value flow in DOM order", async () => {
  const html = await readFixture(htmlPath);
  const orderedIds = [
    "distance-input",
    "distance-slider",
    "pace-minutes",
    "pace-seconds",
    "speed-input",
    "time-hours",
    "time-minutes",
    "time-seconds",
    "projection-5k",
    "projection-10k",
    "projection-half",
    "projection-marathon"
  ];

  let previousIndex = -1;

  for (const id of orderedIds) {
    const index = html.indexOf(`id="${id}"`);

    assert.ok(index > previousIndex, `${id} should keep the expected DOM order`);
    previousIndex = index;
  }

  assert.match(html, /<span id="distance-label">Distance \(km\)<\/span>/);
  assert.equal((html.match(/class="calculator-panel"/g) ?? []).length, 1);
  assert.match(html, /class="tool-bar"/);
  assert.match(html, /id="distance-card"/);
  assert.match(html, /id="rate-card"/);
  assert.match(html, /id="time-card"/);
  assert.match(html, /class="projection-strip"/);
  assert.match(html, /id="distance-slider"[\s\S]*type="range"/);
  assert.match(html, /<span id="pace-label">Pace \(min\/km\)<\/span>/);
  assert.match(html, /<span id="speed-label">Speed \(km\/h\)<\/span>/);
  assert.match(html, /<span>Hours<\/span>[\s\S]*id="time-hours"/);
  assert.match(html, /<span>Minutes<\/span>[\s\S]*id="time-minutes"/);
  assert.match(html, /<span>Seconds<\/span>[\s\S]*id="time-seconds"/);
  assert.doesNotMatch(html, /pace-lock-button/);
  assert.doesNotMatch(html, /time-lock-button/);
  assert.doesNotMatch(html, /pace-driver-button/);
  assert.doesNotMatch(html, /speed-driver-button/);
  assert.doesNotMatch(html, /time-driver-button/);
  assert.doesNotMatch(html, /<details/);
});

test("status messaging, error affordances, and responsive safeguards are present", async () => {
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
  assert.match(css, /input\[aria-invalid="true"\]/);
  assert.match(css, /\.calculator-panel\s*{/);
  assert.match(css, /\.distance-card\s*{/);
  assert.match(css, /\.metric-card\s*{/);
  assert.match(css, /\.metric-card--source\s*{/);
  assert.match(css, /\.metric-card--derived\s*{/);
  assert.match(css, /\.rate-grid\s*{/);
  assert.match(css, /\.time-grid\s*{/);
  assert.match(css, /\.projection-strip\s*{/);
  assert.match(css, /\.status-message:empty\s*{/);
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /@media \(max-width: 540px\)/);
  assert.doesNotMatch(css, /\.metric-row--goal\s*{/);
  assert.doesNotMatch(css, /\.ghost-button--compact\s*{/);
});
