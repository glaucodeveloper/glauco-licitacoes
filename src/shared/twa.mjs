import fs from "node:fs/promises";
import path from "node:path";

export function slugify(value) {
  return String(value || "portal")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "portal";
}

export function validatePackageName(value) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(String(value || ""));
}

export function validatePortalApps(apps) {
  const ids = new Set();
  const packages = new Set();
  const checks = [];

  for (const app of apps || []) {
    if (!app.id || ids.has(app.id)) {
      checks.push({ level: "error", title: "ID duplicado", detail: app.name || "Aplicativo sem nome" });
    }
    ids.add(app.id);

    if (!validatePackageName(app.packageName)) {
      checks.push({
        level: "error",
        title: "Pacote Android invalido",
        detail: `${app.name}: use formato app.empresa.nome`
      });
    }

    if (packages.has(app.packageName)) {
      checks.push({
        level: "error",
        title: "Pacote Android duplicado",
        detail: app.packageName
      });
    }
    packages.add(app.packageName);

    if (!app.route) {
      checks.push({ level: "warning", title: "Rota sem origem", detail: app.name });
    }
  }

  if (!checks.length) {
    checks.push({
      level: "ok",
      title: "Administracao consistente",
      detail: "Aplicativos, rotas e pacotes estao prontos para compile TWA."
    });
  }

  return checks;
}

export function appStartPath(app) {
  return `/__glauco/pages/${app.id}`;
}

export async function generateTwaArtifacts({ app, outputDir, host = "REPLACE_WITH_NGROK_HOST" }) {
  const appDir = path.join(outputDir, app.id);
  await fs.mkdir(appDir, { recursive: true });

  const manifest = {
    packageId: app.packageName,
    host,
    name: app.name,
    launcherName: app.name.slice(0, 12),
    display: "standalone",
    themeColor: "#0f62fe",
    navigationColor: "#0f62fe",
    startUrl: appStartPath(app),
    signing: {
      mode: "bubblewrap",
      keystore: "managed-by-framework"
    }
  };

  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: app.packageName,
        sha256_cert_fingerprints: ["REPLACE_WITH_SIGNED_APK_CERT_FINGERPRINT"]
      }
    }
  ];

  const ps1 = [
    "$ErrorActionPreference = 'Stop'",
    "$here = Split-Path -Parent $MyInvocation.MyCommand.Path",
    "Set-Location $here",
    "bubblewrap build",
    ""
  ].join("\n");

  const sh = ["#!/usr/bin/env sh", "set -eu", "cd \"$(dirname \"$0\")\"", "bubblewrap build", ""].join("\n");

  await fs.writeFile(path.join(appDir, "twa-manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.writeFile(path.join(appDir, "assetlinks.json"), JSON.stringify(assetlinks, null, 2));
  await fs.writeFile(path.join(appDir, "build-twa.ps1"), ps1);
  await fs.writeFile(path.join(appDir, "build-twa.sh"), sh);

  return {
    appDir,
    manifestPath: path.join(appDir, "twa-manifest.json")
  };
}
