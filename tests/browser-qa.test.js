import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  evaluateAcceptance,
  evaluateMobileComparison,
  MOBILE_COMPARISON_VARIANTS,
  MOBILE_COMPARISON_VIEWPORT,
  parseArguments,
  QA_VARIANTS,
  QA_VIEWPORTS,
  renderMobileComparisonReport,
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
  primaryBottom,
  requiredControlsOperable = true,
  resultLabel = "Ready when you are",
  resultValue = "—",
  splitActionDisabled = true,
  splitCount = 0
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
    effectiveViewport: {
      height: clientHeight,
      width: clientWidth
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
    primaryControlCount: 27,
    primaryFitsInitialViewport: primaryBottom <= clientHeight,
    requiredControlsOperable,
    result: {
      detail:
        resultValue === "50:00"
          ? "10 km at 5:00 min/km."
          : "Enter any two values to calculate the third.",
      label: resultLabel,
      rect: {
        inViewport: primaryBottom <= clientHeight
      },
      value: resultValue
    },
    scroll: {
      x: 0,
      y: 0
    },
    splitActionDisabled,
    splitCount,
    validationRegions: [
      "distance-error",
      "pace-error",
      "speed-error",
      "time-error",
      "status-message"
    ].map((id) => ({
      ariaLive: "polite",
      exists: true,
      id,
      text: ""
    }))
  };
}

function passingMeasurements() {
  const initial390 = measurement({
    clientHeight: 844,
    clientWidth: 390,
    documentHeight: 700,
    primaryBottom: 690,
    requiredControlsOperable: false
  });
  const completed390 = measurement({
    clientHeight: 844,
    clientWidth: 390,
    documentHeight: 720,
    primaryBottom: 710,
    resultLabel: "Finish time",
    resultValue: "50:00",
    splitActionDisabled: false
  });
  const splits390 = measurement({
    clientHeight: 844,
    clientWidth: 390,
    documentHeight: 900,
    primaryBottom: 710,
    resultLabel: "Finish time",
    resultValue: "50:00",
    splitActionDisabled: false,
    splitCount: 1
  });

  initial390.states = {
    completed: completed390,
    splits: splits390
  };

  return {
    current: {
      "320x844": measurement({
        clientHeight: 844,
        clientWidth: 320,
        documentHeight: 1800,
        primaryBottom: 1450
      }),
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
      "320x844": measurement({
        clientHeight: 844,
        clientWidth: 320,
        documentHeight: 820,
        primaryBottom: 800
      }),
      "390x844": initial390,
      "768x1024": measurement({
        clientHeight: 1024,
        clientWidth: 768,
        documentHeight: 1000,
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

function mobileComparisonMeasurement(variant, {
  documentHeight,
  primaryVisibleCount
}) {
  return {
    appViewport: {
      devicePixelRatio: 1,
      height: 844,
      visualScale: 1,
      width: 390
    },
    contentBounds: {
      left: 0,
      right: 390,
      width: 390
    },
    document: {
      clientHeight: 844,
      clientWidth: 390,
      scrollHeight: documentHeight,
      scrollWidth: 390
    },
    focus: {
      id: null,
      tag: "BODY"
    },
    identity: "Run Pace Calculator",
    image: {
      file: variant.screenshot,
      height: 908,
      sha256: "a".repeat(64),
      width: 390
    },
    inputState: {
      "distance-input": "10",
      "pace-minutes": "5",
      "pace-seconds": "00",
      "speed-input": "12",
      "time-hours": "0",
      "time-minutes": "50",
      "time-seconds": "00"
    },
    label: {
      revision: variant.revision,
      text: variant.label
    },
    outerDocument: {
      clientHeight: 908,
      clientWidth: 390,
      scrollHeight: 908,
      scrollWidth: 390
    },
    primaryBottom: documentHeight - 100,
    primaryVisibleCount,
    result: {
      detail: "10K at 5:00 /km.",
      label: "Finish time",
      value: "50:00"
    },
    revision: variant.revision,
    scroll: {
      x: 0,
      y: 0
    },
    unit: "km"
  };
}

function passingMobileComparisonMeasurements() {
  return {
    old: mobileComparisonMeasurement(MOBILE_COMPARISON_VARIANTS[0], {
      documentHeight: 1800,
      primaryVisibleCount: 12
    }),
    new: mobileComparisonMeasurement(MOBILE_COMPARISON_VARIANTS[1], {
      documentHeight: 1440,
      primaryVisibleCount: 16
    })
  };
}

test("browser QA matrix fixes fit, narrow-mobile, tablet, and desktop viewports", () => {
  assert.deepEqual(
    QA_VIEWPORTS.map(({ id }) => id),
    ["320x844", "390x844", "768x1024", "1440x900"]
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

test("mobile comparison contract fixes exactly two labeled revisions at one app viewport", () => {
  assert.deepEqual(MOBILE_COMPARISON_VIEWPORT, {
    height: 844,
    id: "390x844",
    width: 390
  });
  assert.deepEqual(
    MOBILE_COMPARISON_VARIANTS.map(
      ({ id, label, revision, screenshot }) => ({
        id,
        label,
        revision,
        screenshot
      })
    ),
    [
      {
        id: "old",
        label: "Старая версия",
        revision: "01871034a84d1ed4daf470535e2351ecc871fdd3",
        screenshot: "old-version-0187103.png"
      },
      {
        id: "new",
        label: "Новая версия",
        revision: "6ffa9d9a1019c0f3814d51cd7dbc888f4b00fe74",
        screenshot: "new-version-6ffa9d9.png"
      }
    ]
  );
});

test("mobile comparison acceptance verifies provenance, framing, state, overflow, and compactness", () => {
  const acceptance = evaluateMobileComparison(
    passingMobileComparisonMeasurements()
  );

  assert.equal(acceptance.passed, true);
  assert.equal(acceptance.compactnessRatio, 0.8);
  assert.deepEqual(
    acceptance.checks.map(({ id }) => id),
    [
      "old-revision",
      "old-label",
      "old-app-viewport",
      "old-image-size",
      "old-horizontal-overflow",
      "old-identity",
      "new-revision",
      "new-label",
      "new-app-viewport",
      "new-image-size",
      "new-horizontal-overflow",
      "new-identity",
      "comparable-state",
      "compactness"
    ]
  );
});

test("mobile comparison acceptance rejects mismatched state, crop, and weak density difference", () => {
  const measurements = passingMobileComparisonMeasurements();

  measurements.old.document.scrollWidth = 410;
  measurements.new.inputState["distance-input"] = "5";
  measurements.new.document.scrollHeight = 1700;

  const acceptance = evaluateMobileComparison(measurements);

  assert.equal(acceptance.passed, false);
  assert.deepEqual(
    acceptance.checks
      .filter(({ passed }) => !passed)
      .map(({ id }) => id),
    ["old-horizontal-overflow", "comparable-state", "compactness"]
  );
});

test("browser QA acceptance covers both pre-split states, narrow width, splits, accessibility, and desktop", () => {
  const acceptance = evaluateAcceptance(passingMeasurements());

  assert.equal(acceptance.passed, true);
  assert.deepEqual(
    acceptance.checks.map(({ id }) => id),
    [
      "horizontal-overflow-320x844",
      "nested-scroll-320x844",
      "target-size-320x844",
      "keyboard-focus-320x844",
      "horizontal-overflow-390x844",
      "nested-scroll-390x844",
      "target-size-390x844",
      "keyboard-focus-390x844",
      "horizontal-overflow-768x1024",
      "nested-scroll-768x1024",
      "target-size-768x1024",
      "keyboard-focus-768x1024",
      "horizontal-overflow-1440x900",
      "nested-scroll-1440x900",
      "target-size-1440x900",
      "keyboard-focus-1440x900",
      "initial-pre-split-fit-390x844",
      "initial-required-ui-390x844",
      "initial-neutral-validation-390x844",
      "completed-pre-split-fit-390x844",
      "completed-required-ui-390x844",
      "completed-result-390x844",
      "created-split-scroll-and-overflow-390x844",
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
      "initial-pre-split-fit-390x844",
      "desktop-primary-workflow"
    ]
  );
});

test("browser QA argument parsing keeps check mode dependency-free", () => {
  const configuration = parseArguments(["--check"]);

  assert.equal(configuration.check, true);
  assert.equal(configuration.chrome, null);
  assert.equal(configuration.mobileComparison, false);
});

test("mobile comparison argument parsing keeps its capture contract inspectable", () => {
  const configuration = parseArguments([
    "--mobile-comparison",
    "--check",
    "--output",
    "artifacts/mobile"
  ]);

  assert.equal(configuration.check, true);
  assert.equal(configuration.mobileComparison, true);
  assert.equal(
    configuration.output,
    fileURLToPath(new URL("../artifacts/mobile", import.meta.url))
  );
});

test("mobile comparison defaults to a dedicated artifact directory", () => {
  const configuration = parseArguments(["--mobile-comparison", "--check"]);

  assert.equal(
    configuration.output,
    fileURLToPath(
      new URL("../artifacts/mobile-comparison", import.meta.url)
    )
  );
});

test("browser QA relative output paths remain portable across checkout roots", () => {
  const configuration = parseArguments(["--output", "artifacts/qa"]);

  assert.equal(
    configuration.output,
    fileURLToPath(new URL("../artifacts/qa", import.meta.url))
  );
});

test("browser QA report records dimensions, checks, and state screenshots", () => {
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
  assert.match(report, /revised-390x844-completed\.png/);
  assert.match(report, /revised-390x844-splits\.png/);
});

test("mobile comparison report records the two labels, revisions, and images", () => {
  const measurements = passingMobileComparisonMeasurements();
  const report = renderMobileComparisonReport({
    acceptance: evaluateMobileComparison(measurements),
    generatedAt: "2026-07-26T00:00:00.000Z",
    measurements
  });

  assert.match(report, /Старая версия/);
  assert.match(report, /Новая версия/);
  assert.match(report, /01871034a84d1ed4daf470535e2351ecc871fdd3/);
  assert.match(report, /6ffa9d9a1019c0f3814d51cd7dbc888f4b00fe74/);
  assert.match(report, /old-version-0187103\.png/);
  assert.match(report, /new-version-6ffa9d9\.png/);
  assert.match(report, /compactness \\| PASS/);
});

test("package scripts expose explicit behavioral regression and browser QA commands", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  );

  assert.equal(packageJson.scripts["qa:browser"], "node scripts/browser-qa.mjs");
  assert.equal(
    packageJson.scripts["qa:mobile-comparison"],
    "node scripts/browser-qa.mjs --mobile-comparison --output artifacts/mobile-comparison"
  );
  assert.match(packageJson.scripts["check:syntax"], /browser-qa\.mjs/);
  assert.match(packageJson.scripts["test:regression"], /calculator\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /main\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /url-state\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /accessibility\.test\.js/);
  assert.match(packageJson.scripts["test:regression"], /browser-qa\.test\.js/);
});
