import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const [, , rootArg = "src", portArg = "4173"] = process.argv;

const rootDir = path.resolve(rootArg);
const port = Number(portArg);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid port: ${portArg}`);
  process.exit(1);
}

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"]
]);

function contentTypeFor(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath)) ?? "application/octet-stream";
}

function resolveRequestPath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const requestPath = decoded === "/" ? "/index.html" : decoded;
  const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const absolute = path.resolve(rootDir, `.${normalized}`);

  if (!absolute.startsWith(rootDir)) {
    return null;
  }

  return absolute;
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
    response.end(file);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
});

server.on("error", (error) => {
  const code = error && typeof error === "object" && "code" in error ? error.code : "";

  if (code === "EACCES" || code === "EPERM") {
    console.error(
      `Local HTTP serving is blocked by this environment while binding port ${port}.`
    );
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }

  process.exit(1);
});

server.listen(port, () => {
  console.log(`Serving ${rootDir} at http://localhost:${port}`);
});
