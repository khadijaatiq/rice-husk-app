import type { OutBucket } from "../types";

export type ImportRowType = "OUT" | "SALE" | "CAPITAL" | "CAPITAL_RETURN";

/** One parsed row from the Excel file, before DB write. Fully serializable (no Dates/BigInt). */
export interface PreviewRow {
  rowNum: number;
  sheet: string;
  rawDate: string; // stringified raw value from cell, for display
  date: string; // ISO yyyy-mm-dd (our best guess; may be ambiguous)
  dateAmbiguous: boolean; // needs human confirmation before commit
  dateFlag?: string; // reason why it's flagged
  rowType: ImportRowType;
  bucket?: OutBucket; // OUT rows only
  amount?: number; // paisa — OUT, CAPITAL, CAPITAL_RETURN
  billed?: number; // paisa — SALE
  received?: number; // paisa — SALE
  weight?: number; // grams — HUSK_PURCHASE (purchased), SALE (sold)
  counterparty?: string;
  partner?: string;
  note?: string;
  errors: string[]; // hard errors → row excluded from import
  warnings: string[]; // non-blocking, shown in preview
}

export interface ParsedImport {
  fileHash: string;
  filename: string;
  rows: PreviewRow[];
  alreadyImported: boolean; // true = a committed batch with this hash exists
  summary: ImportSummary;
  /** Authoritative stock balance in kg, read from col 18 of the Rice Husk sheet. */
  stockBalanceKg?: number | null;
}

export interface ImportSummary {
  total: number;
  valid: number;
  skipped: number; // rows with hard errors
  ambiguousDates: number;
  riceHusk: number;
  partnership: number;
}

export interface CommitPayload {
  fileHash: string;
  filename: string;
  rows: PreviewRow[];
}
