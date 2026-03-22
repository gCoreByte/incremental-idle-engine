# incremental-idle-engine

A zero-dependency TypeScript library for building incremental, idle, and AFK games. Handles the core engine, big number math, resource management, production, upgrades, and save/load. You bring the theme and UI.

## Install

```bash
npm install incremental-idle-engine
```

## Quick Start

```typescript
import {
  GameEngine,
  ResourceManager,
  ProductionSystem,
  UpgradeSystem,
  SaveSystem,
  BigNumber,
  localStorageAdapter,
} from "incremental-idle-engine";

// 1. Set up systems
const resources = new ResourceManager();
const production = new ProductionSystem(resources);
const upgrades = new UpgradeSystem(resources, production);
const engine = new GameEngine({ tickInterval: 100 });

// 2. Define your game content
resources.register("gold", "Gold");

production.register({
  id: "miner",
  name: "Miner",
  resourceId: "gold",
  baseRate: BigNumber.fromNumber(1),   // 1 gold/sec per miner
  baseCost: BigNumber.fromNumber(10),  // first miner costs 10 gold
  costMultiplier: 1.15,                // each subsequent miner costs 15% more
});

upgrades.register({
  id: "pickaxe",
  name: "Better Pickaxe",
  description: "Miners produce 2x gold",
  cost: BigNumber.fromNumber(100),
  costResourceId: "gold",
  effect: { type: "multiply_production", generatorId: "miner", multiplier: 2 },
});

// 3. Wire up saving (optional)
const save = new SaveSystem(engine, resources, production, upgrades, localStorageAdapter);
save.load(); // restore previous session + offline progress

// 4. Register tickable systems and start
engine.addSystem(production);
engine.start();
```

## Core Concepts

### BigNumber

Mantissa × 10^exponent representation for the huge numbers. All resource amounts and costs use this type.

```typescript
const n = BigNumber.fromNumber(1500);
const big = new BigNumber(1.5, 12); // 1.5 × 10^12

big.format("suffix");     // "1.50T"
big.format("scientific"); // "1.50e12"

// Arithmetic (returns new instances)
const sum = a.add(b);
const diff = a.subtract(b);
const product = a.multiply(b);
const quotient = a.divide(b);

// Comparison
a.gt(b);  a.gte(b);  a.lt(b);  a.lte(b);  a.eq(b);
```

### GameEngine

The main game loop. Runs at a configurable interval (default 10 ticks/sec), caps delta time to prevent spiral-of-death and processes offline time on restart.

```typescript
const engine = new GameEngine({
  tickInterval: 100,          // ms between ticks (default: 100)
  maxDeltaTime: 5000,         // cap per-tick delta (default: 5000ms)
  processOfflineTime: true,   // catch up on missed time (default: true)
});

engine.addSystem(production); // any object with tick(deltaSec: number)
engine.start();
engine.stop();
```

### ResourceManager

Named resource (currency) registry. Add, spend, and optionally cap at a maximum.

```typescript
resources.register("gems", "Gems", BigNumber.ZERO, BigNumber.fromNumber(1000)); // max 1000

resources.add("gems", BigNumber.fromNumber(50));
resources.canAfford("gems", BigNumber.fromNumber(30)); // true
resources.spend("gems", BigNumber.fromNumber(30));      // true, deducts; false if insufficient
```

### ProductionSystem

Manages generators that produce resources each tick. Costs scale exponentially.

```typescript
production.register({
  id: "farm",
  name: "Farm",
  resourceId: "food",
  baseRate: BigNumber.fromNumber(5),
  baseCost: BigNumber.fromNumber(50),
  costMultiplier: 1.12,
});

production.buy("farm");                           // purchase one, deducts cost from resource
production.getNextCost("farm");                   // cost of the next unit
production.getProductionRate("farm");             // current output/sec for this generator
production.getTotalProductionRate("food");        // total output/sec across all generators
production.setMultiplier("farm", 3);              // 3x production for farms
production.setGlobalMultiplier(2);                // 2x production for everything
```

### UpgradeSystem

One-time or multi-level purchases that modify production or run custom effects.

```typescript
upgrades.register({
  id: "double-all",
  name: "Double Everything",
  description: "All production ×2",
  cost: BigNumber.fromNumber(5000),
  costResourceId: "gold",
  effect: { type: "multiply_all_production", multiplier: 2 },
});

// Effect types:
// { type: "multiply_production", generatorId: "miner", multiplier: 2 }
// { type: "multiply_all_production", multiplier: 2 }
// { type: "reduce_cost", generatorId: "miner", factor: 0.9 }
// { type: "custom", apply: () => { ... }, remove: () => { ... } }

upgrades.canPurchase("double-all"); // true if affordable and not maxed
upgrades.purchase("double-all");    // buy it
```

### SaveSystem

Saves and loads full game state. Storage backend is pluggable.

```typescript
import { SaveSystem, localStorageAdapter, createMemoryAdapter } from "incremental-idle-engine";

// Browser: uses localStorage
const save = new SaveSystem(engine, resources, production, upgrades, localStorageAdapter);

// Tests / server: in-memory store
const save = new SaveSystem(engine, resources, production, upgrades, createMemoryAdapter());

save.save();              // persist current state
save.load();              // restore state + set offline timestamp
save.deleteSave();        // wipe saved data
save.exportSave();        // base64-encoded string for sharing
save.importSave(str);     // restore from base64 string
```

### StatisticsSystem

Tracks all-time totals (earned, spent, time played, peak rates). Useful for prestige formulas and achievement conditions.

```typescript
import { StatisticsSystem } from "incremental-idle-engine";

const statistics = new StatisticsSystem();

// Auto-track all resource changes (call once during setup)
statistics.wrapResourceManager(resources);

// Plug in production rate sampling
statistics.setProductionRateSampler(() => ({
  gold: production.getTotalProductionRate("gold"),
}));

// Register with engine so it tracks time and samples rates
engine.addSystem(statistics);

// Read stats
statistics.getTotalEarned("gold");          // all-time gold earned (BigNumber)
statistics.getTotalSpent("gold");           // all-time gold spent
statistics.timePlayed;                      // total seconds across all sessions
statistics.timeThisRun;                     // seconds since last prestige
statistics.totalResets;                     // number of prestige resets
statistics.getPeakProductionRate("gold");   // highest gold/sec ever seen

// Custom counters for game-specific tracking
statistics.incrementCounter("clicks");
statistics.getCounter("clicks");
```

### PrestigeSystem

Converts run progress into permanent prestige currency.

```typescript
import { PrestigeSystem } from "incremental-idle-engine";

// Register the prestige currency as a resource
resources.register("prestige_points", "Prestige Points");

const prestige = new PrestigeSystem(resources, production, statistics);

prestige.registerLayer({
  id: "prestige",
  name: "Prestige",
  currencyId: "prestige_points",
  // Formula: earn 1 PP per 1000 total gold earned this run
  formula: (stats) => stats.getTotalEarned("gold").divide(BigNumber.fromNumber(1000)),
  minimumGain: BigNumber.ONE,       // block resets that would gain < 1 PP
  resetResourceIds: ["gold"],       // zero these on prestige
  resetGeneratorIds: ["miner"],     // zero these on prestige
  onReset: () => {                  // custom cleanup
    // reset upgrades, clear buffs, etc.
  },
});

prestige.getPrestigeGain("prestige");     // preview PP gain without resetting
prestige.canPrestige("prestige");         // true if gain >= minimum
prestige.prestige("prestige");            // perform the reset, returns gain or null
prestige.getPrestigeMultiplier("prestige"); // 1 + prestige currency amount
```

### AchievementSystem

Milestones are checked each tick.

```typescript
import { AchievementSystem } from "incremental-idle-engine";

const achievements = new AchievementSystem(resources, production, statistics);

achievements.register({
  id: "first_1000",
  name: "Thousandaire",
  description: "Accumulate 1,000 gold",
  condition: (ctx) => ctx.resources.get("gold").amount.gte(BigNumber.fromNumber(1000)),
  reward: { type: "multiply_production", generatorId: "miner", multiplier: 1.5 },
});

achievements.register({
  id: "prestige_once",
  name: "New Beginnings",
  description: "Perform your first prestige",
  condition: (ctx) => ctx.statistics.totalResets >= 1,
});

// Notification callback
achievements.setOnUnlock((a) => console.log(`Achievement unlocked: ${a.name}`));

// Register with engine
engine.addSystem(achievements);

// After loading a save, re-apply rewards from already-unlocked achievements
achievements.loadSaveData(savedData);
achievements.reapplyRewards();

// Query
achievements.getUnlocked();   // Achievement[]
achievements.getLocked();      // Achievement[]
achievements.forceUnlock(id);  // bypass condition check
```

### Custom Systems

Implement `TickableSystem` to add your own logic to the game loop:

```typescript
import { TickableSystem } from "incremental-idle-engine";

class EventSystem implements TickableSystem {
  private elapsed = 0;

  tick(deltaSec: number) {
    this.elapsed += deltaSec;
    if (this.elapsed >= 60) {
      this.elapsed = 0;
      // trigger a random event every 60 seconds
    }
  }
}

engine.addSystem(new EventSystem());
```

## Future Ideas

Potential systems to add. Nothing committed, just a parking lot.

| Idea | Description |
|------|-------------|
| Buff / Modifier Stack | Composable temporary and permanent multipliers. "2x production for 30 seconds" stacking with a 1.5x from an upgrade. Needs stacking rules (additive vs multiplicative), expiry tracking, and tick integration. Would replace the current simple per-generator multiplier in ProductionSystem. |
| Auto-Buyers | Automatically purchase generators/upgrades when affordable. Configurable priority, toggle on/off, and purchase frequency. Usually unlocked mid-to-late game as a reward. Should be a TickableSystem that runs after ProductionSystem each tick. |
| Timed Events / Cooldowns | Random or scheduled events (e.g. "golden cookie"), active abilities with cooldowns ("click to boost production for 10s"), timed challenges with deadlines. Needs an event scheduler, cooldown tracker, and callback system. |
| Research / Tech Tree | Branching upgrade paths where choices are mutually exclusive. Adds strategic depth beyond linear upgrades. Needs a DAG structure for prerequisites, unlock conditions, and a way to visualize the tree shape. |
| Automation / Scripting Hooks | Let games define rules like "when gold > 1000, buy a miner." A lightweight condition-action system that runs each tick. Different from auto-buyers in that it's user/game-configurable rather than hardcoded. |

## Development

```bash
npm install
npm run build         # compile to dist/
npm run dev           # watch mode
npm test              # run tests
npm run test:watch    # tests in watch mode
npm run lint          # eslint
npm run typecheck     # type-check without emitting
```

## License

MIT
