import { SaveData } from "../core/types.js";
import { GameEngine } from "../core/GameEngine.js";
import { ResourceManager } from "./ResourceManager.js";
import { ProductionSystem } from "./ProductionSystem.js";
import { UpgradeSystem } from "./UpgradeSystem.js";

const SAVE_VERSION = 1;

export interface SaveAdapter {
  save(key: string, data: string): void;
  load(key: string): string | null;
  delete(key: string): void;
}

/** localStorage adapter (browser) */
export const localStorageAdapter: SaveAdapter = {
  save: (key, data) => localStorage.setItem(key, data),
  load: (key) => localStorage.getItem(key),
  delete: (key) => localStorage.removeItem(key),
};

/** In-memory adapter (testing / server-side) */
export function createMemoryAdapter(): SaveAdapter {
  const store = new Map<string, string>();
  return {
    save: (key, data) => store.set(key, data),
    load: (key) => store.get(key) ?? null,
    delete: (key) => store.delete(key),
  };
}

/**
 * Handles serialization, persistence, and loading of game state.
 * Pluggable storage via SaveAdapter (localStorage, memory, custom).
 */
export class SaveSystem {
  constructor(
    private engine: GameEngine,
    private resources: ResourceManager,
    private production: ProductionSystem,
    private upgrades: UpgradeSystem,
    private adapter: SaveAdapter,
    private saveKey: string = "incremental-idle-engine-save",
  ) {}

  save(): void {
    const data: SaveData = {
      version: SAVE_VERSION,
      timestamp: this.engine.getLastTickTime() || Date.now(),
      resources: this.resources.toSaveData(),
      generators: this.production.toSaveData(),
      upgrades: this.upgrades.toSaveData(),
    };
    this.adapter.save(this.saveKey, JSON.stringify(data));
  }

  load(): boolean {
    const raw = this.adapter.load(this.saveKey);
    if (!raw) return false;

    const data: SaveData = JSON.parse(raw);
    // Future: handle migrations based on data.version
    this.resources.loadSaveData(data.resources);
    this.production.loadSaveData(data.generators);
    this.upgrades.loadSaveData(data.upgrades);
    this.engine.setLastTickTime(data.timestamp);

    return true;
  }

  deleteSave(): void {
    this.adapter.delete(this.saveKey);
  }

  exportSave(): string {
    const raw = this.adapter.load(this.saveKey);
    return raw ? btoa(raw) : "";
  }

  importSave(encoded: string): boolean {
    try {
      const raw = atob(encoded);
      JSON.parse(raw); // validate JSON
      this.adapter.save(this.saveKey, raw);
      return this.load();
    } catch {
      return false;
    }
  }
}
