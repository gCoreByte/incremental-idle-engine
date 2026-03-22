import { TickableSystem } from "./types.js";

export interface GameEngineOptions {
  /** Tick interval in milliseconds. Default: 100 (10 ticks/sec) */
  tickInterval?: number;
  /** Maximum delta time (ms) to process in a single tick. Prevents spiral-of-death. Default: 5000 */
  maxDeltaTime?: number;
  /** Whether to process offline time on start. Default: true */
  processOfflineTime?: boolean;
}

/**
 * Central game loop that drives all registered systems.
 * Manages tick timing, offline progress, and system registration.
 */
export class GameEngine {
  private systems: TickableSystem[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;
  private readonly tickInterval: number;
  private readonly maxDeltaTime: number;
  readonly processOfflineTime: boolean;

  constructor(options: GameEngineOptions = {}) {
    this.tickInterval = options.tickInterval ?? 100;
    this.maxDeltaTime = options.maxDeltaTime ?? 5000;
    this.processOfflineTime = options.processOfflineTime ?? true;
  }

  /** Register a system to receive tick updates */
  addSystem(system: TickableSystem): void {
    this.systems.push(system);
  }

  /** Remove a previously registered system */
  removeSystem(system: TickableSystem): void {
    const idx = this.systems.indexOf(system);
    if (idx !== -1) this.systems.splice(idx, 1);
  }

  /** Start the game loop */
  start(): void {
    if (this.intervalId !== null) return;

    const now = Date.now();
    if (this.lastTickTime > 0 && this.processOfflineTime) {
      const offlineDelta = now - this.lastTickTime;
      this.processElapsed(offlineDelta);
    }
    this.lastTickTime = now;

    this.intervalId = setInterval(() => this.tick(), this.tickInterval);
  }

  /** Stop the game loop */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.lastTickTime = Date.now();
  }

  /** Process a single tick */
  private tick(): void {
    const now = Date.now();
    const deltaMs = Math.min(now - this.lastTickTime, this.maxDeltaTime);
    this.lastTickTime = now;
    this.processElapsed(deltaMs);
  }

  /** Process elapsed time across all systems. deltaMs in milliseconds. */
  processElapsed(deltaMs: number): void {
    const deltaSec = deltaMs / 1000;
    for (const system of this.systems) {
      system.tick(deltaSec);
    }
  }

  /** Get the timestamp of the last tick (for save/load offline calc) */
  getLastTickTime(): number {
    return this.lastTickTime;
  }

  /** Set last tick time (used when loading a save) */
  setLastTickTime(time: number): void {
    this.lastTickTime = time;
  }

  get isRunning(): boolean {
    return this.intervalId !== null;
  }
}
