import { spawn, spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
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
  Object.freeze({ height: 844, id: "390x844", width: 390 }),
  Object.freeze({ height: 1024, id: "768x1024", width: 768 }),
  Object.freeze({ height: 900, id: "1440x900", width: 1440 })
]);

export function parseArguments(argv) {
  const options = {
    check: false,
    chrome: null,
    output: resolve(PROJECT_ROOT, "artifacts/browser-qa")
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--check") {
      options.check = true;
      continue;
    }

    if (argument === "--chrome" || argument === "--output") {
      const value = argv[index + 1];

      if (!value) {
        throw new Error(`${argument} requires a value.`);
      }

      options[argument.slice(2)] = resolve(PROJECT_ROOT, value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
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
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
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
    [...document.querySelectorAll(selector)].filter(visible).map((element, index) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: Math.round(rect.bottom * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        name: element.id || element.getAttribute("aria-label") ||
          \`\${selector}[\${index}]\`,
        right: Math.round(rect.right * 100) / 100,
        top: Math.round(rect.top * 100) / 100,
        width: Math.round(rect.width * 100) / 100
      };
    })
  );
  const primaryBottom = Math.max(
    ...primaryRects.map((rect) => rect.bottom)
  );
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
    identity: document.querySelector("#app-title")?.textContent.trim() ?? null,
    interactiveCount: interactive.length,
    minTargetHeight: Math.min(...targets.map((target) => target.height)),
    minTargetWidth: Math.min(...targets.map((target) => target.width)),
    nestedScroll,
    primaryBottom: Math.round(primaryBottom * 100) / 100,
    primaryControlCount: primaryRects.length,
    primaryFitsInitialViewport: primaryRects.length === 22 &&
      primaryRects.every((rect) =>
        rect.top >= -1 && rect.bottom <= innerHeight + 1 &&
        rect.right <= innerWidth + 1
      ),
    primaryRects,
    targets,
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

    return measurement;
  } finally {
    session.close();
    await fetch(`http://127.0.0.1:${chromePort}/json/close/${targetId}`);
  }
}

export function evaluateAcceptance(measurements) {
  const checks = [];
  const revised = measurements.revised;
  const current = measurements.current;

  for (const viewport of QA_VIEWPORTS) {
    const revisedMeasurement = revised[viewport.id];

    checks.push({
      id: `horizontal-overflow-${viewport.id}`,
      passed:
        revisedMeasurement.document.scrollWidth <=
        revisedMeasurement.document.clientWidth + 1,
      value: `${revisedMeasurement.document.scrollWidth}/${revisedMeasurement.document.clientWidth}`
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

    if (viewport.width < 1100) {
      const ratio =
        revisedMeasurement.document.scrollHeight /
        current[viewport.id].document.scrollHeight;

      checks.push({
        id: `vertical-travel-${viewport.id}`,
        passed: ratio <= 0.85,
        value: `${revisedMeasurement.document.scrollHeight}/${current[viewport.id].document.scrollHeight} (${ratio.toFixed(3)})`
      });
    }
  }

  checks.push({
    id: "desktop-primary-workflow",
    passed:
      revised["1440x900"].identity === "Run Pace Calculator" &&
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
    "The three variants were rendered by the same Chromium process with device scale factor 1. Screenshots show the initial viewport; dimensions below are CSS pixels.",
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
    ""
  );

  return sections.join("\n");
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
        {
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

  await runBrowserQa(options);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";

if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
