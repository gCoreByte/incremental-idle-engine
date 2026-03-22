import { describe, it, expect, vi } from "vitest";
import { GameEngine } from "./GameEngine.js";
import { TickableSystem } from "./types.js";

describe("GameEngine", () => {
  it("registers and ticks systems", () => {
    const engine = new GameEngine();
    const system: TickableSystem = { tick: vi.fn() };
    engine.addSystem(system);
    engine.processElapsed(1000); // 1 second
    expect(system.tick).toHaveBeenCalledWith(1);
  });

  it("removes systems", () => {
    const engine = new GameEngine();
    const system: TickableSystem = { tick: vi.fn() };
    engine.addSystem(system);
    engine.removeSystem(system);
    engine.processElapsed(1000);
    expect(system.tick).not.toHaveBeenCalled();
  });

  it("starts and stops", () => {
    const engine = new GameEngine({ tickInterval: 50 });
    expect(engine.isRunning).toBe(false);
    engine.start();
    expect(engine.isRunning).toBe(true);
    engine.stop();
    expect(engine.isRunning).toBe(false);
  });

  it("tracks last tick time", () => {
    const engine = new GameEngine();
    engine.setLastTickTime(12345);
    expect(engine.getLastTickTime()).toBe(12345);
  });
});
