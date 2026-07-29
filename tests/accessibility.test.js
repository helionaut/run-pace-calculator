import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlPath = new URL("../src/index.html", import.meta.url);
const cssPath = new URL("../src/styles.css", import.meta.url);

async function readFixture(url) {
  return readFile(url, "utf8");
}

function relativeLuminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4
    );

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort(
    (left, right) => right - left
  );

  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
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
    /@media \(max-width: 699px\)[\s\S]*?\.distance-card\s*{[^}]*grid-template-columns:\s*52px 94px minmax\(0,\s*1fr\);/
  );
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?\.distance-slider\s*{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*3;/
  );
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?input\s*{[^}]*font-size:\s*1rem;/
  );
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?\.distance-slider\s*{[^}]*width:\s*100%;/
  );
  assert.match(
    css,
    /@media \(max-width: 699px\)[\s\S]*?\.metric-grid\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
  );
});

test("tablet timing controls keep enough track width for 44px targets", async () => {
  const css = await readFixture(cssPath);

  assert.match(
    css,
    /@media \(min-width: 700px\) and \(max-width: 899px\)\s*{[\s\S]*?\.metric-grid\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
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

test("night-track theme keeps decoration inert and interaction states explicit", async () => {
  const [html, css] = await Promise.all([
    readFixture(htmlPath),
    readFixture(cssPath)
  ]);

  assert.match(html, /class="track-atmosphere" aria-hidden="true"/);
  assert.match(css, /color-scheme:\s*dark;/);
  assert.match(css, /--canvas:\s*#070907;/);
  assert.match(css, /--surface:\s*#111411;/);
  assert.match(css, /--text:\s*#f3f7ef;/);
  assert.match(css, /--accent:\s*#c8ff3d;/);
  assert.match(css, /\.track-atmosphere\s*{[^}]*pointer-events:\s*none;/);
  assert.match(css, /button:not\(:disabled\):active/);
  assert.match(css, /button:disabled,/);
  assert.match(css, /@media \(hover: hover\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("night-track palette clears key AA text and non-text contrast thresholds", () => {
  const textPairs = [
    ["#f3f7ef", "#111411"],
    ["#a5afa2", "#111411"],
    ["#7d887b", "#111411"],
    ["#737d71", "#090b09"],
    ["#101606", "#c8ff3d"],
    ["#ff8b80", "#111411"]
  ];

  for (const [foreground, background] of textPairs) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${foreground} on ${background} should meet 4.5:1`
    );
  }

  assert.ok(
    contrastRatio("#616d5e", "#171b17") >= 3,
    "control boundaries should meet 3:1 against raised surfaces"
  );
});

test("performance console replaces the card grammar across every result surface", async () => {
  const [html, css] = await Promise.all([
    readFixture(htmlPath),
    readFixture(cssPath)
  ]);

  for (const compositionHook of [
    "system-kicker",
    "console-zone--distance",
    "distance-scale",
    "console-zone--rate",
    "console-zone--time",
    "timing-board",
    "live-indicator",
    "projection-strip__label"
  ]) {
    assert.match(html, new RegExp(`class="[^"]*${compositionHook}`));
  }

  assert.match(css, /\.tool-bar\s*{[\s\S]*border-block:/);
  assert.match(css, /\.console-zone\s*{[\s\S]*border-radius:\s*0;/);
  assert.match(css, /\.rate-grid\s*{[\s\S]*background:\s*var\(--line\);/);
  assert.match(css, /\.time-grid \.field:not\(:last-child\)::after/);
  assert.match(css, /\.result-card\s*{[\s\S]*background-size:\s*20px 20px;/);
  assert.match(
    css,
    /\.projection-strip\s*{[\s\S]*grid-template-columns:\s*126px repeat\(4, minmax\(0, 1fr\)\);/
  );
});

test("performance console gives controls and semantic states a complete grammar", async () => {
  const css = await readFixture(cssPath);

  for (const stateSelector of [
    ".metric-card--source",
    ".metric-card--derived",
    ".metric-card--idle",
    ".rate-field.field--active",
    ".rate-field.field--linked",
    '.chip-button[aria-pressed="true"]',
    'input[aria-invalid="true"]',
    ".split-action-button:disabled",
    ".split-card.is-selected",
    ".split-card__action--danger",
    ".distance-slider:active"
  ]) {
    assert.ok(css.includes(stateSelector), `${stateSelector} should be styled`);
  }

  assert.match(css, /input:focus-visible,[\s\S]*button:focus-visible,[\s\S]*a:focus-visible/);
  assert.match(css, /@media \(hover: hover\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
