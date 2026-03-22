import { BigNumber } from "../core/BigNumber.js";
import { Upgrade, UpgradeEffect } from "../core/types.js";
import { ProductionSystem } from "./ProductionSystem.js";
import { ResourceManager } from "./ResourceManager.js";

/**
 * Manages purchasable upgrades that modify production, costs, or apply
 * custom effects. Upgrades can be one-time or multi-level.
 */
export class UpgradeSystem {
  private upgrades = new Map<string, Upgrade>();

  constructor(
    private resources: ResourceManager,
    private production: ProductionSystem,
  ) {}

  register(config: {
    id: string;
    name: string;
    description: string;
    cost: BigNumber;
    costResourceId: string;
    maxLevel?: number;
    effect: UpgradeEffect;
  }): Upgrade {
    const upgrade: Upgrade = {
      id: config.id,
      name: config.name,
      description: config.description,
      cost: config.cost,
      costResourceId: config.costResourceId,
      maxLevel: config.maxLevel ?? 1,
      currentLevel: 0,
      effect: config.effect,
    };
    this.upgrades.set(config.id, upgrade);
    return upgrade;
  }

  get(id: string): Upgrade {
    const u = this.upgrades.get(id);
    if (!u) throw new Error(`Unknown upgrade: ${id}`);
    return u;
  }

  getAll(): Upgrade[] {
    return [...this.upgrades.values()];
  }

  canPurchase(id: string): boolean {
    const u = this.get(id);
    if (u.currentLevel >= u.maxLevel) return false;
    return this.resources.canAfford(u.costResourceId, u.cost);
  }

  purchase(id: string): boolean {
    const u = this.get(id);
    if (u.currentLevel >= u.maxLevel) return false;
    if (!this.resources.spend(u.costResourceId, u.cost)) return false;
    u.currentLevel++;
    this.applyEffect(u.effect);
    return true;
  }

  private applyEffect(effect: UpgradeEffect): void {
    switch (effect.type) {
      case "multiply_production": {
        const current = this.production.get(effect.generatorId);
        const existing = current.baseRate;
        this.production.setMultiplier(
          effect.generatorId,
          effect.multiplier,
        );
        void existing; // multiplier is set directly
        break;
      }
      case "multiply_all_production":
        this.production.setGlobalMultiplier(effect.multiplier);
        break;
      case "reduce_cost":
        // Cost reduction is checked at purchase time via the generator
        break;
      case "custom":
        effect.apply();
        break;
    }
  }

  toSaveData(): Record<string, { currentLevel: number }> {
    const data: Record<string, { currentLevel: number }> = {};
    for (const [id, u] of this.upgrades) {
      data[id] = { currentLevel: u.currentLevel };
    }
    return data;
  }

  loadSaveData(data: Record<string, { currentLevel: number }>): void {
    for (const [id, saved] of Object.entries(data)) {
      const u = this.upgrades.get(id);
      if (u) {
        // Re-apply effects for each level
        for (let i = u.currentLevel; i < saved.currentLevel; i++) {
          this.applyEffect(u.effect);
        }
        u.currentLevel = saved.currentLevel;
      }
    }
  }
}
