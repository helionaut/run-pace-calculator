import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../src/index.html", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

test("calculator markup keeps the dense single-card control flow in DOM order", async () => {
  const html = await readFixture(htmlPath);
  const orderedIds = [
    "distance-input",
    "distance-slider",
    "pace-lock-button",
    "pace-driver-button",
    "pace-value",
    "pace-editor",
    "pace-minutes",
    "pace-seconds",
    "speed-driver-button",
    "speed-value",
    "speed-editor",
    "speed-input",
    "time-lock-button",
    "time-driver-button",
    "time-value",
    "time-editor",
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
  assert.match(html, /class="metric-grid"/);
  assert.match(html, /class="projection-strip"/);
  assert.match(html, /id="pace-value"/);
  assert.match(html, /id="speed-value"/);
  assert.match(html, /id="time-value"/);
  assert.match(html, /id="distance-slider"[\s\S]*type="range"/);
  assert.match(html, /<span>Minutes<\/span>[\s\S]*id="pace-minutes"/);
  assert.match(html, /<span>Seconds<\/span>[\s\S]*id="pace-seconds"/);
  assert.match(html, /<span>Value<\/span>[\s\S]*id="speed-input"/);
  assert.match(html, /<span>Hours<\/span>[\s\S]*id="time-hours"/);
  assert.match(html, /<span>Minutes<\/span>[\s\S]*id="time-minutes"/);
  assert.match(html, /<span>Seconds<\/span>[\s\S]*id="time-seconds"/);
  assert.doesNotMatch(html, /class="app-header"/);
  assert.doesNotMatch(html, /class="metric-stack"/);
  assert.doesNotMatch(html, /class="projection-panel"/);
  assert.doesNotMatch(html, /<details/);
  assert.doesNotMatch(html, /id="split-copy"/);
  assert.doesNotMatch(html, /id="split-heading"/);
  assert.doesNotMatch(html, /id="split-rows"/);
  assert.doesNotMatch(html, /<article class="metric-panel/);
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
  assert.match(html, /id="pace-value"[\s\S]*aria-live="polite"/);
  assert.match(html, /id="speed-value"[\s\S]*aria-live="polite"/);
  assert.match(html, /id="time-value"[\s\S]*aria-live="polite"/);
  assert.match(html, /<span class="sr-only" id="pace-state">Adjust<\/span>/);
  assert.match(html, /<span class="sr-only" id="speed-state">Ready<\/span>/);
  assert.match(html, /<span class="sr-only" id="time-state">Ready<\/span>/);
  assert.match(css, /input\[aria-invalid="true"\]/);
  assert.match(css, /input:disabled/);
  assert.match(css, /\.calculator-panel\s*{/);
  assert.match(css, /\.tool-bar,\s*[\s\S]*?\.distance-block\s*{/);
  assert.match(css, /\.metric-grid\s*{/);
  assert.match(css, /\.metric-row--goal\s*{/);
  assert.match(css, /\.metric-value\s*{/);
  assert.match(css, /\.projection-strip\s*{/);
  assert.match(css, /\.status-message:empty\s*{/);
  assert.match(css, /\.sr-only\s*{/);
  assert.match(css, /min-height:\s*100dvh/);
  assert.match(css, /@media \(max-width: 540px\)/);
  assert.doesNotMatch(css, /\.metric-stack\s*{/);
  assert.doesNotMatch(css, /\.projection-panel\s*{/);
});
