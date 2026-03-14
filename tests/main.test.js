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
    distanceError: new FakeElement(),
    distanceInput: new FakeElement({ value: "10" }),
    distanceLabel: new FakeElement(),
    distanceSlider: new FakeElement({ value: "10" }),
    paceCard: new FakeElement(),
    paceDriverButton: new FakeElement(),
    paceError: new FakeElement(),
    paceLabel: new FakeElement(),
    paceLockButton: new FakeElement(),
    paceMinutes: new FakeElement(),
    paceSecondary: new FakeElement(),
    paceSeconds: new FakeElement(),
    paceState: new FakeElement(),
    presetButtons,
    projectionValues: {
      "5k": new FakeElement(),
      "10k": new FakeElement(),
      half: new FakeElement(),
      marathon: new FakeElement()
    },
    resetButton: new FakeElement(),
    selectedDistance: new FakeElement(),
    splitCopy: new FakeElement(),
    splitHeading: new FakeElement(),
    splitRows: new FakeElement(),
    speedCard: new FakeElement(),
    speedDriverButton: new FakeElement(),
    speedError: new FakeElement(),
    speedInput: new FakeElement(),
    speedLabel: new FakeElement(),
    speedSecondary: new FakeElement(),
    speedState: new FakeElement(),
    statusMessage: new FakeElement(),
    timeCard: new FakeElement(),
    timeDriverButton: new FakeElement(),
    timeError: new FakeElement(),
    timeHours: new FakeElement(),
    timeLockButton: new FakeElement(),
    timeMinutes: new FakeElement(),
    timeSecondary: new FakeElement(),
    timeSeconds: new FakeElement(),
    timeState: new FakeElement(),
    unitButtons
  };
}

function installFakeDocument(t) {
  const previousDocument = globalThis.document;

  globalThis.document = {
    createElement() {
      return new FakeElement();
    }
  };

  t.after(() => {
    if (previousDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = previousDocument;
    }
  });
}

function enterPace(elements, minutes, seconds) {
  elements.paceMinutes.value = minutes;
  elements.paceMinutes.dispatch("input");
  elements.paceSeconds.value = seconds;
  elements.paceSeconds.dispatch("input");
}

function enterTime(elements, hours, minutes, seconds) {
  elements.timeDriverButton.dispatch("click");
  elements.timeHours.value = hours;
  elements.timeHours.dispatch("input");
  elements.timeMinutes.value = minutes;
  elements.timeMinutes.dispatch("input");
  elements.timeSeconds.value = seconds;
  elements.timeSeconds.dispatch("input");
}

function readSplitRows(splitRows) {
  return splitRows.children.map((row) => {
    const [labelCell, finishCell] = row.children;

    return {
      label: labelCell.textContent,
      finishLabel: finishCell.textContent,
      isPartial: row.classList.contains("is-final-partial")
    };
  });
}

test("pace input plus slider movement updates derived speed and finish time live", (t) => {
  installFakeDocument(t);
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");

  assert.equal(elements.paceState.textContent, "Input");
  assert.equal(elements.speedState.textContent, "Derived");
  assert.equal(elements.timeState.textContent, "Derived");
  assert.equal(elements.speedInput.value, "12");
  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "50");
  assert.equal(elements.timeSeconds.value, "00");

  elements.distanceSlider.value = "5";
  elements.distanceSlider.dispatch("input");

  assert.equal(elements.selectedDistance.textContent, "5 km");
  assert.equal(elements.speedInput.value, "12");
  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "25");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(elements.paceMinutes.disabled, false);
  assert.equal(elements.speedInput.disabled, true);
});

test("locking time keeps the target fixed while the slider recalculates pace and speed", (t) => {
  installFakeDocument(t);
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");

  elements.timeLockButton.dispatch("click");

  assert.equal(elements.timeState.textContent, "Locked");
  assert.equal(elements.timeDriverButton.textContent, "Locked input");
  assert.equal(elements.speedDriverButton.disabled, true);

  elements.distanceSlider.value = "5";
  elements.distanceSlider.dispatch("input");

  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "50");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(elements.paceMinutes.value, "10");
  assert.equal(elements.paceSeconds.value, "00");
  assert.equal(elements.speedInput.value, "6");
  assert.equal(
    elements.statusMessage.textContent,
    "Time locked. Drag distance to see the required pace and speed."
  );
});

test("locking pace keeps finish time live and blocks switching drivers until unlocked", (t) => {
  installFakeDocument(t);
  const elements = createElements();

  createCalculatorApp(elements);
  enterTime(elements, "0", "50", "0");

  elements.paceLockButton.dispatch("click");

  assert.equal(elements.paceState.textContent, "Locked");
  assert.equal(elements.speedDriverButton.disabled, true);
  assert.equal(elements.timeDriverButton.disabled, true);

  elements.distanceSlider.value = "5";
  elements.distanceSlider.dispatch("input");

  assert.equal(elements.paceMinutes.value, "5");
  assert.equal(elements.paceSeconds.value, "00");
  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "25");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(
    elements.statusMessage.textContent,
    "Pace locked. Drag distance to update the finish time."
  );
});

test("split rows update in the DOM as the selected distance changes", (t) => {
  installFakeDocument(t);
  const elements = createElements();

  createCalculatorApp(elements);

  assert.equal(elements.splitHeading.textContent, "Kilometer splits");
  assert.equal(
    elements.splitRows.children[0].children[0].textContent,
    "Choose a distance, then edit pace, speed, or time."
  );

  enterPace(elements, "5", "0");

  let rows = readSplitRows(elements.splitRows);
  assert.deepEqual(rows.slice(0, 2), [
    { label: "1 km", finishLabel: "00:05:00", isPartial: false },
    { label: "2 km", finishLabel: "00:10:00", isPartial: false }
  ]);
  assert.equal(rows.at(-1).label, "10 km");
  assert.equal(rows.at(-1).finishLabel, "00:50:00");

  elements.distanceSlider.value = "5";
  elements.distanceSlider.dispatch("input");

  rows = readSplitRows(elements.splitRows);
  assert.equal(rows.length, 5);
  assert.equal(rows.at(-1).label, "5 km");
  assert.equal(rows.at(-1).finishLabel, "00:25:00");
});
