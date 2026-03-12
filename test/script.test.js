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
}

class FakeDocument {
  constructor() {
    this.elements = new Map();

    for (const [selector, value] of [
      ["#pace-minutes", "5"],
      ["#pace-seconds", "30"],
      ["#pace-unit", "km"],
      ["#speed-value", ""],
      ["#speed-unit", "kmh"],
      ["#distance-value", "10"],
      ["#distance-unit", "km"],
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
