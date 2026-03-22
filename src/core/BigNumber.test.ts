import { describe, it, expect } from "vitest";
import { BigNumber } from "./BigNumber.js";

describe("BigNumber", () => {
  it("normalizes on construction", () => {
    const n = new BigNumber(150, 0);
    expect(n.mantissa).toBeCloseTo(1.5);
    expect(n.exponent).toBe(2);
  });

  it("handles zero", () => {
    const z = new BigNumber(0, 99);
    expect(z.mantissa).toBe(0);
    expect(z.exponent).toBe(0);
    expect(z.isZero()).toBe(true);
  });

  it("adds two numbers", () => {
    const a = new BigNumber(1, 3); // 1000
    const b = new BigNumber(5, 2); // 500
    const sum = a.add(b);
    expect(sum.toNumber()).toBeCloseTo(1500);
  });

  it("subtracts two numbers", () => {
    const a = new BigNumber(1, 3);
    const b = new BigNumber(2, 2);
    const diff = a.subtract(b);
    expect(diff.toNumber()).toBeCloseTo(800);
  });

  it("multiplies two numbers", () => {
    const a = new BigNumber(3, 2); // 300
    const b = new BigNumber(2, 1); // 20
    const product = a.multiply(b);
    expect(product.toNumber()).toBeCloseTo(6000);
  });

  it("divides two numbers", () => {
    const a = new BigNumber(6, 3); // 6000
    const b = new BigNumber(2, 1); // 20
    const quotient = a.divide(b);
    expect(quotient.toNumber()).toBeCloseTo(300);
  });

  it("throws on divide by zero", () => {
    expect(() => BigNumber.ONE.divide(BigNumber.ZERO)).toThrow("Division by zero");
  });

  it("compares correctly", () => {
    const a = new BigNumber(5, 3);
    const b = new BigNumber(3, 3);
    expect(a.gt(b)).toBe(true);
    expect(a.gte(b)).toBe(true);
    expect(b.lt(a)).toBe(true);
    expect(b.lte(a)).toBe(true);
    expect(a.eq(a)).toBe(true);
  });

  it("compares across exponents", () => {
    const a = new BigNumber(1, 6);
    const b = new BigNumber(9, 5);
    expect(a.gt(b)).toBe(true);
  });

  it("formats with suffix", () => {
    expect(new BigNumber(1.5, 6).format("suffix")).toBe("1.50M");
    expect(new BigNumber(1, 0).format("suffix")).toBe("1");
    expect(new BigNumber(5, 2).format("suffix")).toBe("500");
  });

  it("formats scientific", () => {
    expect(new BigNumber(1.5, 6).format("scientific")).toBe("1.50e6");
  });

  it("round-trips through JSON", () => {
    const n = new BigNumber(3.14, 42);
    const restored = BigNumber.fromJSON(n.toJSON());
    expect(restored.mantissa).toBe(n.mantissa);
    expect(restored.exponent).toBe(n.exponent);
  });

  it("fromNumber handles regular numbers", () => {
    const n = BigNumber.fromNumber(42000);
    expect(n.toNumber()).toBeCloseTo(42000);
  });
});
