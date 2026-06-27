/**
 * Parser for the "Rice Husk" sheet — the source of truth for expense rows.
 *
 * Sheet layout (per raw dump of the real file):
 *   col 0  = Date
 *   col 1  = Description   (captured as `note`)
 *   col 2  = Amount total  (ignored — we sum bucket columns directly)
 *   col 3  = PETTY_CASH    (header: "petty cash")
 *   col 4  = LABOUR        (header: "labour")
 *   col 5  = TRANSPORT     (null header — hardcoded positional)
 *   col 6  = HUSK_PURCHASE (null header — hardcoded positional)
 *   col 18 = running stock balance in kg (checkpoint rows only;
 *            last non-null value is the authoritative stock figure)
 *
 * Per-row weight does NOT exist in this sheet. The HUSK_PURCHASE entries are
 * imported without a weight field. The overall stock balance is read from col 18
 * and returned alongside the rows so the caller can store it separately.
 */

import * as XLSX from "xlsx";
import type { OutBucket } from "../types";
import { rupeesToPaisa } from "../money";
import type { PreviewRow } from "./types";
import { normaliseDate } from "./date-normalise";

type CellVal = string | number | boolean | Date | null | undefined;
type RawRow = CellVal[];

// Keywords that map a column header to a bucket (for named columns)
const BUCKET_PATTERNS: Array<{ bucket: OutBucket; re: RegExp }> = [
  { bucket: "HUSK_PURCHASE", re: /husk|bhoosa?|bhusa?|purchase|investment/i },
  { bucket: "PETTY_CASH", re: /petty|p\.?\s*cash/i },
  { bucket: "LABOUR", re: /labou?r|mzduri|mazduri|wage/i },
  { bucket: "TRANSPORT", re: /transport|freight|kiraya|carriage|bhara/i },
  { bucket: "BROKER", re: /broker|brokerage|commission/i },
  { bucket: "MISC", re: /misc|other/i },
];

const DATE_COL_RE = /^(date|dt|تاریخ|tarikh)$/i;
const NAME_COL_RE = /name|party|counterparty|paid\s*to|vendor|to\b|person|detail/i;
const NOTE_COL_RE = /note|remark|comment|desc/i;

// Confirmed positions for the two null-header bucket columns in the real file.
const TRANSPORT_COL = 5;
const HUSK_PURCHASE_COL = 6;
// Running stock balance (kg on hand); last non-null value in this column is authoritative.
const STOCK_BALANCE_COL = 18;

interface ColMap {
  dateIdx: number;
  nameIdx: number | null;
  noteIdx: number | null;
  buckets: Array<{ idx: number; bucket: OutBucket }>;
}

function headerStr(val: CellVal): string {
  return String(val ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function detectColumns(row: RawRow): ColMap | null {
  let dateIdx = -1;
  let nameIdx: number | null = null;
  let noteIdx: number | null = null;
  const buckets: Array<{ idx: number; bucket: OutBucket }> = [];

  for (let i = 0; i < row.length; i++) {
    const h = headerStr(row[i]);
    if (!h) continue;

    if (DATE_COL_RE.test(h)) {
      dateIdx = i;
    } else if (NOTE_COL_RE.test(h)) {
      noteIdx = i;
    } else if (NAME_COL_RE.test(h)) {
      nameIdx = i;
    } else {
      for (const { bucket, re } of BUCKET_PATTERNS) {
        if (re.test(h) && !buckets.find((b) => b.bucket === bucket)) {
          buckets.push({ idx: i, bucket });
          break;
        }
      }
    }
  }

  // Positional fallback for the two null-header columns confirmed in the real file.
  // Keyword detection takes priority; these only fire when a column wasn't already found.
  if (!buckets.find((b) => b.bucket === "TRANSPORT")) {
    buckets.push({ idx: TRANSPORT_COL, bucket: "TRANSPORT" });
  }
  if (!buckets.find((b) => b.bucket === "HUSK_PURCHASE")) {
    buckets.push({ idx: HUSK_PURCHASE_COL, bucket: "HUSK_PURCHASE" });
  }

  if (dateIdx === -1 || buckets.length === 0) return null;
  return { dateIdx, nameIdx, noteIdx, buckets };
}

function cellNum(val: CellVal): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/,/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

function cellStr(val: CellVal): string | undefined {
  const s = String(val ?? "").trim();
  return s || undefined;
}

export interface RiceHuskParseResult {
  rows: PreviewRow[];
  /**
   * Last non-null value from col 18 (the sheet's running stock balance, in kg).
   * This is the authoritative stock figure — null only if col 18 was entirely empty.
   */
  stockBalanceKg: number | null;
}

export function parseRiceHuskSheet(ws: XLSX.WorkSheet): RiceHuskParseResult {
  // raw:true gives numeric serials for date cells and actual numbers for amounts.
  const rawNums: RawRow[] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  // Find the header row (first row with a detectable Date column)
  let colMap: ColMap | null = null;
  let dataStart = 0;

  for (let i = 0; i < Math.min(rawNums.length, 15); i++) {
    const attempt = detectColumns(rawNums[i]);
    if (attempt) {
      colMap = attempt;
      dataStart = i + 1;
      break;
    }
  }

  if (!colMap) return { rows: [], stockBalanceKg: null };

  const rows: PreviewRow[] = [];
  let stockBalanceKg: number | null = null;

  for (let ri = dataStart; ri < rawNums.length; ri++) {
    const row = rawNums[ri];
    if (!row || row.every((c) => c == null || c === "")) continue;

    // Track the running stock balance — last non-null value is authoritative
    const balanceCell = cellNum(row[STOCK_BALANCE_COL]);
    if (balanceCell != null && balanceCell > 0) stockBalanceKg = balanceCell;

    // Skip subtotal / summary rows: col 2 (Amount) == col 6 (HUSK_PURCHASE) and
    // the value is large. Individual transactions are never > Rs 1,000,000 each;
    // only section sub-totals reach that magnitude.
    const colC = cellNum(row[2]);
    const colG = cellNum(row[HUSK_PURCHASE_COL]);
    if (colC != null && colC === colG && colC > 1_000_000) continue;

    // Date — required; skip rows with no date value
    const rawDateCell = row[colMap.dateIdx];
    if (rawDateCell == null || rawDateCell === "") continue;

    const dr = normaliseDate(rawDateCell);

    // Skip total/summary rows (non-numeric date cell containing "total" etc.)
    if (typeof rawDateCell === "string") {
      const lower = rawDateCell.trim().toLowerCase();
      if (/total|sum|grand|subtotal/.test(lower)) continue;
    }

    const counterparty = colMap.nameIdx != null ? cellStr(row[colMap.nameIdx]) : undefined;
    const note = colMap.noteIdx != null ? cellStr(row[colMap.noteIdx]) : undefined;

    // Produce one PreviewRow per non-zero bucket column
    for (const { idx, bucket } of colMap.buckets) {
      const amountRupees = cellNum(row[idx]);
      if (!amountRupees || amountRupees <= 0) continue;

      const errors: string[] = [];

      if (dr.parseError) errors.push(`date: ${dr.flag}`);

      rows.push({
        rowNum: ri + 1,
        sheet: "Rice Husk",
        rawDate: String(rawDateCell),
        date: dr.date,
        dateAmbiguous: dr.ambiguous,
        dateFlag: dr.flag,
        rowType: "OUT",
        bucket,
        amount: rupeesToPaisa(amountRupees),
        // No per-row weight: the Rice Husk sheet tracks only a running balance (col 18).
        counterparty,
        note,
        errors,
        warnings: [],
      });
    }
  }

  return { rows, stockBalanceKg };
}
