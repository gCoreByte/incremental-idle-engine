import { describe, it, expect } from "vitest";
import { BigNumber } from "../core/BigNumber.js";
import { ResourceManager } from "./ResourceManager.js";

describe("ResourceManager", () => {
  it("registers and retrieves resources", () => {
    const rm = new ResourceManager();
    rm.register("gold", "Gold", BigNumber.fromNumber(100));
    expect(rm.get("gold").amount.toNumber()).toBeCloseTo(100);
  });

  it("adds to a resource", () => {
    const rm = new ResourceManager();
    rm.register("gold", "Gold");
    rm.add("gold", BigNumber.fromNumber(50));
    expect(rm.get("gold").amount.toNumber()).toBeCloseTo(50);
  });

  it("caps at max", () => {
    const rm = new ResourceManager();
    rm.register("gold", "Gold", BigNumber.ZERO, BigNumber.fromNumber(100));
    rm.add("gold", BigNumber.fromNumber(200));
    expect(rm.get("gold").amount.toNumber()).toBeCloseTo(100);
  });

  it("spends resource if affordable", () => {
    const rm = new ResourceManager();
    rm.register("gold", "Gold", BigNumber.fromNumber(100));
    expect(rm.spend("gold", BigNumber.fromNumber(60))).toBe(true);
    expect(rm.get("gold").amount.toNumber()).toBeCloseTo(40);
  });

  it("rejects spending if insufficient", () => {
    const rm = new ResourceManager();
    rm.register("gold", "Gold", BigNumber.fromNumber(10));
    expect(rm.spend("gold", BigNumber.fromNumber(50))).toBe(false);
    expect(rm.get("gold").amount.toNumber()).toBeCloseTo(10);
  });

  it("throws for unknown resource", () => {
    const rm = new ResourceManager();
    expect(() => rm.get("nope")).toThrow("Unknown resource: nope");
  });

  it("round-trips save data", () => {
    const rm = new ResourceManager();
    rm.register("gold", "Gold", BigNumber.fromNumber(42));
    const saved = rm.toSaveData();
    rm.reset("gold");
    expect(rm.get("gold").amount.isZero()).toBe(true);
    rm.loadSaveData(saved);
    expect(rm.get("gold").amount.toNumber()).toBeCloseTo(42);
  });
});
