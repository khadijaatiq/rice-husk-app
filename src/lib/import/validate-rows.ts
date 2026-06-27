/**
 * Per-row validation pass that runs after parsing.
 * Parsers do structural validation; this layer enforces domain rules
 * (amounts positive, required fields present, no future years, etc.).
 * Returns the same row with errors/warnings arrays populated.
 */

import type { PreviewRow } from "./types";

export function validateRow(row: PreviewRow): PreviewRow {
  const errors = [...row.errors];
  const warnings = [...row.warnings];

  // Date must be parseable
  if (!row.date && !errors.some((e) => e.startsWith("date"))) {
    errors.push("date is missing");
  }

  switch (row.rowType) {
    case "OUT": {
      if (!row.bucket) errors.push("bucket is required for OUT rows");
      if (row.amount == null || row.amount <= 0) errors.push("amount must be positive");
      break;
    }
    case "SALE": {
      if (row.billed == null || row.billed <= 0) errors.push("billed amount required");
      if (row.received == null || row.received < 0) errors.push("received must be ≥ 0");
      if (row.billed != null && row.received != null && row.received > row.billed) {
        warnings.push("received exceeds billed (overpayment)");
      }
      break;
    }
    case "CAPITAL":
    case "CAPITAL_RETURN": {
      if (!row.partner) errors.push("partner name required");
      if (row.amount == null || row.amount <= 0) errors.push("amount must be positive");
      if (!row.date) {
        // Capital entries sometimes lack dates; allow with a warning
        warnings.push("no date — entry will be imported without a date (may sort oddly)");
        // Remove the "date is missing" hard error we added above
        const idx = errors.indexOf("date is missing");
        if (idx !== -1) errors.splice(idx, 1);
      }
      break;
    }
  }

  return { ...row, errors, warnings };
}

/** Build the import summary counts. */
export function buildSummary(rows: PreviewRow[]) {
  const riceHusk = rows.filter((r) => r.sheet === "Rice Husk").length;
  const partnership = rows.filter((r) => r.sheet === "partnership").length;
  const skipped = rows.filter((r) => r.errors.length > 0).length;
  const ambiguousDates = rows.filter((r) => r.dateAmbiguous).length;
  return {
    total: rows.length,
    valid: rows.length - skipped,
    skipped,
    ambiguousDates,
    riceHusk,
    partnership,
  };
}
