/**
 * Parser for the "Rice Husk" sheet — the source of truth for expense rows.
 *
 * Sheet layout (per CLAUDE.md): D+E+F+G = C.
 *   Col G → HUSK_PURCHASE  (the investment)
 *   Col D → PETTY_CASH
 *   Col E → LABOUR
 *   Col F → TRANSPORT
 *   (BROKER / MISC added if their headers appear in the file)
 *
 * Strategy: detect header row, map columns by keyword, then read data rows.
 * Each data row produces one PreviewRow per non-zero bucket column found.
 * Rows with no date or all-zero amounts are skipped silently.
 *
 * Null-header fallback: the actual file has null headers for TRANSPORT (col F)
 * and HUSK_PURCHASE (col G). After keyword detection, if those buckets are
 * still missing we scan forward from the last detected bucket column and assign
 * the first two null-header columns positionally (TRANSPORT first, then
 * HUSK_PURCHASE) — matching the sheet's D/E/F/G column order.
 */

import * as XLSX from "xlsx";
import type { OutBucket } from "../types";
import { rupeesToPaisa, kgToGrams, mundToGrams } from "../money";
import type { PreviewRow } from "./types";
import { normaliseDate } from "./date-normalise";

type CellVal = string | number | boolean | Date | null | undefined;
type RawRow = CellVal[];

// Keywords that map a column header to a bucket
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
const WEIGHT_COL_RE = /\bkg\b|weight|mund|mnd|quantity|qty/i;
const NOTE_COL_RE = /note|remark|comment|desc/i;

interface ColMap {
  dateIdx: number;
  nameIdx: number | null;
  weightIdx: number | null;
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
  let weightIdx: number | null = null;
  let noteIdx: number | null = null;
  const buckets: Array<{ idx: number; bucket: OutBucket }> = [];

  for (let i = 0; i < row.length; i++) {
    const h = headerStr(row[i]);
    if (!h) continue;

    if (DATE_COL_RE.test(h)) {
      dateIdx = i;
    } else if (WEIGHT_COL_RE.test(h)) {
      weightIdx = i;
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

  // Null-header fallback: the real file has null headers for TRANSPORT and
  // HUSK_PURCHASE (columns F and G). Scan forward from the last named bucket
  // column and assign the first two null-header columns positionally.
  const missingBuckets: OutBucket[] = [];
  if (!buckets.find((b) => b.bucket === "TRANSPORT")) missingBuckets.push("TRANSPORT");
  if (!buckets.find((b) => b.bucket === "HUSK_PURCHASE")) missingBuckets.push("HUSK_PURCHASE");

  if (missingBuckets.length > 0 && buckets.length > 0) {
    const lastNamedIdx = Math.max(...buckets.map((b) => b.idx));
    let assigned = 0;
    for (let i = lastNamedIdx + 1; i < row.length && assigned < missingBuckets.length; i++) {
      const h = headerStr(row[i]);
      if (!h) {
        buckets.push({ idx: i, bucket: missingBuckets[assigned++] });
      } else {
        // Non-null header signals end of expense columns (e.g. "sales", "balance")
        break;
      }
    }
  }

  if (dateIdx === -1 || buckets.length === 0) return null;
  return { dateIdx, nameIdx, weightIdx, noteIdx, buckets };
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

export function parseRiceHuskSheet(ws: XLSX.WorkSheet): PreviewRow[] {
  // raw:true gives numeric serials for date cells and actual numbers for amounts.
  const rawNums: RawRow[] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  // Find the header row (first row with ≥ 2 non-empty string cells)
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

  if (!colMap) return []; // sheet layout unrecognised

  const rows: PreviewRow[] = [];

  for (let ri = dataStart; ri < rawNums.length; ri++) {
    const row = rawNums[ri];
    if (!row || row.every((c) => c == null || c === "")) continue;

    // Date — use raw (numeric) row for serial detection
    const rawDateCell = row[colMap.dateIdx];
    if (rawDateCell == null || rawDateCell === "") continue;

    const dr = normaliseDate(rawDateCell);

    // Check if this is a "Total" / summary row (non-numeric date cell that's text)
    if (typeof rawDateCell === "string") {
      const lower = rawDateCell.trim().toLowerCase();
      if (/total|sum|grand|subtotal/.test(lower)) continue;
    }

    const counterparty = colMap.nameIdx != null ? cellStr(row[colMap.nameIdx]) : undefined;
    const note = colMap.noteIdx != null ? cellStr(row[colMap.noteIdx]) : undefined;
    const weightRaw = colMap.weightIdx != null ? cellNum(row[colMap.weightIdx]) : null;

    // Produce one PreviewRow per non-zero bucket column
    for (const { idx, bucket } of colMap.buckets) {
      const amountRupees = cellNum(row[idx]);
      if (!amountRupees || amountRupees <= 0) continue;

      const errors: string[] = [];
      const warnings: string[] = [];

      if (dr.parseError) errors.push(`date: ${dr.flag}`);
      if (amountRupees <= 0) errors.push("amount must be positive");

      // Weight is only meaningful for HUSK_PURCHASE
      let weight: number | undefined;
      if (bucket === "HUSK_PURCHASE") {
        if (weightRaw != null && weightRaw > 0) {
          // Header-detected weight column — treat value as kg
          weight = kgToGrams(weightRaw);
        } else {
          // Column P (index 15) holds mund values in the real file; no header present
          const mundRaw = cellNum(row[15]);
          if (mundRaw != null && mundRaw > 0) {
            weight = mundToGrams(mundRaw);
          }
        }
      }

      if (bucket === "HUSK_PURCHASE" && !weight) {
        warnings.push("no weight (mund/kg) for HUSK_PURCHASE row — stock tracking will be incomplete");
      }

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
        weight,
        counterparty,
        note,
        errors,
        warnings,
      });
    }
  }

  return rows;
}
