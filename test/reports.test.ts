import { describe, it, expect } from "vitest";
import { summarize } from "../src/lib/calc.js";
import { rupeesToPaisa, kgToGrams } from "../src/lib/money.js";
import type { Entry } from "../src/lib/types.js";

/** Mirrors what getEntries({ fromDate, toDate }) does in the DB layer. */
function filterByDate(entries: Entry[], from?: string, to?: string): Entry[] {
  return entries.filter((e) => {
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    return true;
  });
}

function makeEntries(): Entry[] {
  return [
    {
      id: "e1",
      date: "2025-11-01",
      direction: "OUT",
      bucket: "HUSK_PURCHASE",
      amount: rupeesToPaisa(100000),
      priority: "REQUIRED",
      source: "IMPORT",
    },
    {
      id: "e2",
      date: "2025-12-15",
      direction: "OUT",
      bucket: "PETTY_CASH",
      amount: rupeesToPaisa(20000),
      priority: "EXTRA",
      source: "IMPORT",
    },
    {
      id: "e3",
      date: "2026-01-10",
      direction: "IN",
      kind: "SALE",
      weight: kgToGrams(5000),
      billed: rupeesToPaisa(90000),
      received: rupeesToPaisa(75000),
      source: "IMPORT",
    },
    {
      id: "e4",
      date: "2026-02-20",
      direction: "OUT",
      bucket: "LABOUR",
      amount: rupeesToPaisa(30000),
      priority: "REQUIRED",
      source: "IMPORT",
    },
    {
      id: "e5",
      date: "2026-03-05",
      direction: "IN",
      kind: "CAPITAL",
      partner: "Azeem",
      amount: rupeesToPaisa(500000),
      source: "IMPORT",
    },
  ] as Entry[];
}

describe("report date filtering", () => {
  it("returns all entries when no date filter applied", () => {
    const all = filterByDate(makeEntries());
    expect(all).toHaveLength(5);
  });

  it("filters to a closed date range inclusive on both ends", () => {
    const filtered = filterByDate(makeEntries(), "2025-12-01", "2026-01-31");
    // only e2 (2025-12-15) and e3 (2026-01-10) fall in range
    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.id)).toEqual(["e2", "e3"]);
  });

  it("summarize() on a filtered range gives correct subset totals", () => {
    // filter to Dec 2025 only → just the PETTY_CASH EXTRA entry
    const filtered = filterByDate(makeEntries(), "2025-12-01", "2025-12-31");
    expect(filtered).toHaveLength(1);

    const s = summarize(filtered, { ratePaisaPerKg: 1700 });
    expect(s.totalExpenses).toBe(rupeesToPaisa(20000));
    expect(s.bucketTotals.PETTY_CASH).toBe(rupeesToPaisa(20000));
    expect(s.bucketTotals.HUSK_PURCHASE).toBe(0);
    expect(s.extraOutflow).toBe(rupeesToPaisa(20000));
    expect(s.requiredOutflow).toBe(0);
    expect(s.salesBilled).toBe(0);
    expect(s.salesReceived).toBe(0);
    expect(s.kgOnHand).toBe(0);
    expect(s.partners).toHaveLength(0);
  });
});
