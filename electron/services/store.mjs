import fs from "node:fs/promises";
import path from "node:path";
import { defaultState, mergeState, nowStamp } from "../../src/shared/defaultState.mjs";

export class JsonStore {
  constructor({ userRoot }) {
    this.userRoot = userRoot;
    this.statePath = path.join(userRoot, "state.json");
    this.dirs = {
      root: userRoot,
      documents: path.join(userRoot, "documents"),
      finance: path.join(userRoot, "finance"),
      portals: path.join(userRoot, "portals"),
      twa: path.join(userRoot, "twa"),
      cache: path.join(userRoot, "cache"),
      logs: path.join(userRoot, "logs")
    };
    this.state = defaultState(userRoot);
  }

  async init() {
    await Promise.all(Object.values(this.dirs).map((dir) => fs.mkdir(dir, { recursive: true })));
    try {
      const loaded = JSON.parse(await fs.readFile(this.statePath, "utf8"));
      this.state = mergeState(defaultState(this.userRoot), loaded);
      this.state.setup.userRoot = this.userRoot;
    } catch {
      this.state = defaultState(this.userRoot);
      await this.save();
    }
    return this.snapshot();
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  async save() {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
  }

  async update(mutator) {
    const draft = this.snapshot();
    const result = await mutator(draft);
    this.state = result || draft;
    this.state.setup.userRoot = this.userRoot;
    await this.save();
    return this.snapshot();
  }

  async setActiveView(view) {
    return this.update((state) => {
      state.activeView = view;
      return state;
    });
  }

  async addActivity(message) {
    return this.update((state) => {
      state.activity = [`${nowStamp()} - ${message}`, ...(state.activity || [])].slice(0, 30);
      return state;
    });
  }
}
