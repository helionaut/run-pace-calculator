import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlPath = new URL("../index.html", import.meta.url);
const cssPath = new URL("../styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

test("each calculator control has a visible text label and DOM order matches the form flow", async () => {
  const html = await readFixture(htmlPath);
  const controls = [
    { id: "pace-minutes", label: "Minutes" },
    { id: "pace-seconds", label: "Seconds" },
    { id: "pace-unit", label: "Unit" },
    { id: "speed-value", label: "Value" },
    { id: "speed-unit", label: "Unit" },
    { id: "distance-value", label: "Value" },
    { id: "distance-unit", label: "Unit" },
  ];

  let previousIndex = -1;

  for (const control of controls) {
    const matcher = new RegExp(
      `<label class="control">[\\s\\S]*?<span class="control-label">${control.label}</span>[\\s\\S]*?id="${control.id}"`,
    );

    assert.match(html, matcher);

    const controlIndex = html.indexOf(`id="${control.id}"`);
    assert.ok(
      controlIndex > previousIndex,
      `${control.id} should appear after the previous control in DOM order`,
    );
    previousIndex = controlIndex;
  }

  assert.match(html, /<legend class="field-label">Pace<\/legend>/);
  assert.match(html, /<legend class="field-label">Speed<\/legend>/);
  assert.match(html, /<legend class="field-label">Custom distance<\/legend>/);
});

test("validation copy and narrow-screen layout rules are present in the shipped files", async () => {
  const [html, css] = await Promise.all([
    readFixture(htmlPath),
    readFixture(cssPath),
  ]);

  assert.match(html, /id="pace-message" class="field-message" aria-live="polite"/);
  assert.match(
    html,
    /id="status-line" class="status-line" role="status" aria-live="polite"/,
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*?\.control-grid-pace,\s*\.control-grid-inline\s*{\s*grid-template-columns: 1fr;/,
  );
  assert.match(css, /table\s*{\s*width: 100%;\s*table-layout: fixed;/);
  assert.match(css, /overflow-wrap: anywhere;/);
  assert.match(
    css,
    /@media \(max-width: 420px\)[\s\S]*?\.page-shell\s*{\s*width: min\(calc\(100% - 0\.75rem\), var\(--max-width\)\);/,
  );
});
