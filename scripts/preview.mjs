import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

export function resolveRequestPath(urlPath) {
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  return path.join(distDir, normalized);
}

export function createPreviewServer() {
  return http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const filePath = resolveRequestPath(requestUrl.pathname);
      const extension = path.extname(filePath);
      const contentType = CONTENT_TYPES[extension] ?? "application/octet-stream";
      const contents = await readFile(filePath);

      response.writeHead(200, { "Content-Type": contentType });
      response.end(contents);
    } catch (error) {
      response.writeHead(error?.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end(error?.code === "ENOENT" ? "Not found" : "Preview server error");
    }
  });
}

async function startPreviewServer() {
  const server = createPreviewServer();

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  console.log(`Previewing dist at http://127.0.0.1:${port}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startPreviewServer().catch((error) => {
    console.error(`Could not start preview server on 127.0.0.1:${port}: ${error.code ?? error.message}`);
    process.exitCode = 1;
  });
}
