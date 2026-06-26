import type { Entry as PrismaEntry } from "@prisma/client";
import type {
  Entry,
  OutEntry,
  SaleEntry,
  CapitalEntry,
  CapitalReturnEntry,
  OutBucket,
  Priority,
  PaymentSource,
} from "./types";

// Re-exported so tests can construct mock rows without touching @prisma/client directly.
export type DbRow = PrismaEntry;

export function mapDbEntry(row: DbRow): Entry {
  const base = {
    id: row.id,
    // Prisma returns DateTime as Date; domain uses ISO yyyy-mm-dd string.
    date: row.date.toISOString().split("T")[0],
    note: row.note ?? undefined,
    counterparty: row.counterparty ?? undefined,
    paymentSource: (row.paymentSource as PaymentSource) ?? undefined,
    source: row.source as "MANUAL" | "IMPORT",
  };

  if (row.kind === "SALE") {
    const entry: SaleEntry = {
      ...base,
      direction: "IN",
      kind: "SALE",
      weight: Number(row.weight!),
      billed: Number(row.billed!),
      received: Number(row.received!),
    };
    return entry;
  }

  if (row.kind === "CAPITAL") {
    const entry: CapitalEntry = {
      ...base,
      direction: "IN",
      kind: "CAPITAL",
      partner: row.partner!,
      amount: Number(row.amount!),
    };
    return entry;
  }

  if (row.kind === "CAPITAL_RETURN") {
    const entry: CapitalReturnEntry = {
      ...base,
      direction: "OUT",
      kind: "CAPITAL_RETURN",
      partner: row.partner!,
      amount: Number(row.amount!),
    };
    return entry;
  }

  // HUSK_PURCHASE or OPERATIONAL → OutEntry (no `kind` field in domain type)
  const entry: OutEntry = {
    ...base,
    direction: "OUT",
    bucket: row.bucket! as OutBucket,
    amount: Number(row.amount!),
    priority: row.priority! as Priority,
    weight: row.weight != null ? Number(row.weight) : undefined,
  };
  return entry;
}
