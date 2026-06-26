"use client";

import { useState, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EntryFormDialog } from "./entry-form";
import { deleteEntryAction } from "@/app/actions";
import {
  isOut,
  isSale,
  isCapital,
  isCapitalReturn,
  type Entry,
  type OutBucket,
} from "@/lib/types";
import { formatPKR, gramsToKg } from "@/lib/money";

interface Filters {
  fromDate: string;
  toDate: string;
  direction: string;
  bucket: string;
  priority: string;
}

function entryDescription(e: Entry): string {
  if (isOut(e)) return BUCKET_LABELS[e.bucket] ?? e.bucket;
  if (isSale(e)) return `Sold ${gramsToKg(e.weight).toLocaleString("en-PK")} kg`;
  if (isCapital(e)) return `Capital · ${e.partner}`;
  if (isCapitalReturn(e)) return `Return · ${e.partner}`;
  return "—";
}

function entryAmount(e: Entry): string {
  if (isOut(e)) return formatPKR(e.amount);
  if (isSale(e))
    return `${formatPKR(e.received)} / ${formatPKR(e.billed)}`;
  if (isCapital(e) || isCapitalReturn(e)) return formatPKR(e.amount);
  return "—";
}

function entryBadge(e: Entry) {
  if (isOut(e) && e.bucket === "HUSK_PURCHASE")
    return <Badge variant="secondary">Investment</Badge>;
  if (isOut(e)) return <Badge variant="outline">Expense</Badge>;
  if (isSale(e)) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Sale</Badge>;
  if (isCapital(e)) return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">Capital</Badge>;
  return <Badge variant="outline">Return</Badge>;
}

const BUCKET_LABELS: Record<string, string> = {
  HUSK_PURCHASE: "Husk Purchase",
  PETTY_CASH: "Petty Cash",
  LABOUR: "Labour",
  TRANSPORT: "Transport",
  BROKER: "Broker",
  MISC: "Misc",
};

function applyFilters(entries: Entry[], f: Filters): Entry[] {
  return entries.filter((e) => {
    if (f.fromDate && e.date < f.fromDate) return false;
    if (f.toDate && e.date > f.toDate) return false;
    if (f.direction === "IN" && e.direction !== "IN") return false;
    if (f.direction === "OUT" && e.direction !== "OUT") return false;
    if (f.bucket && !(isOut(e) && e.bucket === f.bucket)) return false;
    if (f.priority && !(isOut(e) && e.priority === f.priority)) return false;
    return true;
  });
}

export function LedgerSection({ entries }: { entries: Entry[] }) {
  const [filters, setFilters] = useState<Filters>({
    fromDate: "",
    toDate: "",
    direction: "",
    bucket: "",
    priority: "",
  });
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, startDelete] = useTransition();

  const visible = useMemo(
    () => applyFilters(entries, filters),
    [entries, filters]
  );

  function setFilter<K extends keyof Filters>(k: K, v: string) {
    setFilters((prev) => ({ ...prev, [k]: v }));
  }

  function handleDelete(id: string) {
    if (!confirm("Soft-delete this entry?")) return;
    startDelete(async () => {
      await deleteEntryAction(id);
    });
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Ledger</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          + Add Entry
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          className="h-8 w-36 text-xs"
          placeholder="From"
          value={filters.fromDate}
          onChange={(e) => setFilter("fromDate", e.target.value)}
        />
        <Input
          type="date"
          className="h-8 w-36 text-xs"
          placeholder="To"
          value={filters.toDate}
          onChange={(e) => setFilter("toDate", e.target.value)}
        />
        <Select value={filters.direction} onValueChange={(v) => setFilter("direction", v)}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="IN">IN</SelectItem>
            <SelectItem value="OUT">OUT</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.bucket} onValueChange={(v) => setFilter("bucket", v)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Bucket" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All buckets</SelectItem>
            {Object.entries(BUCKET_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.priority} onValueChange={(v) => setFilter("priority", v)}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="REQUIRED">Required</SelectItem>
            <SelectItem value="EXTRA">Extra</SelectItem>
          </SelectContent>
        </Select>
        {Object.values(filters).some(Boolean) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() =>
              setFilters({ fromDate: "", toDate: "", direction: "", bucket: "", priority: "" })
            }
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Date</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  No entries
                </TableCell>
              </TableRow>
            )}
            {visible.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs tabular-nums">{e.date}</TableCell>
                <TableCell>{entryBadge(e)}</TableCell>
                <TableCell className="text-sm">
                  {entryDescription(e)}
                  {e.note && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {e.note}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {entryAmount(e)}
                </TableCell>
                <TableCell>
                  {isOut(e) && (
                    <span
                      className={`text-xs ${
                        e.priority === "EXTRA"
                          ? "text-amber-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {e.priority === "EXTRA" ? "Extra" : "Req"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setEditEntry(e)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleDelete(e.id)}
                    >
                      Del
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {visible.length} of {entries.length} entries
      </p>

      <EntryFormDialog
        entry={editEntry}
        open={showAdd || !!editEntry}
        onClose={() => {
          setShowAdd(false);
          setEditEntry(null);
        }}
      />
    </div>
  );
}
