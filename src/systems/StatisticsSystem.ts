import { BigNumber } from "../core/BigNumber.js";
import { TickableSystem } from "../core/types.js";
import { ResourceManager } from "./ResourceManager.js";

export interface StatSnapshot {
  /** All-time total of each resource earned (never decreases) */
  totalEarned: Record<string, BigNumber>;
  /** All-time total of each resource spent */
  totalSpent: Record<string, BigNumber>;
  /** Number of prestige resets performed */
  totalResets: number;
  /** Total seconds the game has been running (across all sessions) */
  timePlayed: number;
  /** Seconds played in the current prestige run */
  timeThisRun: number;
  /** Highest production rate ever seen, keyed by resource ID */
  peakProductionRate: Record<string, BigNumber>;
  /** Arbitrary counters for game-specific tracking */
  counters: Record<string, number>;
}

/**
 * Tracks cumulative statistics across the lifetime of a game.
 * Implements TickableSystem to accumulate time and sample production rates.
 *
 * Hook into ResourceManager operations by calling `recordEarned` / `recordSpent`
 * whenever resources change, or use `wrapResourceManager` for automatic tracking.
 */
export class StatisticsSystem implements TickableSystem {
  private stats: StatSnapshot = {
    totalEarned: {},
    totalSpent: {},
    totalResets: 0,
    timePlayed: 0,
    timeThisRun: 0,
    peakProductionRate: {},
    counters: {},
  };

  private productionRateSampler: (() => Record<string, BigNumber>) | null = null;

  /** Register a function that returns current production rates per resource. */
  setProductionRateSampler(sampler: () => Record<string, BigNumber>): void {
    this.productionRateSampler = sampler;
  }

  tick(deltaSec: number): void {
    this.stats.timePlayed += deltaSec;
    this.stats.timeThisRun += deltaSec;

    // Sample production rates and update peaks
    if (this.productionRateSampler) {
      const rates = this.productionRateSampler();
      for (const [resourceId, rate] of Object.entries(rates)) {
        const peak = this.stats.peakProductionRate[resourceId];
        if (!peak || rate.gt(peak)) {
          this.stats.peakProductionRate[resourceId] = rate;
        }
      }
    }
  }

  recordEarned(resourceId: string, amount: BigNumber): void {
    const prev = this.stats.totalEarned[resourceId] ?? BigNumber.ZERO;
    this.stats.totalEarned[resourceId] = prev.add(amount);
  }

  recordSpent(resourceId: string, amount: BigNumber): void {
    const prev = this.stats.totalSpent[resourceId] ?? BigNumber.ZERO;
    this.stats.totalSpent[resourceId] = prev.add(amount);
  }

  recordReset(): void {
    this.stats.totalResets++;
    this.stats.timeThisRun = 0;
  }

  incrementCounter(key: string, amount: number = 1): void {
    this.stats.counters[key] = (this.stats.counters[key] ?? 0) + amount;
  }

  getCounter(key: string): number {
    return this.stats.counters[key] ?? 0;
  }

  getTotalEarned(resourceId: string): BigNumber {
    return this.stats.totalEarned[resourceId] ?? BigNumber.ZERO;
  }

  getTotalSpent(resourceId: string): BigNumber {
    return this.stats.totalSpent[resourceId] ?? BigNumber.ZERO;
  }

  get totalResets(): number {
    return this.stats.totalResets;
  }

  get timePlayed(): number {
    return this.stats.timePlayed;
  }

  get timeThisRun(): number {
    return this.stats.timeThisRun;
  }

  getPeakProductionRate(resourceId: string): BigNumber {
    return this.stats.peakProductionRate[resourceId] ?? BigNumber.ZERO;
  }

  /** Get the full snapshot (read-only view) */
  getSnapshot(): Readonly<StatSnapshot> {
    return this.stats;
  }

  /**
   * Wrap a ResourceManager so that all add/spend calls are automatically tracked.
   * Returns the same ResourceManager instance (mutated with tracking).
   */
  wrapResourceManager(rm: ResourceManager): ResourceManager {
    const origAdd = rm.add.bind(rm);
    const origSpend = rm.spend.bind(rm);

    rm.add = (id: string, amount: BigNumber) => {
      this.recordEarned(id, amount);
      origAdd(id, amount);
    };

    rm.spend = (id: string, amount: BigNumber): boolean => {
      const success = origSpend(id, amount);
      if (success) {
        this.recordSpent(id, amount);
      }
      return success;
    };

    return rm;
  }

  toSaveData(): {
    totalEarned: Record<string, { mantissa: number; exponent: number }>;
    totalSpent: Record<string, { mantissa: number; exponent: number }>;
    totalResets: number;
    timePlayed: number;
    timeThisRun: number;
    peakProductionRate: Record<string, { mantissa: number; exponent: number }>;
    counters: Record<string, number>;
  } {
    const serializeBigMap = (m: Record<string, BigNumber>) => {
      const out: Record<string, { mantissa: number; exponent: number }> = {};
      for (const [k, v] of Object.entries(m)) {
        out[k] = v.toJSON();
      }
      return out;
    };

    return {
      totalEarned: serializeBigMap(this.stats.totalEarned),
      totalSpent: serializeBigMap(this.stats.totalSpent),
      totalResets: this.stats.totalResets,
      timePlayed: this.stats.timePlayed,
      timeThisRun: this.stats.timeThisRun,
      peakProductionRate: serializeBigMap(this.stats.peakProductionRate),
      counters: { ...this.stats.counters },
    };
  }

  loadSaveData(data: ReturnType<StatisticsSystem["toSaveData"]>): void {
    const deserializeBigMap = (m: Record<string, { mantissa: number; exponent: number }>) => {
      const out: Record<string, BigNumber> = {};
      for (const [k, v] of Object.entries(m)) {
        out[k] = BigNumber.fromJSON(v);
      }
      return out;
    };

    this.stats.totalEarned = deserializeBigMap(data.totalEarned);
    this.stats.totalSpent = deserializeBigMap(data.totalSpent);
    this.stats.totalResets = data.totalResets;
    this.stats.timePlayed = data.timePlayed;
    this.stats.timeThisRun = data.timeThisRun;
    this.stats.peakProductionRate = deserializeBigMap(data.peakProductionRate);
    this.stats.counters = { ...data.counters };
  }
}
