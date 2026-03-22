import { describe, it, expect, vi } from "vitest";
import { BigNumber } from "../core/BigNumber.js";
import { ResourceManager } from "./ResourceManager.js";
import { ProductionSystem } from "./ProductionSystem.js";
import { StatisticsSystem } from "./StatisticsSystem.js";
import { AchievementSystem } from "./AchievementSystem.js";

function setup() {
  const resources = new ResourceManager();
  resources.register("gold", "Gold", BigNumber.fromNumber(0));

  const production = new ProductionSystem(resources);
  production.register({
    id: "miner",
    name: "Miner",
    resourceId: "gold",
    baseRate: BigNumber.fromNumber(1),
    baseCost: BigNumber.fromNumber(10),
  });

  const statistics = new StatisticsSystem();
  const achievements = new AchievementSystem(resources, production, statistics);

  return { resources, production, statistics, achievements };
}

describe("AchievementSystem", () => {
  it("unlocks when condition is met on tick", () => {
    const { resources, achievements } = setup();
    achievements.register({
      id: "first_gold",
      name: "First Gold",
      description: "Earn your first gold",
      condition: (ctx) => ctx.resources.get("gold").amount.gte(BigNumber.ONE),
    });

    achievements.tick(1);
    expect(achievements.get("first_gold").unlocked).toBe(false);

    resources.add("gold", BigNumber.fromNumber(5));
    achievements.tick(1);
    expect(achievements.get("first_gold").unlocked).toBe(true);
    expect(achievements.get("first_gold").unlockedAt).toBeTypeOf("number");
  });

  it("does not re-trigger already unlocked achievements", () => {
    const { resources, achievements } = setup();
    const conditionFn = vi.fn().mockReturnValue(true);

    achievements.register({
      id: "test",
      name: "Test",
      description: "test",
      condition: conditionFn,
    });

    achievements.tick(1);
    achievements.tick(1);
    achievements.tick(1);

    // Condition should only be called until unlocked, then skipped
    expect(conditionFn).toHaveBeenCalledTimes(1);
  });

  it("fires onUnlock callback", () => {
    const { resources, achievements } = setup();
    const onUnlock = vi.fn();
    achievements.setOnUnlock(onUnlock);

    achievements.register({
      id: "rich",
      name: "Rich",
      description: "Have 100 gold",
      condition: (ctx) => ctx.resources.get("gold").amount.gte(BigNumber.fromNumber(100)),
    });

    resources.add("gold", BigNumber.fromNumber(100));
    achievements.tick(1);

    expect(onUnlock).toHaveBeenCalledOnce();
    expect(onUnlock.mock.calls[0][0].id).toBe("rich");
  });

  it("applies reward on unlock", () => {
    const { resources, production, achievements } = setup();
    resources.add("gold", BigNumber.fromNumber(100));
    production.buy("miner");

    achievements.register({
      id: "boost",
      name: "Boost",
      description: "Double miner production",
      condition: () => true,
      reward: { type: "multiply_production", generatorId: "miner", multiplier: 2 },
    });

    achievements.tick(1);
    expect(production.getProductionRate("miner").toNumber()).toBeCloseTo(2);
  });

  it("applies custom reward", () => {
    const { achievements } = setup();
    const customFn = vi.fn();

    achievements.register({
      id: "custom",
      name: "Custom",
      description: "Custom reward",
      condition: () => true,
      reward: { type: "custom", apply: customFn },
    });

    achievements.tick(1);
    expect(customFn).toHaveBeenCalledOnce();
  });

  it("force unlocks an achievement", () => {
    const { achievements } = setup();
    achievements.register({
      id: "secret",
      name: "Secret",
      description: "Hidden achievement",
      condition: () => false,
    });

    achievements.forceUnlock("secret");
    expect(achievements.get("secret").unlocked).toBe(true);
  });

  it("lists locked and unlocked achievements", () => {
    const { achievements } = setup();
    achievements.register({ id: "a", name: "A", description: "", condition: () => true });
    achievements.register({ id: "b", name: "B", description: "", condition: () => false });

    achievements.tick(1);
    expect(achievements.getUnlocked().map((a) => a.id)).toEqual(["a"]);
    expect(achievements.getLocked().map((a) => a.id)).toEqual(["b"]);
  });

  it("round-trips save data", () => {
    const { achievements } = setup();
    achievements.register({ id: "a", name: "A", description: "", condition: () => true });
    achievements.register({ id: "b", name: "B", description: "", condition: () => false });

    achievements.tick(1);
    const saved = achievements.toSaveData();
    expect(saved["a"].unlocked).toBe(true);
    expect(saved["b"].unlocked).toBe(false);

    // Load into fresh system
    const { achievements: a2 } = setup();
    a2.register({ id: "a", name: "A", description: "", condition: () => false });
    a2.register({ id: "b", name: "B", description: "", condition: () => false });
    a2.loadSaveData(saved);

    expect(a2.get("a").unlocked).toBe(true);
    expect(a2.get("b").unlocked).toBe(false);
  });

  it("reapplies rewards after loading", () => {
    const { production, resources, achievements } = setup();
    resources.add("gold", BigNumber.fromNumber(100));
    production.buy("miner");

    achievements.register({
      id: "boost",
      name: "Boost",
      description: "2x miners",
      condition: () => true,
      reward: { type: "multiply_production", generatorId: "miner", multiplier: 2 },
    });

    achievements.tick(1);
    const saved = achievements.toSaveData();

    // Load into fresh system
    const s2 = setup();
    s2.resources.add("gold", BigNumber.fromNumber(100));
    s2.production.buy("miner");
    s2.achievements.register({
      id: "boost",
      name: "Boost",
      description: "2x miners",
      condition: () => false,
      reward: { type: "multiply_production", generatorId: "miner", multiplier: 2 },
    });
    s2.achievements.loadSaveData(saved);
    s2.achievements.reapplyRewards();

    expect(s2.production.getProductionRate("miner").toNumber()).toBeCloseTo(2);
  });

  it("throws for unknown achievement", () => {
    const { achievements } = setup();
    expect(() => achievements.get("nope")).toThrow("Unknown achievement: nope");
  });
});
