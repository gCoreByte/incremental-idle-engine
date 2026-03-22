/**
 * Represents a large number using mantissa × 10^exponent notation.
 * Handles the extremely large values common in incremental games
 * without floating-point overflow.
 */
export class BigNumber {
  mantissa: number;
  exponent: number;

  static readonly ZERO = new BigNumber(0, 0);
  static readonly ONE = new BigNumber(1, 0);

  constructor(mantissa: number, exponent: number = 0) {
    if (mantissa === 0) {
      this.mantissa = 0;
      this.exponent = 0;
      return;
    }
    // Normalize: keep mantissa in [1, 10)
    this.mantissa = mantissa;
    this.exponent = exponent;
    this.normalize();
  }

  private normalize(): void {
    if (this.mantissa === 0) {
      this.exponent = 0;
      return;
    }
    while (Math.abs(this.mantissa) >= 10) {
      this.mantissa /= 10;
      this.exponent++;
    }
    while (Math.abs(this.mantissa) < 1) {
      this.mantissa *= 10;
      this.exponent--;
    }
  }

  static fromNumber(n: number): BigNumber {
    return new BigNumber(n);
  }

  add(other: BigNumber): BigNumber {
    if (this.mantissa === 0) return other;
    if (other.mantissa === 0) return this;

    const expDiff = this.exponent - other.exponent;

    if (expDiff > 15) return this;
    if (expDiff < -15) return other;

    const aligned = other.mantissa * Math.pow(10, other.exponent - this.exponent);
    return new BigNumber(this.mantissa + aligned, this.exponent);
  }

  subtract(other: BigNumber): BigNumber {
    return this.add(new BigNumber(-other.mantissa, other.exponent));
  }

  multiply(other: BigNumber): BigNumber {
    return new BigNumber(
      this.mantissa * other.mantissa,
      this.exponent + other.exponent,
    );
  }

  divide(other: BigNumber): BigNumber {
    if (other.mantissa === 0) throw new Error("Division by zero");
    return new BigNumber(
      this.mantissa / other.mantissa,
      this.exponent - other.exponent,
    );
  }

  gte(other: BigNumber): boolean {
    if (this.exponent !== other.exponent) return this.exponent > other.exponent;
    return this.mantissa >= other.mantissa;
  }

  gt(other: BigNumber): boolean {
    if (this.exponent !== other.exponent) return this.exponent > other.exponent;
    return this.mantissa > other.mantissa;
  }

  lte(other: BigNumber): boolean {
    return !this.gt(other);
  }

  lt(other: BigNumber): boolean {
    return !this.gte(other);
  }

  eq(other: BigNumber): boolean {
    return this.mantissa === other.mantissa && this.exponent === other.exponent;
  }

  isZero(): boolean {
    return this.mantissa === 0;
  }

  toNumber(): number {
    return this.mantissa * Math.pow(10, this.exponent);
  }

  /** Short display format: e.g. "1.50e6", "342", "1.2M" */
  format(notation: "scientific" | "suffix" = "suffix"): string {
    if (this.mantissa === 0) return "0";
    if (this.exponent < 3) {
      return this.toNumber().toFixed(this.exponent < 0 ? 2 : 0);
    }
    if (notation === "scientific") {
      return `${this.mantissa.toFixed(2)}e${this.exponent}`;
    }
    return formatWithSuffix(this.mantissa, this.exponent);
  }

  toJSON(): { mantissa: number; exponent: number } {
    return { mantissa: this.mantissa, exponent: this.exponent };
  }

  static fromJSON(data: { mantissa: number; exponent: number }): BigNumber {
    return new BigNumber(data.mantissa, data.exponent);
  }
}

const SUFFIXES = [
  "", "", "", "K", "K", "K", "M", "M", "M", "B", "B", "B",
  "T", "T", "T", "Qa", "Qa", "Qa", "Qi", "Qi", "Qi",
];

function formatWithSuffix(mantissa: number, exponent: number): string {
  if (exponent >= SUFFIXES.length) {
    return `${mantissa.toFixed(2)}e${exponent}`;
  }
  const suffix = SUFFIXES[exponent];
  const adjustedMantissa = mantissa * Math.pow(10, exponent % 3);
  return `${adjustedMantissa.toFixed(2)}${suffix}`;
}
