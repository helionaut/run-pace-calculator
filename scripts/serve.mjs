import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

export function resolveRequestPath(rootDir, urlPath) {
  const decodedPath = decodeURIComponent(urlPath);
  const segments = decodedPath.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "..")) {
    throw new Error("Path traversal is not allowed");
  }

  const relativeSegments =
    segments.length === 0 || decodedPath.endsWith("/")
      ? [...segments, "index.html"]
      : segments;

  return path.join(path.resolve(rootDir), path.join(...relativeSegments));
}

export function createStaticServer({ rootDir }) {
  const resolvedRoot = path.resolve(rootDir);

  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const filePath = resolveRequestPath(resolvedRoot, requestUrl.pathname);
      const extension = path.extname(filePath);
      const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
      const contents = await readFile(filePath);

      response.writeHead(200, { "Content-Type": contentType });
      response.end(contents);
    } catch (error) {
      const statusCode =
        error.message === "Path traversal is not allowed"
          ? 400
          : error.code === "ENOENT"
            ? 404
            : 500;

      response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(
        statusCode === 400 ? "Bad request" : statusCode === 404 ? "Not found" : "Server error",
      );
    }
  });
}

export async function startStaticServer({
  rootDir = REPO_ROOT,
  port = 3000,
  host = "127.0.0.1",
} = {}) {
  const server = createStaticServer({ rootDir });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  console.log(`Serving ${path.resolve(rootDir)} at http://${host}:${port}`);
  return server;
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const rootArg = process.argv[2] ?? ".";
  const portArg = Number.parseInt(process.argv[3] ?? process.env.PORT ?? "3000", 10);

  if (!Number.isInteger(portArg) || portArg < 1) {
    console.error("Port must be a positive integer.");
    process.exit(1);
  }

  startStaticServer({ rootDir: path.resolve(REPO_ROOT, rootArg), port: portArg }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
