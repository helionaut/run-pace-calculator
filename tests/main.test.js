import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/main.js";

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      this.values.add(token);
    }
  }

  remove(...tokens) {
    for (const token of tokens) {
      this.values.delete(token);
    }
  }

  toggle(token, force) {
    if (force === true) {
      this.values.add(token);
      return true;
    }

    if (force === false) {
      this.values.delete(token);
      return false;
    }

    if (this.values.has(token)) {
      this.values.delete(token);
      return false;
    }

    this.values.add(token);
    return true;
  }

  contains(token) {
    return this.values.has(token);
  }

  toString() {
    return [...this.values].join(" ");
  }
}

class FakeElement {
  constructor({ dataset = {}, value = "" } = {}) {
    this.attributes = new Map();
    this.children = [];
    this.dataset = dataset;
    this.hidden = false;
    this.listeners = new Map();
    this.scope = "";
    this.tabIndex = 0;
    this.textContent = "";
    this.value = value;
    this.classList = new FakeClassList(this);
  }

  set className(value) {
    this.classList = new FakeClassList(this);

    for (const token of String(value).split(/\s+/).filter(Boolean)) {
      this.classList.add(token);
    }
  }

  get className() {
    return this.classList.toString();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];

    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  append(...children) {
    this.children.push(...children);
  }

  dispatch(type, overrides = {}) {
    const event = {
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      target: this,
      type,
      ...overrides
    };

    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }

  focus() {
    this.focused = true;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();

    this.modeButtons = [
      this.register("[data-mode-button-pace]", new FakeElement({ dataset: { mode: "pace" } })),
      this.register("[data-mode-button-speed]", new FakeElement({ dataset: { mode: "speed" } })),
      this.register("[data-mode-button-finish]", new FakeElement({ dataset: { mode: "finish" } }))
    ];
    this.panels = [
      this.register("[data-input-panel-pace]", new FakeElement({ dataset: { inputPanel: "pace" } })),
      this.register("[data-input-panel-speed]", new FakeElement({ dataset: { inputPanel: "speed" } })),
      this.register("[data-input-panel-finish]", new FakeElement({ dataset: { inputPanel: "finish" } }))
    ];

    for (const [selector, value] of [
      ["#distance-select", ""],
      ["#finish-caption", ""],
      ["#finish-error", ""],
      ["#finish-hours", "0"],
      ["#finish-minutes", "45"],
      ["#finish-seconds", "0"],
      ["#finish-value", ""],
      ["#hero-chips", ""],
      ["#pace-error", ""],
      ["#pace-km-value", ""],
      ["#pace-mi-value", ""],
      ["#pace-minutes", "5"],
      ["#pace-seconds", "0"],
      ["#pace-unit", "km"],
      ["#projection-rows", ""],
      ["#speed-error", ""],
      ["#speed-kmh-value", ""],
      ["#speed-mph-value", ""],
      ["#speed-unit", "kmh"],
      ["#speed-value", "12"],
      ["#split-grid", ""],
      ["#status-message", ""]
    ]) {
      this.register(selector, new FakeElement({ value }));
    }
  }

  createElement() {
    return new FakeElement();
  }

  querySelector(selector) {
    if (selector === "[data-mode-button]") {
      throw new Error("Use querySelectorAll for mode buttons");
    }

    if (selector === "[data-input-panel]") {
      throw new Error("Use querySelectorAll for panels");
    }

    const element = this.elements.get(selector);

    if (!element) {
      throw new Error(`Unknown selector: ${selector}`);
    }

    return element;
  }

  querySelectorAll(selector) {
    if (selector === "[data-mode-button]") {
      return this.modeButtons;
    }

    if (selector === "[data-input-panel]") {
      return this.panels;
    }

    throw new Error(`Unknown selector list: ${selector}`);
  }

  register(selector, element) {
    this.elements.set(selector, element);
    return element;
  }
}

test("createApp renders the default pace view", () => {
  const document = new FakeDocument();
  const { elements } = createApp(document);

  assert.equal(elements.finishValue.textContent, "50:00");
  assert.equal(elements.finishCaption.textContent, "10K at the current steady effort.");
  assert.equal(elements.paceKmValue.textContent, "5:00 /km");
  assert.equal(elements.speedKmhValue.textContent, "12.0 km/h");
  assert.equal(elements.statusMessage.textContent, "Calculated from pace input.");
  assert.equal(elements.projectionRows.children.length, 6);
});

test("invalid pace input exposes text validation and preserves the last valid projection", () => {
  const document = new FakeDocument();
  const { elements } = createApp(document);

  elements.paceSeconds.value = "75";
  elements.paceSeconds.dispatch("input");

  assert.equal(elements.paceError.textContent, "Pace seconds must stay between 0 and 59.");
  assert.equal(elements.paceMinutes.getAttribute("aria-invalid"), "true");
  assert.equal(elements.paceSeconds.getAttribute("aria-invalid"), "true");
  assert.equal(elements.paceUnit.getAttribute("aria-invalid"), "true");
  assert.equal(elements.finishValue.textContent, "50:00");
  assert.match(
    elements.statusMessage.textContent,
    /Showing the last valid projection while you fix the active pace input/
  );
});

test("mode switches keep focus state and route validation to the active panel", () => {
  const document = new FakeDocument();
  const { elements, setMode } = createApp(document);

  setMode("finish", { focusButton: true });

  assert.equal(elements.modeButtons[0].getAttribute("aria-selected"), "false");
  assert.equal(elements.modeButtons[2].getAttribute("aria-selected"), "true");
  assert.equal(elements.modeButtons[2].focused, true);
  assert.equal(elements.panels[0].hidden, true);
  assert.equal(elements.panels[2].hidden, false);

  elements.finishMinutes.value = "61";
  elements.finishMinutes.dispatch("input");

  assert.equal(elements.finishError.textContent, "Minutes must stay between 0 and 59.");
  assert.equal(elements.finishMinutes.getAttribute("aria-invalid"), "true");
  assert.equal(elements.paceError.textContent, "");
  assert.match(elements.statusMessage.textContent, /active finish time input/);
});
