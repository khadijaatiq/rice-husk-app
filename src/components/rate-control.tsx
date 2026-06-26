"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setRateAction } from "@/app/actions";

export function RateControl({ current }: { current: number }) {
  const rateRupees = current / 100;
  const [value, setValue] = useState(rateRupees.toString());
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const n = parseFloat(value);
    if (!Number.isInteger(n) || n <= 0) {
      setError("Whole number Rs/kg required");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await setRateAction({ rateRupees: n });
      if (result?.error) setError(result.error);
    });
  }

  const dirty = parseFloat(value) !== rateRupees;

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Rate (Rs / kg)</p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-24 text-sm tabular-nums"
          disabled={isPending}
        />
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
