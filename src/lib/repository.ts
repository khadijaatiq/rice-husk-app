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
