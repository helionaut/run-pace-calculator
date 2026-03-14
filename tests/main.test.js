import test from "node:test";
import assert from "node:assert/strict";

import { createCalculatorApp } from "../src/main.js";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      this.tokens.add(token);
    }
  }

  remove(...tokens) {
    for (const token of tokens) {
      this.tokens.delete(token);
    }
  }

  toggle(token, force) {
    if (force === true) {
      this.tokens.add(token);
      return true;
    }

    if (force === false) {
      this.tokens.delete(token);
      return false;
    }

    if (this.tokens.has(token)) {
      this.tokens.delete(token);
      return false;
    }

    this.tokens.add(token);
    return true;
  }

  contains(token) {
    return this.tokens.has(token);
  }

  setFromString(value) {
    this.tokens = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  toString() {
    return [...this.tokens].join(" ");
  }
}

class FakeElement {
  constructor({ dataset = {}, value = "", textContent = "" } = {}) {
    this.classList = new FakeClassList();
    this.children = [];
    this.dataset = { ...dataset };
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
    this.textContent = textContent;
    this.value = value;
    this.attributes = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];

    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, extra = {}) {
    const listeners = this.listeners.get(type) ?? [];
    const event = {
      currentTarget: this,
      preventDefault() {},
      target: this,
      type,
      ...extra
    };

    for (const listener of listeners) {
      listener(event);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList.setFromString(value);
  }
}

function createElements() {
  const unitButtons = [
    new FakeElement({ dataset: { unit: "km" } }),
    new FakeElement({ dataset: { unit: "mi" } })
  ];
  const presetButtons = [
    new FakeElement({ dataset: { preset: "5k" } }),
    new FakeElement({ dataset: { preset: "10k" } }),
    new FakeElement({ dataset: { preset: "half" } }),
    new FakeElement({ dataset: { preset: "marathon" } })
  ];

  return {
    distanceCard: new FakeElement(),
    distanceError: new FakeElement(),
    distanceInput: new FakeElement({ value: "10" }),
    distanceLabel: new FakeElement(),
    distanceSlider: new FakeElement({ value: "10" }),
    paceError: new FakeElement(),
    paceLabel: new FakeElement(),
    paceMinutes: new FakeElement(),
    paceSeconds: new FakeElement(),
    presetButtons,
    projectionValues: {
      "5k": new FakeElement(),
      "10k": new FakeElement(),
      half: new FakeElement(),
      marathon: new FakeElement()
    },
    rateCard: new FakeElement(),
    resetButton: new FakeElement(),
    selectedDistance: new FakeElement(),
    speedError: new FakeElement(),
    speedInput: new FakeElement(),
    speedLabel: new FakeElement(),
    statusMessage: new FakeElement(),
    timeCard: new FakeElement(),
    timeError: new FakeElement(),
    timeHours: new FakeElement(),
    timeMinutes: new FakeElement(),
    timeSeconds: new FakeElement(),
    unitButtons
  };
}

function enterPace(elements, minutes, seconds) {
  elements.paceMinutes.value = minutes;
  elements.paceMinutes.dispatch("input");
  elements.paceSeconds.value = seconds;
  elements.paceSeconds.dispatch("input");
}

function enterSpeed(elements, speed) {
  elements.speedInput.value = speed;
  elements.speedInput.dispatch("input");
}

function enterTime(elements, hours, minutes, seconds) {
  elements.timeHours.value = hours;
  elements.timeHours.dispatch("input");
  elements.timeMinutes.value = minutes;
  elements.timeMinutes.dispatch("input");
  elements.timeSeconds.value = seconds;
  elements.timeSeconds.dispatch("input");
}

test("pace input plus slider movement updates derived speed and finish time live", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");

  assert.equal(elements.speedInput.value, "12");
  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "50");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(
    elements.statusMessage.textContent,
    "Solving time from distance + movement rate."
  );
  assert.equal(elements.rateCard.classList.contains("metric-card--source"), true);
  assert.equal(elements.timeCard.classList.contains("metric-card--derived"), true);

  elements.distanceSlider.value = "5";
  elements.distanceSlider.dispatch("input");

  assert.equal(elements.selectedDistance.textContent, "5 km");
  assert.equal(elements.speedInput.value, "12");
  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "25");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(elements.distanceCard.classList.contains("metric-card--source"), true);
});

test("editing time after pace recalculates distance from the new source pair", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");
  enterTime(elements, "0", "40", "0");

  assert.equal(elements.distanceInput.value, "8");
  assert.equal(elements.selectedDistance.textContent, "8 km");
  assert.equal(elements.speedInput.value, "12");
  assert.equal(
    elements.statusMessage.textContent,
    "Solving distance from movement rate + time."
  );
  assert.equal(elements.distanceCard.classList.contains("metric-card--derived"), true);
});

test("speed input keeps pace and finish time linked in the DOM", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterSpeed(elements, "12");

  assert.equal(elements.paceMinutes.value, "5");
  assert.equal(elements.paceSeconds.value, "00");
  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "50");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(
    elements.statusMessage.textContent,
    "Solving time from distance + movement rate."
  );
});

test("preset buttons work with a time-driven solve and recalculate movement rate", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterTime(elements, "0", "50", "0");
  elements.presetButtons[0].dispatch("click");

  assert.equal(elements.distanceInput.value, "5");
  assert.equal(elements.selectedDistance.textContent, "5 km");
  assert.equal(elements.paceMinutes.value, "10");
  assert.equal(elements.paceSeconds.value, "00");
  assert.equal(elements.speedInput.value, "6");
  assert.equal(
    elements.statusMessage.textContent,
    "Solving movement rate from distance + time."
  );
});
