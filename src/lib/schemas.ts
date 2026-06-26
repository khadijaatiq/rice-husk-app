import { z } from "zod";

const BUCKETS = [
  "HUSK_PURCHASE",
  "PETTY_CASH",
  "LABOUR",
  "TRANSPORT",
  "BROKER",
  "MISC",
] as const;

const PRIORITIES = ["REQUIRED", "EXTRA"] as const;
const PAYMENT_SOURCES = ["ALFALAH", "MEEZAN", "CASH", "OTHER"] as const;

// Single flat form schema used by the entry form (all fields optional at the
// schema level; superRefine enforces per-type requirements so the form can
// show field-level errors for whichever type is active).
export const entryFormSchema = z
  .object({
    type: z.enum(["OUT", "SALE", "CAPITAL", "CAPITAL_RETURN"]),
    date: z.string().min(1, "Date required"),
    // OUT fields
    bucket: z.enum(BUCKETS).optional(),
    amountRupees: z.coerce.number().optional(),
    priority: z.enum(PRIORITIES).optional(),
    weightKg: z.coerce.number().optional(),
    // SALE fields
    weightSoldKg: z.coerce.number().optional(),
    billedRupees: z.coerce.number().optional(),
    receivedRupees: z.coerce.number().optional(),
    // CAPITAL / CAPITAL_RETURN
    partner: z.string().optional(),
    // Common optional
    note: z.string().optional(),
    counterparty: z.string().optional(),
    paymentSource: z.enum([...PAYMENT_SOURCES, "" as ""]).optional(),
  })
  .superRefine((d, ctx) => {
    const err = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    if (d.type === "OUT") {
      if (!d.bucket) err("bucket", "Bucket required");
      if (!d.amountRupees || d.amountRupees <= 0)
        err("amountRupees", "Amount must be > 0");
      if (!d.priority) err("priority", "Priority required");
    }
    if (d.type === "SALE") {
      if (!d.weightSoldKg || d.weightSoldKg <= 0)
        err("weightSoldKg", "Weight sold must be > 0");
      if (!d.billedRupees || d.billedRupees <= 0)
        err("billedRupees", "Billed amount must be > 0");
      if (d.receivedRupees == null || d.receivedRupees < 0)
        err("receivedRupees", "Received must be ≥ 0");
    }
    if (d.type === "CAPITAL" || d.type === "CAPITAL_RETURN") {
      if (!d.partner?.trim()) err("partner", "Partner name required");
      if (!d.amountRupees || d.amountRupees <= 0)
        err("amountRupees", "Amount must be > 0");
    }
  });

export type EntryFormData = z.infer<typeof entryFormSchema>;

export const setRateSchema = z.object({
  rateRupees: z.coerce
    .number()
    .positive("Rate must be > 0")
    .int("Rate must be a whole number (Rs/kg)"),
});

export type SetRateData = z.infer<typeof setRateSchema>;
