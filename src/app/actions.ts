"use server";

import { revalidatePath } from "next/cache";
import { entryFormSchema, setRateSchema } from "@/lib/schemas";
import * as repo from "@/lib/repository";
import { rupeesToPaisa, kgToGrams } from "@/lib/money";
import type { OutBucket, Priority, PaymentSource } from "@/lib/types";

type ActionResult = { error: string } | undefined;

export async function createEntryAction(raw: unknown): Promise<ActionResult> {
  const parsed = entryFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  try {
    if (d.type === "OUT") {
      await repo.createEntry({
        date: d.date,
        direction: "OUT",
        kind: d.bucket === "HUSK_PURCHASE" ? "HUSK_PURCHASE" : "OPERATIONAL",
        bucket: d.bucket as OutBucket,
        priority: d.priority as Priority,
        amount: rupeesToPaisa(d.amountRupees!),
        weight:
          d.bucket === "HUSK_PURCHASE" && d.weightKg
            ? kgToGrams(d.weightKg)
            : undefined,
        note: d.note || undefined,
        counterparty: d.counterparty || undefined,
        paymentSource: (d.paymentSource || undefined) as PaymentSource | undefined,
      });
    } else if (d.type === "SALE") {
      await repo.createEntry({
        date: d.date,
        direction: "IN",
        kind: "SALE",
        weight: kgToGrams(d.weightSoldKg!),
        billed: rupeesToPaisa(d.billedRupees!),
        received: rupeesToPaisa(d.receivedRupees!),
        note: d.note || undefined,
        counterparty: d.counterparty || undefined,
      });
    } else if (d.type === "CAPITAL") {
      await repo.createEntry({
        date: d.date,
        direction: "IN",
        kind: "CAPITAL",
        partner: d.partner!,
        amount: rupeesToPaisa(d.amountRupees!),
        note: d.note || undefined,
      });
    } else {
      await repo.createEntry({
        date: d.date,
        direction: "OUT",
        kind: "CAPITAL_RETURN",
        partner: d.partner!,
        amount: rupeesToPaisa(d.amountRupees!),
        note: d.note || undefined,
      });
    }
    revalidatePath("/");
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updateEntryAction(
  id: string,
  raw: unknown
): Promise<ActionResult> {
  const parsed = entryFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const d = parsed.data;

  try {
    if (d.type === "OUT") {
      await repo.updateEntry(id, {
        date: d.date,
        bucket: d.bucket as OutBucket,
        priority: d.priority as Priority,
        amount: rupeesToPaisa(d.amountRupees!),
        weight:
          d.bucket === "HUSK_PURCHASE" && d.weightKg
            ? kgToGrams(d.weightKg)
            : undefined,
        note: d.note || undefined,
        counterparty: d.counterparty || undefined,
        paymentSource: (d.paymentSource || undefined) as PaymentSource | undefined,
      });
    } else if (d.type === "SALE") {
      await repo.updateEntry(id, {
        date: d.date,
        weight: kgToGrams(d.weightSoldKg!),
        billed: rupeesToPaisa(d.billedRupees!),
        received: rupeesToPaisa(d.receivedRupees!),
        note: d.note || undefined,
        counterparty: d.counterparty || undefined,
      });
    } else {
      await repo.updateEntry(id, {
        date: d.date,
        partner: d.partner!,
        amount: rupeesToPaisa(d.amountRupees!),
        note: d.note || undefined,
      });
    }
    revalidatePath("/");
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteEntryAction(id: string): Promise<ActionResult> {
  try {
    await repo.softDeleteEntry(id);
    revalidatePath("/");
  } catch (e) {
    return { error: String(e) };
  }
}

export async function setRateAction(raw: unknown): Promise<ActionResult> {
  const parsed = setRateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  try {
    await repo.setCurrentRate(parsed.data.rateRupees * 100);
    revalidatePath("/");
  } catch (e) {
    return { error: String(e) };
  }
}
