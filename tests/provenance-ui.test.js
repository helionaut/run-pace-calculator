import assert from "node:assert/strict";
import test from "node:test";

import {
  CONVERT_SOURCES,
  MODES,
  createFormState,
  deriveCalculatorView
} from "../src/lib/calculator.js";
import {
  renderProvenanceBadges,
  setClusterState
} from "../src/lib/provenance-ui.js";

function buildState(overrides = {}, inputOverrides = {}) {
  const state = createFormState();

  return {
    ...state,
    ...overrides,
    inputs: {
      ...state.inputs,
      ...inputOverrides
    }
  };
}

class FakeElement {
  constructor(tagName = "div") {
    this.attributes = new Map();
    this.children = [];
    this.className = "";
    this.hidden = false;
    this.tagName = tagName;
    this.textContent = "";
    this.classList = {
      contains: (token) => this.#getClasses().has(token),
      toggle: (token, force) => {
        const classes = this.#getClasses();

        if (force) {
          classes.add(token);
        } else {
          classes.delete(token);
        }

        this.className = [...classes].join(" ");
      }
    };
  }

  #getClasses() {
    return new Set(this.className.split(/\s+/).filter(Boolean));
  }

  replaceChildren(...children) {
    this.children = children;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function getBadgeTexts(element) {
  return element.children.slice(1).map((child) => child.textContent);
}

test("renderProvenanceBadges shows entered and derived labels with screen-reader prefixes", () => {
  const documentRef = new FakeDocument();
  const currentView = deriveCalculatorView(
    buildState(
      { mode: MODES.FINISH },
      {
        distance: "10",
        paceMinutes: "5",
        paceSeconds: "0"
      }
    )
  );
  const primaryBadges = new FakeElement();
  const lockedBadges = new FakeElement();
  const lockedCluster = new FakeElement("section");

  renderProvenanceBadges(
    primaryBadges,
    currentView.display.provenance.primary,
    "Result provenance",
    documentRef
  );
  renderProvenanceBadges(
    lockedBadges,
    currentView.display.lockedSummary.provenance,
    "Locked value provenance",
    documentRef
  );
  setClusterState(lockedCluster, currentView.inputProvenance.pace);

  assert.equal(primaryBadges.hidden, false);
  assert.equal(primaryBadges.children[0].className, "sr-only");
  assert.equal(primaryBadges.children[0].textContent, "Result provenance: ");
  assert.deepEqual(getBadgeTexts(primaryBadges), ["Derived"]);
  assert.equal(
    primaryBadges.children[1].getAttribute("aria-label"),
    "Calculated value"
  );

  assert.equal(lockedBadges.hidden, false);
  assert.equal(lockedBadges.children[0].textContent, "Locked value provenance: ");
  assert.deepEqual(getBadgeTexts(lockedBadges), ["Entered", "Locked"]);
  assert.equal(
    lockedBadges.children[1].getAttribute("aria-label"),
    "User-entered value"
  );
  assert.equal(
    lockedBadges.children[2].getAttribute("aria-label"),
    "Currently driving recalculation"
  );

  assert.equal(lockedCluster.classList.contains("field-cluster--entered"), true);
  assert.equal(lockedCluster.classList.contains("field-cluster--locked"), true);
});

test("stale provenance rendering keeps last-valid context in summary badges and clears ambiguous input badges", () => {
  const documentRef = new FakeDocument();
  const validView = deriveCalculatorView(
    buildState(
      {
        mode: MODES.CONVERT,
        convertSource: CONVERT_SOURCES.PACE
      },
      {
        paceMinutes: "5",
        paceSeconds: "0"
      }
    )
  );
  const staleView = deriveCalculatorView(
    buildState(
      {
        mode: MODES.CONVERT,
        convertSource: CONVERT_SOURCES.SPEED
      },
      {
        speed: ""
      }
    ),
    validView.currentResult
  );
  const lockedBadges = new FakeElement();
  const speedBadges = new FakeElement();
  const speedCluster = new FakeElement("section");

  renderProvenanceBadges(
    lockedBadges,
    staleView.display.lockedSummary.provenance,
    "Locked value provenance",
    documentRef
  );
  renderProvenanceBadges(
    speedBadges,
    staleView.inputProvenance.speed,
    "Speed input state",
    documentRef
  );
  setClusterState(speedCluster, staleView.inputProvenance.speed);

  assert.deepEqual(getBadgeTexts(lockedBadges), ["Entered", "Locked", "Last valid"]);
  assert.equal(
    lockedBadges.children[3].getAttribute("aria-label"),
    "Shown from the last valid complete calculation"
  );
  assert.equal(speedBadges.hidden, true);
  assert.deepEqual(speedBadges.children, []);
  assert.equal(speedCluster.classList.contains("field-cluster--entered"), false);
  assert.equal(speedCluster.classList.contains("field-cluster--locked"), false);
});
