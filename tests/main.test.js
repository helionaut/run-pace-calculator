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

class FakeDocument {
  createElement(tagName) {
    return new FakeElement({
      ownerDocument: this,
      tagName
    });
  }
}

class FakeElement {
  constructor({
    dataset = {},
    ownerDocument = null,
    tagName = "div",
    textContent = "",
    value = ""
  } = {}) {
    this.classList = new FakeClassList();
    this.children = [];
    this.dataset = { ...dataset };
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
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
  const documentRef = new FakeDocument();
  const unitButtons = [
    new FakeElement({ dataset: { unit: "km" }, ownerDocument: documentRef }),
    new FakeElement({ dataset: { unit: "mi" }, ownerDocument: documentRef })
  ];
  const presetButtons = [
    new FakeElement({ dataset: { preset: "100m" }, ownerDocument: documentRef }),
    new FakeElement({ dataset: { preset: "500m" }, ownerDocument: documentRef }),
    new FakeElement({ dataset: { preset: "1k" }, ownerDocument: documentRef }),
    new FakeElement({ dataset: { preset: "5k" }, ownerDocument: documentRef }),
    new FakeElement({ dataset: { preset: "10k" }, ownerDocument: documentRef }),
    new FakeElement({ dataset: { preset: "half" }, ownerDocument: documentRef }),
    new FakeElement({ dataset: { preset: "marathon" }, ownerDocument: documentRef })
  ];

  return {
    distanceCard: new FakeElement({ ownerDocument: documentRef }),
    distanceError: new FakeElement({ ownerDocument: documentRef }),
    distanceInput: new FakeElement({ ownerDocument: documentRef, value: "10" }),
    distanceLabel: new FakeElement({ ownerDocument: documentRef }),
    distanceSlider: new FakeElement({ ownerDocument: documentRef, value: "10" }),
    documentRef,
    paceError: new FakeElement({ ownerDocument: documentRef }),
    paceField: new FakeElement({ ownerDocument: documentRef }),
    paceLabel: new FakeElement({ ownerDocument: documentRef }),
    paceMinutes: new FakeElement({ ownerDocument: documentRef }),
    paceSeconds: new FakeElement({ ownerDocument: documentRef }),
    presetButtons,
    projectionValues: {
      "5k": new FakeElement({ ownerDocument: documentRef }),
      "10k": new FakeElement({ ownerDocument: documentRef }),
      half: new FakeElement({ ownerDocument: documentRef }),
      marathon: new FakeElement({ ownerDocument: documentRef })
    },
    rateCard: new FakeElement({ ownerDocument: documentRef }),
    resetButton: new FakeElement({ ownerDocument: documentRef }),
    selectedDistance: new FakeElement({ ownerDocument: documentRef }),
    splitActionButton: new FakeElement({ ownerDocument: documentRef }),
    splitEmptyState: new FakeElement({ ownerDocument: documentRef }),
    splitList: new FakeElement({ ownerDocument: documentRef, tagName: "ol" }),
    splitSummary: new FakeElement({ ownerDocument: documentRef }),
    speedError: new FakeElement({ ownerDocument: documentRef }),
    speedField: new FakeElement({ ownerDocument: documentRef }),
    speedInput: new FakeElement({ ownerDocument: documentRef }),
    speedLabel: new FakeElement({ ownerDocument: documentRef }),
    statusMessage: new FakeElement({ ownerDocument: documentRef }),
    timeCard: new FakeElement({ ownerDocument: documentRef }),
    timeError: new FakeElement({ ownerDocument: documentRef }),
    timeHours: new FakeElement({ ownerDocument: documentRef }),
    timeMinutes: new FakeElement({ ownerDocument: documentRef }),
    timeSeconds: new FakeElement({ ownerDocument: documentRef }),
    unitButtons
  };
}

function getPresetButton(elements, presetId) {
  return elements.presetButtons.find((button) => button.dataset.preset === presetId);
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

function getSplitMetricValue(splitRow, index) {
  return splitRow.children[0].children[1].children[index].children[1].textContent;
}

function getSplitMetricValues(splitRow) {
  return [0, 1, 2].map((index) => getSplitMetricValue(splitRow, index));
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

test("focusing speed makes it the active rate field without changing the linked value", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");

  elements.speedInput.dispatch("focus");

  assert.equal(elements.speedInput.value, "12");
  assert.equal(elements.paceMinutes.value, "5");
  assert.equal(elements.paceSeconds.value, "00");
  assert.equal(elements.paceField.classList.contains("field--linked"), true);
  assert.equal(elements.speedField.classList.contains("field--active"), true);
  assert.equal(
    elements.statusMessage.textContent,
    "Solving time from distance + movement rate."
  );
});

test("moving between pace subfields does not snap back the unfinished group", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  elements.paceMinutes.value = "5";
  elements.paceMinutes.dispatch("focus");
  elements.paceMinutes.dispatch("input");
  elements.paceSeconds.dispatch("focus");
  elements.paceSeconds.value = "";
  elements.paceSeconds.dispatch("input");
  elements.paceSeconds.dispatch("blur", {
    relatedTarget: elements.paceMinutes
  });

  assert.equal(elements.paceMinutes.value, "5");
  assert.equal(elements.paceSeconds.value, "");
  assert.equal(elements.paceError.textContent, "Complete pace minutes and seconds.");
});

test("first pace edit auto-fills the untouched seconds field with zeros", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  elements.paceMinutes.value = "5";
  elements.paceMinutes.dispatch("focus");
  elements.paceMinutes.dispatch("input");

  assert.equal(elements.paceMinutes.value, "5");
  assert.equal(elements.paceSeconds.value, "00");
  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "50");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(elements.speedInput.value, "12");
});

test("first time edit auto-fills untouched fields with zeros", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  elements.timeHours.value = "1";
  elements.timeHours.dispatch("focus");
  elements.timeHours.dispatch("input");

  assert.equal(elements.timeHours.value, "1");
  assert.equal(elements.timeMinutes.value, "00");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(elements.paceMinutes.value, "6");
  assert.equal(elements.paceSeconds.value, "00");
  assert.equal(elements.speedInput.value, "10");
});

test("invalid time blur restores the last valid view instead of leaving hidden state", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");

  elements.timeSeconds.dispatch("focus");
  elements.timeSeconds.value = "999";
  elements.timeSeconds.dispatch("input");

  assert.equal(elements.timeError.textContent, "Finish seconds must stay between 0 and 59.");
  assert.equal(elements.statusMessage.textContent, "Fix highlighted fields.");

  elements.timeSeconds.dispatch("blur");

  assert.equal(elements.timeHours.value, "0");
  assert.equal(elements.timeMinutes.value, "50");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(elements.timeError.textContent, "");
  assert.equal(elements.statusMessage.textContent, "Solving time from distance + movement rate.");
});

test("default quick-distance chips include the new short kilometer presets", () => {
  const elements = createElements();

  createCalculatorApp(elements);

  assert.deepEqual(
    elements.presetButtons.map(({ dataset, textContent }) => [dataset.preset, textContent]),
    [
      ["100m", "100m"],
      ["500m", "500m"],
      ["1k", "1 km"],
      ["5k", "5K"],
      ["10k", "10K"],
      ["half", "Half"],
      ["marathon", "Marathon"]
    ]
  );
});

test("preset buttons work with a time-driven solve and recalculate movement rate", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterTime(elements, "0", "50", "0");
  getPresetButton(elements, "5k").dispatch("click");

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

test("unit switch updates quick-distance chip labels for the selected unit", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  elements.unitButtons[1].dispatch("click");

  assert.deepEqual(
    elements.presetButtons.map(({ dataset, textContent }) => [dataset.preset, textContent]),
    [
      ["0.1mi", "0.1 mi"],
      ["0.5mi", "0.5 mi"],
      ["1mi", "1 mi"],
      ["5mi", "5 mi"],
      ["10mi", "10 mi"],
      ["half", "Half"],
      ["marathon", "Marathon"]
    ]
  );
});

test("mile short-distance preset buttons update the selected distance", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  elements.unitButtons[1].dispatch("click");
  getPresetButton(elements, "0.5mi").dispatch("click");

  assert.equal(elements.distanceInput.value, "0.5");
  assert.equal(elements.selectedDistance.textContent, "0.5 mi");
  assert.equal(getPresetButton(elements, "0.5mi").getAttribute("aria-pressed"), "true");
});

test("slider input rounds mile distances to at most two decimals", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  elements.unitButtons[1].dispatch("click");
  elements.distanceSlider.value = "6.21371";
  elements.distanceSlider.dispatch("input");

  assert.equal(elements.distanceInput.value, "6.21");
  assert.equal(elements.selectedDistance.textContent, "6.21 mi");
  assert.equal(elements.distanceSlider.step, "0.01");
});

test("add split captures the current calculator values into a compact row", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");
  elements.splitActionButton.dispatch("click");

  assert.equal(elements.splitSummary.textContent, "No split selected");
  assert.equal(elements.splitList.children.length, 1);
  assert.equal(elements.splitEmptyState.hidden, true);
  assert.equal(getSplitMetricValue(elements.splitList.children[0], 0), "10 km");
  assert.equal(getSplitMetricValue(elements.splitList.children[0], 1), "05:00 /km");
  assert.equal(getSplitMetricValue(elements.splitList.children[0], 2), "00:50:00");
  assert.equal(elements.splitActionButton.textContent, "Add split");
});

test("selecting a split loads it into the editor and dirty edits switch the action into save mode", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "5", "0");
  elements.splitActionButton.dispatch("click");
  enterTime(elements, "0", "40", "0");
  elements.splitActionButton.dispatch("click");

  elements.splitList.children[0].children[0].dispatch("click");

  assert.equal(elements.distanceInput.value, "10");
  assert.equal(elements.timeMinutes.value, "50");
  assert.equal(elements.timeSeconds.value, "00");
  assert.equal(elements.splitSummary.textContent, "Editing split 1");

  elements.distanceInput.dispatch("focus");
  elements.distanceInput.value = "12";
  elements.distanceInput.dispatch("input");

  assert.equal(elements.splitActionButton.textContent, "Save split");
  assert.equal(
    elements.splitActionButton.classList.contains("split-action-button--save"),
    true
  );
  assert.equal(elements.splitSummary.textContent, "Update split 1");

  elements.splitActionButton.dispatch("click");

  assert.equal(getSplitMetricValue(elements.splitList.children[0], 0), "12 km");
  assert.equal(getSplitMetricValue(elements.splitList.children[0], 2), "01:00:00");
  assert.equal(elements.splitActionButton.textContent, "Add split");
  assert.equal(
    elements.splitActionButton.classList.contains("split-action-button--save"),
    false
  );
  assert.equal(elements.splitSummary.textContent, "Editing split 1");
});

test("duplicate and delete controls keep the split list editable", () => {
  const elements = createElements();

  createCalculatorApp(elements);
  enterPace(elements, "6", "0");
  elements.splitActionButton.dispatch("click");

  const firstRow = elements.splitList.children[0];
  const duplicateButton = firstRow.children[1].children[0];
  const deleteButton = firstRow.children[1].children[1];

  duplicateButton.dispatch("click");

  assert.equal(elements.splitList.children.length, 2);
  assert.equal(elements.splitSummary.textContent, "Editing split 2");
  assert.equal(elements.distanceInput.value, "10");
  assert.equal(elements.timeHours.value, "1");
  assert.equal(elements.timeMinutes.value, "00");
  assert.deepEqual(
    getSplitMetricValues(elements.splitList.children[1]),
    getSplitMetricValues(firstRow)
  );

  deleteButton.dispatch("click");

  assert.equal(elements.splitList.children.length, 1);
  assert.equal(elements.splitSummary.textContent, "Editing split 1");
  assert.equal(elements.splitEmptyState.hidden, true);

  elements.splitList.children[0].children[1].children[1].dispatch("click");

  assert.equal(elements.splitList.children.length, 0);
  assert.equal(elements.splitSummary.textContent, "No splits yet");
  assert.equal(elements.splitEmptyState.hidden, false);
});
