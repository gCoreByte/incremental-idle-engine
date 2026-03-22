import { BigNumber } from "../core/BigNumber.js";
import { TickableSystem } from "../core/types.js";
import { ResourceManager } from "./ResourceManager.js";
import { ProductionSystem } from "./ProductionSystem.js";
import { StatisticsSystem } from "./StatisticsSystem.js";

export interface AchievementConfig {
  id: string;
  name: string;
  description: string;
  /** Return true when the achievement should unlock */
  condition: (ctx: AchievementContext) => boolean;
  /** Optional reward applied when unlocked */
  reward?: AchievementReward;
  /** If true, condition is only checked once (on registration). Default: false */
  hidden?: boolean;
}

export interface AchievementContext {
  resources: ResourceManager;
  production: ProductionSystem;
  statistics: StatisticsSystem;
}

export type AchievementReward =
  | { type: "multiply_production"; generatorId: string; multiplier: number }
  | { type: "multiply_all_production"; multiplier: number }
  | { type: "custom"; apply: () => void };

export interface Achievement extends AchievementConfig {
  unlocked: boolean;
  unlockedAt: number | null;
}

/**
 * Tracks milestones and grants rewards when conditions are met.
 * Conditions are evaluated each tick, so keep them cheap.
 *
 * Once unlocked, an achievement stays unlocked permanently (survives prestige).
 */
export class AchievementSystem implements TickableSystem {
  private achievements = new Map<string, Achievement>();
  private ctx: AchievementContext;
  private onUnlock: ((achievement: Achievement) => void) | null = null;

  constructor(
    private resources: ResourceManager,
    private production: ProductionSystem,
    private statistics: StatisticsSystem,
  ) {
    this.ctx = { resources, production, statistics };
  }

  /** Set a callback that fires whenever an achievement is unlocked */
  setOnUnlock(callback: (achievement: Achievement) => void): void {
    this.onUnlock = callback;
  }

  register(config: AchievementConfig): Achievement {
    const achievement: Achievement = {
      ...config,
      unlocked: false,
      unlockedAt: null,
    };
    this.achievements.set(config.id, achievement);
    return achievement;
  }

  get(id: string): Achievement {
    const a = this.achievements.get(id);
    if (!a) throw new Error(`Unknown achievement: ${id}`);
    return a;
  }

  getAll(): Achievement[] {
    return [...this.achievements.values()];
  }

  getUnlocked(): Achievement[] {
    return this.getAll().filter((a) => a.unlocked);
  }

  getLocked(): Achievement[] {
    return this.getAll().filter((a) => !a.unlocked);
  }

  tick(_deltaSec: number): void {
    for (const achievement of this.achievements.values()) {
      if (achievement.unlocked) continue;
      if (achievement.condition(this.ctx)) {
        this.unlock(achievement);
      }
    }
  }

  /** Manually unlock an achievement (bypasses condition check) */
  forceUnlock(id: string): void {
    const a = this.get(id);
    if (!a.unlocked) {
      this.unlock(a);
    }
  }

  private unlock(achievement: Achievement): void {
    achievement.unlocked = true;
    achievement.unlockedAt = Date.now();

    if (achievement.reward) {
      this.applyReward(achievement.reward);
    }

    this.onUnlock?.(achievement);
  }

  private applyReward(reward: AchievementReward): void {
    switch (reward.type) {
      case "multiply_production":
        this.production.setMultiplier(reward.generatorId, reward.multiplier);
        break;
      case "multiply_all_production":
        this.production.setGlobalMultiplier(reward.multiplier);
        break;
      case "custom":
        reward.apply();
        break;
    }
  }

  /** Re-apply all unlocked achievement rewards (call after loading a save) */
  reapplyRewards(): void {
    for (const a of this.achievements.values()) {
      if (a.unlocked && a.reward) {
        this.applyReward(a.reward);
      }
    }
  }

  toSaveData(): Record<string, { unlocked: boolean; unlockedAt: number | null }> {
    const data: Record<string, { unlocked: boolean; unlockedAt: number | null }> = {};
    for (const [id, a] of this.achievements) {
      data[id] = { unlocked: a.unlocked, unlockedAt: a.unlockedAt };
    }
    return data;
  }

  loadSaveData(data: Record<string, { unlocked: boolean; unlockedAt: number | null }>): void {
    for (const [id, saved] of Object.entries(data)) {
      const a = this.achievements.get(id);
      if (a) {
        a.unlocked = saved.unlocked;
        a.unlockedAt = saved.unlockedAt;
      }
    }
  }
}
