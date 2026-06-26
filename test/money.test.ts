import { describe, it, expect } from "vitest";
import {
  rupeesToPaisa,
  paisaToRupees,
  sumPaisa,
  halve,
  valueAtRate,
  mundToGrams,
  kgToGrams,
  gramsToKg,
} from "../src/lib/money.js";

describe("money: exactness", () => {
  it("has no floating-point drift on the classic 0.1 + 0.2 case", () => {
    const sum = sumPaisa([rupeesToPaisa(0.1), rupeesToPaisa(0.2)]);
    expect(sum).toBe(30); // 30 paisa, exactly
    expect(paisaToRupees(sum)).toBe(0.3);
  });

  it("represents quarter-rupee sheet values exactly", () => {
    expect(rupeesToPaisa(4038384.75)).toBe(403838475);
    expect(paisaToRupees(403838475)).toBe(4038384.75);
    expect(rupeesToPaisa(8076769.5)).toBe(807676950);
  });

  it("halve() preserves the total to the paisa, odd paisa to first share", () => {
    const [a, b] = halve(807676951); // odd
    expect(a + b).toBe(807676951);
    expect(a - b).toBe(1);
  });
});

describe("weight + valuation", () => {
  it("converts mund -> grams using 1 mund = 40 kg", () => {
    expect(mundToGrams(1)).toBe(40_000);
    expect(gramsToKg(mundToGrams(585.1))).toBe(23404); // sheet: 585.1*40
  });

  it("values stock at the editable rate (sheet: 291,150 kg @ 17 = 4,949,550)", () => {
    const grams = kgToGrams(291150);
    expect(valueAtRate(grams, 1700)).toBe(rupeesToPaisa(4949550));
    // Sheet2 uses Rs 18/kg instead — rate is editable, value follows.
    expect(valueAtRate(grams, 1800)).toBe(rupeesToPaisa(5240700));
  });
});
