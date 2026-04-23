import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { appStartPath, generateTwaArtifacts } from "../../src/shared/twa.mjs";

export class PortalRuntime {
  constructor({ store, getResourcePath }) {
    this.store = store;
    this.getResourcePath = getResourcePath;
    this.server = null;
    this.port = 8010;
    this.ngrok = null;
    this.publicUrl = "";
  }

  async activate(appId) {
    const state = this.store.snapshot();
    const portal = state.portalApps.find((item) => item.id === appId);
    if (!portal) throw new Error("Aplicativo externo nao encontrado");

    await this.ensureServer(portal.port || this.port);
    const publicUrl = await this.ensureNgrok().catch(() => "");
    const localBaseUrl = `http://localhost:${this.port}`;

    return this.store.update((draft) => {
      draft.portalApps = draft.portalApps.map((item) =>
        item.id === appId || item.active
          ? {
              ...item,
              active: item.id === appId ? true : item.active,
              localUrl: `${localBaseUrl}${appStartPath(item)}`,
              publicUrl: publicUrl ? `${publicUrl}${appStartPath(item)}` : item.publicUrl || ""
            }
          : item
      );
      draft.activity = [`Portal externo ativado: ${portal.name}`, ...(draft.activity || [])].slice(0, 30);
      return draft;
    });
  }

  async deactivate(appId) {
    const state = await this.store.update((draft) => {
      draft.portalApps = draft.portalApps.map((item) => {
        if (item.id === appId) return { ...item, active: false, publicUrl: "", localUrl: "" };
        if (!item.active || !this.publicUrl) return item;
        return {
          ...item,
          localUrl: `http://localhost:${this.port}${appStartPath(item)}`,
          publicUrl: `${this.publicUrl}${appStartPath(item)}`
        };
      });
      draft.activity = [`Portal externo desativado: ${appId}`, ...(draft.activity || [])].slice(0, 30);
      return draft;
    });

    if (!state.portalApps.some((item) => item.active)) {
      await this.stopNgrok();
      await this.stopServer();
    }
    return state;
  }

  async generateTwa(appId) {
    let state = this.store.snapshot();
    const portal = state.portalApps.find((item) => item.id === appId);
    if (!portal) throw new Error("Aplicativo externo nao encontrado");
    if (!portal.publicUrl) {
      state = await this.activate(appId);
    }
    const activatedPortal = state.portalApps.find((item) => item.id === appId) || portal;
    const host = activatedPortal.publicUrl ? new URL(activatedPortal.publicUrl).host : "REPLACE_WITH_NGROK_HOST";
    const output = await generateTwaArtifacts({ app: activatedPortal, outputDir: this.store.dirs.twa, host });
    const build = await runBubblewrapBuild(output.appDir);
    return this.store.update((draft) => {
      draft.portalApps = draft.portalApps.map((item) =>
        item.id === appId
          ? {
              ...item,
              twaStatus: build.ok
                ? `APK gerado: ${build.apkPath || output.appDir}`
                : `Manifest gerado; Bubblewrap pendente: ${build.error}`,
              apkPath: build.apkPath || item.apkPath || ""
            }
          : item
      );
      draft.activity = [
        build.ok ? `APK TWA gerado: ${portal.name}` : `TWA preparado, Bubblewrap nao concluiu: ${portal.name}`,
        ...(draft.activity || [])
      ].slice(0, 30);
      return draft;
    });
  }

  async ensureServer(port) {
    if (this.server) return;
    this.port = port || 8010;
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end(error.message);
      });
    });
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, "127.0.0.1", resolve);
    });
  }

  async stopServer() {
    if (!this.server) return;
    await new Promise((resolve) => this.server.close(resolve));
    this.server = null;
  }

  async ensureNgrok() {
    if (this.publicUrl) return this.publicUrl;
    const existing = await this.readNgrokUrl();
    if (existing) {
      this.publicUrl = existing;
      return this.publicUrl;
    }
    if (!this.ngrok) {
      this.ngrok = spawn("ngrok", ["http", String(this.port), "--log", "stdout"], {
        windowsHide: true,
        stdio: "ignore"
      });
      this.ngrok.once("exit", () => {
        this.ngrok = null;
        this.publicUrl = "";
      });
    }

    for (let index = 0; index < 20; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const url = await this.readNgrokUrl();
      if (url) {
        this.publicUrl = url;
        return this.publicUrl;
      }
    }
    return "";
  }

  async readNgrokUrl() {
    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (!response.ok) return "";
      const data = await response.json();
      const tunnel = data.tunnels?.find((item) => item.proto === "https") || data.tunnels?.[0];
      return tunnel?.public_url || "";
    } catch {
      return "";
    }
  }

  async stopNgrok() {
    if (this.ngrok) this.ngrok.kill();
    this.ngrok = null;
    this.publicUrl = "";
  }

  async handleRequest(req, res) {
    const url = new URL(req.url || "/", `http://localhost:${this.port}`);
    if (url.pathname === "/assets/nexus-lotes.svg") {
      const svg = await fs.readFile(this.getResourcePath("public/nexus-lotes.svg"));
      res.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8" });
      res.end(svg);
      return;
    }

    if (!url.pathname.startsWith("/__glauco/pages/")) {
      res.writeHead(302, { location: "/__glauco/pages/confidence-portal" });
      res.end();
      return;
    }

    const id = url.pathname.split("/").pop();
    const state = this.store.snapshot();
    const portal = state.portalApps.find((item) => item.id === id) || state.portalApps[0];
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(this.renderPortalPage(portal, state));
  }

  renderPortalPage(portal, state) {
    const notifications = state.bahia?.notifications || [];
    const isVenture = portal.route === "ventures";
    const ventureHtml = isVenture ? renderVenturePortal() : "";
    const rows = notifications
      .slice(0, 5)
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.orgao)}</span><small>${escapeHtml(item.reason)}</small></li>`
      )
      .join("");

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(portal.name)}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;background:#f4f4f4;color:#161616}
    header{background:#0f62fe;color:white;padding:20px 24px}
    main{padding:24px;display:grid;gap:18px}
    .panel{background:white;border:1px solid #d0d0d0;padding:18px}
    .map{height:58vh;overflow:hidden;border:1px solid #8d8d8d;background:white;touch-action:none;position:relative}
    .map-layer{position:absolute;inset:0;transform-origin:center}.svg-host,.svg-host svg{width:100%;height:100%;user-select:none}.svg-host{display:grid;place-items:center}.svg-host svg{display:block;max-width:100%;max-height:100%}
    .svg-host rect{cursor:pointer;fill:rgba(15,98,254,.14)!important;stroke:rgba(15,98,254,.72)!important;stroke-width:18px!important;vector-effect:non-scaling-stroke}.svg-host rect:hover,.svg-host rect.lote-active{fill:rgba(36,161,72,.28)!important;stroke:#24a148!important}
    .lot-card{position:absolute;top:18px;right:18px;z-index:3;width:min(320px,calc(100% - 36px));background:white;border:1px solid #d0d0d0;box-shadow:0 12px 34px rgba(0,0,0,.18);padding:16px;display:grid;gap:10px}
    .lot-card h2{margin:0;font-size:28px;font-weight:400}.lot-card dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.lot-card dt{color:#525252;font-size:12px;text-transform:uppercase}.lot-card dd{margin:2px 0 0;font-weight:700}
    label{display:block;font-size:12px;text-transform:uppercase;margin-top:10px}
    input,button,textarea{font:inherit;padding:10px;border:1px solid #8d8d8d}
    button{background:#0f62fe;color:white;border-color:#0f62fe;cursor:pointer}
    ul{padding:0;margin:0;display:grid;gap:10px}li{list-style:none;border-left:4px solid #0f62fe;background:#f4f4f4;padding:12px;display:grid;gap:4px}
  </style>
</head>
<body>
  <header>
    <strong>${escapeHtml(portal.name)}</strong>
    <p>${escapeHtml(portal.description || state.company.summary)}</p>
  </header>
  <main>
    ${
      isVenture
        ? ventureHtml
        : `<section class="panel"><h1>${escapeHtml(state.company.name)}</h1><p>${escapeHtml(state.company.summary)}</p><ul>${rows || "<li>Radar ainda sem notificacoes.</li>"}</ul></section>`
    }
  </main>
  ${isVenture ? renderVentureScript() : ""}
</body>
</html>`;
  }
}

function renderVenturePortal() {
  return `<section class="panel"><h1>Mapa do empreendimento</h1><p id="lot-count">Carregando lotes do SVG original...</p><div class="map" id="venture-map"><div class="map-layer" id="map-layer"><div class="svg-host" id="svg-host"></div></div><aside class="lot-card" id="lot-card"></aside></div><form><label>Nome</label><input placeholder="Nome do interessado" /><label>Unidade</label><input id="lot-input" readonly placeholder="Selecione um lote no mapa" /><label>WhatsApp</label><input placeholder="+55..." /><button type="button">Solicitar reserva</button></form></section>`;
}

function renderVentureScript() {
  return `<script>
    let zoom = 1;
    let offset = { x: 0, y: 0 };
    let drag = null;
    let wasMoved = false;
    const map = document.getElementById("venture-map");
    const layer = document.getElementById("map-layer");
    const host = document.getElementById("svg-host");
    const card = document.getElementById("lot-card");
    const input = document.getElementById("lot-input");
    const count = document.getElementById("lot-count");
    function applyTransform() {
      layer.style.transform = "translate(" + offset.x + "px," + offset.y + "px) scale(" + zoom + ")";
    }
    function lotFromRect(rect) {
      const svg = host.querySelector("svg");
      const rects = Array.from(svg.querySelectorAll("rect"));
      const index = rects.indexOf(rect);
      const box = rect.getBBox();
      return { index, name: "Lote " + index, area: Math.round(box.width * box.height).toLocaleString("pt-BR") + " u2", dimensions: box.width.toFixed(2) + " x " + box.height.toFixed(2), status: "Disponivel" };
    }
    function renderLot(rect) {
      const lot = lotFromRect(rect);
      input.value = lot.name;
      host.querySelectorAll("rect").forEach((item) => item.classList.remove("lote-active"));
      rect.classList.add("lote-active");
      card.innerHTML = '<p style="margin:0;color:#525252;font-size:12px;text-transform:uppercase">Unidade selecionada</p><h2>' + lot.name + '</h2><dl><div><dt>Indice SVG</dt><dd>' + lot.index + '</dd></div><div><dt>Area tecnica</dt><dd>' + lot.area + '</dd></div><div><dt>Status</dt><dd>' + lot.status + '</dd></div><div><dt>Dimensoes</dt><dd>' + lot.dimensions + '</dd></div></dl><p style="margin:0">Lote identificado pelo retangulo interativo original do SVG Nexus.</p><button type="button">Reservar este lote</button>';
      zoom = Math.max(zoom, 1.8);
      applyTransform();
    }
    fetch("/assets/nexus-lotes.svg").then((response) => response.text()).then((text) => {
      host.innerHTML = text;
      const svg = host.querySelector("svg");
      const rects = Array.from(svg.querySelectorAll("rect"));
      rects.forEach((rect, index) => {
        rect.id = "lote-" + index;
        rect.dataset.index = String(index);
        rect.setAttribute("tabindex", "0");
      });
      count.textContent = rects.length + " lotes detectados no SVG original.";
      if (rects[0]) renderLot(rects[0]);
    });
    map.addEventListener("wheel", (event) => {
      event.preventDefault();
      zoom = Math.max(0.6, Math.min(3, zoom + (event.deltaY < 0 ? 0.12 : -0.12)));
      applyTransform();
    }, { passive: false });
    map.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      drag = { x: event.clientX - offset.x, y: event.clientY - offset.y, moved: false };
      map.setPointerCapture(event.pointerId);
    });
    map.addEventListener("pointermove", (event) => {
      if (!drag) return;
      drag.moved = true;
      wasMoved = true;
      offset = { x: event.clientX - drag.x, y: event.clientY - drag.y };
      applyTransform();
    });
    map.addEventListener("pointerup", () => { drag = null; });
    map.addEventListener("click", (event) => {
      if (wasMoved) {
        wasMoved = false;
        return;
      }
      const rect = event.target.closest && event.target.closest("rect");
      if (rect) renderLot(rect);
    });
  </script>`;
}

async function runBubblewrapBuild(cwd) {
  try {
    const result = await new Promise((resolve) => {
      const child = spawn("bubblewrap", ["build"], {
        cwd,
        shell: process.platform === "win32",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ ok: false, error: "timeout ao executar bubblewrap build" });
      }, 240000);
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        resolve({ ok: false, error: error.message });
      });
      child.on("close", async (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          resolve({ ok: false, error: (stderr || stdout || `exit ${code}`).trim().slice(0, 240) });
          return;
        }
        resolve({ ok: true, apkPath: await findApk(cwd) });
      });
    });
    return result;
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function findApk(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".apk")) return full;
    if (entry.isDirectory()) {
      const nested = await findApk(full);
      if (nested) return nested;
    }
  }
  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
