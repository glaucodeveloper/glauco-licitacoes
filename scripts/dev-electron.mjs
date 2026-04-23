import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const electronBin = path.join(root, "node_modules", "electron", "cli.js");

const vite = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5173"], {
  cwd: root,
  stdio: "inherit",
  shell: false
});

await waitForUrl("http://127.0.0.1:5173");

const electronEnv = {
  ...process.env,
  VITE_DEV_SERVER_URL: "http://127.0.0.1:5173"
};
delete electronEnv.ELECTRON_RUN_AS_NODE;

const electron = spawn(process.execPath, [electronBin, "."], {
  cwd: root,
  stdio: "inherit",
  shell: false,
  env: electronEnv
});

electron.on("exit", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});

process.on("SIGINT", () => {
  electron.kill();
  vite.kill();
});

async function waitForUrl(url) {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Vite nao respondeu em ${url}`);
}
