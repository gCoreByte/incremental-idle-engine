import { describe, it, expect } from "vitest";
import { BigNumber } from "../core/BigNumber.js";
import { ResourceManager } from "./ResourceManager.js";
import { StatisticsSystem } from "./StatisticsSystem.js";

describe("StatisticsSystem", () => {
  it("tracks time played across ticks", () => {
    const stats = new StatisticsSystem();
    stats.tick(1.5);
    stats.tick(2.5);
    expect(stats.timePlayed).toBeCloseTo(4);
  });

  it("tracks time this run and resets on prestige", () => {
    const stats = new StatisticsSystem();
    stats.tick(10);
    expect(stats.timeThisRun).toBeCloseTo(10);
    stats.recordReset();
    expect(stats.timeThisRun).toBe(0);
    expect(stats.timePlayed).toBeCloseTo(10); // total doesn't reset
  });

  it("records earned and spent", () => {
    const stats = new StatisticsSystem();
    stats.recordEarned("gold", BigNumber.fromNumber(100));
    stats.recordEarned("gold", BigNumber.fromNumber(50));
    stats.recordSpent("gold", BigNumber.fromNumber(30));

    expect(stats.getTotalEarned("gold").toNumber()).toBeCloseTo(150);
    expect(stats.getTotalSpent("gold").toNumber()).toBeCloseTo(30);
  });

  it("returns zero for untracked resources", () => {
    const stats = new StatisticsSystem();
    expect(stats.getTotalEarned("gems").isZero()).toBe(true);
    expect(stats.getTotalSpent("gems").isZero()).toBe(true);
    expect(stats.getPeakProductionRate("gems").isZero()).toBe(true);
  });

  it("tracks total resets", () => {
    const stats = new StatisticsSystem();
    stats.recordReset();
    stats.recordReset();
    expect(stats.totalResets).toBe(2);
  });

  it("tracks peak production rate", () => {
    const stats = new StatisticsSystem();
    let rate = BigNumber.fromNumber(10);
    stats.setProductionRateSampler(() => ({ gold: rate }));

    stats.tick(1);
    expect(stats.getPeakProductionRate("gold").toNumber()).toBeCloseTo(10);

    rate = BigNumber.fromNumber(50);
    stats.tick(1);
    expect(stats.getPeakProductionRate("gold").toNumber()).toBeCloseTo(50);

    // Lower rate shouldn't replace peak
    rate = BigNumber.fromNumber(5);
    stats.tick(1);
    expect(stats.getPeakProductionRate("gold").toNumber()).toBeCloseTo(50);
  });

  it("increments and reads counters", () => {
    const stats = new StatisticsSystem();
    stats.incrementCounter("clicks", 5);
    stats.incrementCounter("clicks");
    expect(stats.getCounter("clicks")).toBe(6);
    expect(stats.getCounter("unknown")).toBe(0);
  });

  it("wraps ResourceManager for automatic tracking", () => {
    const stats = new StatisticsSystem();
    const rm = new ResourceManager();
    rm.register("gold", "Gold", BigNumber.fromNumber(100));

    stats.wrapResourceManager(rm);

    rm.add("gold", BigNumber.fromNumber(50));
    expect(stats.getTotalEarned("gold").toNumber()).toBeCloseTo(50);

    rm.spend("gold", BigNumber.fromNumber(30));
    expect(stats.getTotalSpent("gold").toNumber()).toBeCloseTo(30);

    // Failed spend should not be tracked
    rm.spend("gold", BigNumber.fromNumber(99999));
    expect(stats.getTotalSpent("gold").toNumber()).toBeCloseTo(30);
  });

  it("round-trips through save data", () => {
    const stats = new StatisticsSystem();
    stats.recordEarned("gold", BigNumber.fromNumber(500));
    stats.recordSpent("gold", BigNumber.fromNumber(100));
    stats.recordReset();
    stats.tick(42);
    stats.incrementCounter("clicks", 7);

    const saved = stats.toSaveData();

    const stats2 = new StatisticsSystem();
    stats2.loadSaveData(saved);

    expect(stats2.getTotalEarned("gold").toNumber()).toBeCloseTo(500);
    expect(stats2.getTotalSpent("gold").toNumber()).toBeCloseTo(100);
    expect(stats2.totalResets).toBe(1);
    expect(stats2.timePlayed).toBeCloseTo(42);
    expect(stats2.getCounter("clicks")).toBe(7);
  });
});
