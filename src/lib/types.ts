/**
 * types.ts — the domain model, faithful to how the Rice Husk sheet works.
 *
 * One unified ledger of `Entry` rows. Each row is one money movement.
 * The sheet's side-by-side category columns (D=petty cash, E=labour,
 * F=transport, G=husk purchase) become the `bucket` field; its `/2`
 * partner logic and kg-based stock tracking are computed in calc.ts.
 */

import type { Paisa, Grams } from "./money.js";

export type Direction = "IN" | "OUT";

/** Priority applies to OUT rows (req 4). Binary, per your decision. */
export type Priority = "REQUIRED" | "EXTRA";

/**
 * Buckets mirror the sheet's split columns.
 *  - HUSK_PURCHASE  -> the "investment" (sheet column G): husk bought to resell.
 *  - PETTY_CASH / LABOUR / TRANSPORT / BROKER / MISC -> "money given to people /
 *    service charges" (sheet columns D, E, F).
 */
export type OutBucket =
  | "HUSK_PURCHASE"
  | "PETTY_CASH"
  | "LABOUR"
  | "TRANSPORT"
  | "BROKER"
  | "MISC";

export const PEOPLE_BUCKETS: OutBucket[] = [
  "PETTY_CASH",
  "LABOUR",
  "TRANSPORT",
  "BROKER",
  "MISC",
];

export type PaymentSource = "ALFALAH" | "MEEZAN" | "CASH" | "OTHER";

interface BaseEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd (normalised on import)
  note?: string;
  counterparty?: string;
  paymentSource?: PaymentSource;
  source: "MANUAL" | "IMPORT";
}

/** OUT: an expense. Husk purchase carries the weight bought (drives stock). */
export interface OutEntry extends BaseEntry {
  direction: "OUT";
  bucket: OutBucket;
  amount: Paisa;
  priority: Priority;
  /** kg bought, only for HUSK_PURCHASE rows; in grams. */
  weight?: Grams;
}

/** IN, a sale: husk sold. Billed vs received tracks the receivable. */
export interface SaleEntry extends BaseEntry {
  direction: "IN";
  kind: "SALE";
  weight: Grams; // kg sold (drives stock down)
  billed: Paisa; // weight x price/kg
  received: Paisa; // cash actually received so far (<= billed)
}

/** IN, partner capital contributed. */
export interface CapitalEntry extends BaseEntry {
  direction: "IN";
  kind: "CAPITAL";
  partner: string; // "Azeem", "Atiq", ...
  amount: Paisa;
}

/** OUT, capital returned to a partner ("return to Azeem"). */
export interface CapitalReturnEntry extends BaseEntry {
  direction: "OUT";
  kind: "CAPITAL_RETURN";
  partner: string;
  amount: Paisa;
}

export type Entry = OutEntry | SaleEntry | CapitalEntry | CapitalReturnEntry;

export interface EngineConfig {
  /** Current market price per kg, in paisa. Editable; fluctuates. */
  ratePaisaPerKg: number;
}

// ---- type guards ----------------------------------------------------------

export const isOut = (e: Entry): e is OutEntry =>
  e.direction === "OUT" && "bucket" in e;
export const isSale = (e: Entry): e is SaleEntry =>
  e.direction === "IN" && (e as SaleEntry).kind === "SALE";
export const isCapital = (e: Entry): e is CapitalEntry =>
  e.direction === "IN" && (e as CapitalEntry).kind === "CAPITAL";
export const isCapitalReturn = (e: Entry): e is CapitalReturnEntry =>
  e.direction === "OUT" && (e as CapitalReturnEntry).kind === "CAPITAL_RETURN";
