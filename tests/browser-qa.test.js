import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateAcceptance,
  parseArguments,
  QA_VARIANTS,
  QA_VIEWPORTS,
  renderMarkdownReport
} from "../scripts/browser-qa.mjs";

function measurement({
  clientHeight,
  clientWidth,
  documentHeight,
  focusCount = 18,
  minTargetHeight = 44,
  minTargetWidth = 44,
  nestedScroll = [],
  primaryBottom
}) {
  return {
    body: {
      clientHeight: documentHeight,
      clientWidth,
      scrollHeight: documentHeight,
      scrollWidth: clientWidth
    },
    document: {
      clientHeight,
      clientWidth,
      scrollHeight: documentHeight,
      scrollWidth: clientWidth
    },
    focus: {
      controlsVisited: focusCount,
      expectedCount: focusCount,
      failures: []
    },
    identity: "Run Pace Calculator",
    minTargetHeight,
    minTargetWidth,
    nestedScroll,
    primaryBottom,
    primaryControlCount: 22,
    primaryFitsInitialViewport: primaryBottom <= clientHeight
  };
}

function passingMeasurements() {
  return {
    current: {
      "390x844": measurement({
        clientHeight: 844,
        clientWidth: 390,
        documentHeight: 1800,
        primaryBottom: 1450
      }),
      "768x1024": measurement({
        clientHeight: 1024,
        clientWidth: 768,
        documentHeight: 1400,
        primaryBottom: 1000
      }),
      "1440x900": measurement({
        clientHeight: 900,
        clientWidth: 1440,
        documentHeight: 1000,
        primaryBottom: 840
      })
    },
    previous: {},
    revised: {
      "390x844": measurement({
        clientHeight: 844,
        clientWidth: 390,
        documentHeight: 1400,
        primaryBottom: 1180
      }),
      "768x1024": measurement({
        clientHeight: 1024,
        clientWidth: 768,
        documentHeight: 1100,
        primaryBottom: 880
      }),
      "1440x900": measurement({
        clientHeight: 900,
        clientWidth: 1440,
        documentHeight: 900,
        primaryBottom: 840
      })
    }
  };
}

test("browser QA matrix fixes the three authoritative viewports and comparison states", () => {
  assert.deepEqual(
    QA_VIEWPORTS.map(({ id }) => id),
    ["390x844", "768x1024", "1440x900"]
  );
  assert.deepEqual(
    QA_VARIANTS.map(({ id, revision }) => [id, revision]),
    [
      ["previous", "f16d457"],
      ["current", "0187103"],
      ["revised", null]
    ]
  );
});

test("browser QA acceptance checks cover overflow, travel, targets, focus, and desktop fit", () => {
  const acceptance = evaluateAcceptance(passingMeasurements());

  assert.equal(acceptance.passed, true);
  assert.deepEqual(
    acceptance.checks.map(({ id }) => id),
    [
      "horizontal-overflow-390x844",
      "nested-scroll-390x844",
      "target-size-390x844",
      "keyboard-focus-390x844",
      "vertical-travel-390x844",
      "horizontal-overflow-768x1024",
      "nested-scroll-768x1024",
      "target-size-768x1024",
      "keyboard-focus-768x1024",
      "vertical-travel-768x1024",
      "horizontal-overflow-1440x900",
      "nested-scroll-1440x900",
      "target-size-1440x900",
      "keyboard-focus-1440x900",
      "desktop-primary-workflow"
    ]
  );
});

test("browser QA acceptance fails on a measurable responsive regression", () => {
  const measurements = passingMeasurements();

  measurements.revised["390x844"].document.scrollWidth = 410;
  measurements.revised["390x844"].minTargetWidth = 43;
  measurements.revised["768x1024"].minTargetHeight = 40;
  measurements.revised["1440x900"].primaryFitsInitialViewport = false;

  const acceptance = evaluateAcceptance(measurements);

  assert.equal(acceptance.passed, false);
  assert.deepEqual(
    acceptance.checks
      .filter(({ passed }) => !passed)
    .map(({ id }) => id),
    [
      "horizontal-overflow-390x844",
      "target-size-390x844",
      "target-size-768x1024",
      "desktop-primary-workflow"
    ]
  );
});

test("browser QA argument parsing keeps check mode dependency-free", () => {
  const configuration = parseArguments(["--check"]);

  assert.equal(configuration.check, true);
  assert.equal(configuration.chrome, null);
});

test("browser QA relative output paths remain portable across checkout roots", () => {
  const configuration = parseArguments(["--output", "artifacts/qa"]);

  assert.equal(
    configuration.output,
    fileURLToPath(new URL("../artifacts/qa", import.meta.url))
  );
});

test("browser QA report records dimensions, checks, and all nine screenshots", () => {
  const measurements = passingMeasurements();

  for (const variant of QA_VARIANTS) {
    measurements[variant.id] ||= {};

    for (const viewport of QA_VIEWPORTS) {
      measurements[variant.id][viewport.id] ||=
        measurements.revised[viewport.id];
    }
  }

  const report = renderMarkdownReport({
    acceptance: evaluateAcceptance(measurements),
    generatedAt: "2026-07-26T00:00:00.000Z",
    measurements
  });

  assert.match(report, /document client \| document scroll \| body scroll/);
  assert.match(report, /desktop-primary-workflow \| PASS/);

  for (const variant of QA_VARIANTS) {
    for (const viewport of QA_VIEWPORTS) {
      assert.match(report, new RegExp(`${variant.id}-${viewport.id}\\.png`));
    }
  }
});

test("package scripts expose explicit behavioral regression and browser QA commands", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );

  assert.equal(packageJson.scripts["qa:browser"], "node scripts/browser-qa.mjs");
  assert.match(packageJson.scripts["test:regression"], /calculator\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /main\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /url-state\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /accessibility\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /browser-qa\.test\.js/);
});
