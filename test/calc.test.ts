import { describe, it, expect } from "vitest";
import { summarize, PARTNER_SPLIT } from "../src/lib/calc.js";
import { rupeesToPaisa, kgToGrams, formatPKR } from "../src/lib/money.js";
import type { Entry } from "../src/lib/types.js";

/**
 * GOLDEN NUMBERS — taken directly from Rice_Husk_Expenses.xlsx.
 * The engine must reproduce these to the paisa before any UI is built.
 *
 *   Rice Husk!C121  total expenses ........ 8,076,769.5
 *   Rice Husk!G121  husk purchases (G) .... 4,662,941.5   (= investment)
 *   Rice Husk!D121  petty cash ............   675,923
 *   Rice Husk!E121  labour ................   877,785
 *   Rice Husk!F121  transport/other ......  1,860,120
 *                   D+E+F+G == C  (the split reconciles)
 *   partnership!L28 sales received ........ 2,483,030
 *   Rice Husk!S     stock on hand ......... 291,150 kg
 *   Rice Husk!T5    stock @ Rs 17/kg ...... 4,949,550
 *   partner Azeem   5,000,000 - 4,038,384.75 = 961,615.25 remaining
 */
const G_HUSK = 4662941.5;
const G_PETTY = 675923;
const G_LABOUR = 877785;
const G_TRANSPORT = 1860120;
const G_TOTAL = 8076769.5;
const G_SALES_RECEIVED = 2483030;
const G_STOCK_KG = 291150;
const RATE_17 = 1700; // paisa per kg

/** A fixture whose aggregates equal the real sheet totals. */
function realisticLedger(): Entry[] {
  const out = (
    id: string,
    bucket: any,
    rupees: number,
    priority: "REQUIRED" | "EXTRA" = "REQUIRED",
    weightKg?: number
  ): Entry => ({
    id,
    date: "2025-11-30",
    direction: "OUT",
    bucket,
    amount: rupeesToPaisa(rupees),
    priority,
    source: "IMPORT",
    ...(weightKg ? { weight: kgToGrams(weightKg) } : {}),
  });

  return [
    // husk purchases (investment) — also bring in the stock that was bought
    out("h1", "HUSK_PURCHASE", 4000000, "REQUIRED", 400000),
    out("h2", "HUSK_PURCHASE", 662941.5, "REQUIRED", 0),
    // people / service charges
    out("p1", "PETTY_CASH", 675923, "EXTRA"), // tagged Extra for the req-5 test
    out("l1", "LABOUR", 877785, "REQUIRED"),
    out("t1", "TRANSPORT", 1860120, "REQUIRED"),
    // sales — sold some stock, partially received
    {
      id: "s1",
      date: "2025-12-17",
      direction: "IN",
      kind: "SALE",
      weight: kgToGrams(108850),
      billed: rupeesToPaisa(2700000),
      received: rupeesToPaisa(2483030),
      source: "IMPORT",
    },
    // partner capital
    {
      id: "c1",
      date: "2025-11-22",
      direction: "IN",
      kind: "CAPITAL",
      partner: "Azeem",
      amount: rupeesToPaisa(5000000),
      source: "IMPORT",
    },
    {
      id: "c2",
      date: "2026-04-01",
      direction: "IN",
      kind: "CAPITAL",
      partner: "Atiq",
      amount: rupeesToPaisa(1000000),
      source: "IMPORT",
    },
  ];
}

describe("engine reproduces the Rice Husk sheet", () => {
  const s = summarize(realisticLedger(), { ratePaisaPerKg: RATE_17 });

  it("splits expenses into buckets that reconcile to the total (D+E+F+G = C)", () => {
    expect(s.bucketTotals.HUSK_PURCHASE).toBe(rupeesToPaisa(G_HUSK));
    expect(s.bucketTotals.PETTY_CASH).toBe(rupeesToPaisa(G_PETTY));
    expect(s.bucketTotals.LABOUR).toBe(rupeesToPaisa(G_LABOUR));
    expect(s.bucketTotals.TRANSPORT).toBe(rupeesToPaisa(G_TRANSPORT));
    expect(s.totalExpenses).toBe(rupeesToPaisa(G_TOTAL));
    expect(s.investment + s.givenToPeople).toBe(s.totalExpenses);
  });

  it("treats husk purchases as the investment (sheet column G)", () => {
    expect(s.investment).toBe(rupeesToPaisa(G_HUSK));
  });

  it("totals money given to people as petty cash + labour + transport", () => {
    expect(s.givenToPeople).toBe(rupeesToPaisa(G_PETTY + G_LABOUR + G_TRANSPORT));
  });

  it("computes 'extra money' as the sum of EXTRA-priority outflow (req 5)", () => {
    expect(s.extraOutflow).toBe(rupeesToPaisa(G_PETTY));
    expect(s.requiredOutflow).toBe(
      rupeesToPaisa(G_HUSK + G_LABOUR + G_TRANSPORT)
    );
    expect(s.requiredOutflow + s.extraOutflow).toBe(s.totalExpenses);
  });

  it("tracks sales received and the outstanding receivable", () => {
    expect(s.salesReceived).toBe(rupeesToPaisa(G_SALES_RECEIVED));
    expect(s.receivable).toBe(rupeesToPaisa(2700000 - G_SALES_RECEIVED));
  });

  it("runs stock in kg and values it at the editable rate", () => {
    expect(s.kgOnHand).toBe(kgToGrams(G_STOCK_KG)); // 400000 bought - 108850 sold
    expect(s.stockValue).toBe(rupeesToPaisa(4949550));
  });

  it("re-values stock when the rate changes (Rs 17 -> Rs 18)", () => {
    const s18 = summarize(realisticLedger(), { ratePaisaPerKg: 1800 });
    expect(s18.stockValue).toBe(rupeesToPaisa(5240700));
  });
});

describe("partners are split 50/50 regardless of contribution", () => {
  const s = summarize(realisticLedger(), { ratePaisaPerKg: RATE_17 });
  const azeem = s.partners.find((p) => p.partner === "Azeem")!;
  const atiq = s.partners.find((p) => p.partner === "Atiq")!;

  it("uses a fixed divisor of 2", () => {
    expect(PARTNER_SPLIT).toBe(2);
    expect(azeem.expenseShare).toBe(atiq.expenseShare); // equal halves
  });

  it("each partner carries half of total expenses (sheet C2/2)", () => {
    expect(azeem.expenseShare).toBe(rupeesToPaisa(4038384.75));
    expect(azeem.expenseShare + atiq.expenseShare).toBe(s.totalExpenses);
  });

  it("capital remaining = capital - half expenses (sheet: 5,000,000 - 4,038,384.75)", () => {
    expect(azeem.netCapital).toBe(rupeesToPaisa(5000000));
    expect(azeem.capitalRemaining).toBe(rupeesToPaisa(961615.25));
  });
});

describe("purchase-and-sale headline position", () => {
  it("counts unsold stock as value, so mid-cycle is not a phantom loss", () => {
    const s = summarize(realisticLedger(), { ratePaisaPerKg: RATE_17 });
    // received 2,483,030 + stock 4,949,550 - expenses 8,076,769.5
    expect(s.position).toBe(rupeesToPaisa(2483030 + 4949550 - 8076769.5));
    // a quick human-readable sanity print
    expect(formatPKR(s.stockValue)).toContain("4,949,550");
  });
});
