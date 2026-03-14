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
    this.children = [];
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

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
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
    "distance-card",
    "distance-error",
    "distance-input",
    "distance-label",
    "distance-slider",
    "pace-error",
    "pace-label",
    "pace-minutes",
    "pace-seconds",
    "projection-5k",
    "projection-10k",
    "projection-half",
    "projection-marathon",
    "rate-card",
    "reset-button",
    "selected-distance",
    "speed-error",
    "speed-input",
    "speed-label",
    "status-message",
    "time-card",
    "time-error",
    "time-hours",
    "time-minutes",
    "time-seconds"
  ];

  for (const id of ids) {
    document.registerElement(id);
  }

  const presetButtons = {
    "100m": new FakeElement({ dataset: { preset: "100m" } }),
    "500m": new FakeElement({ dataset: { preset: "500m" } }),
    "1k": new FakeElement({ dataset: { preset: "1k" } }),
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
    "?solve=distance-rate&preset=custom&unit=mi&distance=6.5&rate=pace&pm=8&ps=15"
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
    "?solve=distance-rate&preset=custom&unit=mi&distance=6.5&rate=pace&pm=8&ps=15"
  );
  assert.equal(app.window.history.calls.length, 0);
});

test("main updates the URL after valid edits without reloading the page", async (t) => {
  const app = await loadApp(t);

  enterPace(app.elements, "5", "0");

  assert.equal(
    app.window.location.search,
    "?solve=distance-rate&preset=10k&unit=km&rate=pace&pm=5&ps=0"
  );
  assert.match(
    app.window.history.calls.at(-1),
    /\?solve=distance-rate&preset=10k&unit=km&rate=pace&pm=5&ps=0$/
  );
  assert.equal(app.window.reloadCount, 0);
});

test("main keeps the latest source pair in the URL as distance changes", async (t) => {
  const app = await loadApp(t);

  enterTime(app.elements, "0", "50", "0");

  assert.equal(
    app.window.location.search,
    "?solve=distance-time&preset=10k&unit=km&th=0&tm=50&ts=0"
  );

  app.elements["distance-slider"].value = "5";
  app.elements["distance-slider"].emit("input");

  assert.equal(
    app.window.location.search,
    "?solve=time-distance&preset=5k&unit=km&th=0&tm=50&ts=0"
  );
  assert.equal(app.window.reloadCount, 0);
});

test("main clears malformed query state back to the default calculator", async (t) => {
  const app = await loadApp(
    t,
    "?solve=distance-rate&unit=km&speed=12&rate=pace"
  );

  assert.equal(app.window.location.search, "");
  assert.equal(app.elements["distance-input"].value, "10");
  assert.equal(app.elements["speed-input"].value, "");
  assert.equal(app.window.history.calls.length, 1);
  assert.equal(app.window.history.calls[0], "/index.html");
});

test("main reset clears a valid deep link back to a clean URL", async (t) => {
  const app = await loadApp(
    t,
    "?solve=distance-rate&preset=10k&unit=km&rate=pace&pm=5&ps=0"
  );

  app.elements["reset-button"].emit("click");

  assert.equal(app.window.location.search, "");
  assert.equal(app.elements["distance-input"].value, "10");
  assert.equal(app.elements["pace-minutes"].value, "");
  assert.equal(app.elements["pace-seconds"].value, "");
  assert.equal(app.window.history.calls.at(-1), "/index.html");
  assert.equal(app.window.reloadCount, 0);
});
