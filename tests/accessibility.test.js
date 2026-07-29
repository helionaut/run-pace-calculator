import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../src/index.html", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

test("calculator keeps the established value flow and accessible errors", async () => {
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

  for (const errorId of ["distance-error", "pace-error", "speed-error", "time-error"]) {
    assert.match(html, new RegExp(`id="${errorId}" aria-live="polite"`));
  }

  assert.match(html, /id="status-message"[\s\S]*role="status"[\s\S]*aria-live="polite"/);
  assert.match(html, /id="split-list" aria-live="polite"/);
});

test("responsive CSS encodes mobile, tablet, and desktop layout safeguards", async () => {
  const css = await readFixture(cssPath);

  assert.match(css, /\*\s*{[\s\S]*box-sizing:\s*border-box;/);
  assert.match(css, /\.page-shell\s*{[\s\S]*width:\s*min\(100%,\s*1232px\);/);
  assert.match(css, /\.calculator-panel\s*{[\s\S]*min-width:\s*0;/);
  assert.match(css, /@media \(min-width: 700px\)/);
  assert.match(css, /@media \(min-width: 1100px\)/);
  assert.match(
    css,
    /grid-template-columns:\s*minmax\(0,\s*7fr\)\s+minmax\(320px,\s*5fr\);/
  );
  assert.match(css, /@media \(max-width: 699px\)/);
  assert.match(css, /@media \(max-width: 350px\)/);
  assert.match(css, /\.projection-strip\s*{[\s\S]*overflow:\s*hidden;/);
  assert.match(css, /\.split-card__metrics\s*{[\s\S]*min-width:\s*0;/);
  assert.match(css, /input\s*{[\s\S]*min-width:\s*0;[\s\S]*font-size:\s*1rem;/);
});

test("keyboard focus and interactive targets meet the static accessibility contract", async () => {
  const css = await readFixture(cssPath);

  assert.match(
    css,
    /\.support-link,[\s\S]*\.split-card__action\s*{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;/
  );
  assert.match(css, /\.segmented__button\s*{[\s\S]*min-width:\s*44px;/);
  assert.match(css, /input\s*{[\s\S]*min-height:\s*48px;/);
  assert.match(css, /\.distance-slider\s*{[\s\S]*min-height:\s*44px;/);
  assert.match(
    css,
    /input:focus-visible,[\s\S]*button:focus-visible,[\s\S]*a:focus-visible\s*{[\s\S]*outline:\s*2px solid var\(--accent\);[\s\S]*outline-offset:\s*3px;/
  );
  assert.match(css, /input\[aria-invalid="true"\]/);
  assert.match(css, /\.field--linked > span::after|\.rate-field\.field--linked > span::after/);
});

for (const viewport of ["320x844", "390x844", "768x1024", "1440x900"]) {
  test(`${viewport} keeps every button and link target at least 44px square`, async () => {
    const css = await readFixture(cssPath);
    const sharedTargetRule = css.match(
      /\.support-link,\s*\.segmented__button,\s*\.ghost-button,\s*\.chip-button,\s*\.split-action-button,\s*\.split-card,\s*\.split-card__action\s*\{([^}]+)\}/
    );

    assert.ok(sharedTargetRule, "shared interactive target rule should exist");
    assert.match(sharedTargetRule[1], /min-width:\s*44px;/);
    assert.match(sharedTargetRule[1], /min-height:\s*44px;/);
  });
}

test("mobile fit overrides preserve 44px controls in the compact grids", async () => {
  const css = await readFixture(cssPath);

  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?\.chip-button--increment\s*{[^}]*min-width:\s*44px;/
  );
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?\.preset-row \.chip-button\s*{[^}]*min-width:\s*44px;/
  );
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?input\s*{[^}]*min-height:\s*44px;[^}]*height:\s*44px;/
  );
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?\.distance-card\s*{[^}]*grid-template-columns:\s*52px 94px minmax\(0,\s*1fr\) 44px;/
  );
  assert.match(
    css,
    /@media \(max-width: 350px\)[\s\S]*?\.metric-grid\s*{[^}]*grid-template-columns:\s*1fr;/
  );
});

test("support CTA uses the exact script-free owner URL", async () => {
  const html = await readFixture(htmlPath);

  assert.match(
    html,
    /href="https:\/\/buymeacoffee\.com\/helionaut"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"/
  );
  assert.match(html, /aria-label="Buy me a coffee \(opens in a new tab\)"/);
  assert.doesNotMatch(html, /<script[^>]+(?:buymeacoffee|coffee)/i);
  assert.doesNotMatch(html, /<iframe/i);
});
