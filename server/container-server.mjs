import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  decorateOpenEditaisDataset,
  getOpenEditalById,
  listOpenEditais
} from "../src/shared/openEditaisData.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererRoot = path.join(root, "dist", "renderer");
const port = Number(process.env.PORT || 8080);
let cache;

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error.message }));
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Glauco container server listening on ${port}`);
});

async function handle(req, res) {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  if (url.pathname === "/api/health") {
    json(res, { ok: true });
    return;
  }
  if (url.pathname === "/api/overview") {
    const { meta } = await loadData();
    json(res, meta);
    return;
  }
  if (url.pathname === "/api/open-editais") {
    const { dataset } = await loadData();
    json(res, listOpenEditais(dataset, Object.fromEntries(url.searchParams)));
    return;
  }
  if (url.pathname.startsWith("/api/open-editais/")) {
    const { dataset } = await loadData();
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const detail = getOpenEditalById(dataset, id);
    if (!detail) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Edital nao encontrado" }));
      return;
    }
    json(res, detail);
    return;
  }
  await serveStatic(url.pathname, res);
}

async function loadData() {
  if (cache) return cache;
  const dataset = JSON.parse(await fs.readFile(path.join(root, "data", "open-editais.dataset.json"), "utf8"));
  const meta = JSON.parse(await fs.readFile(path.join(root, "data", "open-editais.meta.json"), "utf8"));
  cache = {
    dataset: decorateOpenEditaisDataset(dataset),
    meta
  };
  return cache;
}

async function serveStatic(urlPath, res) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(rendererRoot, cleanPath));
  if (!filePath.startsWith(rendererRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": contentType(filePath) });
    res.end(body);
  } catch {
    const body = await fs.readFile(path.join(rendererRoot, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  }
}

function json(res, payload) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}
