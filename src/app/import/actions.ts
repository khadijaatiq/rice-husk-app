"use server";

import { createHash } from "crypto";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { parseRiceHuskSheet } from "@/lib/import/parse-rice-husk";
import { parsePartnershipSheet } from "@/lib/import/parse-partnership";
import { validateRow, buildSummary } from "@/lib/import/validate-rows";
import type { ParsedImport, CommitPayload, PreviewRow } from "@/lib/import/types";
import * as repo from "@/lib/repository";

const IGNORED_SHEETS = new Set(["Sheet1", "PUNN ", "Sheet2"]);
const RICE_HUSK_SHEET = "Rice Husk";
const PARTNERSHIP_SHEET = "partnership";

export async function parseFileAction(formData: FormData): Promise<ParsedImport | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided" };
  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    return { error: "Only .xlsx / .xls files are supported" };
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { error: "Failed to read file" };
  }

  const fileHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  const alreadyImported = await repo.importHashExists(fileHash);

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: false });
  } catch {
    return { error: "Failed to parse Excel file — is it a valid .xlsx?" };
  }

  // Validate required sheets exist
  const sheetNames = wb.SheetNames;
  const hasRiceHusk = sheetNames.includes(RICE_HUSK_SHEET);
  const hasPartnership = sheetNames.includes(PARTNERSHIP_SHEET);

  if (!hasRiceHusk && !hasPartnership) {
    return { error: `Could not find "${RICE_HUSK_SHEET}" or "${PARTNERSHIP_SHEET}" sheets in this file. Found: ${sheetNames.join(", ")}` };
  }

  const ignored = sheetNames.filter((n) => IGNORED_SHEETS.has(n));
  const rows: PreviewRow[] = [];
  let stockBalanceKg: number | null = null;

  if (hasRiceHusk) {
    const ws = wb.Sheets[RICE_HUSK_SHEET];
    const { rows: riceHuskRows, stockBalanceKg: balance } = parseRiceHuskSheet(ws);
    rows.push(...riceHuskRows.map(validateRow));
    stockBalanceKg = balance;
  }

  if (hasPartnership) {
    const ws = wb.Sheets[PARTNERSHIP_SHEET];
    const parsed = parsePartnershipSheet(ws);
    rows.push(...parsed.map(validateRow));
  }

  if (rows.length === 0) {
    return { error: "No importable rows found in the file. Check that the sheet structure matches the expected layout." };
  }

  return {
    fileHash,
    filename: file.name,
    rows,
    alreadyImported,
    summary: buildSummary(rows),
    stockBalanceKg,
  };
}

export async function commitImportAction(
  payload: CommitPayload
): Promise<{ batchId: string } | { error: string }> {
  // Re-check dedupe server-side — prevent double-submission
  const alreadyImported = await repo.importHashExists(payload.fileHash);
  if (alreadyImported) {
    return { error: "This file has already been imported. Re-importing the same file is blocked to prevent double-counting." };
  }

  // Only commit rows without hard errors
  const validRows = payload.rows.filter((r) => r.errors.length === 0);
  const skipped = payload.rows.length - validRows.length;

  if (validRows.length === 0) {
    return { error: "No valid rows to import after excluding rows with errors." };
  }

  const parsedSheets = [
    payload.rows.some((r) => r.sheet === RICE_HUSK_SHEET) ? RICE_HUSK_SHEET : null,
    payload.rows.some((r) => r.sheet === PARTNERSHIP_SHEET) ? PARTNERSHIP_SHEET : null,
  ]
    .filter(Boolean)
    .join(",");

  try {
    const batchId = await repo.commitImportBatch({
      filename: payload.filename,
      fileHash: payload.fileHash,
      sheetNames: parsedSheets,
      rows: validRows.map((r) => ({
        date: r.date,
        rowType: r.rowType,
        bucket: r.bucket,
        amount: r.amount,
        billed: r.billed,
        received: r.received,
        weight: r.weight,
        counterparty: r.counterparty,
        partner: r.partner,
        note: r.note,
      })),
      skipped,
    });

    revalidatePath("/");
    return { batchId };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function rollbackBatchAction(batchId: string): Promise<{ error: string } | undefined> {
  try {
    await repo.rollbackBatch(batchId);
    revalidatePath("/");
  } catch (e) {
    return { error: String(e) };
  }
}

export async function bulkSetPriorityAction(
  batchId: string,
  priority: "REQUIRED" | "EXTRA",
  filter: { bucket?: string; counterparty?: string } = {}
): Promise<{ count: number } | { error: string }> {
  try {
    const count = await repo.bulkSetPriority(batchId, priority as "REQUIRED" | "EXTRA", {
      bucket: filter.bucket as repo.BatchRow["bucket"],
      counterparty: filter.counterparty,
    });
    revalidatePath("/");
    return { count };
  } catch (e) {
    return { error: String(e) };
  }
}
