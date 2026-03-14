import assert from "node:assert/strict";
import test from "node:test";

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  add(...tokens) {
    const classes = this.#getClasses();

    for (const token of tokens) {
      classes.add(token);
    }

    this.#setClasses(classes);
  }

  remove(...tokens) {
    const classes = this.#getClasses();

    for (const token of tokens) {
      classes.delete(token);
    }

    this.#setClasses(classes);
  }

  toggle(token, force) {
    const classes = this.#getClasses();
    const shouldAdd = force ?? !classes.has(token);

    if (shouldAdd) {
      classes.add(token);
    } else {
      classes.delete(token);
    }

    this.#setClasses(classes);
    return shouldAdd;
  }

  #getClasses() {
    return new Set(this.element.className.split(/\s+/).filter(Boolean));
  }

  #setClasses(classes) {
    this.element.className = [...classes].join(" ");
  }
}

class FakeElement {
  constructor(tagName, { id = "", dataset = {} } = {}) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.dataset = { ...dataset };
    this.attributes = new Map();
    this.children = [];
    this.className = "";
    this.classList = new FakeClassList(this);
    this.hidden = false;
    this.listeners = new Map();
    this.scope = "";
    this.tabIndex = 0;
    this.textContent = "";
    this.value = "";
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];

    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  append(...children) {
    this.children.push(...children);
  }

  dispatch(type, init = {}) {
    const handlers = this.listeners.get(type) ?? [];
    const event = {
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      target: this,
      ...init
    };

    for (const handler of handlers) {
      handler(event);
    }
  }

  focus() {}

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.modeButtons = [];
    this.unitButtons = [];
    this.convertSourceButtons = [];
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelector(selector) {
    if (!selector.startsWith("#")) {
      throw new Error(`Unsupported selector: ${selector}`);
    }

    return this.elements.get(selector.slice(1)) ?? null;
  }

  querySelectorAll(selector) {
    if (selector === "[data-mode-button]") {
      return this.modeButtons;
    }

    if (selector === "[data-unit-button]") {
      return this.unitButtons;
    }

    if (selector === "[data-convert-source-button]") {
      return this.convertSourceButtons;
    }

    throw new Error(`Unsupported selector: ${selector}`);
  }

  register(tagName, id, dataset = {}) {
    const element = new FakeElement(tagName, { id, dataset });

    this.elements.set(id, element);
    return element;
  }
}

function createFakeDom() {
  const document = new FakeDocument();
  const make = (tagName, id, dataset) => document.register(tagName, id, dataset);

  const elements = {
    alternatePaceLabel: make("span", "alternate-pace-label"),
    alternatePaceValue: make("span", "alternate-pace-value"),
    alternateSpeedLabel: make("span", "alternate-speed-label"),
    alternateSpeedValue: make("span", "alternate-speed-value"),
    convertSourceCluster: make("div", "convert-source-cluster"),
    distanceCluster: make("div", "distance-cluster"),
    distanceError: make("p", "distance-error"),
    distanceInput: make("input", "distance-input"),
    distanceLabel: make("span", "distance-label"),
    finishCluster: make("div", "finish-cluster"),
    finishError: make("p", "finish-error"),
    finishHours: make("input", "finish-hours"),
    finishMinutes: make("input", "finish-minutes"),
    finishSeconds: make("input", "finish-seconds"),
    heroChips: make("div", "hero-chips"),
    paceCluster: make("div", "pace-cluster"),
    paceCopy: make("p", "pace-copy"),
    paceError: make("p", "pace-error"),
    paceMinutes: make("input", "pace-minutes"),
    paceSeconds: make("input", "pace-seconds"),
    presetSelect: make("select", "preset-select"),
    primaryLabel: make("span", "primary-label"),
    primaryMeta: make("p", "primary-meta"),
    primaryValue: make("span", "primary-value"),
    projectionRows: make("tbody", "projection-rows"),
    resetButton: make("button", "reset-button"),
    resultBadge: make("span", "result-badge"),
    resultNote: make("p", "result-note"),
    selectedDistance: make("span", "selected-distance"),
    selectedPaceLabel: make("span", "selected-pace-label"),
    selectedPaceValue: make("span", "selected-pace-value"),
    selectedSpeedLabel: make("span", "selected-speed-label"),
    selectedSpeedValue: make("span", "selected-speed-value"),
    splitCopy: make("p", "split-copy"),
    splitHeading: make("h3", "split-heading"),
    splitRows: make("tbody", "split-rows"),
    speedCluster: make("div", "speed-cluster"),
    speedError: make("p", "speed-error"),
    speedInput: make("input", "speed-input"),
    speedLabel: make("span", "speed-label"),
    statusMessage: make("p", "status-message")
  };

  document.modeButtons = [
    make("button", "mode-tab-pace", { mode: "pace" }),
    make("button", "mode-tab-finish", { mode: "finish" }),
    make("button", "mode-tab-convert", { mode: "convert" })
  ];
  document.unitButtons = [
    make("button", "unit-km", { unit: "km" }),
    make("button", "unit-mi", { unit: "mi" })
  ];
  document.convertSourceButtons = [
    make("button", "convert-source-pace", { convertSource: "pace" }),
    make("button", "convert-source-speed", { convertSource: "speed" })
  ];

  elements.modeTabPace = document.modeButtons[0];
  elements.modeTabFinish = document.modeButtons[1];
  elements.modeTabConvert = document.modeButtons[2];
  elements.unitKm = document.unitButtons[0];
  elements.unitMi = document.unitButtons[1];
  elements.convertSourcePace = document.convertSourceButtons[0];
  elements.convertSourceSpeed = document.convertSourceButtons[1];

  return { document, elements };
}

let importCounter = 0;

async function loadApp() {
  const { document, elements } = createFakeDom();
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;

  globalThis.document = document;
  globalThis.window = {
    document,
    history: {
      replaceState(_state, _title, url) {
        const parsed = new URL(url, "https://example.test");

        globalThis.window.location.pathname = parsed.pathname;
        globalThis.window.location.search = parsed.search;
        globalThis.window.location.hash = parsed.hash;
      }
    },
    location: {
      hash: "",
      pathname: "/index.html",
      search: ""
    }
  };

  importCounter += 1;
  await import(new URL(`../src/main.js?test=${importCounter}`, import.meta.url).href);

  return {
    elements,
    restore() {
      if (previousDocument === undefined) {
        delete globalThis.document;
      } else {
        globalThis.document = previousDocument;
      }

      if (previousWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = previousWindow;
      }
    }
  };
}

function setInputValue(element, value) {
  element.value = value;
  element.dispatch("input");
}

function click(element) {
  element.dispatch("click");
}

function readSplitRows(splitRows) {
  return splitRows.children.map((row) => {
    const [labelCell, finishCell] = row.children;

    return {
      finishLabel: finishCell?.textContent ?? "",
      isPartial: row.className.includes("is-final-partial"),
      label: labelCell?.textContent ?? ""
    };
  });
}

test("main.js updates split rows in the DOM when result-driving inputs change", async (t) => {
  const app = await loadApp();
  const { elements } = app;

  t.after(() => {
    app.restore();
  });

  assert.equal(elements.splitHeading.textContent, "Selected-distance splits");
  assert.equal(
    elements.splitRows.children[0].children[0].textContent,
    "Enter valid values to calculate."
  );

  setInputValue(elements.distanceInput, "10");
  setInputValue(elements.finishHours, "0");
  setInputValue(elements.finishMinutes, "50");
  setInputValue(elements.finishSeconds, "0");

  let rows = readSplitRows(elements.splitRows);
  assert.deepEqual(rows.slice(0, 2), [
    { label: "1 km", finishLabel: "00:05:00", isPartial: false },
    { label: "2 km", finishLabel: "00:10:00", isPartial: false }
  ]);

  setInputValue(elements.finishMinutes, "45");
  rows = readSplitRows(elements.splitRows);
  assert.equal(rows[0].finishLabel, "00:04:30");
  assert.equal(rows.at(-1).label, "10 km");
  assert.equal(rows.at(-1).finishLabel, "00:45:00");

  click(elements.modeTabFinish);
  setInputValue(elements.distanceInput, "10");
  setInputValue(elements.paceMinutes, "5");
  setInputValue(elements.paceSeconds, "0");

  rows = readSplitRows(elements.splitRows);
  assert.equal(rows[0].finishLabel, "00:05:00");
  assert.equal(rows.at(-1).finishLabel, "00:50:00");

  setInputValue(elements.paceMinutes, "4");
  rows = readSplitRows(elements.splitRows);
  assert.equal(rows[0].finishLabel, "00:04:00");
  assert.equal(rows.at(-1).finishLabel, "00:40:00");

  click(elements.modeTabConvert);
  click(elements.unitMi);
  click(elements.convertSourceSpeed);
  setInputValue(elements.distanceInput, "3");
  setInputValue(elements.speedInput, "7.5");

  rows = readSplitRows(elements.splitRows);
  assert.deepEqual(rows, [
    { label: "1 mi", finishLabel: "00:08:00", isPartial: false },
    { label: "2 mi", finishLabel: "00:16:00", isPartial: false },
    { label: "3 mi", finishLabel: "00:24:00", isPartial: false }
  ]);

  setInputValue(elements.speedInput, "6");
  rows = readSplitRows(elements.splitRows);
  assert.equal(rows[0].finishLabel, "00:10:00");
  assert.equal(rows.at(-1).finishLabel, "00:30:00");

  setInputValue(elements.distanceInput, "4");
  rows = readSplitRows(elements.splitRows);
  assert.equal(rows.length, 4);
  assert.equal(rows.at(-1).label, "4 mi");
  assert.equal(rows.at(-1).finishLabel, "00:40:00");
});
