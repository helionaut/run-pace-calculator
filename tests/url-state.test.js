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
    this.classList = new FakeClassList();
    this.dataset = { ...dataset };
    this.disabled = false;
    this.id = id;
    this.listeners = new Map();
    this.textContent = "";
    this.value = "";
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

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList.setFromString(value);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

class FakeDocument {
  constructor() {
    this.byId = new Map();
    this.collections = new Map();
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
    "distance-error",
    "distance-input",
    "distance-label",
    "distance-slider",
    "pace-card",
    "pace-driver-button",
    "pace-error",
    "pace-label",
    "pace-lock-button",
    "pace-minutes",
    "pace-secondary",
    "pace-seconds",
    "pace-state",
    "projection-5k",
    "projection-10k",
    "projection-half",
    "projection-marathon",
    "reset-button",
    "selected-distance",
    "speed-card",
    "speed-driver-button",
    "speed-error",
    "speed-input",
    "speed-label",
    "speed-secondary",
    "speed-state",
    "status-message",
    "time-card",
    "time-driver-button",
    "time-error",
    "time-hours",
    "time-lock-button",
    "time-minutes",
    "time-secondary",
    "time-seconds",
    "time-state"
  ];

  for (const id of ids) {
    document.registerElement(id);
  }

  const presetButtons = {
    "5k": new FakeElement({ dataset: { preset: "5k" } }),
    "10k": new FakeElement({ dataset: { preset: "10k" } }),
    half: new FakeElement({ dataset: { preset: "half" } }),
    marathon: new FakeElement({ dataset: { preset: "marathon" } })
  };
  const unitButtons = {
    km: new FakeElement({ dataset: { unit: "km" } }),
    mi: new FakeElement({ dataset: { unit: "mi" } })
  };

  document.registerCollection("[data-preset-button]", Object.values(presetButtons));
  document.registerCollection("[data-unit-button]", Object.values(unitButtons));

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
      presetButtons,
      unitButtons
    },
    document,
    elements: Object.fromEntries([...document.byId.entries()]),
    window
  };
}

function enterPace(elements, minutes, seconds) {
  elements["pace-minutes"].value = minutes;
  elements["pace-minutes"].emit("input");
  elements["pace-seconds"].value = seconds;
  elements["pace-seconds"].emit("input");
}

function enterTime(elements, hours, minutes, seconds) {
  elements["time-driver-button"].emit("click");
  elements["time-hours"].value = hours;
  elements["time-hours"].emit("input");
  elements["time-minutes"].value = minutes;
  elements["time-minutes"].emit("input");
  elements["time-seconds"].value = seconds;
  elements["time-seconds"].emit("input");
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
    "?metric=pace&preset=custom&unit=mi&distance=6.5&pm=8&ps=15"
  );

  assert.equal(app.elements["distance-input"].value, "6.5");
  assert.equal(app.elements["pace-minutes"].value, "8");
  assert.equal(app.elements["pace-seconds"].value, "15");
  assert.equal(app.elements["speed-input"].value, "7.27");
  assert.equal(app.elements["time-hours"].value, "0");
  assert.equal(app.elements["time-minutes"].value, "53");
  assert.equal(app.elements["time-seconds"].value, "38");
  assert.equal(
    app.window.location.search,
    "?metric=pace&preset=custom&unit=mi&distance=6.5&pm=8&ps=15"
  );
  assert.equal(app.window.history.calls.length, 0);
});

test("main updates the URL after valid edits without reloading the page", async (t) => {
  const app = await loadApp(t);

  enterPace(app.elements, "5", "0");

  assert.equal(
    app.window.location.search,
    "?metric=pace&preset=10k&unit=km&pm=5&ps=0"
  );
  assert.match(
    app.window.history.calls.at(-1),
    /\?metric=pace&preset=10k&unit=km&pm=5&ps=0$/
  );
  assert.equal(app.window.reloadCount, 0);
});

test("main keeps lock state in the URL as distance changes", async (t) => {
  const app = await loadApp(t);

  enterTime(app.elements, "0", "50", "0");
  app.elements["time-lock-button"].emit("click");

  assert.equal(
    app.window.location.search,
    "?metric=time&preset=10k&unit=km&th=0&tm=50&ts=0&lock=time"
  );

  app.elements["distance-slider"].value = "5";
  app.elements["distance-slider"].emit("input");

  assert.equal(
    app.window.location.search,
    "?metric=time&preset=5k&unit=km&th=0&tm=50&ts=0&lock=time"
  );
  assert.equal(app.window.reloadCount, 0);
});

test("main clears malformed query state back to the default calculator", async (t) => {
  const app = await loadApp(
    t,
    "?metric=speed&preset=10k&unit=km&speed=12&lock=time"
  );

  assert.equal(app.window.location.search, "");
  assert.equal(app.elements["distance-input"].value, "10");
  assert.equal(app.elements["speed-input"].value, "");
  assert.equal(app.window.history.calls.length, 1);
  assert.equal(app.window.history.calls[0], "/index.html");
});

test("main reset clears a valid deep link back to a clean URL", async (t) => {
  const app = await loadApp(t, "?metric=pace&preset=10k&unit=km&pm=5&ps=0");

  app.elements["reset-button"].emit("click");

  assert.equal(app.window.location.search, "");
  assert.equal(app.elements["distance-input"].value, "10");
  assert.equal(app.elements["pace-minutes"].value, "");
  assert.equal(app.elements["pace-seconds"].value, "");
  assert.equal(app.window.history.calls.at(-1), "/index.html");
  assert.equal(app.window.reloadCount, 0);
});
