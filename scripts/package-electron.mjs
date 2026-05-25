import fs from "node:fs/promises";
import path from "node:path";
import { defaultState } from "../src/shared/defaultState.mjs";
import { validatePortalApps } from "../src/shared/portalApps.mjs";

const root = process.cwd();
const outDir = path.join(root, "dist", "package");
const state = defaultState("");

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const manifest = {
  app: "glauco-licitacoes-electron",
  runtime: "electron-react",
  entry: "electron/main.cjs",
  renderer: "dist/renderer",
  userData: "Electron app.getPath('userData')/workspace",
  portals: state.portalApps.map((item) => ({
    id: item.id,
    route: item.route
  })),
  checks: validatePortalApps(state.portalApps)
};

await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await fs.writeFile(
  path.join(outDir, "README.txt"),
  [
    "Pacote Electron React gerado.",
    "Use `npm run windows-app` para gerar o executavel portatil.",
    "Use `npm run containerize` para gerar Dockerfile, Kubernetes e runners.",
    ""
  ].join("\n")
);

console.log(`Package manifest: ${path.join(outDir, "manifest.json")}`);
