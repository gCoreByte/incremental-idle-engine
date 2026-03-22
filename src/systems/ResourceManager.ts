import { BigNumber } from "../core/BigNumber.js";
import { Resource } from "../core/types.js";

/**
 * Manages all game resources (currencies). Handles adding, spending,
 * and capping resources at their max values.
 */
export class ResourceManager {
  private resources = new Map<string, Resource>();

  register(id: string, name: string, initial?: BigNumber, max?: BigNumber): Resource {
    const resource: Resource = {
      id,
      name,
      amount: initial ?? BigNumber.ZERO,
      max,
    };
    this.resources.set(id, resource);
    return resource;
  }

  get(id: string): Resource {
    const r = this.resources.get(id);
    if (!r) throw new Error(`Unknown resource: ${id}`);
    return r;
  }

  getAll(): Resource[] {
    return [...this.resources.values()];
  }

  add(id: string, amount: BigNumber): void {
    const r = this.get(id);
    r.amount = r.amount.add(amount);
    if (r.max && r.amount.gt(r.max)) {
      r.amount = r.max;
    }
  }

  /** Returns true if the resource was spent, false if insufficient */
  spend(id: string, amount: BigNumber): boolean {
    const r = this.get(id);
    if (r.amount.lt(amount)) return false;
    r.amount = r.amount.subtract(amount);
    return true;
  }

  canAfford(id: string, amount: BigNumber): boolean {
    return this.get(id).amount.gte(amount);
  }

  reset(id: string): void {
    this.get(id).amount = BigNumber.ZERO;
  }

  toSaveData(): Record<string, { amount: { mantissa: number; exponent: number }; max?: { mantissa: number; exponent: number } }> {
    const data: Record<string, { amount: { mantissa: number; exponent: number }; max?: { mantissa: number; exponent: number } }> = {};
    for (const [id, r] of this.resources) {
      data[id] = { amount: r.amount.toJSON(), max: r.max?.toJSON() };
    }
    return data;
  }

  loadSaveData(data: Record<string, { amount: { mantissa: number; exponent: number } }>): void {
    for (const [id, saved] of Object.entries(data)) {
      const r = this.resources.get(id);
      if (r) {
        r.amount = BigNumber.fromJSON(saved.amount);
      }
    }
  }
}
