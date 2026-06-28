import * as XLSX from "xlsx";
import { paisaToRupees, gramsToKg } from "./money";
import { isOut, isSale, isCapital, isCapitalReturn, type Entry } from "./types";
import type { Summary } from "./calc";

export function buildWorkbook(
  entries: Entry[],
  summary: Summary,
  ratePaisaPerKg: number,
  opts: { period?: string } = {}
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(summary, ratePaisaPerKg, opts), "Summary");
  XLSX.utils.book_append_sheet(wb, buildLedgerSheet(entries), "Ledger");
  return wb;
}

type Row = (string | number | null)[];

function r(paisa: number): number {
  return paisa / 100;
}

function buildSummarySheet(
  summary: Summary,
  ratePaisaPerKg: number,
  opts: { period?: string }
): XLSX.WorkSheet {
  const rows: Row[] = [];

  if (opts.period) {
    rows.push(["Period", opts.period]);
    rows.push([]);
  }

  rows.push(["EXPENSES"]);
  rows.push(["Total Expenses (Rs)", r(summary.totalExpenses)]);
  rows.push(["  Investment (Husk Purchase)", r(summary.investment)]);
  rows.push(["  Given to People", r(summary.givenToPeople)]);
  rows.push(["    Petty Cash", r(summary.bucketTotals.PETTY_CASH)]);
  rows.push(["    Labour", r(summary.bucketTotals.LABOUR)]);
  rows.push(["    Transport", r(summary.bucketTotals.TRANSPORT)]);
  if (summary.bucketTotals.BROKER > 0)
    rows.push(["    Broker", r(summary.bucketTotals.BROKER)]);
  if (summary.bucketTotals.MISC > 0)
    rows.push(["    Misc", r(summary.bucketTotals.MISC)]);
  rows.push([]);

  rows.push(["PRIORITY"]);
  rows.push(["Required Outflow (Rs)", r(summary.requiredOutflow)]);
  rows.push(["Extra Outflow (Rs)", r(summary.extraOutflow)]);
  rows.push([]);

  rows.push(["SALES"]);
  rows.push(["Sales Billed (Rs)", r(summary.salesBilled)]);
  rows.push(["Sales Received (Rs)", r(summary.salesReceived)]);
  rows.push(["Receivable (Rs)", r(summary.receivable)]);
  rows.push([]);

  rows.push(["STOCK"]);
  rows.push(["Purchased (kg)", gramsToKg(summary.kgPurchased)]);
  rows.push(["Sold (kg)", gramsToKg(summary.kgSold)]);
  rows.push(["On Hand (kg)", gramsToKg(summary.kgOnHand)]);
  rows.push(["Rate (Rs/kg)", ratePaisaPerKg / 100]);
  rows.push(["Stock Value (Rs)", r(summary.stockValue)]);
  rows.push([]);

  rows.push(["POSITION"]);
  rows.push(["Operating Position (Rs)", r(summary.position)]);
  rows.push([]);

  if (summary.partners.length > 0) {
    rows.push(["PARTNERS (50/50)"]);
    for (const p of summary.partners) {
      rows.push([p.partner + " — Capital Contributed", r(p.capitalContributed)]);
      if (p.capitalReturned > 0)
        rows.push([p.partner + " — Capital Returned", r(p.capitalReturned)]);
      rows.push([p.partner + " — Net Capital", r(p.netCapital)]);
      rows.push([p.partner + " — Expense Share", r(p.expenseShare)]);
      rows.push([p.partner + " — Capital Remaining", r(p.capitalRemaining)]);
    }
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildLedgerSheet(entries: Entry[]): XLSX.WorkSheet {
  const header: string[] = [
    "Date", "Direction", "Kind", "Bucket",
    "Amount (Rs)", "Billed (Rs)", "Received (Rs)", "Weight (kg)",
    "Counterparty", "Partner", "Priority", "Note", "Source",
  ];

  const dataRows = entries.map((e): Row => {
    if (isOut(e)) {
      return [
        e.date, "OUT",
        e.bucket === "HUSK_PURCHASE" ? "HUSK_PURCHASE" : "OPERATIONAL",
        e.bucket, r(e.amount), null, null,
        e.weight != null ? gramsToKg(e.weight) : null,
        e.counterparty ?? null, null, e.priority, e.note ?? null, e.source,
      ];
    }
    if (isSale(e)) {
      return [
        e.date, "IN", "SALE", null, null,
        r(e.billed), r(e.received), gramsToKg(e.weight),
        e.counterparty ?? null, null, null, e.note ?? null, e.source,
      ];
    }
    if (isCapital(e)) {
      return [
        e.date, "IN", "CAPITAL", null, r(e.amount),
        null, null, null, null, e.partner, null, e.note ?? null, e.source,
      ];
    }
    if (isCapitalReturn(e)) {
      return [
        e.date, "OUT", "CAPITAL_RETURN", null, r(e.amount),
        null, null, null, null, e.partner, null, e.note ?? null, e.source,
      ];
    }
    return [];
  });

  return XLSX.utils.aoa_to_sheet([header, ...dataRows]);
}
