import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../src/index.html", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

test("calculator inputs keep visible labels and DOM order that matches the visible flow", async () => {
  const html = await readFixture(htmlPath);
  const orderedIds = [
    "mode-tab-pace",
    "mode-tab-finish",
    "mode-tab-convert",
    "preset-select",
    "distance-input",
    "finish-hours",
    "finish-minutes",
    "finish-seconds",
    "pace-minutes",
    "pace-seconds",
    "speed-input"
  ];

  let previousIndex = -1;

  for (const id of orderedIds) {
    const index = html.indexOf(`id="${id}"`);

    assert.ok(index > previousIndex, `${id} should keep the expected DOM order`);
    previousIndex = index;
  }

  assert.match(html, /<span>Preset<\/span>\s*<select id="preset-select"/);
  assert.match(html, /<span id="distance-label">Distance \(km\)<\/span>/);
  assert.match(html, /<span>Hours<\/span>[\s\S]*?id="finish-hours"/);
  assert.match(html, /<span>Minutes<\/span>[\s\S]*?id="finish-minutes"/);
  assert.match(html, /<span>Seconds<\/span>[\s\S]*?id="finish-seconds"/);
  assert.match(html, /<span>Pace minutes<\/span>[\s\S]*?id="pace-minutes"/);
  assert.match(html, /<span>Pace seconds<\/span>[\s\S]*?id="pace-seconds"/);
  assert.match(html, /<span id="speed-label">Speed \(km\/h\)<\/span>/);
});

test("validation text and 320 px layout safeguards are present in the shipped files", async () => {
  const [html, css] = await Promise.all([
    readFixture(htmlPath),
    readFixture(cssPath)
  ]);

  assert.match(html, /id="distance-error" aria-live="polite"/);
  assert.match(html, /id="finish-error" aria-live="polite"/);
  assert.match(html, /id="pace-error" aria-live="polite"/);
  assert.match(html, /id="speed-error" aria-live="polite"/);
  assert.match(
    html,
    /id="status-message"[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/
  );
  assert.match(html, /<h3 id="split-heading">Selected-distance splits<\/h3>/);
  assert.match(html, /id="split-copy"/);
  assert.match(html, /<tbody id="split-rows">[\s\S]*?Enter valid values to calculate\./);
  assert.match(html, /<table class="split-table" aria-describedby="split-copy">/);
  assert.match(css, /input\[aria-invalid="true"\],\s*select\[aria-invalid="true"\]/);
  assert.match(css, /table\s*{\s*width: 100%;\s*table-layout: fixed;/);
  assert.match(css, /\.table-shell--compact\s*{\s*max-height: 320px;\s*overflow: auto;/);
  assert.match(css, /overflow-wrap: anywhere;/);
  assert.match(
    css,
    /@media \(max-width: 420px\)[\s\S]*?\.page-shell\s*{\s*padding: 14px 12px 24px;/
  );
});
