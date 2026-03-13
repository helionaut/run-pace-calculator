import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../script.js";

class FakeElement {
  constructor({ value = "" } = {}) {
    this.value = value;
    this.textContent = "";
    this.innerHTML = "";
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatch(type) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ target: this, type });
    }
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();

    for (const [selector, value] of [
      ["#pace-minutes", "5"],
      ["#pace-seconds", "30"],
      ["#pace-unit", "km"],
      ["#pace-message", ""],
      ["#speed-value", ""],
      ["#speed-unit", "kmh"],
      ["#speed-message", ""],
      ["#distance-value", "10"],
      ["#distance-unit", "km"],
      ["#distance-message", ""],
      ["#status-line", ""],
      ["#custom-distance-label", ""],
      ["#custom-finish", ""],
      ["#custom-detail", ""],
      ["#hero-pace", ""],
      ["#hero-speed", ""],
      ["#pace-km-value", ""],
      ["#pace-km-detail", ""],
      ["#pace-mi-value", ""],
      ["#pace-mi-detail", ""],
      ["#speed-km-value", ""],
      ["#speed-km-detail", ""],
      ["#speed-mi-value", ""],
      ["#speed-mi-detail", ""],
      ["#prediction-table-body", ""],
    ]) {
      this.elements.set(selector, new FakeElement({ value }));
    }
  }

  querySelector(selector) {
    const element = this.elements.get(selector);

    if (!element) {
      throw new Error(`Unknown selector: ${selector}`);
    }

    return element;
  }

  createElement() {
    return new FakeElement();
  }
}

test("createApp renders the default calculator view", () => {
  const document = new FakeDocument();
  const { elements } = createApp(document);

  assert.equal(elements.heroPace.textContent, "5:30 /km");
  assert.equal(elements.heroSpeed.textContent, "10.91 km/h");
  assert.equal(elements.customFinish.textContent, "55:00");
  assert.equal(elements.predictionTableBody.children.length, 7);
  assert.match(elements.predictionTableBody.children[0].innerHTML, /1 Mile/);
  assert.match(elements.statusLine.textContent, /8:51 \/mi/);
  assert.equal(elements.paceMessage.textContent, "");
  assert.equal(elements.speedMessage.textContent, "");
  assert.equal(elements.distanceMessage.textContent, "");
});

test("speed input updates the rendered projections", () => {
  const document = new FakeDocument();
  const { elements } = createApp(document);

  elements.speedUnit.value = "mph";
  elements.speedUnit.dispatch("change");
  elements.speedValue.value = "8";
  elements.speedValue.dispatch("input");

  assert.equal(elements.heroPace.textContent, "4:40 /km");
  assert.equal(elements.speedKmValue.textContent, "12.87 km/h");
  assert.equal(elements.customFinish.textContent, "46:36");
  assert.match(elements.predictionTableBody.children[6].innerHTML, /46:36/);
});

test("invalid pace input exposes text validation and preserves the last valid output", () => {
  const document = new FakeDocument();
  const { elements } = createApp(document);

  elements.paceSeconds.value = "75";
  elements.paceSeconds.dispatch("input");

  assert.equal(
    elements.paceMessage.textContent,
    "Enter a pace greater than 0:00 with whole seconds from 0 to 59.",
  );
  assert.equal(elements.paceMinutes.getAttribute("aria-invalid"), "true");
  assert.equal(elements.paceSeconds.getAttribute("aria-invalid"), "true");
  assert.equal(
    elements.statusLine.textContent,
    "Showing the last valid projection while you correct the marked field.",
  );
  assert.equal(elements.customFinish.textContent, "55:00");
});

test("invalid distance input exposes text validation and clears once corrected", () => {
  const document = new FakeDocument();
  const { elements } = createApp(document);

  elements.distanceValue.value = "0";
  elements.distanceValue.dispatch("input");

  assert.equal(
    elements.distanceMessage.textContent,
    "Enter a distance greater than 0.",
  );
  assert.equal(elements.distanceValue.getAttribute("aria-invalid"), "true");

  elements.distanceValue.value = "13.1";
  elements.distanceValue.dispatch("input");

  assert.equal(elements.distanceMessage.textContent, "");
  assert.equal(elements.distanceValue.getAttribute("aria-invalid"), null);
  assert.equal(elements.customDistanceLabel.textContent, "13.1 km");
});
