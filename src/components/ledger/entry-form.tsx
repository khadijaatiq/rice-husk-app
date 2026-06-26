"use client";

import { useEffect, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { entryFormSchema, type EntryFormData } from "@/lib/schemas";
import { createEntryAction, updateEntryAction } from "@/app/actions";
import {
  isOut,
  isSale,
  isCapital,
  isCapitalReturn,
  type Entry,
} from "@/lib/types";
import { gramsToKg } from "@/lib/money";

type EntryType = "OUT" | "SALE" | "CAPITAL" | "CAPITAL_RETURN";

function typeOf(entry: Entry): EntryType {
  if (isCapitalReturn(entry)) return "CAPITAL_RETURN";
  if (isCapital(entry)) return "CAPITAL";
  if (isSale(entry)) return "SALE";
  return "OUT";
}

function defaultsFor(entry: Entry | null): Partial<EntryFormData> {
  if (!entry) return { type: "OUT", date: new Date().toISOString().split("T")[0] };
  const type = typeOf(entry);
  const base = { type, date: entry.date, note: entry.note ?? "" };
  if (isOut(entry))
    return {
      ...base,
      bucket: entry.bucket,
      amountRupees: entry.amount / 100,
      priority: entry.priority,
      weightKg:
        entry.weight != null ? gramsToKg(entry.weight) : undefined,
      counterparty: entry.counterparty ?? "",
      paymentSource: entry.paymentSource ?? "",
    };
  if (isSale(entry))
    return {
      ...base,
      weightSoldKg: gramsToKg(entry.weight),
      billedRupees: entry.billed / 100,
      receivedRupees: entry.received / 100,
      counterparty: entry.counterparty ?? "",
    };
  if (isCapital(entry) || isCapitalReturn(entry))
    return { ...base, partner: entry.partner, amountRupees: entry.amount / 100 };
  return base;
}

interface Props {
  entry: Entry | null;
  open: boolean;
  onClose: () => void;
}

export function EntryFormDialog({ entry, open, onClose }: Props) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EntryFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(entryFormSchema) as Resolver<EntryFormData>,
    defaultValues: defaultsFor(entry) as EntryFormData,
  });

  useEffect(() => {
    reset(defaultsFor(entry) as EntryFormData);
  }, [entry, open, reset]);

  const type = watch("type");
  const bucket = watch("bucket");

  function onSubmit(data: EntryFormData) {
    startTransition(async () => {
      const result = entry
        ? await updateEntryAction(entry.id, data)
        : await createEntryAction(data);
      if (!result?.error) onClose();
    });
  }

  const isEdit = !!entry;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Entry" : "Add Entry"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Type selector — locked when editing */}
          <Field label="Type" error={errors.type?.message}>
            <Select
              value={type}
              onValueChange={(v) => setValue("type", v as EntryType)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OUT">Expense (OUT)</SelectItem>
                <SelectItem value="SALE">Sale (IN)</SelectItem>
                <SelectItem value="CAPITAL">Capital (IN)</SelectItem>
                <SelectItem value="CAPITAL_RETURN">Capital Return (OUT)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* Date */}
          <Field label="Date" error={errors.date?.message}>
            <Input type="date" {...register("date")} />
          </Field>

          {/* OUT fields */}
          {type === "OUT" && (
            <>
              <Field label="Bucket" error={errors.bucket?.message}>
                <Select
                  value={bucket ?? ""}
                  onValueChange={(v) =>
                    setValue("bucket", v as EntryFormData["bucket"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bucket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HUSK_PURCHASE">Husk Purchase</SelectItem>
                    <SelectItem value="PETTY_CASH">Petty Cash</SelectItem>
                    <SelectItem value="LABOUR">Labour</SelectItem>
                    <SelectItem value="TRANSPORT">Transport</SelectItem>
                    <SelectItem value="BROKER">Broker</SelectItem>
                    <SelectItem value="MISC">Misc</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Amount (Rs)" error={errors.amountRupees?.message}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("amountRupees")}
                />
              </Field>
              <Field label="Priority" error={errors.priority?.message}>
                <Select
                  value={watch("priority") ?? ""}
                  onValueChange={(v) =>
                    setValue("priority", v as "REQUIRED" | "EXTRA")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REQUIRED">Required</SelectItem>
                    <SelectItem value="EXTRA">Extra</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {bucket === "HUSK_PURCHASE" && (
                <Field label="Weight bought (kg)" error={errors.weightKg?.message}>
                  <Input type="number" step="0.001" min="0" {...register("weightKg")} />
                </Field>
              )}
              <Field label="Payment source" error={undefined}>
                <Select
                  value={watch("paymentSource") ?? ""}
                  onValueChange={(v) =>
                    setValue("paymentSource", v as EntryFormData["paymentSource"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— none —</SelectItem>
                    <SelectItem value="ALFALAH">Alfalah</SelectItem>
                    <SelectItem value="MEEZAN">Meezan</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {/* SALE fields */}
          {type === "SALE" && (
            <>
              <Field label="Weight sold (kg)" error={errors.weightSoldKg?.message}>
                <Input type="number" step="0.001" min="0" {...register("weightSoldKg")} />
              </Field>
              <Field label="Billed (Rs)" error={errors.billedRupees?.message}>
                <Input type="number" step="0.01" min="0" {...register("billedRupees")} />
              </Field>
              <Field label="Received (Rs)" error={errors.receivedRupees?.message}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("receivedRupees")}
                />
              </Field>
            </>
          )}

          {/* CAPITAL / CAPITAL_RETURN fields */}
          {(type === "CAPITAL" || type === "CAPITAL_RETURN") && (
            <>
              <Field label="Partner" error={errors.partner?.message}>
                <Input {...register("partner")} placeholder="e.g. Azeem" />
              </Field>
              <Field label="Amount (Rs)" error={errors.amountRupees?.message}>
                <Input type="number" step="0.01" min="0" {...register("amountRupees")} />
              </Field>
            </>
          )}

          {/* Common optional fields */}
          <Field label="Counterparty" error={undefined}>
            <Input {...register("counterparty")} placeholder="Optional" />
          </Field>
          <Field label="Note" error={undefined}>
            <Input {...register("note")} placeholder="Optional" />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
