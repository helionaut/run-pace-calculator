import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_SOURCE_FILES = Object.freeze([
  "favicon.svg",
  "index.html",
  "lib/calculator.js",
  "lib/provenance-ui.js",
  "main.js",
  "styles.css"
]);
const MIME_TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
});

export const QA_VARIANTS = Object.freeze([
  Object.freeze({
    id: "previous",
    label: "Previous compact layout",
    revision: "f16d457"
  }),
  Object.freeze({
    id: "current",
    label: "Current pre-rework layout",
    revision: "0187103"
  }),
  Object.freeze({
    id: "revised",
    label: "Revised worktree layout",
    revision: null
  })
]);

export const QA_VIEWPORTS = Object.freeze([
  Object.freeze({ height: 844, id: "320x844", width: 320 }),
  Object.freeze({ height: 844, id: "390x844", width: 390 }),
  Object.freeze({ height: 1024, id: "768x1024", width: 768 }),
  Object.freeze({ height: 900, id: "1440x900", width: 1440 })
]);

export const REQUIRED_PRIMARY_ELEMENT_COUNT = 26;

export const MOBILE_COMPARISON_VARIANTS = Object.freeze([
  Object.freeze({
    id: "old",
    label: "Старая версия",
    revision: "01871034a84d1ed4daf470535e2351ecc871fdd3",
    screenshot: "old-version-0187103.png"
  }),
  Object.freeze({
    id: "new",
    label: "Новая версия",
    revision: "6ffa9d9a1019c0f3814d51cd7dbc888f4b00fe74",
    screenshot: "new-version-6ffa9d9.png"
  })
]);

export const MOBILE_COMPARISON_VIEWPORT = Object.freeze({
  height: 844,
  id: "390x844",
  width: 390
});

const MOBILE_COMPARISON_LABEL_HEIGHT = 64;

function numericInputValue(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function isInitialPreSplitState(state) {
  const inputState = state?.inputState;

  if (!inputState) {
    return false;
  }

  return (
    inputState.unit === "km" &&
    numericInputValue(inputState.distance) === 10 &&
    numericInputValue(inputState.paceMinutes) === null &&
    numericInputValue(inputState.paceSeconds) === null &&
    numericInputValue(inputState.speed) === null &&
    numericInputValue(inputState.timeHours) === null &&
    numericInputValue(inputState.timeMinutes) === null &&
    numericInputValue(inputState.timeSeconds) === null &&
    state.splitActionDisabled === true &&
    state.splitCount === 0
  );
}

export function isCompletedPreSplitState(state) {
  const inputState = state?.inputState;

  if (!inputState) {
    return false;
  }

  const distance = numericInputValue(inputState.distance);
  const paceMinutes = numericInputValue(inputState.paceMinutes);
  const paceSeconds = numericInputValue(inputState.paceSeconds);
  const speed = numericInputValue(inputState.speed);
  const timeHours = numericInputValue(inputState.timeHours);
  const timeMinutes = numericInputValue(inputState.timeMinutes);
  const timeSeconds = numericInputValue(inputState.timeSeconds);

  return (
    inputState.unit === "km" &&
    distance === 10 &&
    paceMinutes !== null &&
    paceSeconds !== null &&
    paceMinutes * 60 + paceSeconds === 300 &&
    speed !== null &&
    Math.abs(speed - 12) < 0.001 &&
    timeHours !== null &&
    timeMinutes !== null &&
    timeSeconds !== null &&
    timeHours * 3600 + timeMinutes * 60 + timeSeconds === 3000 &&
    state.splitActionDisabled === false &&
    state.splitCount === 0
  );
}

export function parseArguments(argv) {
  let outputProvided = false;
  const options = {
    check: false,
    chrome: null,
    mobileComparison: false,
    output: resolve(PROJECT_ROOT, "artifacts/browser-qa")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--check") {
      options.check = true;
      continue;
    }

    if (argument === "--mobile-comparison") {
      options.mobileComparison = true;
      continue;
    }

    if (argument === "--chrome" || argument === "--output") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error(`${argument} requires a value.`);
      }

      options[argument.slice(2)] = resolve(PROJECT_ROOT, value);
      outputProvided ||= argument === "--output";
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (options.mobileComparison && !outputProvided) {
    options.output = resolve(PROJECT_ROOT, "artifacts/mobile-comparison");
  }

  return options;
}

function executableFromPath(name) {
  for (const directory of (process.env.PATH ?? "").split(":").filter(Boolean)) {
    const candidate = join(directory, name);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function findChrome(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.CHROME_BIN,
    executableFromPath("google-chrome"),
    executableFromPath("google-chrome-stable"),
    executableFromPath("chromium"),
    executableFromPath("chromium-browser"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No Chromium-family browser was found. Set CHROME_BIN or pass --chrome /absolute/path/to/chrome."
  );
}

function gitFile(revision, relativePath) {
  const result = spawnSync(
    "git",
    ["show", `${revision}:src/${relativePath}`],
    {
      cwd: PROJECT_ROOT,
      encoding: null,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `Unable to read ${relativePath} at ${revision}: ${String(result.stderr)}`
    );
  }

  return result.stdout;
}

async function stageVariant(variant, stagingRoot) {
  const variantRoot = join(stagingRoot, variant.id);

  for (const relativePath of REQUIRED_SOURCE_FILES) {
    const destination = join(variantRoot, relativePath);

    await mkdir(dirname(destination), { recursive: true });

    if (variant.revision) {
      await writeFile(destination, gitFile(variant.revision, relativePath));
    } else {
      await copyFile(join(PROJECT_ROOT, "src", relativePath), destination);
    }
  }

  return variantRoot;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function stageMobileComparisonVariant(variant, stagingRoot) {
  await stageVariant(variant, stagingRoot);

  const wrapperRoot = join(stagingRoot, `comparison-${variant.id}`);
  const wrapper = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <title>${escapeHtml(variant.label)}</title>
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: ${MOBILE_COMPARISON_VIEWPORT.width}px;
        min-width: ${MOBILE_COMPARISON_VIEWPORT.width}px;
        max-width: ${MOBILE_COMPARISON_VIEWPORT.width}px;
        margin: 0;
        overflow: hidden;
        background: #17211e;
      }

      .capture-label {
        display: grid;
        width: ${MOBILE_COMPARISON_VIEWPORT.width}px;
        height: ${MOBILE_COMPARISON_LABEL_HEIGHT}px;
        padding: 8px 14px 7px;
        color: #fff;
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1;
      }

      .capture-label strong {
        align-self: center;
        font-size: 17px;
        letter-spacing: -0.01em;
      }

      .capture-label code {
        align-self: center;
        overflow: hidden;
        font: 10px/1.2 "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      iframe {
        display: block;
        width: ${MOBILE_COMPARISON_VIEWPORT.width}px;
        height: ${MOBILE_COMPARISON_VIEWPORT.height}px;
        border: 0;
        background: #fff;
      }
    </style>
  </head>
  <body>
    <header
      class="capture-label"
      data-label="${escapeHtml(variant.label)}"
      data-revision="${escapeHtml(variant.revision)}"
    >
      <strong>${escapeHtml(variant.label)}</strong>
      <code>${escapeHtml(variant.revision)}</code>
    </header>
    <iframe
      title="Run Pace Calculator — ${escapeHtml(variant.label)}"
      src="../${escapeHtml(variant.id)}/index.html"
    ></iframe>
  </body>
</html>
`;

  await mkdir(wrapperRoot, { recursive: true });
  await writeFile(join(wrapperRoot, "index.html"), wrapper);
}

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  return server.address().port;
}

async function createFixtureServer(stagingRoot) {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      const relativePath = decodedPath.endsWith("/")
        ? `${decodedPath}index.html`
        : decodedPath;
      const target = resolve(stagingRoot, `.${relativePath}`);
      const allowedPrefix = `${resolve(stagingRoot)}${sep}`;

      if (!target.startsWith(allowedPrefix)) {
        response.writeHead(403).end("Forbidden");
        return;
      }

      const content = await readFile(target);

      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": MIME_TYPES[extname(target)] ?? "application/octet-stream"
      });
      response.end(content);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  const port = await listen(server);

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      })
  };
}

async function reservePort() {
  const server = createServer();
  const port = await listen(server);

  await new Promise((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });

  return port;
}

async function waitForDevtools(port, child) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Chrome exited before DevTools was ready (${child.exitCode}).`);
    }

    try {
      const response = await fetch(endpoint);

      if (response.ok) {
        return;
      }
    } catch {
      // Chrome has not opened the debugging socket yet.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  throw new Error("Timed out waiting for the Chrome DevTools endpoint.");
}

async function launchChrome(chromePath, temporaryRoot) {
  const port = await reservePort();
  const child = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-sandbox",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${join(temporaryRoot, "chrome-profile")}`,
      "about:blank"
    ],
    {
      stdio: ["ignore", "ignore", "pipe"]
    }
  );
  let diagnostics = "";

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    diagnostics = `${diagnostics}${chunk}`.slice(-8000);
  });

  try {
    await waitForDevtools(port, child);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(`${error.message}\n${diagnostics}`.trim());
  }

  return {
    close: async () => {
      if (child.exitCode !== null) {
        return;
      }

      child.kill("SIGTERM");
      await Promise.race([
        new Promise((resolvePromise) => child.once("exit", resolvePromise)),
        new Promise((resolvePromise) => setTimeout(resolvePromise, 2000))
      ]);

      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    },
    port
  };
}

class DevtoolsSession {
  constructor(webSocketUrl) {
    this.counter = 0;
    this.eventWaiters = new Map();
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
  }

  async connect() {
    await new Promise((resolvePromise, reject) => {
      this.socket.addEventListener("open", resolvePromise, { once: true });
      this.socket.addEventListener(
        "error",
        () => reject(new Error("Unable to connect to the page DevTools socket.")),
        { once: true }
      );
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));

      if (message.id) {
        const pending = this.pending.get(message.id);

        if (!pending) {
          return;
        }

        this.pending.delete(message.id);

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }

        return;
      }

      const waiters = this.eventWaiters.get(message.method) ?? [];

      this.eventWaiters.delete(message.method);
      for (const waiter of waiters) {
        waiter(message.params);
      }
    });

    return this;
  }

  command(method, params = {}) {
    const id = (this.counter += 1);

    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { reject, resolve: resolvePromise });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method) {
    return new Promise((resolvePromise) => {
      const waiters = this.eventWaiters.get(method) ?? [];

      waiters.push(resolvePromise);
      this.eventWaiters.set(method, waiters);
    });
  }

  close() {
    this.socket.close();
  }
}

async function createPageSession(port, url) {
  const response = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" }
  );

  if (!response.ok) {
    throw new Error(`Unable to create a Chrome target (${response.status}).`);
  }

  const target = await response.json();
  const session = await new DevtoolsSession(target.webSocketDebuggerUrl).connect();

  await session.command("Page.enable");
  await session.command("Runtime.enable");

  return { session, targetId: target.id };
}

function runtimeValue(result) {
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Browser evaluation failed."
    );
  }

  return result.result.value;
}

async function evaluate(session, expression) {
  return runtimeValue(
    await session.command("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true
    })
  );
}

const MEASUREMENT_EXPRESSION = `(() => {
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== "none" && style.visibility !== "hidden";
  };
  const viewportHeight = window.visualViewport?.height ?? innerHeight;
  const viewportWidth = window.visualViewport?.width ?? innerWidth;
  const rectRecord = (element, name) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      bottom: Math.round(rect.bottom * 100) / 100,
      disabled: element.matches(":disabled") ||
        style.pointerEvents === "none",
      height: Math.round(rect.height * 100) / 100,
      inViewport:
        rect.top >= -1 && rect.left >= -1 &&
        rect.bottom <= viewportHeight + 1 &&
        rect.right <= viewportWidth + 1,
      left: Math.round(rect.left * 100) / 100,
      name,
      right: Math.round(rect.right * 100) / 100,
      top: Math.round(rect.top * 100) / 100,
      visible: visible(element),
      width: Math.round(rect.width * 100) / 100
    };
  };
  const interactive = [...document.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(visible);
  const targets = interactive.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      height: Math.round(rect.height * 100) / 100,
      name: element.id || element.getAttribute("aria-label") ||
        element.textContent.trim().replace(/\\s+/g, " ").slice(0, 50) ||
        element.tagName.toLowerCase(),
      width: Math.round(rect.width * 100) / 100
    };
  });
  const nestedScroll = [...document.querySelectorAll(
    'main, .calculator-panel, .distance-card, .metric-card, .result-card, .projection-strip, .split-builder'
  )].filter((element) => {
    const style = getComputedStyle(element);
    return /(auto|scroll)/.test(style.overflowY) &&
      element.scrollHeight > element.clientHeight + 1;
  }).map((element) => element.id || element.className);
  const requiredSelectors = [
    "#app-title",
    ".support-link",
    "[data-unit-button]",
    "#reset-button",
    "#distance-input",
    "#distance-slider",
    "[data-distance-increment-button]",
    "[data-preset-button]",
    "#pace-minutes",
    "#pace-seconds",
    "#speed-input",
    "#time-hours",
    "#time-minutes",
    "#time-seconds",
    "#split-action-button",
    ".result-card"
  ];
  const requiredRects = requiredSelectors.flatMap((selector) =>
    [...document.querySelectorAll(selector)].map((element, index) =>
      rectRecord(
        element,
        element.id || element.getAttribute("aria-label") ||
          \`\${selector}[\${index}]\`
      )
    )
  );
  const primaryBottom = Math.max(
    ...requiredRects.map((rect) => rect.bottom)
  );
  const validationRegions = [
    "#distance-error",
    "#pace-error",
    "#speed-error",
    "#time-error",
    "#status-message"
  ].map((selector) => {
    const element = document.querySelector(selector);
    return {
      ariaLive: element?.getAttribute("aria-live") ?? null,
      exists: Boolean(element),
      id: selector.slice(1),
      text: element?.textContent.trim() ?? null
    };
  });
  const resultCard = document.querySelector(".result-card");
  const resultRect = resultCard
    ? rectRecord(resultCard, "result-card")
    : null;
  return {
    body: {
      clientHeight: document.body.clientHeight,
      clientWidth: document.body.clientWidth,
      scrollHeight: document.body.scrollHeight,
      scrollWidth: document.body.scrollWidth
    },
    document: {
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth
    },
    effectiveViewport: {
      height: Math.round(viewportHeight * 100) / 100,
      width: Math.round(viewportWidth * 100) / 100
    },
    identity: document.querySelector("#app-title")?.textContent.trim() ?? null,
    inputState: {
      distance: document.querySelector("#distance-input")?.value ?? null,
      paceMinutes: document.querySelector("#pace-minutes")?.value ?? null,
      paceSeconds: document.querySelector("#pace-seconds")?.value ?? null,
      speed: document.querySelector("#speed-input")?.value ?? null,
      timeHours: document.querySelector("#time-hours")?.value ?? null,
      timeMinutes: document.querySelector("#time-minutes")?.value ?? null,
      timeSeconds: document.querySelector("#time-seconds")?.value ?? null,
      unit:
        document.querySelector('[data-unit-button][aria-pressed="true"]')
          ?.dataset.unit ?? null
    },
    interactiveCount: interactive.length,
    minTargetHeight: Math.min(...targets.map((target) => target.height)),
    minTargetWidth: Math.min(...targets.map((target) => target.width)),
    nestedScroll,
    primaryBottom: Math.round(primaryBottom * 100) / 100,
    primaryControlCount: requiredRects.length,
    primaryFitsInitialViewport:
      requiredRects.length === ${REQUIRED_PRIMARY_ELEMENT_COUNT} &&
      requiredRects.every((rect) => rect.visible && rect.inViewport),
    primaryRects: requiredRects,
    requiredControlsOperable: requiredRects
      .filter((rect) => rect.name !== "app-title" && rect.name !== "result-card")
      .every((rect) => rect.visible && !rect.disabled),
    result: {
      detail: document.querySelector("#result-detail")?.textContent.trim() ?? null,
      label: document.querySelector("#result-label")?.textContent.trim() ?? null,
      rect: resultRect,
      value: document.querySelector("#result-value")?.textContent.trim() ?? null
    },
    scroll: {
      x: Math.round(scrollX * 100) / 100,
      y: Math.round(scrollY * 100) / 100
    },
    splitActionDisabled:
      document.querySelector("#split-action-button")?.disabled ?? null,
    splitCount: document.querySelectorAll(".split-list__item").length,
    targets,
    validationRegions,
    viewport: { height: innerHeight, width: innerWidth }
  };
})()`;

async function auditKeyboardFocus(session) {
  await evaluate(session, `(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    return true;
  })()`);

  const expectedCount = await evaluate(
    session,
    `document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])').length`
  );
  const visited = new Map();

  for (let index = 0; index < expectedCount + 3; index += 1) {
    await session.command("Input.dispatchKeyEvent", {
      code: "Tab",
      key: "Tab",
      type: "keyDown",
      windowsVirtualKeyCode: 9
    });
    await session.command("Input.dispatchKeyEvent", {
      code: "Tab",
      key: "Tab",
      type: "keyUp",
      windowsVirtualKeyCode: 9
    });

    const focus = await evaluate(
      session,
      `(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const name = element.id || element.getAttribute("aria-label") ||
          element.textContent.trim().replace(/\\s+/g, " ").slice(0, 50) ||
          element.tagName.toLowerCase();
        return {
          name,
          outlineColor: style.outlineColor,
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth) || 0,
          visible: rect.width > 0 && rect.height > 0
        };
      })()`
    );

    if (focus?.visible && !visited.has(focus.name)) {
      visited.set(focus.name, focus);
    }
  }

  return {
    controlsVisited: visited.size,
    expectedCount,
    failures: [...visited.values()].filter(
      (focus) =>
        focus.outlineWidth < 2 ||
        focus.outlineStyle === "none" ||
        focus.outlineColor === "rgba(0, 0, 0, 0)"
    ),
    visited: [...visited.values()]
  };
}

const COMPLETE_PRE_SPLIT_STATE_EXPRESSION = `(async () => {
  const setInput = (id, value) => {
    const input = document.querySelector(\`#\${id}\`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(\`Missing input #\${id}\`);
    }

    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  setInput("distance-input", "10");
  setInput("pace-minutes", "5");
  setInput("pace-seconds", "00");
  document.activeElement?.blur();
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
  scrollTo(0, 0);
  return {
    inputState: {
      distance: document.querySelector("#distance-input")?.value ?? null,
      paceMinutes: document.querySelector("#pace-minutes")?.value ?? null,
      paceSeconds: document.querySelector("#pace-seconds")?.value ?? null,
      speed: document.querySelector("#speed-input")?.value ?? null,
      timeHours: document.querySelector("#time-hours")?.value ?? null,
      timeMinutes: document.querySelector("#time-minutes")?.value ?? null,
      timeSeconds: document.querySelector("#time-seconds")?.value ?? null,
      unit:
        document.querySelector('[data-unit-button][aria-pressed="true"]')
          ?.dataset.unit ?? null
    },
    result: document.querySelector("#result-value")?.textContent.trim() ?? null,
    splitActionDisabled:
      document.querySelector("#split-action-button")?.disabled ?? null,
    splitCount: document.querySelectorAll(".split-list__item").length
  };
})()`;

const CREATE_SPLIT_STATE_EXPRESSION = `(async () => {
  const button = document.querySelector("#split-action-button");

  if (!(button instanceof HTMLButtonElement) || button.disabled) {
    throw new Error("The completed state did not enable Add split.");
  }

  button.click();
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
  scrollTo(0, 0);
  return document.querySelectorAll(".split-list__item").length;
})()`;

async function captureVariant({
  baseUrl,
  chromePort,
  output,
  variant,
  viewport
}) {
  const url = `${baseUrl}/${variant.id}/index.html`;
  const { session, targetId } = await createPageSession(chromePort, "about:blank");

  try {
    await session.command("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: viewport.height,
      mobile: viewport.width < 700,
      screenHeight: viewport.height,
      screenWidth: viewport.width,
      width: viewport.width
    });
    const loaded = session.waitForEvent("Page.loadEventFired");

    await session.command("Page.navigate", { url });
    await loaded;
    await evaluate(
      session,
      `document.fonts?.ready ? document.fonts.ready.then(() => true) : true`
    );

    const measurement = await evaluate(session, MEASUREMENT_EXPRESSION);
    const screenshot = await session.command("Page.captureScreenshot", {
      captureBeyondViewport: false,
      format: "png",
      fromSurface: true
    });
    const screenshotName = `${variant.id}-${viewport.id}.png`;

    await writeFile(join(output, screenshotName), screenshot.data, "base64");
    measurement.focus = await auditKeyboardFocus(session);
    measurement.screenshot = screenshotName;
    measurement.url = `/${variant.id}/index.html`;

    if (variant.id === "revised" && viewport.id === "390x844") {
      const completedState = await evaluate(
        session,
        COMPLETE_PRE_SPLIT_STATE_EXPRESSION
      );

      if (!isCompletedPreSplitState(completedState)) {
        throw new Error(
          `Unable to establish completed pre-split state: ${JSON.stringify(completedState)}`
        );
      }

      const completed = await evaluate(session, MEASUREMENT_EXPRESSION);
      const completedScreenshot =
        `${variant.id}-${viewport.id}-completed.png`;
      const completedImage = await session.command("Page.captureScreenshot", {
        captureBeyondViewport: false,
        format: "png",
        fromSurface: true
      });

      await writeFile(
        join(output, completedScreenshot),
        completedImage.data,
        "base64"
      );
      completed.focus = await auditKeyboardFocus(session);
      completed.screenshot = completedScreenshot;

      const splitCount = await evaluate(session, CREATE_SPLIT_STATE_EXPRESSION);

      if (splitCount !== 1) {
        throw new Error(`Expected one created split, received ${splitCount}.`);
      }

      const splits = await evaluate(session, MEASUREMENT_EXPRESSION);
      const splitsScreenshot = `${variant.id}-${viewport.id}-splits.png`;
      const splitsImage = await session.command("Page.captureScreenshot", {
        captureBeyondViewport: false,
        format: "png",
        fromSurface: true
      });

      await writeFile(
        join(output, splitsScreenshot),
        splitsImage.data,
        "base64"
      );
      splits.focus = await auditKeyboardFocus(session);
      splits.screenshot = splitsScreenshot;
      measurement.states = { completed, splits };
    }

    return measurement;
  } finally {
    session.close();
    await fetch(`http://127.0.0.1:${chromePort}/json/close/${targetId}`);
  }
}

const MOBILE_COMPARISON_MEASUREMENT_EXPRESSION = `(() => {
  const frame = document.querySelector("iframe");
  const label = document.querySelector(".capture-label");
  const frameWindow = frame?.contentWindow;
  const frameDocument = frame?.contentDocument;

  if (!frameWindow || !frameDocument) {
    throw new Error("The comparison frame is not available.");
  }

  const inputIds = [
    "distance-input",
    "pace-minutes",
    "pace-seconds",
    "speed-input",
    "time-hours",
    "time-minutes",
    "time-seconds"
  ];
  const inputState = Object.fromEntries(
    inputIds.map((id) => [id, frameDocument.querySelector(\`#\${id}\`)?.value ?? null])
  );
  const content = frameDocument.querySelector(".page-shell");
  const contentRect = content?.getBoundingClientRect();
  const primarySelectors = [
    "#app-title",
    ".tool-bar__actions",
    "#distance-input",
    "#distance-slider",
    "[data-distance-increment-button]",
    "[data-preset-button]",
    "#pace-minutes",
    "#pace-seconds",
    "#speed-input",
    "#time-hours",
    "#time-minutes",
    "#time-seconds",
    ".result-card"
  ];
  const primaryRects = primarySelectors.flatMap((selector) =>
    [...frameDocument.querySelectorAll(selector)].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom * 100) / 100,
        top: Math.round(rect.top * 100) / 100
      };
    })
  );

  return {
    appViewport: {
      devicePixelRatio: frameWindow.devicePixelRatio,
      height: frameWindow.innerHeight,
      visualScale: frameWindow.visualViewport?.scale ?? 1,
      width: frameWindow.innerWidth
    },
    contentBounds: contentRect
      ? {
          left: Math.round(contentRect.left * 100) / 100,
          right: Math.round(contentRect.right * 100) / 100,
          width: Math.round(contentRect.width * 100) / 100
        }
      : null,
    document: {
      clientHeight: frameDocument.documentElement.clientHeight,
      clientWidth: frameDocument.documentElement.clientWidth,
      scrollHeight: frameDocument.documentElement.scrollHeight,
      scrollWidth: frameDocument.documentElement.scrollWidth
    },
    focus: {
      id: frameDocument.activeElement?.id || null,
      tag: frameDocument.activeElement?.tagName ?? null
    },
    identity: frameDocument.querySelector("#app-title")?.textContent.trim() ?? null,
    inputState,
    label: {
      revision: label?.dataset.revision ?? null,
      text: label?.dataset.label ?? null
    },
    outerDocument: {
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth
    },
    primaryBottom: Math.round(
      Math.max(...primaryRects.map((rect) => rect.bottom))
    ),
    primaryVisibleCount: primaryRects.filter(
      (rect) => rect.top >= -1 && rect.bottom <= frameWindow.innerHeight + 1
    ).length,
    result: {
      detail: frameDocument.querySelector("#result-detail")?.textContent.trim() ?? null,
      label: frameDocument.querySelector("#result-label")?.textContent.trim() ?? null,
      value: frameDocument.querySelector("#result-value")?.textContent.trim() ?? null
    },
    scroll: {
      x: frameWindow.scrollX,
      y: frameWindow.scrollY
    },
    unit: frameDocument.querySelector("[data-unit-button][aria-pressed='true']")
      ?.dataset.unit ?? null
  };
})()`;

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");

  if (signature !== "89504e470d0a1a0a" || buffer.subarray(12, 16).toString() !== "IHDR") {
    throw new Error("Chrome returned data that is not a PNG image.");
  }

  return {
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16)
  };
}

async function captureMobileComparisonVariant({
  baseUrl,
  chromePort,
  output,
  variant
}) {
  const url = `${baseUrl}/comparison-${variant.id}/index.html`;
  const { session, targetId } = await createPageSession(chromePort, "about:blank");
  const screenshotViewport = {
    height: MOBILE_COMPARISON_VIEWPORT.height + MOBILE_COMPARISON_LABEL_HEIGHT,
    width: MOBILE_COMPARISON_VIEWPORT.width
  };

  try {
    await session.command("Emulation.setDeviceMetricsOverride", {
      deviceScaleFactor: 1,
      height: screenshotViewport.height,
      mobile: true,
      screenHeight: screenshotViewport.height,
      screenWidth: screenshotViewport.width,
      width: screenshotViewport.width
    });
    const loaded = session.waitForEvent("Page.loadEventFired");

    await session.command("Page.navigate", { url });
    await loaded;
    await evaluate(
      session,
      `(() => {
        const frame = document.querySelector("iframe");
        const frameWindow = frame?.contentWindow;
        const frameDocument = frame?.contentDocument;

        if (!frameWindow || !frameDocument) {
          throw new Error("The comparison frame failed to load.");
        }

        const ready = frameDocument.fonts?.ready ?? Promise.resolve();
        return ready.then(() => {
          const active = frameDocument.activeElement;
          if (active instanceof frameWindow.HTMLElement) active.blur();
          frameWindow.scrollTo(0, 0);
          return new Promise((resolvePromise) =>
            frameWindow.requestAnimationFrame(() =>
              frameWindow.requestAnimationFrame(() => resolvePromise(true))
            )
          );
        });
      })()`
    );

    const measurement = await evaluate(
      session,
      MOBILE_COMPARISON_MEASUREMENT_EXPRESSION
    );
    const screenshot = await session.command("Page.captureScreenshot", {
      captureBeyondViewport: false,
      format: "png",
      fromSurface: true
    });
    const screenshotBuffer = Buffer.from(screenshot.data, "base64");
    const dimensions = pngDimensions(screenshotBuffer);

    await writeFile(join(output, variant.screenshot), screenshotBuffer);

    return {
      ...measurement,
      image: {
        ...dimensions,
        file: variant.screenshot,
        sha256: createHash("sha256").update(screenshotBuffer).digest("hex")
      },
      revision: variant.revision
    };
  } finally {
    session.close();
    await fetch(`http://127.0.0.1:${chromePort}/json/close/${targetId}`);
  }
}

function comparableState(measurement) {
  return JSON.stringify({
    focus: measurement.focus,
    inputState: measurement.inputState,
    result: measurement.result,
    scroll: measurement.scroll,
    unit: measurement.unit
  });
}

export function evaluateMobileComparison(measurements) {
  const checks = [];
  const expectedImageHeight =
    MOBILE_COMPARISON_VIEWPORT.height + MOBILE_COMPARISON_LABEL_HEIGHT;

  for (const variant of MOBILE_COMPARISON_VARIANTS) {
    const measurement = measurements[variant.id];

    checks.push({
      id: `${variant.id}-revision`,
      passed:
        measurement.revision === variant.revision &&
        measurement.label.revision === variant.revision,
      value: `${measurement.label.revision ?? "missing"}`
    });
    checks.push({
      id: `${variant.id}-label`,
      passed: measurement.label.text === variant.label,
      value: `${measurement.label.text ?? "missing"}`
    });
    checks.push({
      id: `${variant.id}-app-viewport`,
      passed:
        measurement.appViewport.width === MOBILE_COMPARISON_VIEWPORT.width &&
        measurement.appViewport.height === MOBILE_COMPARISON_VIEWPORT.height &&
        measurement.appViewport.devicePixelRatio === 1 &&
        measurement.appViewport.visualScale === 1,
      value: `${measurement.appViewport.width}×${measurement.appViewport.height} CSS px; DPR ${measurement.appViewport.devicePixelRatio}; zoom ${measurement.appViewport.visualScale}`
    });
    checks.push({
      id: `${variant.id}-image-size`,
      passed:
        measurement.image.width === MOBILE_COMPARISON_VIEWPORT.width &&
        measurement.image.height === expectedImageHeight,
      value: `${measurement.image.width}×${measurement.image.height} px`
    });
    checks.push({
      id: `${variant.id}-horizontal-overflow`,
      passed:
        measurement.document.scrollWidth <=
          measurement.document.clientWidth + 1 &&
        measurement.outerDocument.scrollWidth <=
          measurement.outerDocument.clientWidth + 1 &&
        measurement.contentBounds?.left >= -1 &&
        measurement.contentBounds?.right <=
          MOBILE_COMPARISON_VIEWPORT.width + 1,
      value: `app ${measurement.document.scrollWidth}/${measurement.document.clientWidth}; frame ${measurement.outerDocument.scrollWidth}/${measurement.outerDocument.clientWidth}`
    });
    checks.push({
      id: `${variant.id}-identity`,
      passed: measurement.identity === "Run Pace Calculator",
      value: measurement.identity ?? "missing"
    });
  }

  const oldMeasurement = measurements.old;
  const newMeasurement = measurements.new;
  const compactnessRatio =
    newMeasurement.document.scrollHeight / oldMeasurement.document.scrollHeight;

  checks.push({
    id: "comparable-state",
    passed:
      comparableState(oldMeasurement) === comparableState(newMeasurement) &&
      oldMeasurement.focus.id === null &&
      ["BODY", "HTML"].includes(oldMeasurement.focus.tag),
    value:
      comparableState(oldMeasurement) === comparableState(newMeasurement)
        ? "identical inputs, result, unit, focus-free scroll position"
        : "state mismatch"
  });
  checks.push({
    id: "compactness",
    passed:
      newMeasurement.document.scrollHeight <
        oldMeasurement.document.scrollHeight &&
      compactnessRatio <= 0.85 &&
      newMeasurement.primaryVisibleCount >=
        oldMeasurement.primaryVisibleCount,
    value: `${newMeasurement.document.scrollHeight}/${oldMeasurement.document.scrollHeight} (${compactnessRatio.toFixed(3)}); visible controls ${newMeasurement.primaryVisibleCount}/${oldMeasurement.primaryVisibleCount}`
  });

  return {
    checks,
    compactnessRatio,
    passed: checks.every((check) => check.passed)
  };
}

export function evaluateAcceptance(measurements) {
  const checks = [];
  const revised = measurements.revised;
  const initial = revised["390x844"];
  const completed = initial.states?.completed;
  const splits = initial.states?.splits;
  const noHorizontalOverflow = (measurement) =>
    Boolean(measurement) &&
    measurement.document.scrollWidth <= measurement.document.clientWidth + 1 &&
    measurement.body.scrollWidth <= measurement.document.clientWidth + 1;
  const fitsViewportAtTop = (measurement) =>
    noHorizontalOverflow(measurement) &&
    measurement.document.scrollHeight <=
      measurement.effectiveViewport.height + 1 &&
    measurement.scroll.x === 0 &&
    measurement.scroll.y === 0;

  for (const viewport of QA_VIEWPORTS) {
    const revisedMeasurement = revised[viewport.id];

    checks.push({
      id: `horizontal-overflow-${viewport.id}`,
      passed: noHorizontalOverflow(revisedMeasurement),
      value: `document ${revisedMeasurement.document.scrollWidth}/${revisedMeasurement.document.clientWidth}; body ${revisedMeasurement.body.scrollWidth}/${revisedMeasurement.document.clientWidth}`
    });
    checks.push({
      id: `nested-scroll-${viewport.id}`,
      passed: revisedMeasurement.nestedScroll.length === 0,
      value: revisedMeasurement.nestedScroll.join(", ") || "none"
    });
    checks.push({
      id: `target-size-${viewport.id}`,
      passed:
        revisedMeasurement.minTargetHeight >= 44 &&
        revisedMeasurement.minTargetWidth >= 44,
      value: `${revisedMeasurement.minTargetWidth}x${revisedMeasurement.minTargetHeight}`
    });
    checks.push({
      id: `keyboard-focus-${viewport.id}`,
      passed:
        revisedMeasurement.focus.controlsVisited ===
          revisedMeasurement.focus.expectedCount &&
        revisedMeasurement.focus.failures.length === 0,
      value: `${revisedMeasurement.focus.controlsVisited}/${revisedMeasurement.focus.expectedCount} controls`
    });
  }

  checks.push({
    id: "initial-pre-split-fit-390x844",
    passed:
      fitsViewportAtTop(initial) &&
      initial.splitCount === 0,
    value: `scroll ${initial.document.scrollWidth}×${initial.document.scrollHeight}; effective viewport ${initial.effectiveViewport.width}×${initial.effectiveViewport.height}; scroll position ${initial.scroll.x},${initial.scroll.y}`
  });
  checks.push({
    id: "initial-required-ui-390x844",
    passed:
      initial.primaryControlCount === REQUIRED_PRIMARY_ELEMENT_COUNT &&
      initial.primaryFitsInitialViewport &&
      isInitialPreSplitState(initial) &&
      initial.result.rect?.inViewport === true,
    value: `${initial.primaryControlCount}/${REQUIRED_PRIMARY_ELEMENT_COUNT} required elements; bottom ${initial.primaryBottom}/${initial.effectiveViewport.height}; result ${initial.result.value}`
  });
  checks.push({
    id: "initial-neutral-validation-390x844",
    passed:
      initial.validationRegions.length === 5 &&
      initial.validationRegions.every(
        (region) =>
          region.exists &&
          region.ariaLive === "polite" &&
          region.text === ""
      ),
    value: initial.validationRegions
      .map((region) => `${region.id}:${region.exists ? region.ariaLive : "missing"}`)
      .join(", ")
  });
  checks.push({
    id: "completed-pre-split-fit-390x844",
    passed:
      fitsViewportAtTop(completed) &&
      completed.splitCount === 0,
    value: completed
      ? `scroll ${completed.document.scrollWidth}×${completed.document.scrollHeight}; effective viewport ${completed.effectiveViewport.width}×${completed.effectiveViewport.height}; scroll position ${completed.scroll.x},${completed.scroll.y}`
      : "missing completed-state measurement"
  });
  checks.push({
    id: "completed-required-ui-390x844",
    passed:
      completed?.primaryControlCount === REQUIRED_PRIMARY_ELEMENT_COUNT &&
      completed.primaryFitsInitialViewport &&
      completed.requiredControlsOperable &&
      completed.splitActionDisabled === false,
    value: completed
      ? `${completed.primaryControlCount}/${REQUIRED_PRIMARY_ELEMENT_COUNT} required elements; bottom ${completed.primaryBottom}/${completed.effectiveViewport.height}; Add split ${completed.splitActionDisabled ? "disabled" : "enabled"}`
      : "missing completed-state measurement"
  });
  checks.push({
    id: "completed-result-390x844",
    passed:
      isCompletedPreSplitState(completed) &&
      completed.result.rect?.inViewport === true,
    value: completed
      ? `${completed.result.label}: ${completed.result.value}; inputs ${JSON.stringify(completed.inputState)}`
      : "missing completed-state measurement"
  });
  checks.push({
    id: "created-split-scroll-and-overflow-390x844",
    passed:
      splits?.splitCount === 1 &&
      noHorizontalOverflow(splits) &&
      splits.nestedScroll.length === 0,
    value: splits
      ? `${splits.splitCount} split; document ${splits.document.scrollWidth}×${splits.document.scrollHeight}; nested scroll ${splits.nestedScroll.join(", ") || "none"}`
      : "missing split-state measurement"
  });
  checks.push({
    id: "desktop-primary-workflow",
    passed:
      revised["1440x900"].identity === "Run Pace Calculator" &&
      revised["1440x900"].primaryControlCount ===
        REQUIRED_PRIMARY_ELEMENT_COUNT &&
      revised["1440x900"].primaryFitsInitialViewport,
    value: `${revised["1440x900"].primaryControlCount} controls; bottom ${revised["1440x900"].primaryBottom}/900`
  });

  return {
    checks,
    passed: checks.every((check) => check.passed)
  };
}

function markdownTable(measurements, variant) {
  const rows = [
    "| Viewport | document client | document scroll | body scroll | min target | primary bottom | nested scroll |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |"
  ];

  for (const viewport of QA_VIEWPORTS) {
    const result = measurements[variant.id][viewport.id];

    rows.push(
      `| ${viewport.id} | ${result.document.clientWidth}×${result.document.clientHeight} | ${result.document.scrollWidth}×${result.document.scrollHeight} | ${result.body.scrollWidth}×${result.body.scrollHeight} | ${result.minTargetWidth}×${result.minTargetHeight} | ${result.primaryBottom} | ${result.nestedScroll.join(", ") || "none"} |`
    );
  }

  return rows.join("\n");
}

export function renderMarkdownReport(report) {
  const sections = [
    "# Run Pace Calculator browser QA",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "The three variants were rendered by the same Chromium process with device scale factor 1. Screenshots show the initial viewport; dimensions below are CSS pixels. The revised 390×844 capture also records completed pre-split and created-split states.",
    ""
  ];

  for (const variant of QA_VARIANTS) {
    sections.push(`## ${variant.label}`, "", markdownTable(report.measurements, variant), "");
  }

  sections.push(
    "## Acceptance checks",
    "",
    "| Check | Result | Measurement |",
    "| --- | --- | --- |"
  );

  for (const check of report.acceptance.checks) {
    sections.push(
      `| ${check.id} | ${check.passed ? "PASS" : "FAIL"} | ${check.value} |`
    );
  }

  sections.push(
    "",
    "## Screenshots",
    "",
    ...QA_VIEWPORTS.flatMap((viewport) =>
      QA_VARIANTS.map(
        (variant) =>
          `- ${variant.label}, ${viewport.id}: \`${variant.id}-${viewport.id}.png\``
      )
    ),
    "- Revised worktree layout, 390x844 completed pre-split state: `revised-390x844-completed.png`",
    "- Revised worktree layout, 390x844 after creating one split: `revised-390x844-splits.png`",
    ""
  );

  return sections.join("\n");
}

export function renderMobileComparisonReport(report) {
  const rows = [
    "# Сравнение мобильных версий Run Pace Calculator",
    "",
    `Создано: ${report.generatedAt}`,
    "",
    `Обе версии отрисованы одним процессом Chromium при viewport приложения ${MOBILE_COMPARISON_VIEWPORT.width}×${MOBILE_COMPARISON_VIEWPORT.height} CSS px, DPR 1 и масштабе 100%. Одинаковая плашка высотой ${MOBILE_COMPARISON_LABEL_HEIGHT} px добавлена вне viewport приложения.`,
    "",
    "| Версия | Git-ревизия | Изображение | Viewport приложения | Размер PNG | document scroll | Видимые основные элементы |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: |"
  ];

  for (const variant of MOBILE_COMPARISON_VARIANTS) {
    const measurement = report.measurements[variant.id];

    rows.push(
      `| ${variant.label} | \`${variant.revision}\` | \`${measurement.image.file}\` | ${measurement.appViewport.width}×${measurement.appViewport.height} | ${measurement.image.width}×${measurement.image.height} | ${measurement.document.scrollWidth}×${measurement.document.scrollHeight} | ${measurement.primaryVisibleCount} |`
    );
  }

  rows.push(
    "",
    "## Проверки",
    "",
    "| Проверка | Результат | Значение |",
    "| --- | --- | --- |"
  );

  for (const check of report.acceptance.checks) {
    rows.push(
      `| ${check.id} | ${check.passed ? "PASS" : "FAIL"} | ${check.value} |`
    );
  }

  rows.push("");

  return rows.join("\n");
}

async function assertOnlyExpectedComparisonPngs(output) {
  const expected = MOBILE_COMPARISON_VARIANTS.map(({ screenshot }) => screenshot).sort();
  const actual = (await readdir(output))
    .filter((entry) => entry.toLowerCase().endsWith(".png"))
    .sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `The mobile comparison output must contain exactly two PNG files (${expected.join(", ")}); found: ${actual.join(", ") || "none"}.`
    );
  }
}

async function runMobileComparison(options) {
  const chromePath = findChrome(options.chrome);
  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "run-pace-mobile-comparison-")
  );
  let fixtureServer;
  let chrome;

  try {
    const stagingRoot = join(temporaryRoot, "fixtures");
    const captureOutput = join(temporaryRoot, "output");

    await Promise.all(
      MOBILE_COMPARISON_VARIANTS.map((variant) =>
        stageMobileComparisonVariant(variant, stagingRoot)
      )
    );
    await mkdir(captureOutput, { recursive: true });
    await mkdir(options.output, { recursive: true });

    const existingPngs = (await readdir(options.output)).filter(
      (entry) =>
        entry.toLowerCase().endsWith(".png") &&
        !MOBILE_COMPARISON_VARIANTS.some(
          ({ screenshot }) => screenshot === entry
        )
    );

    if (existingPngs.length > 0) {
      throw new Error(
        `Refusing to mix the requested two-image comparison with unrelated PNG files: ${existingPngs.join(", ")}.`
      );
    }

    fixtureServer = await createFixtureServer(stagingRoot);
    chrome = await launchChrome(chromePath, temporaryRoot);

    const measurements = {};

    for (const variant of MOBILE_COMPARISON_VARIANTS) {
      measurements[variant.id] = await captureMobileComparisonVariant({
        baseUrl: fixtureServer.baseUrl,
        chromePort: chrome.port,
        output: captureOutput,
        variant
      });
    }

    await assertOnlyExpectedComparisonPngs(captureOutput);

    const report = {
      acceptance: evaluateMobileComparison(measurements),
      browser: chromePath,
      capture: {
        appViewport: MOBILE_COMPARISON_VIEWPORT,
        deviceScaleFactor: 1,
        labelHeight: MOBILE_COMPARISON_LABEL_HEIGHT,
        pageZoom: 1,
        screenshotViewport: {
          height:
            MOBILE_COMPARISON_VIEWPORT.height +
            MOBILE_COMPARISON_LABEL_HEIGHT,
          width: MOBILE_COMPARISON_VIEWPORT.width
        }
      },
      generatedAt: new Date().toISOString(),
      measurements,
      variants: MOBILE_COMPARISON_VARIANTS
    };

    await writeFile(
      join(captureOutput, "manifest.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
    await writeFile(
      join(captureOutput, "report.md"),
      `${renderMobileComparisonReport(report)}\n`
    );

    if (!report.acceptance.passed) {
      const failures = report.acceptance.checks
        .filter((check) => !check.passed)
        .map((check) => `${check.id}: ${check.value}`)
        .join("\n");

      throw new Error(`Mobile comparison failed:\n${failures}`);
    }

    await Promise.all([
      ...MOBILE_COMPARISON_VARIANTS.map(({ screenshot }) =>
        copyFile(
          join(captureOutput, screenshot),
          join(options.output, screenshot)
        )
      ),
      copyFile(
        join(captureOutput, "manifest.json"),
        join(options.output, "manifest.json")
      ),
      copyFile(
        join(captureOutput, "report.md"),
        join(options.output, "report.md")
      )
    ]);
    await assertOnlyExpectedComparisonPngs(options.output);

    process.stdout.write(
      `Mobile comparison passed. Evidence: ${join(options.output, "report.md")}\n`
    );
  } finally {
    await chrome?.close();
    await fixtureServer?.close();
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function runBrowserQa(options) {
  const chromePath = findChrome(options.chrome);
  const temporaryRoot = await mkdtemp(join(tmpdir(), "run-pace-browser-qa-"));
  let fixtureServer;
  let chrome;

  try {
    const stagingRoot = join(temporaryRoot, "fixtures");

    await Promise.all(
      QA_VARIANTS.map((variant) => stageVariant(variant, stagingRoot))
    );
    await mkdir(options.output, { recursive: true });
    fixtureServer = await createFixtureServer(stagingRoot);
    chrome = await launchChrome(chromePath, temporaryRoot);

    const measurements = Object.fromEntries(
      QA_VARIANTS.map((variant) => [variant.id, {}])
    );

    for (const viewport of QA_VIEWPORTS) {
      for (const variant of QA_VARIANTS) {
        measurements[variant.id][viewport.id] = await captureVariant({
          baseUrl: fixtureServer.baseUrl,
          chromePort: chrome.port,
          output: options.output,
          variant,
          viewport
        });
      }
    }

    const report = {
      acceptance: evaluateAcceptance(measurements),
      browser: chromePath,
      generatedAt: new Date().toISOString(),
      measurements,
      variants: QA_VARIANTS,
      viewports: QA_VIEWPORTS
    };

    await writeFile(
      join(options.output, "measurements.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
    await writeFile(
      join(options.output, "report.md"),
      `${renderMarkdownReport(report)}\n`
    );

    if (!report.acceptance.passed) {
      const failures = report.acceptance.checks
        .filter((check) => !check.passed)
        .map((check) => `${check.id}: ${check.value}`)
        .join("\n");

      throw new Error(`Browser QA failed:\n${failures}`);
    }

    process.stdout.write(
      `Browser QA passed. Evidence: ${join(options.output, "report.md")}\n`
    );
  } finally {
    await chrome?.close();
    await fixtureServer?.close();
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.check) {
    process.stdout.write(
      `${JSON.stringify(
        options.mobileComparison
          ? {
              appViewport: MOBILE_COMPARISON_VIEWPORT,
              labelHeight: MOBILE_COMPARISON_LABEL_HEIGHT,
              output: options.output,
              variants: MOBILE_COMPARISON_VARIANTS
            }
          : {
              output: options.output,
              variants: QA_VARIANTS,
              viewports: QA_VIEWPORTS
            },
        null,
        2
      )}\n`
    );
    return;
  }

  if (options.mobileComparison) {
    await runMobileComparison(options);
  } else {
    await runBrowserQa(options);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";

if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
