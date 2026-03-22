import { BigNumber } from "../core/BigNumber.js";
import { Generator, TickableSystem } from "../core/types.js";
import { ResourceManager } from "./ResourceManager.js";

/**
 * Manages generators and their per-tick resource production.
 * Implements TickableSystem so it can be driven by the GameEngine.
 */
export class ProductionSystem implements TickableSystem {
  private generators = new Map<string, Generator>();
  private productionMultipliers = new Map<string, number>();
  private globalMultiplier = 1;
  private prestigeMultiplier = 1;

  constructor(private resources: ResourceManager) {}

  register(config: {
    id: string;
    name: string;
    resourceId: string;
    baseRate: BigNumber;
    baseCost: BigNumber;
    costMultiplier?: number;
  }): Generator {
    const generator: Generator = {
      id: config.id,
      name: config.name,
      resourceId: config.resourceId,
      baseRate: config.baseRate,
      count: BigNumber.ZERO,
      baseCost: config.baseCost,
      costMultiplier: config.costMultiplier ?? 1.15,
    };
    this.generators.set(config.id, generator);
    return generator;
  }

  get(id: string): Generator {
    const g = this.generators.get(id);
    if (!g) throw new Error(`Unknown generator: ${id}`);
    return g;
  }

  getAll(): Generator[] {
    return [...this.generators.values()];
  }

  /** Calculate the cost for the next unit of a generator */
  getNextCost(id: string): BigNumber {
    const g = this.get(id);
    const multiplier = Math.pow(g.costMultiplier, g.count.toNumber());
    return g.baseCost.multiply(BigNumber.fromNumber(multiplier));
  }

  /** Attempt to buy one unit of a generator, spending the required resource */
  buy(id: string): boolean {
    const g = this.get(id);
    const cost = this.getNextCost(id);
    if (!this.resources.spend(g.resourceId, cost)) return false;
    g.count = g.count.add(BigNumber.ONE);
    return true;
  }

  /** Get production per second for a specific generator */
  getProductionRate(id: string): BigNumber {
    const g = this.get(id);
    const localMult = this.productionMultipliers.get(id) ?? 1;
    return g.baseRate
      .multiply(g.count)
      .multiply(BigNumber.fromNumber(localMult * this.globalMultiplier * this.prestigeMultiplier));
  }

  /** Get production per second for a single unit of a generator (ignores count) */
  getUnitRate(id: string): BigNumber {
    const g = this.get(id);
    const localMult = this.productionMultipliers.get(id) ?? 1;
    return g.baseRate.multiply(BigNumber.fromNumber(localMult * this.globalMultiplier * this.prestigeMultiplier));
  }

  /** Get total production per second for a resource across all generators */
  getTotalProductionRate(resourceId: string): BigNumber {
    let total = BigNumber.ZERO;
    for (const g of this.generators.values()) {
      if (g.resourceId === resourceId) {
        total = total.add(this.getProductionRate(g.id));
      }
    }
    return total;
  }

  /** Multiply a generator's existing multiplier (stacks with previous calls) */
  setMultiplier(generatorId: string, multiplier: number): void {
    const existing = this.productionMultipliers.get(generatorId) ?? 1;
    this.productionMultipliers.set(generatorId, existing * multiplier);
  }

  /** Multiply the global production multiplier (stacks with previous calls) */
  setGlobalMultiplier(multiplier: number): void {
    this.globalMultiplier *= multiplier;
  }

  /**
   * Set the prestige multiplier (replaces the current value).
   * This is kept separate from the global multiplier so that prestige
   * can recalculate it without interfering with upgrade multipliers.
   */
  setPrestigeMultiplier(multiplier: number): void {
    this.prestigeMultiplier = multiplier;
  }

  /** Reset per-generator and global multipliers to 1 (prestige multiplier is preserved) */
  resetMultipliers(): void {
    this.productionMultipliers.clear();
    this.globalMultiplier = 1;
  }

  tick(deltaSec: number): void {
    const delta = BigNumber.fromNumber(deltaSec);
    for (const g of this.generators.values()) {
      if (g.count.isZero()) continue;
      const produced = this.getProductionRate(g.id).multiply(delta);
      this.resources.add(g.resourceId, produced);
    }
  }

  toSaveData(): Record<string, { count: { mantissa: number; exponent: number } }> {
    const data: Record<string, { count: { mantissa: number; exponent: number } }> = {};
    for (const [id, g] of this.generators) {
      data[id] = { count: g.count.toJSON() };
    }
    return data;
  }

  loadSaveData(data: Record<string, { count: { mantissa: number; exponent: number } }>): void {
    for (const [id, saved] of Object.entries(data)) {
      const g = this.generators.get(id);
      if (g) {
        g.count = BigNumber.fromJSON(saved.count);
      }
    }
  }
}
