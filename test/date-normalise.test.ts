import { describe, it, expect } from "vitest";
import { normaliseDate } from "../src/lib/import/date-normalise.js";

describe("normaliseDate", () => {
  // ── DD/MM/YY strings (Pakistani format) ──────────────────────────────────
  it("parses DD/MM/YY string (day > 12, unambiguous)", () => {
    const r = normaliseDate("15/03/25");
    expect(r.date).toBe("2025-03-15");
    expect(r.ambiguous).toBe(false);
    expect(r.parseError).toBe(false);
  });

  it("parses DD/MM/YYYY string (day ≤ 12 so flagged ambiguous)", () => {
    // 07/11/2025: day=7 ≤ 12, month=11 ≤ 12 → could be MM/DD or DD/MM → flagged
    const r = normaliseDate("07/11/2025");
    expect(r.date).toBe("2025-11-07"); // best guess: DD/MM
    expect(r.ambiguous).toBe(true);
    expect(r.parseError).toBe(false);
  });

  it("parses DD/MM/YYYY string unambiguously when day > 12", () => {
    const r = normaliseDate("22/11/2025");
    expect(r.date).toBe("2025-11-22");
    expect(r.ambiguous).toBe(false);
  });

  it("parses DD-MM-YY with hyphen separator", () => {
    const r = normaliseDate("20-06-25");
    expect(r.date).toBe("2025-06-20");
    expect(r.ambiguous).toBe(false);
  });

  // ── Ambiguous dates (day ≤ 12 AND month ≤ 12) ────────────────────────────
  it("flags ambiguous dates where day ≤ 12 and month ≤ 12", () => {
    const r = normaliseDate("05/03/25");
    expect(r.date).toBe("2025-03-05"); // best guess: DD/MM
    expect(r.ambiguous).toBe(true);
    expect(r.parseError).toBe(false);
  });

  it("does not flag when day > 12 (unambiguously DD/MM)", () => {
    const r = normaliseDate("13/03/25");
    expect(r.ambiguous).toBe(false);
  });

  it("does not flag when month > 12 after swap (was MM/DD)", () => {
    // month field = 14 is impossible; should be rejected
    const r = normaliseDate("14/15/25");
    expect(r.parseError).toBe(true); // both > 12, can't resolve
  });

  // ── Day/month-swapped (month field > 12 → swap) ──────────────────────────
  it("swaps day and month when parsed month field > 12", () => {
    // "03/15/25" read as DD/MM/YY gives month=15, impossible → swap → day=15, month=3
    const r = normaliseDate("03/15/25");
    expect(r.date).toBe("2025-03-15");
    expect(r.ambiguous).toBe(false);
    expect(r.parseError).toBe(false);
  });

  // ── Wrong year (future year) ──────────────────────────────────────────────
  it("flags year > 2026 as ambiguous with a warning", () => {
    const r = normaliseDate("15/03/28"); // 2028 → flagged
    expect(r.date).toBe("2028-03-15");  // still returned
    expect(r.ambiguous).toBe(true);
    expect(r.flag).toMatch(/future|typo/i);
    expect(r.parseError).toBe(false);
  });

  it("does not flag current year 2026", () => {
    const r = normaliseDate("15/03/26");
    expect(r.ambiguous).toBe(false);
    expect(r.parseError).toBe(false);
  });

  // ── Excel serials ─────────────────────────────────────────────────────────
  it("converts a known Excel serial to the correct date", () => {
    // Serial 45669 = 12 Jan 2025 (verified independently)
    const r = normaliseDate(45669);
    expect(r.date).toBe("2025-01-12");
    expect(r.ambiguous).toBe(false);
    expect(r.parseError).toBe(false);
  });

  it("converts serial 44927 → 2023-01-01", () => {
    const r = normaliseDate(44927);
    expect(r.date).toBe("2023-01-01");
    expect(r.parseError).toBe(false);
  });

  // ── JS Date objects ───────────────────────────────────────────────────────
  it("handles a JS Date object", () => {
    const r = normaliseDate(new Date(2025, 5, 15)); // Jun 15 2025 (local)
    expect(r.date).toBe("2025-06-15");
    expect(r.parseError).toBe(false);
  });

  // ── Error cases ───────────────────────────────────────────────────────────
  it("returns parseError for null", () => {
    expect(normaliseDate(null).parseError).toBe(true);
  });

  it("returns parseError for empty string", () => {
    expect(normaliseDate("").parseError).toBe(true);
  });

  it("returns parseError for unrecognised format", () => {
    expect(normaliseDate("not-a-date").parseError).toBe(true);
  });

  it("returns parseError for invalid month (> 12 and day also > 12)", () => {
    // e.g. "99/99/25" — neither field can be a valid month
    expect(normaliseDate("99/99/25").parseError).toBe(true);
  });

  it("returns parseError for invalid serial (< 1)", () => {
    expect(normaliseDate(0).parseError).toBe(true);
  });

  // ── ISO pass-through ──────────────────────────────────────────────────────
  it("passes through existing ISO dates cleanly", () => {
    const r = normaliseDate("2025-11-22");
    expect(r.date).toBe("2025-11-22");
    expect(r.ambiguous).toBe(false);
    expect(r.parseError).toBe(false);
  });
});
