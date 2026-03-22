import { BigNumber } from "../core/BigNumber.js";
import { ResourceManager } from "./ResourceManager.js";
import { ProductionSystem } from "./ProductionSystem.js";
import { StatisticsSystem } from "./StatisticsSystem.js";

export interface PrestigeLayerConfig {
  id: string;
  name: string;
  /** Resource ID for the prestige currency (must be registered in ResourceManager) */
  currencyId: string;
  /**
   * Calculate the total prestige currency deserved based on lifetime stats.
   * The system awards only the net new gain (formula result minus already awarded).
   */
  formula: (stats: StatisticsSystem) => BigNumber;
  /**
   * Minimum prestige currency gain required to allow a reset.
   * Prevents resets that would gain nothing. Default: 1
   */
  minimumGain?: BigNumber;
  /**
   * Called during reset to clear run-specific state.
   * The system automatically resets resources and generators listed in `resetResourceIds`
   * and `resetGeneratorIds`. Use this callback for anything extra.
   */
  onReset?: () => void;
  /** Resource IDs to reset to zero on prestige */
  resetResourceIds: string[];
  /** Generator IDs to reset count to zero on prestige */
  resetGeneratorIds: string[];
}

export interface PrestigeLayer extends PrestigeLayerConfig {
  totalResets: number;
  /** Total prestige currency ever awarded from this layer (used to calculate net gain) */
  totalAwarded: BigNumber;
}

/**
 * Manages prestige (soft-reset) mechanics. Supports multiple independent
 * prestige layers for games with layered reset systems.
 *
 * Flow: player triggers prestige → formula calculates total deserved reward →
 * net new gain is awarded → resources/generators/multipliers are reset →
 * prestige multiplier is applied → onReset callback fires.
 */
export class PrestigeSystem {
  private layers = new Map<string, PrestigeLayer>();

  constructor(
    private resources: ResourceManager,
    private production: ProductionSystem,
    private statistics: StatisticsSystem,
  ) {}

  registerLayer(config: PrestigeLayerConfig): PrestigeLayer {
    const layer: PrestigeLayer = {
      ...config,
      minimumGain: config.minimumGain ?? BigNumber.ONE,
      totalResets: 0,
      totalAwarded: BigNumber.ZERO,
    };
    this.layers.set(config.id, layer);
    return layer;
  }

  getLayer(id: string): PrestigeLayer {
    const layer = this.layers.get(id);
    if (!layer) throw new Error(`Unknown prestige layer: ${id}`);
    return layer;
  }

  getAllLayers(): PrestigeLayer[] {
    return [...this.layers.values()];
  }

  /**
   * Preview how much prestige currency would be gained without actually resetting.
   * Returns the net new gain (formula result minus already awarded), floored to zero.
   */
  getPrestigeGain(layerId: string): BigNumber {
    const layer = this.getLayer(layerId);
    const total = layer.formula(this.statistics);
    const net = total.subtract(layer.totalAwarded);
    return net.lt(BigNumber.ZERO) ? BigNumber.ZERO : net;
  }

  /** Check if a prestige reset is possible (gain meets minimum threshold) */
  canPrestige(layerId: string): boolean {
    const layer = this.getLayer(layerId);
    const gain = this.getPrestigeGain(layerId);
    return gain.gte(layer.minimumGain!);
  }

  /**
   * Perform a prestige reset. Returns the amount of prestige currency gained,
   * or null if the reset was blocked (gain below minimum).
   */
  prestige(layerId: string): BigNumber | null {
    const layer = this.getLayer(layerId);
    const gain = this.getPrestigeGain(layerId);

    if (!gain.gte(layer.minimumGain!)) return null;

    // Track total awarded so future gains are only the net new amount
    layer.totalAwarded = layer.totalAwarded.add(gain);

    // Award prestige currency
    this.resources.add(layer.currencyId, gain);

    // Reset resources
    for (const resId of layer.resetResourceIds) {
      this.resources.reset(resId);
    }

    // Reset generators
    for (const genId of layer.resetGeneratorIds) {
      try {
        const gen = this.production.get(genId);
        gen.count = BigNumber.ZERO;
      } catch {
        // Generator might not exist, skip
      }
    }

    // Reset upgrade multipliers (prestige multiplier is preserved)
    this.production.resetMultipliers();

    layer.totalResets++;
    this.statistics.recordReset();

    // Apply prestige multiplier to production
    this.applyPrestigeMultiplier();

    // Fire custom reset callback
    layer.onReset?.();

    return gain;
  }

  /**
   * Get the prestige multiplier for a layer.
   * Common pattern: multiplier = 1 + prestigeCurrency.
   * Override this by subclassing or by reading the currency directly.
   */
  getPrestigeMultiplier(layerId: string): BigNumber {
    const layer = this.getLayer(layerId);
    const currency = this.resources.get(layer.currencyId);
    return BigNumber.ONE.add(currency.amount);
  }

  /**
   * Apply the combined prestige multiplier from all layers to production.
   * Called automatically after prestige and loadSaveData.
   */
  applyPrestigeMultiplier(): void {
    let combined = 1;
    for (const layer of this.layers.values()) {
      const currency = this.resources.get(layer.currencyId);
      combined *= 1 + currency.amount.toNumber();
    }
    this.production.setPrestigeMultiplier(combined);
  }

  toSaveData(): Record<string, { totalResets: number; totalAwarded: { mantissa: number; exponent: number } }> {
    const data: Record<string, { totalResets: number; totalAwarded: { mantissa: number; exponent: number } }> = {};
    for (const [id, layer] of this.layers) {
      data[id] = {
        totalResets: layer.totalResets,
        totalAwarded: layer.totalAwarded.toJSON(),
      };
    }
    return data;
  }

  loadSaveData(data: Record<string, { totalResets: number; totalAwarded?: { mantissa: number; exponent: number } }>): void {
    for (const [id, saved] of Object.entries(data)) {
      const layer = this.layers.get(id);
      if (layer) {
        layer.totalResets = saved.totalResets;
        layer.totalAwarded = saved.totalAwarded
          ? BigNumber.fromJSON(saved.totalAwarded)
          : BigNumber.ZERO;
      }
    }
    // Re-apply prestige multiplier from loaded currency amounts
    this.applyPrestigeMultiplier();
  }
}
