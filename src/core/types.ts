import { BigNumber } from "./BigNumber.js";

/** Any system that can be ticked by the game engine */
export interface TickableSystem {
  tick(deltaSec: number): void;
}

/** A named resource with a current and optional max value */
export interface Resource {
  id: string;
  name: string;
  amount: BigNumber;
  max?: BigNumber;
}

/** A generator that produces resources over time */
export interface Generator {
  id: string;
  name: string;
  /** Resource ID this generator produces */
  resourceId: string;
  /** Base production per second per unit */
  baseRate: BigNumber;
  /** Number of this generator owned */
  count: BigNumber;
  /** Base cost of the next unit */
  baseCost: BigNumber;
  /** Cost multiplier per purchase (e.g. 1.15) */
  costMultiplier: number;
}

/** An upgrade that can be purchased once or has levels */
export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: BigNumber;
  /** Resource ID used to pay */
  costResourceId: string;
  maxLevel: number;
  currentLevel: number;
  /** What this upgrade affects — interpreted by the relevant system */
  effect: UpgradeEffect;
}

export type UpgradeEffect =
  | { type: "multiply_production"; generatorId: string; multiplier: number }
  | { type: "multiply_all_production"; multiplier: number }
  | { type: "reduce_cost"; generatorId: string; factor: number }
  | { type: "custom"; apply: () => void; remove: () => void };

/** Serializable game state snapshot */
export interface SaveData {
  version: number;
  timestamp: number;
  resources: Record<string, { amount: { mantissa: number; exponent: number }; max?: { mantissa: number; exponent: number } }>;
  generators: Record<string, { count: { mantissa: number; exponent: number } }>;
  upgrades: Record<string, { currentLevel: number }>;
  custom?: Record<string, unknown>;
}
