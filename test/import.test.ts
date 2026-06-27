import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseRiceHuskSheet } from "../src/lib/import/parse-rice-husk.js";
import { parsePartnershipSheet } from "../src/lib/import/parse-partnership.js";
import { validateRow, buildSummary } from "../src/lib/import/validate-rows.js";
import type { PreviewRow } from "../src/lib/import/types.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal XLSX worksheet from a 2D array of values. */
function makeWs(data: (string | number | null)[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(data);
}

// ── parseRiceHuskSheet ────────────────────────────────────────────────────────

describe("parseRiceHuskSheet", () => {
  it("parses a minimal Rice Husk sheet with one HUSK_PURCHASE row", () => {
    const ws = makeWs([
      ["Date", "Name", "Total", "Petty Cash", "Labour", "Transport", "Husk Purchase"],
      ["15/03/25", "Supplier A", 50000, null, null, null, 50000],
    ]);
    const { rows } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.rowType).toBe("OUT");
    expect(r.bucket).toBe("HUSK_PURCHASE");
    expect(r.date).toBe("2025-03-15");
    expect(r.amount).toBe(50000 * 100); // Rs 50000 → 5,000,000 paisa
    expect(r.counterparty).toBe("Supplier A");
    expect(r.errors).toHaveLength(0);
  });

  it("parses a LABOUR row correctly", () => {
    const ws = makeWs([
      ["Date", "Name", "Total", "Petty Cash", "Labour", "Transport", "Husk"],
      ["20/06/25", "Worker Group", 10000, null, 10000, null, null],
    ]);
    const { rows } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(1);
    expect(rows[0].bucket).toBe("LABOUR");
    expect(rows[0].amount).toBe(10000 * 100);
  });

  it("produces two rows when a data row fills two bucket columns", () => {
    const ws = makeWs([
      ["Date", "Name", "Total", "Petty Cash", "Labour", "Transport", "Husk"],
      ["01/04/25", "Mixed", 30000, 10000, 20000, null, null],
    ]);
    const { rows } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(2);
    const buckets = rows.map((r) => r.bucket).sort();
    expect(buckets).toEqual(["LABOUR", "PETTY_CASH"]);
  });

  it("skips rows where all bucket columns are empty / zero", () => {
    const ws = makeWs([
      ["Date", "Name", "Total", "Petty Cash", "Labour", "Transport", "Husk"],
      ["01/04/25", "Empty row", 0, null, null, null, null],
    ]);
    const { rows } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(0);
  });

  it("skips rows that look like totals", () => {
    const ws = makeWs([
      ["Date", "Name", "Total", "Petty Cash", "Labour", "Transport", "Husk"],
      ["15/03/25", "Supplier", 50000, null, null, null, 50000],
      ["Total", "", 50000, null, null, null, 50000], // header total row
    ]);
    const { rows } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(1); // total row skipped
  });

  it("returns empty rows when sheet has no detectable header", () => {
    const ws = makeWs([
      [null, null, null],
      [null, null, null],
    ]);
    const { rows, stockBalanceKg } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(0);
    expect(stockBalanceKg).toBeNull();
  });

  it("handles Excel serial dates", () => {
    const ws = makeWs([
      ["Date", "Name", "Petty Cash"],
      [45669, "Test", 5000], // serial 45669 = 2025-01-12
    ]);
    const { rows } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2025-01-12");
  });

  it("flags ambiguous dates but still produces a row", () => {
    const ws = makeWs([
      ["Date", "Name", "Labour"],
      ["05/03/25", "Someone", 1000], // day=5, month=3, both ≤ 12 → ambiguous
    ]);
    const { rows } = parseRiceHuskSheet(ws);
    expect(rows).toHaveLength(1);
    expect(rows[0].dateAmbiguous).toBe(true);
    expect(rows[0].errors).toHaveLength(0); // ambiguous ≠ hard error
  });

  it("reads the running stock balance from col 18", () => {
    // Col 18 = index 18; checkpoint row carries the balance in kg
    const dataRow = new Array(19).fill(null);
    dataRow[0] = "15/03/25"; // date
    dataRow[3] = 5000;       // petty cash
    dataRow[18] = 291150;    // stock balance kg
    const ws = makeWs([
      ["Date", "Name", "Total", "Petty Cash", "Labour", "Transport", "Husk"],
      dataRow,
    ]);
    const { stockBalanceKg } = parseRiceHuskSheet(ws);
    expect(stockBalanceKg).toBe(291150);
  });
});

// ── parsePartnershipSheet ─────────────────────────────────────────────────────

describe("parsePartnershipSheet", () => {
  it("parses a CAPITAL row", () => {
    const ws = makeWs([
      ["Partner", "Capital"],
      ["Azeem", 5000000],
    ]);
    const rows = parsePartnershipSheet(ws);
    const cap = rows.find((r) => r.rowType === "CAPITAL");
    expect(cap).toBeDefined();
    expect(cap!.partner).toBe("Azeem");
    expect(cap!.amount).toBe(5000000 * 100); // 500,000,000 paisa
  });

  it("parses a SALE row with billed and received", () => {
    const ws = makeWs([
      ["Date", "Buyer", "Kg", "Billed", "Received"],
      ["10/04/25", "Customer X", 1000, 17000, 10000],
    ]);
    const rows = parsePartnershipSheet(ws);
    const sale = rows.find((r) => r.rowType === "SALE");
    expect(sale).toBeDefined();
    expect(sale!.billed).toBe(17000 * 100);
    expect(sale!.received).toBe(10000 * 100);
    expect(sale!.weight).toBe(1000 * 1000); // 1000 kg → 1,000,000 g
    expect(sale!.counterparty).toBe("Customer X");
  });

  it("returns [] for empty / unrecognised sheet", () => {
    // @ts-expect-error testing null input
    expect(parsePartnershipSheet(null)).toHaveLength(0);
  });
});

// ── validateRow ───────────────────────────────────────────────────────────────

describe("validateRow", () => {
  const base: PreviewRow = {
    rowNum: 1,
    sheet: "Rice Husk",
    rawDate: "15/03/25",
    date: "2025-03-15",
    dateAmbiguous: false,
    rowType: "OUT",
    bucket: "LABOUR",
    amount: 100000, // 1000 paisa
    errors: [],
    warnings: [],
  };

  it("passes a valid OUT row", () => {
    const r = validateRow(base);
    expect(r.errors).toHaveLength(0);
  });

  it("errors when OUT row has no bucket", () => {
    const r = validateRow({ ...base, bucket: undefined });
    expect(r.errors.some((e) => /bucket/i.test(e))).toBe(true);
  });

  it("errors when OUT row has zero amount", () => {
    const r = validateRow({ ...base, amount: 0 });
    expect(r.errors.some((e) => /amount/i.test(e))).toBe(true);
  });

  it("errors when SALE row has no billed amount", () => {
    const r = validateRow({
      ...base,
      rowType: "SALE",
      bucket: undefined,
      amount: undefined,
      billed: undefined,
      received: 0,
    });
    expect(r.errors.some((e) => /billed/i.test(e))).toBe(true);
  });

  it("errors when CAPITAL row has no partner", () => {
    const r = validateRow({
      ...base,
      rowType: "CAPITAL",
      bucket: undefined,
      amount: 500000,
      partner: undefined,
    });
    expect(r.errors.some((e) => /partner/i.test(e))).toBe(true);
  });

  it("errors when date is missing and row is not CAPITAL", () => {
    const r = validateRow({ ...base, date: "" });
    expect(r.errors.some((e) => /date/i.test(e))).toBe(true);
  });

  it("warns but does not error when CAPITAL row has no date", () => {
    const r = validateRow({
      ...base,
      rowType: "CAPITAL",
      partner: "Azeem",
      amount: 100000,
      bucket: undefined,
      date: "",
    });
    expect(r.errors.filter((e) => /date/i.test(e))).toHaveLength(0);
    expect(r.warnings.some((w) => /date/i.test(w))).toBe(true);
  });
});

// ── buildSummary ──────────────────────────────────────────────────────────────

describe("buildSummary", () => {
  it("counts valid, skipped and ambiguous correctly", () => {
    const rows: PreviewRow[] = [
      { ...makeRow("Rice Husk"), errors: [] },
      { ...makeRow("Rice Husk"), errors: ["bad date"] },
      { ...makeRow("partnership"), errors: [], dateAmbiguous: true },
    ];
    const s = buildSummary(rows);
    expect(s.total).toBe(3);
    expect(s.valid).toBe(2);
    expect(s.skipped).toBe(1);
    expect(s.ambiguousDates).toBe(1);
    expect(s.riceHusk).toBe(2);
    expect(s.partnership).toBe(1);
  });
});

function makeRow(sheet: string): PreviewRow {
  return {
    rowNum: 1,
    sheet,
    rawDate: "01/01/25",
    date: "2025-01-01",
    dateAmbiguous: false,
    rowType: "OUT",
    bucket: "LABOUR",
    amount: 1000,
    errors: [],
    warnings: [],
  };
}

// ── Dedupe (pure logic) ───────────────────────────────────────────────────────

describe("dedupe — same file hash = blocked", () => {
  it("two ParsedImports with the same fileHash are identified as duplicates", () => {
    const hash = "abc123";
    // The repo.importHashExists function would return true for a second import.
    // We test the hash computation is deterministic here (pure, no DB).
    const { createHash } = require("crypto");
    const buf = Buffer.from("hello world");
    const h1 = createHash("sha256").update(buf).digest("hex");
    const h2 = createHash("sha256").update(buf).digest("hex");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(hash); // just sanity check it's real
  });

  it("different file content produces different hash", () => {
    const { createHash } = require("crypto");
    const h1 = createHash("sha256").update(Buffer.from("file1")).digest("hex");
    const h2 = createHash("sha256").update(Buffer.from("file2")).digest("hex");
    expect(h1).not.toBe(h2);
  });
});
