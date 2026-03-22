// Core
export { BigNumber } from "./core/BigNumber.js";
export { GameEngine } from "./core/GameEngine.js";
export type { GameEngineOptions } from "./core/GameEngine.js";
export type {
  TickableSystem,
  Resource,
  Generator,
  Upgrade,
  UpgradeEffect,
  SaveData,
} from "./core/types.js";

// Systems
export { ResourceManager } from "./systems/ResourceManager.js";
export { ProductionSystem } from "./systems/ProductionSystem.js";
export { UpgradeSystem } from "./systems/UpgradeSystem.js";
export {
  SaveSystem,
  localStorageAdapter,
  createMemoryAdapter,
} from "./systems/SaveSystem.js";
export type { SaveAdapter } from "./systems/SaveSystem.js";
export { StatisticsSystem } from "./systems/StatisticsSystem.js";
export type { StatSnapshot } from "./systems/StatisticsSystem.js";
export { PrestigeSystem } from "./systems/PrestigeSystem.js";
export type { PrestigeLayerConfig, PrestigeLayer } from "./systems/PrestigeSystem.js";
export { AchievementSystem } from "./systems/AchievementSystem.js";
export type {
  AchievementConfig,
  AchievementContext,
  AchievementReward,
  Achievement,
} from "./systems/AchievementSystem.js";
