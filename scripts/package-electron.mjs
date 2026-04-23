import fs from "node:fs/promises";
import path from "node:path";
import { defaultState } from "../src/shared/defaultState.mjs";
import { generateTwaArtifacts, validatePortalApps } from "../src/shared/twa.mjs";

const root = process.cwd();
const outDir = path.join(root, "dist", "package");
const twaDir = path.join(root, "dist", "twa");
const state = defaultState("");

await fs.rm(outDir, { recursive: true, force: true });
await fs.rm(twaDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(twaDir, { recursive: true });

for (const app of state.portalApps) {
  await generateTwaArtifacts({ app, outputDir: twaDir });
}

const manifest = {
  app: "glauco-licitacoes-electron",
  runtime: "electron-react",
  entry: "electron/main.cjs",
  renderer: "dist/renderer",
  userData: "Electron app.getPath('userData')/workspace",
  portals: state.portalApps.map((item) => ({
    id: item.id,
    route: item.route,
    packageName: item.packageName
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
console.log(`TWA artifacts: ${twaDir}`);
