import assert from "node:assert/strict";
import test from "node:test";

class FakeClassList {
  constructor() {
    this.tokens = new Set();
  }

  add(...tokens) {
    for (const token of tokens) {
      this.tokens.add(token);
    }
  }

  contains(token) {
    return this.tokens.has(token);
  }

  remove(...tokens) {
    for (const token of tokens) {
      this.tokens.delete(token);
    }
  }

  setFromString(value) {
    this.tokens = new Set(String(value).split(/\s+/).filter(Boolean));
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

  toString() {
    return [...this.tokens].join(" ");
  }
}

class FakeElement {
  constructor({ id = "", dataset = {} } = {}) {
    this.attributes = {};
    this.children = [];
    this.classList = new FakeClassList();
    this.dataset = { ...dataset };
    this.hidden = false;
    this.id = id;
    this.listeners = new Map();
    this.textContent = "";
    this.value = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];

    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  emit(type, event = {}) {
    const handlers = this.listeners.get(type) ?? [];

    for (const handler of handlers) {
      handler({
        ...event,
        currentTarget: this,
        preventDefault() {},
        target: this
      });
    }
  }

  focus() {
    this.focused = true;
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList.setFromString(value);
  }
}

class FakeDocument {
  constructor() {
    this.byId = new Map();
    this.collections = new Map();
  }

  createElement() {
    return new FakeElement();
  }

  querySelector(selector) {
    if (!selector.startsWith("#")) {
      throw new Error(`Unsupported selector: ${selector}`);
    }

    return this.byId.get(selector.slice(1)) ?? null;
  }

  querySelectorAll(selector) {
    return this.collections.get(selector) ?? [];
  }

  registerElement(id, element = new FakeElement({ id })) {
    this.byId.set(id, element);
    return element;
  }

  registerCollection(selector, elements) {
    this.collections.set(selector, elements);
    return elements;
  }
}

function createEnvironment(search = "") {
  const document = new FakeDocument();
  const ids = [
    "alternate-pace-label",
    "alternate-pace-provenance",
    "alternate-pace-value",
    "alternate-speed-label",
    "alternate-speed-provenance",
    "alternate-speed-value",
    "convert-source-cluster",
    "distance-cluster",
    "distance-cluster-provenance",
    "distance-error",
    "distance-input",
    "distance-label",
    "distance-provenance",
    "finish-cluster",
    "finish-cluster-provenance",
    "finish-error",
    "finish-hours",
    "finish-minutes",
    "finish-seconds",
    "hero-chips",
    "locked-label",
    "locked-meta",
    "locked-provenance",
    "locked-value",
    "pace-cluster",
    "pace-cluster-provenance",
    "pace-copy",
    "pace-error",
    "pace-minutes",
    "pace-seconds",
    "preset-select",
    "primary-label",
    "primary-meta",
    "primary-provenance",
    "primary-value",
    "projection-rows",
    "reset-button",
    "result-badge",
    "result-note",
    "selected-distance",
    "selected-pace-label",
    "selected-pace-provenance",
    "selected-pace-value",
    "selected-speed-label",
    "selected-speed-provenance",
    "selected-speed-value",
    "speed-cluster",
    "speed-cluster-provenance",
    "speed-error",
    "speed-input",
    "speed-label",
    "status-message"
  ];

  for (const id of ids) {
    document.registerElement(id);
  }

  const modeButtons = {
    convert: new FakeElement({ dataset: { mode: "convert" }, id: "mode-tab-convert" }),
    finish: new FakeElement({ dataset: { mode: "finish" }, id: "mode-tab-finish" }),
    pace: new FakeElement({ dataset: { mode: "pace" }, id: "mode-tab-pace" })
  };
  const unitButtons = {
    km: new FakeElement({ dataset: { unit: "km" } }),
    mi: new FakeElement({ dataset: { unit: "mi" } })
  };
  const convertSourceButtons = {
    pace: new FakeElement({ dataset: { convertSource: "pace" } }),
    speed: new FakeElement({ dataset: { convertSource: "speed" } })
  };

  document.registerCollection("[data-mode-button]", Object.values(modeButtons));
  document.registerCollection("[data-unit-button]", Object.values(unitButtons));
  document.registerCollection(
    "[data-convert-source-button]",
    Object.values(convertSourceButtons)
  );

  const window = {
    history: {
      calls: [],
      replaceState(_state, _title, url) {
        this.calls.push(url);

        const parsed = new URL(url, "https://example.test");

        window.location.pathname = parsed.pathname;
        window.location.search = parsed.search;
        window.location.hash = parsed.hash;
      }
    },
    location: {
      hash: "",
      pathname: "/index.html",
      search
    },
    reloadCount: 0,
    reload() {
      this.reloadCount += 1;
    }
  };

  return {
    controls: {
      convertSourceButtons,
      modeButtons,
      unitButtons
    },
    document,
    elements: Object.fromEntries([...document.byId.entries()]),
    window
  };
}

async function loadApp(t, search = "") {
  const environment = createEnvironment(search);
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;

  globalThis.document = environment.document;
  globalThis.window = environment.window;

  t.after(() => {
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
  });

  await import(
    new URL(`../src/main.js?case=${Math.random().toString(36).slice(2)}`, import.meta.url)
  );

  return environment;
}

test("main restores a valid calculator scenario from the query string on load", async (t) => {
  const app = await loadApp(
    t,
    "?mode=finish&unit=mi&preset=custom&distance=6.5&pm=8&ps=15"
  );

  assert.equal(app.elements["distance-input"].value, "6.5");
  assert.equal(app.elements["pace-minutes"].value, "8");
  assert.equal(app.elements["pace-seconds"].value, "15");
  assert.equal(app.elements["preset-select"].value, "custom");
  assert.equal(
    app.window.location.search,
    "?mode=finish&unit=mi&preset=custom&distance=6.5&pm=8&ps=15"
  );
  assert.equal(app.window.history.calls.length, 0);
});

test("main updates the URL after valid edits without reloading the page", async (t) => {
  const app = await loadApp(t);

  app.controls.modeButtons.finish.emit("click");
  app.elements["distance-input"].value = "10";
  app.elements["distance-input"].emit("input");
  app.elements["pace-minutes"].value = "5";
  app.elements["pace-minutes"].emit("input");
  app.elements["pace-seconds"].value = "0";
  app.elements["pace-seconds"].emit("input");

  assert.equal(
    app.window.location.search,
    "?mode=finish&unit=km&preset=custom&distance=10&pm=5&ps=0"
  );
  assert.match(
    app.window.history.calls.at(-1),
    /\?mode=finish&unit=km&preset=custom&distance=10&pm=5&ps=0$/
  );
  assert.equal(app.window.reloadCount, 0);
});

test("main clears malformed query state back to the default calculator", async (t) => {
  const app = await loadApp(t, "?mode=convert&unit=km&source=speed&speed=12&pm=5");

  assert.equal(app.window.location.search, "");
  assert.equal(app.elements["distance-input"].value, "");
  assert.equal(app.elements["speed-input"].value, "");
  assert.equal(app.window.history.calls.length, 1);
  assert.equal(app.window.history.calls[0], "/index.html");
});

test("main reset clears a valid deep link back to a clean URL", async (t) => {
  const app = await loadApp(t, "?mode=finish&unit=km&preset=custom&distance=10&pm=5&ps=0");

  app.elements["reset-button"].emit("click");

  assert.equal(app.window.location.search, "");
  assert.equal(app.elements["distance-input"].value, "");
  assert.equal(app.elements["pace-minutes"].value, "");
  assert.equal(app.elements["pace-seconds"].value, "");
  assert.equal(app.window.history.calls.at(-1), "/index.html");
  assert.equal(app.window.reloadCount, 0);
});
