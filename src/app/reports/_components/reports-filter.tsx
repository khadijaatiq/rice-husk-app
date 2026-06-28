"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReportsFilter({ from, to }: { from: string; to: string }) {
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (fromVal) params.set("from", fromVal);
    if (toVal) params.set("to", toVal);
    const qs = params.toString();
    router.push(`/reports${qs ? "?" + qs : ""}`);
  }

  function handleClear() {
    setFromVal("");
    setToVal("");
    router.push("/reports");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          className="h-8 w-36 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          className="h-8 w-36 text-sm"
        />
      </div>
      <Button type="submit" size="sm">
        Apply
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
        Clear
      </Button>
    </form>
  );
}
