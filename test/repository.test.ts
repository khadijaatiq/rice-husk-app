import { describe, it, expect } from "vitest";
import { mapDbEntry, type DbRow } from "../src/lib/entry-map.js";
import { isOut, isSale, isCapital, isCapitalReturn } from "../src/lib/types.js";

// Minimal factory so each test only overrides what it cares about.
const base: DbRow = {
  id: "test-id",
  date: new Date("2025-11-30T00:00:00.000Z"),
  direction: "OUT",
  kind: "HUSK_PURCHASE",
  bucket: "HUSK_PURCHASE",
  priority: "REQUIRED",
  amount: BigInt(400000000), // 4,000,000.00 Rs in paisa
  billed: null,
  received: null,
  weight: BigInt(400000000), // 400,000 kg in grams
  counterparty: null,
  partner: null,
  paymentSource: null,
  note: null,
  source: "MANUAL",
  importBatchId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("mapDbEntry: BigInt → number conversion", () => {
  it("converts amount BigInt to a plain number (paisa)", () => {
    const e = mapDbEntry(base);
    expect(isOut(e)).toBe(true);
    if (isOut(e)) {
      expect(typeof e.amount).toBe("number");
      expect(e.amount).toBe(400000000);
    }
  });

  it("converts weight BigInt to a plain number (grams)", () => {
    const e = mapDbEntry(base);
    if (isOut(e)) {
      expect(typeof e.weight).toBe("number");
      expect(e.weight).toBe(400000000); // 400,000 kg in grams
    }
  });
});

describe("mapDbEntry: date formatting", () => {
  it("formats DateTime as yyyy-mm-dd string", () => {
    const e = mapDbEntry(base);
    expect(e.date).toBe("2025-11-30");
  });

  it("works for any date", () => {
    const e = mapDbEntry({ ...base, date: new Date("2026-04-01T00:00:00.000Z") });
    expect(e.date).toBe("2026-04-01");
  });
});

describe("mapDbEntry: HUSK_PURCHASE → OutEntry", () => {
  it("maps to an OutEntry with correct bucket and priority", () => {
    const e = mapDbEntry(base);
    expect(isOut(e)).toBe(true);
    if (isOut(e)) {
      expect(e.direction).toBe("OUT");
      expect(e.bucket).toBe("HUSK_PURCHASE");
      expect(e.priority).toBe("REQUIRED");
      expect(e.source).toBe("MANUAL");
    }
  });
});

describe("mapDbEntry: OPERATIONAL → OutEntry", () => {
  it("maps each people bucket correctly", () => {
    const row: DbRow = {
      ...base,
      kind: "OPERATIONAL",
      bucket: "LABOUR",
      priority: "EXTRA",
      amount: BigInt(87778500),
      weight: null,
    };
    const e = mapDbEntry(row);
    expect(isOut(e)).toBe(true);
    if (isOut(e)) {
      expect(e.bucket).toBe("LABOUR");
      expect(e.priority).toBe("EXTRA");
      expect(e.amount).toBe(87778500);
      expect(e.weight).toBeUndefined();
    }
  });
});

describe("mapDbEntry: SALE → SaleEntry", () => {
  it("maps billed, received, and weight correctly", () => {
    const row: DbRow = {
      ...base,
      direction: "IN",
      kind: "SALE",
      bucket: null,
      priority: null,
      amount: null,
      billed: BigInt(270000000),
      received: BigInt(248303000),
      weight: BigInt(108850000), // 108,850 kg in grams
    };
    const e = mapDbEntry(row);
    expect(isSale(e)).toBe(true);
    if (isSale(e)) {
      expect(e.direction).toBe("IN");
      expect(e.kind).toBe("SALE");
      expect(e.billed).toBe(270000000);
      expect(e.received).toBe(248303000);
      expect(e.weight).toBe(108850000);
    }
  });
});

describe("mapDbEntry: CAPITAL → CapitalEntry", () => {
  it("maps partner name and amount", () => {
    const row: DbRow = {
      ...base,
      direction: "IN",
      kind: "CAPITAL",
      bucket: null,
      priority: null,
      amount: BigInt(500000000),
      weight: null,
      partner: "Azeem",
    };
    const e = mapDbEntry(row);
    expect(isCapital(e)).toBe(true);
    if (isCapital(e)) {
      expect(e.kind).toBe("CAPITAL");
      expect(e.partner).toBe("Azeem");
      expect(e.amount).toBe(500000000);
    }
  });
});

describe("mapDbEntry: CAPITAL_RETURN → CapitalReturnEntry", () => {
  it("maps kind and partner correctly", () => {
    const row: DbRow = {
      ...base,
      direction: "OUT",
      kind: "CAPITAL_RETURN",
      bucket: null,
      priority: null,
      amount: BigInt(100000000),
      weight: null,
      partner: "Atiq",
    };
    const e = mapDbEntry(row);
    expect(isCapitalReturn(e)).toBe(true);
    if (isCapitalReturn(e)) {
      expect(e.kind).toBe("CAPITAL_RETURN");
      expect(e.partner).toBe("Atiq");
      expect(e.amount).toBe(100000000);
    }
  });
});

describe("mapDbEntry: optional fields", () => {
  it("converts null note to undefined", () => {
    const e = mapDbEntry({ ...base, note: null });
    expect(e.note).toBeUndefined();
  });

  it("passes through non-null note", () => {
    const e = mapDbEntry({ ...base, note: "test note" });
    expect(e.note).toBe("test note");
  });

  it("converts null counterparty to undefined", () => {
    const e = mapDbEntry({ ...base, counterparty: null });
    expect(e.counterparty).toBeUndefined();
  });

  it("converts null paymentSource to undefined", () => {
    const e = mapDbEntry({ ...base, paymentSource: null });
    expect(e.paymentSource).toBeUndefined();
  });

  it("converts null weight on OutEntry to undefined weight", () => {
    const e = mapDbEntry({
      ...base,
      kind: "OPERATIONAL",
      bucket: "PETTY_CASH",
      weight: null,
    });
    if (isOut(e)) expect(e.weight).toBeUndefined();
  });
});
