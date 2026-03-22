import { describe, it, expect } from "vitest";
import { BigNumber } from "../core/BigNumber.js";
import { ResourceManager } from "./ResourceManager.js";
import { ProductionSystem } from "./ProductionSystem.js";

describe("ProductionSystem", () => {
  function setup() {
    const resources = new ResourceManager();
    resources.register("gold", "Gold", BigNumber.fromNumber(1000));
    const production = new ProductionSystem(resources);
    production.register({
      id: "miner",
      name: "Miner",
      resourceId: "gold",
      baseRate: BigNumber.fromNumber(1),
      baseCost: BigNumber.fromNumber(10),
      costMultiplier: 1.15,
    });
    return { resources, production };
  }

  it("buys a generator and deducts cost", () => {
    const { resources, production } = setup();
    expect(production.buy("miner")).toBe(true);
    expect(production.get("miner").count.toNumber()).toBe(1);
    expect(resources.get("gold").amount.toNumber()).toBeCloseTo(990);
  });

  it("produces resources on tick", () => {
    const { resources, production } = setup();
    production.buy("miner");
    const before = resources.get("gold").amount.toNumber();
    production.tick(1); // 1 second
    const after = resources.get("gold").amount.toNumber();
    expect(after - before).toBeCloseTo(1);
  });

  it("scales cost with costMultiplier", () => {
    const { production } = setup();
    production.buy("miner");
    const nextCost = production.getNextCost("miner");
    expect(nextCost.toNumber()).toBeCloseTo(11.5);
  });

  it("reports production rate", () => {
    const { production } = setup();
    production.buy("miner");
    production.buy("miner");
    const rate = production.getProductionRate("miner");
    expect(rate.toNumber()).toBeCloseTo(2);
  });

  it("applies multiplier", () => {
    const { production } = setup();
    production.buy("miner");
    production.setMultiplier("miner", 3);
    expect(production.getProductionRate("miner").toNumber()).toBeCloseTo(3);
  });

  it("stacks multiple multiplier calls", () => {
    const { production } = setup();
    production.buy("miner");
    production.setMultiplier("miner", 2);
    production.setMultiplier("miner", 3);
    // 2 * 3 = 6x
    expect(production.getProductionRate("miner").toNumber()).toBeCloseTo(6);
  });

  it("stacks multiple global multiplier calls", () => {
    const { production } = setup();
    production.buy("miner");
    production.setGlobalMultiplier(2);
    production.setGlobalMultiplier(3);
    // 2 * 3 = 6x
    expect(production.getProductionRate("miner").toNumber()).toBeCloseTo(6);
  });

  it("prestige multiplier is separate from global", () => {
    const { production } = setup();
    production.buy("miner");
    production.setGlobalMultiplier(2);
    production.setPrestigeMultiplier(5);
    // 2 * 5 = 10x
    expect(production.getProductionRate("miner").toNumber()).toBeCloseTo(10);
  });

  it("resetMultipliers clears local and global but preserves prestige", () => {
    const { production } = setup();
    production.buy("miner");
    production.setMultiplier("miner", 4);
    production.setGlobalMultiplier(3);
    production.setPrestigeMultiplier(2);

    production.resetMultipliers();

    // Only prestige multiplier should remain: 1 * 1 * 2 = 2
    expect(production.getProductionRate("miner").toNumber()).toBeCloseTo(2);
  });
});
