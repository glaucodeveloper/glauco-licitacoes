export function slugify(value) {
  return String(value || "portal")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "portal";
}

export function validatePortalApps(apps) {
  const ids = new Set();
  const checks = [];

  for (const app of apps || []) {
    if (!app.id || ids.has(app.id)) {
      checks.push({ level: "error", title: "ID duplicado", detail: app.name || "Aplicativo sem nome" });
    }
    ids.add(app.id);

    if (!app.route) {
      checks.push({ level: "warning", title: "Rota sem origem", detail: app.name });
    }
  }

  if (!checks.length) {
    checks.push({
      level: "ok",
      title: "Administracao consistente",
      detail: "Aplicativos e rotas estao prontos para publicacao externa."
    });
  }

  return checks;
}

export function appStartPath(app) {
  return `/__glauco/pages/${app.id}`;
}
