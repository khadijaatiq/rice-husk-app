import { prisma } from "./db";
import { mapDbEntry, type DbRow } from "./entry-map";
import type { Entry, OutBucket, Priority, PaymentSource } from "./types";
import type { Prisma } from "@prisma/client";

export interface EntryFilters {
  fromDate?: string;
  toDate?: string;
  direction?: "IN" | "OUT";
  bucket?: OutBucket;
  priority?: "REQUIRED" | "EXTRA";
}

export async function getEntries(filters: EntryFilters = {}): Promise<Entry[]> {
  const where: Prisma.EntryWhereInput = { deletedAt: null };
  const dateCond: Prisma.DateTimeFilter<"Entry"> = {};
  if (filters.fromDate) dateCond.gte = new Date(filters.fromDate);
  if (filters.toDate) dateCond.lte = new Date(filters.toDate);
  if (filters.fromDate || filters.toDate) where.date = dateCond;
  if (filters.direction) where.direction = filters.direction;
  if (filters.bucket) where.bucket = filters.bucket;
  if (filters.priority) where.priority = filters.priority;

  const rows = await prisma.entry.findMany({
    where,
    orderBy: { date: "asc" },
  });
  return rows.map(mapDbEntry);
}

export interface CreateEntryData {
  date: string;
  kind: "HUSK_PURCHASE" | "OPERATIONAL" | "SALE" | "CAPITAL" | "CAPITAL_RETURN";
  direction: "IN" | "OUT";
  bucket?: OutBucket;
  priority?: Priority;
  amount?: number;
  billed?: number;
  received?: number;
  weight?: number;
  counterparty?: string;
  partner?: string;
  paymentSource?: PaymentSource;
  note?: string;
}

export async function createEntry(data: CreateEntryData): Promise<void> {
  await prisma.entry.create({
    data: {
      date: new Date(data.date),
      direction: data.direction,
      kind: data.kind,
      bucket: data.bucket ?? null,
      priority: data.priority ?? null,
      amount: data.amount != null ? BigInt(data.amount) : null,
      billed: data.billed != null ? BigInt(data.billed) : null,
      received: data.received != null ? BigInt(data.received) : null,
      weight: data.weight != null ? BigInt(data.weight) : null,
      counterparty: data.counterparty ?? null,
      partner: data.partner ?? null,
      paymentSource: data.paymentSource ?? null,
      note: data.note ?? null,
      source: "MANUAL",
    },
  });
}

export async function updateEntry(
  id: string,
  data: Omit<CreateEntryData, "kind" | "direction">
): Promise<void> {
  await prisma.entry.update({
    where: { id },
    data: {
      date: new Date(data.date),
      bucket: data.bucket ?? null,
      priority: data.priority ?? null,
      amount: data.amount != null ? BigInt(data.amount) : null,
      billed: data.billed != null ? BigInt(data.billed) : null,
      received: data.received != null ? BigInt(data.received) : null,
      weight: data.weight != null ? BigInt(data.weight) : null,
      counterparty: data.counterparty ?? null,
      partner: data.partner ?? null,
      paymentSource: data.paymentSource ?? null,
      note: data.note ?? null,
    },
  });
}

export async function softDeleteEntry(id: string): Promise<void> {
  await prisma.entry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function getCurrentRate(): Promise<number> {
  const latest = await prisma.rateSetting.findFirst({
    orderBy: { effectiveFrom: "desc" },
  });
  return latest?.paisaPerKg ?? 1700;
}

export async function setCurrentRate(
  paisaPerKg: number,
  note?: string
): Promise<void> {
  await prisma.rateSetting.create({
    data: { paisaPerKg, note: note ?? null },
  });
}

// Exported for repository tests — constructs a domain Entry from a plain object
// without a DB call. This re-export keeps test/repository.test.ts DB-free.
export { mapDbEntry, type DbRow } from "./entry-map";

// ---- import batch -----------------------------------------------------------

/** True if a committed ImportBatch already exists for this file hash. */
export async function importHashExists(fileHash: string): Promise<boolean> {
  const batch = await prisma.importBatch.findFirst({ where: { fileHash } });
  return batch != null;
}

export interface BatchRow {
  date: string; // ISO yyyy-mm-dd (empty string → use today as fallback)
  rowType: "OUT" | "SALE" | "CAPITAL" | "CAPITAL_RETURN";
  bucket?: OutBucket;
  amount?: number; // paisa
  billed?: number; // paisa
  received?: number; // paisa
  weight?: number; // grams
  counterparty?: string;
  partner?: string;
  note?: string;
}

export async function commitImportBatch(opts: {
  filename: string;
  fileHash: string;
  sheetNames: string;
  rows: BatchRow[];
  skipped: number;
}): Promise<string> {
  const { filename, fileHash, sheetNames, rows, skipped } = opts;

  const batch = await prisma.importBatch.create({
    data: { filename, fileHash, sheetNames, rowCount: rows.length, skipped },
  });

  const fallbackDate = new Date();

  for (const r of rows) {
    const date = r.date ? new Date(r.date) : fallbackDate;

    if (r.rowType === "OUT") {
      const kind = r.bucket === "HUSK_PURCHASE" ? "HUSK_PURCHASE" : "OPERATIONAL";
      await prisma.entry.create({
        data: {
          date,
          direction: "OUT",
          kind,
          bucket: r.bucket ?? null,
          priority: null, // priority is set via bulk-tag after import
          amount: r.amount != null ? BigInt(r.amount) : null,
          weight: r.weight != null ? BigInt(r.weight) : null,
          counterparty: r.counterparty ?? null,
          note: r.note ?? null,
          source: "IMPORT",
          importBatchId: batch.id,
        },
      });
    } else if (r.rowType === "SALE") {
      await prisma.entry.create({
        data: {
          date,
          direction: "IN",
          kind: "SALE",
          billed: r.billed != null ? BigInt(r.billed) : null,
          received: r.received != null ? BigInt(r.received) : null,
          weight: r.weight != null ? BigInt(r.weight) : null,
          counterparty: r.counterparty ?? null,
          note: r.note ?? null,
          source: "IMPORT",
          importBatchId: batch.id,
        },
      });
    } else if (r.rowType === "CAPITAL") {
      await prisma.entry.create({
        data: {
          date,
          direction: "IN",
          kind: "CAPITAL",
          amount: r.amount != null ? BigInt(r.amount) : null,
          partner: r.partner ?? null,
          note: r.note ?? null,
          source: "IMPORT",
          importBatchId: batch.id,
        },
      });
    } else if (r.rowType === "CAPITAL_RETURN") {
      await prisma.entry.create({
        data: {
          date,
          direction: "OUT",
          kind: "CAPITAL_RETURN",
          amount: r.amount != null ? BigInt(r.amount) : null,
          partner: r.partner ?? null,
          note: r.note ?? null,
          source: "IMPORT",
          importBatchId: batch.id,
        },
      });
    }
  }

  return batch.id;
}

export async function getBatchWithEntries(batchId: string) {
  return prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { entries: { where: { deletedAt: null }, orderBy: { date: "asc" } } },
  });
}

export async function rollbackBatch(batchId: string): Promise<void> {
  await prisma.entry.updateMany({
    where: { importBatchId: batchId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function bulkSetPriority(
  batchId: string,
  priority: Priority,
  filter: { bucket?: OutBucket; counterparty?: string } = {}
): Promise<number> {
  const where: Prisma.EntryWhereInput = {
    importBatchId: batchId,
    deletedAt: null,
    direction: "OUT",
  };
  if (filter.bucket) where.bucket = filter.bucket;
  if (filter.counterparty) where.counterparty = filter.counterparty;

  const result = await prisma.entry.updateMany({ where, data: { priority } });
  return result.count;
}
