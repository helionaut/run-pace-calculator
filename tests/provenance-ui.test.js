import assert from "node:assert/strict";
import test from "node:test";

import {
  renderProvenanceBadges,
  setClusterState
} from "../src/lib/provenance-ui.js";

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
  const primaryBadges = new FakeElement();
  const lockedBadges = new FakeElement();
  const lockedCluster = new FakeElement("section");
  const derivedDescriptor = {
    badges: [
      {
        ariaLabel: "Calculated value",
        label: "Derived",
        tone: "derived"
      }
    ]
  };
  const lockedDescriptor = {
    badges: [
      {
        ariaLabel: "User-entered value",
        label: "Entered",
        tone: "entered"
      },
      {
        ariaLabel: "Currently driving recalculation",
        label: "Locked",
        tone: "locked"
      }
    ]
  };

  renderProvenanceBadges(
    primaryBadges,
    derivedDescriptor,
    "Result provenance",
    documentRef
  );
  renderProvenanceBadges(
    lockedBadges,
    lockedDescriptor,
    "Locked value provenance",
    documentRef
  );
  setClusterState(lockedCluster, lockedDescriptor);

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
  const lockedBadges = new FakeElement();
  const speedBadges = new FakeElement();
  const speedCluster = new FakeElement("section");
  const staleDescriptor = {
    badges: [
      {
        ariaLabel: "User-entered value",
        label: "Entered",
        tone: "entered"
      },
      {
        ariaLabel: "Currently driving recalculation",
        label: "Locked",
        tone: "locked"
      },
      {
        ariaLabel: "Shown from the last valid complete calculation",
        label: "Last valid",
        tone: "stale"
      }
    ]
  };
  const emptyDescriptor = { badges: [] };

  renderProvenanceBadges(
    lockedBadges,
    staleDescriptor,
    "Locked value provenance",
    documentRef
  );
  renderProvenanceBadges(
    speedBadges,
    emptyDescriptor,
    "Speed input state",
    documentRef
  );
  setClusterState(speedCluster, emptyDescriptor);

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
