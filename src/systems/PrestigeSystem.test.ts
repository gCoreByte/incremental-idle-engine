import { describe, it, expect, vi } from "vitest";
import { BigNumber } from "../core/BigNumber.js";
import { ResourceManager } from "./ResourceManager.js";
import { ProductionSystem } from "./ProductionSystem.js";
import { StatisticsSystem } from "./StatisticsSystem.js";
import { PrestigeSystem } from "./PrestigeSystem.js";

function setup() {
  const resources = new ResourceManager();
  resources.register("gold", "Gold", BigNumber.fromNumber(1000));
  resources.register("prestige_points", "Prestige Points");

  const production = new ProductionSystem(resources);
  production.register({
    id: "miner",
    name: "Miner",
    resourceId: "gold",
    baseRate: BigNumber.fromNumber(1),
    baseCost: BigNumber.fromNumber(10),
  });

  const statistics = new StatisticsSystem();
  statistics.wrapResourceManager(resources);

  const prestige = new PrestigeSystem(resources, production, statistics);
  prestige.registerLayer({
    id: "layer1",
    name: "Prestige",
    currencyId: "prestige_points",
    formula: (stats) => {
      // Simple formula: 1 prestige point per 1000 total gold earned
      const earned = stats.getTotalEarned("gold");
      return earned.divide(BigNumber.fromNumber(1000));
    },
    resetResourceIds: ["gold"],
    resetGeneratorIds: ["miner"],
  });

  return { resources, production, statistics, prestige };
}

describe("PrestigeSystem", () => {
  it("calculates prestige gain from formula", () => {
    const { resources, prestige, statistics } = setup();
    // Earn 5000 gold → 5 prestige points
    resources.add("gold", BigNumber.fromNumber(5000));
    const gain = prestige.getPrestigeGain("layer1");
    expect(gain.toNumber()).toBeCloseTo(5);
  });

  it("blocks prestige when gain is below minimum", () => {
    const { prestige } = setup();
    // No gold earned → 0 prestige points → below default minimum of 1
    expect(prestige.canPrestige("layer1")).toBe(false);
    expect(prestige.prestige("layer1")).toBeNull();
  });

  it("performs prestige reset", () => {
    const { resources, production, prestige, statistics } = setup();
    // Earn enough gold
    resources.add("gold", BigNumber.fromNumber(5000));
    production.buy("miner");
    production.buy("miner");

    expect(prestige.canPrestige("layer1")).toBe(true);
    const gain = prestige.prestige("layer1");

    expect(gain).not.toBeNull();
    expect(gain!.toNumber()).toBeGreaterThanOrEqual(1);

    // Gold should be reset
    expect(resources.get("gold").amount.isZero()).toBe(true);

    // Miners should be reset
    expect(production.get("miner").count.isZero()).toBe(true);

    // Prestige points should be awarded
    expect(resources.get("prestige_points").amount.gt(BigNumber.ZERO)).toBe(true);

    // Stats should record the reset
    expect(statistics.totalResets).toBe(1);
  });

  it("calls onReset callback", () => {
    const { resources, prestige } = setup();
    const onReset = vi.fn();
    const layer = prestige.getLayer("layer1");
    layer.onReset = onReset;

    resources.add("gold", BigNumber.fromNumber(5000));
    prestige.prestige("layer1");

    expect(onReset).toHaveBeenCalledOnce();
  });

  it("calculates prestige multiplier as 1 + currency", () => {
    const { resources, prestige } = setup();
    resources.add("gold", BigNumber.fromNumber(3000));
    prestige.prestige("layer1");

    const mult = prestige.getPrestigeMultiplier("layer1");
    // Should be 1 + prestige_points
    const pp = resources.get("prestige_points").amount;
    expect(mult.toNumber()).toBeCloseTo(1 + pp.toNumber());
  });

  it("supports custom minimum gain", () => {
    const { resources, prestige } = setup();
    const layer = prestige.getLayer("layer1");
    layer.minimumGain = BigNumber.fromNumber(10);

    // Earn 5000 gold → 5 PP → below minimum of 10
    resources.add("gold", BigNumber.fromNumber(5000));
    expect(prestige.canPrestige("layer1")).toBe(false);

    // Earn more
    resources.add("gold", BigNumber.fromNumber(10000));
    expect(prestige.canPrestige("layer1")).toBe(true);
  });

  it("round-trips save data", () => {
    const { resources, prestige } = setup();
    resources.add("gold", BigNumber.fromNumber(5000));
    prestige.prestige("layer1");
    prestige.prestige("layer1"); // second reset (gold was reset, so this might not gain)

    const saved = prestige.toSaveData();
    expect(saved["layer1"].totalResets).toBeGreaterThanOrEqual(1);

    // Load into fresh prestige system
    const { prestige: prestige2 } = setup();
    prestige2.loadSaveData(saved);
    expect(prestige2.getLayer("layer1").totalResets).toBe(saved["layer1"].totalResets);
  });

  it("prevents prestige spam — second prestige without new earnings gives no gain", () => {
    const { resources, prestige } = setup();
    resources.add("gold", BigNumber.fromNumber(5000));

    // First prestige: earns 5 PP
    const gain1 = prestige.prestige("layer1");
    expect(gain1).not.toBeNull();
    expect(gain1!.toNumber()).toBeCloseTo(5);

    // Second prestige without earning more: net gain is 0, should be blocked
    expect(prestige.getPrestigeGain("layer1").toNumber()).toBeCloseTo(0);
    expect(prestige.canPrestige("layer1")).toBe(false);
    expect(prestige.prestige("layer1")).toBeNull();
  });

  it("allows prestige again after earning more resources", () => {
    const { resources, prestige } = setup();
    resources.add("gold", BigNumber.fromNumber(5000));

    // First prestige: 5 PP
    prestige.prestige("layer1");
    expect(prestige.canPrestige("layer1")).toBe(false);

    // Earn more gold → totalEarned increases → net gain becomes positive
    resources.add("gold", BigNumber.fromNumber(3000));
    const gain = prestige.getPrestigeGain("layer1");
    expect(gain.toNumber()).toBeGreaterThan(0);
  });

  it("applies prestige multiplier to production after prestige", () => {
    const { resources, production, prestige } = setup();
    resources.add("gold", BigNumber.fromNumber(5000));
    production.buy("miner");

    const rateBefore = production.getProductionRate("miner").toNumber();
    prestige.prestige("layer1");

    // Re-buy a miner after prestige
    resources.add("gold", BigNumber.fromNumber(100));
    production.buy("miner");

    const rateAfter = production.getProductionRate("miner").toNumber();
    // Prestige multiplier (1 + PP) should make production higher than before
    expect(rateAfter).toBeGreaterThan(rateBefore);
  });

  it("resets upgrade multipliers on prestige", () => {
    const { resources, production, prestige } = setup();
    production.setMultiplier("miner", 5);
    production.setGlobalMultiplier(3);

    resources.add("gold", BigNumber.fromNumber(5000));
    prestige.prestige("layer1");

    // After prestige, upgrade multipliers should be reset
    // Buy a miner and check rate equals baseRate * prestigeMult (no upgrade mults)
    resources.add("gold", BigNumber.fromNumber(100));
    production.buy("miner");
    const pp = resources.get("prestige_points").amount.toNumber();
    const expectedRate = 1 * (1 + pp); // baseRate * prestigeMult
    expect(production.getProductionRate("miner").toNumber()).toBeCloseTo(expectedRate);
  });

  it("round-trips totalAwarded in save data", () => {
    const { resources, prestige } = setup();
    resources.add("gold", BigNumber.fromNumber(5000));
    prestige.prestige("layer1");

    const saved = prestige.toSaveData();
    expect(saved["layer1"].totalAwarded).toBeDefined();

    const { prestige: prestige2 } = setup();
    prestige2.loadSaveData(saved);
    expect(prestige2.getLayer("layer1").totalAwarded.toNumber()).toBeCloseTo(
      prestige.getLayer("layer1").totalAwarded.toNumber(),
    );
  });

  it("throws for unknown layer", () => {
    const { prestige } = setup();
    expect(() => prestige.getLayer("nope")).toThrow("Unknown prestige layer: nope");
  });
});
