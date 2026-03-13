import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../src/index.html", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

test("every calculator control has a visible text label in source order", async () => {
  const html = await readFixture(htmlPath);
  const controls = [
    { id: "mode-tab-pace", label: "Pace" },
    { id: "mode-tab-speed", label: "Speed" },
    { id: "mode-tab-finish", label: "Finish Time" },
    { id: "pace-minutes", label: "Pace minutes" },
    { id: "pace-seconds", label: "Pace seconds" },
    { id: "pace-unit", label: "Unit" },
    { id: "speed-value", label: "Speed" },
    { id: "speed-unit", label: "Unit" },
    { id: "finish-hours", label: "Hours" },
    { id: "finish-minutes", label: "Minutes" },
    { id: "finish-seconds", label: "Seconds" },
    { id: "distance-select", label: "Race distance" }
  ];

  let previousIndex = -1;

  for (const control of controls) {
    const controlIndex = html.indexOf(`id="${control.id}"`);

    assert.ok(controlIndex > previousIndex, `${control.id} should keep DOM order`);
    previousIndex = controlIndex;
  }

  assert.match(
    html,
    /<label class="field field--wide">\s*<span>Race distance<\/span>\s*<select id="distance-select"/
  );
  assert.match(html, /<span>Pace minutes<\/span>[\s\S]*?id="pace-minutes"/);
  assert.match(html, /<span>Pace seconds<\/span>[\s\S]*?id="pace-seconds"/);
  assert.match(html, /<span>Speed<\/span>[\s\S]*?id="speed-value"/);
  assert.match(html, /<span>Hours<\/span>[\s\S]*?id="finish-hours"/);
});

test("validation copy and 320 px responsive rules are present in the shipped files", async () => {
  const [html, css] = await Promise.all([
    readFixture(htmlPath),
    readFixture(cssPath)
  ]);

  assert.match(html, /id="pace-error" aria-live="polite"/);
  assert.match(html, /id="speed-error" aria-live="polite"/);
  assert.match(html, /id="finish-error" aria-live="polite"/);
  assert.match(
    html,
    /id="status-message"[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*aria-atomic="true"/
  );
  assert.match(css, /input\[aria-invalid="true"\],\s*select\[aria-invalid="true"\]/);
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*?\.field-row\s*{\s*grid-template-columns: 1fr;/
  );
  assert.match(css, /table\s*{\s*width: 100%;\s*table-layout: fixed;/);
  assert.match(css, /overflow-wrap: anywhere;/);
  assert.match(
    css,
    /@media \(max-width: 420px\)[\s\S]*?\.page-shell\s*{\s*padding: 14px 12px 24px;/
  );
});
