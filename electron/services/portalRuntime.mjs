import http from "node:http";
import { spawn } from "node:child_process";
import { appStartPath } from "../../src/shared/portalApps.mjs";

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
    <section class="panel"><h1>${escapeHtml(state.company.name)}</h1><p>${escapeHtml(state.company.summary)}</p><ul>${rows || "<li>Radar ainda sem notificacoes.</li>"}</ul></section>
  </main>
</body>
</html>`;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
