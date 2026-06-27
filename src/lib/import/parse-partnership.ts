/**
 * Parser for the "partnership" sheet.
 *
 * The real file has a SIDE-BY-SIDE layout in a single header row (row 0):
 *
 *   LEFT side  (cols ~0-5): partner capital entries
 *     col 0 = partner name (no header)
 *     col 1 = capital date (header: "date")
 *     col 2 = capital amount (header: "capital investment")
 *
 *   RIGHT side (cols ~6-12): sale transactions
 *     col 6  = sale date      (header: "Date")
 *     col 7  = buyer name     (header: "Billing")
 *     col 8  = weight kg      (header: "Weight")
 *     col 10 = billed amount  (header: "Amount")
 *     col 11 = received       (header: "Recieved " — note typo)
 *
 * Each data row may produce BOTH a CAPITAL entry (from the left side) AND a
 * SALE entry (from the right side). Rows with "Total" in col 0 are skipped.
 * "return to X" rows produce a CAPITAL_RETURN entry.
 *
 * Column detection is keyword-based, with support for the "Recieved" typo.
 */

import * as XLSX from "xlsx";
import { rupeesToPaisa, kgToGrams } from "../money";
import type { PreviewRow } from "./types";
import { normaliseDate } from "./date-normalise";

type CellVal = string | number | boolean | Date | null | undefined;
type RawRow = CellVal[];

function cellNum(v: CellVal): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function cellStr(v: CellVal): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

export function parsePartnershipSheet(ws: XLSX.WorkSheet): PreviewRow[] {
  if (!ws) return [];

  const rawNums: RawRow[] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (!rawNums || rawNums.length < 2) return [];

  // ── Column detection from the header row (row 0) ──────────────────────────
  const headerRow = rawNums[0];

  let capAmountIdx: number | null = null;
  // capDateIdx = first "date" column (left side, for capital entry dates)
  let capDateIdx: number | null = null;
  // saleDateIdx = second "date" column (right side, for sale dates)
  let saleDateIdx: number | null = null;
  let saleBuyerIdx: number | null = null;
  let saleKgIdx: number | null = null;
  let saleBilledIdx: number | null = null;
  let saleReceivedIdx: number | null = null;

  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] ?? "")
      .trim()
      .toLowerCase();
    if (!h) continue;

    if (/capital|investment/i.test(h) && capAmountIdx == null) {
      capAmountIdx = i;
    } else if (/^date|^dt/i.test(h)) {
      if (capDateIdx == null) capDateIdx = i;
      else if (saleDateIdx == null) saleDateIdx = i;
    } else if (/billing|buyer|customer|party|client/i.test(h) && saleBuyerIdx == null) {
      saleBuyerIdx = i;
    } else if (/\bkg\b|weight|qty|quantity/i.test(h) && saleKgIdx == null) {
      saleKgIdx = i;
    } else if (/bill[ei]?d|invoice|total|amount/i.test(h) && saleBilledIdx == null) {
      saleBilledIdx = i;
    } else if (/receiv[ei]?d|reciev[ei]?d/i.test(h) && saleReceivedIdx == null) {
      // Matches both "received" (correct) and "recieved" (typo in the real file)
      saleReceivedIdx = i;
    }
  }

  // If only one "date" column was found, use it for sales (simple sheet layout).
  const effectiveSaleDateIdx = saleDateIdx ?? capDateIdx;

  const rows: PreviewRow[] = [];

  // ── Process data rows ─────────────────────────────────────────────────────
  for (let ri = 1; ri < rawNums.length; ri++) {
    const row = rawNums[ri];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const col0 = String(row[0] ?? "").trim();

    // ── CAPITAL / CAPITAL_RETURN entry (left side) ──────────────────────────
    if (col0 && !/^total$/i.test(col0) && capAmountIdx != null) {
      const amountRupees = cellNum(row[capAmountIdx]);
      if (amountRupees != null && amountRupees > 0) {
        const isReturn = /^return\s+to\b/i.test(col0);
        const partnerName = isReturn
          ? col0.replace(/^return\s+to\s+/i, "").trim()
          : col0;

        const capRawDate = capDateIdx != null ? row[capDateIdx] : null;
        let capDate = "";
        let capDateAmbiguous = false;
        let capDateFlag: string | undefined;
        if (capRawDate != null && capRawDate !== "") {
          const dr = normaliseDate(capRawDate);
          capDate = dr.date;
          capDateAmbiguous = dr.ambiguous;
          capDateFlag = dr.flag;
        }

        const capWarnings: string[] = [];
        if (!capDate) capWarnings.push("no date — today's date will be used on commit");
        if (isReturn) {
          capWarnings.push(
            "capital return entry: this will reduce the partner's net capital and capitalRemaining"
          );
        }

        rows.push({
          rowNum: ri + 1,
          sheet: "partnership",
          rawDate: capRawDate != null ? String(capRawDate) : "",
          date: capDate,
          dateAmbiguous: capDateAmbiguous,
          dateFlag: capDateFlag,
          rowType: isReturn ? "CAPITAL_RETURN" : "CAPITAL",
          partner: partnerName,
          amount: rupeesToPaisa(amountRupees),
          errors: [],
          warnings: capWarnings,
        });
      }
    }

    // ── SALE entry (right side) ──────────────────────────────────────────────
    if (effectiveSaleDateIdx != null && saleBilledIdx != null) {
      const rawSaleDate = row[effectiveSaleDateIdx];
      const billedRupees = cellNum(row[saleBilledIdx]);

      if (rawSaleDate != null && rawSaleDate !== "" && billedRupees != null && billedRupees > 0) {
        const receivedRupees = saleReceivedIdx != null ? cellNum(row[saleReceivedIdx]) : null;
        const kgRaw = saleKgIdx != null ? cellNum(row[saleKgIdx]) : null;
        const buyerName = saleBuyerIdx != null ? cellStr(row[saleBuyerIdx]) : undefined;

        const dr = normaliseDate(rawSaleDate);
        const errors: string[] = [];
        const warnings: string[] = [];

        if (dr.parseError) errors.push(`date: ${dr.flag}`);

        const billed = rupeesToPaisa(billedRupees);
        const received = receivedRupees != null ? rupeesToPaisa(receivedRupees) : 0;

        if (billed <= 0) errors.push("billed amount missing or zero");
        if (received > billed) warnings.push("received > billed (overpayment?)");

        let weight: number | undefined;
        if (kgRaw != null && kgRaw > 0) weight = kgToGrams(kgRaw);
        if (!weight) warnings.push("no weight — stock tracking for this sale will be incomplete");

        rows.push({
          rowNum: ri + 1,
          sheet: "partnership",
          rawDate: String(rawSaleDate),
          date: dr.date,
          dateAmbiguous: dr.ambiguous,
          dateFlag: dr.flag,
          rowType: "SALE",
          billed,
          received,
          weight,
          counterparty: buyerName,
          errors,
          warnings,
        });
      }
    }
  }

  return rows;
}
