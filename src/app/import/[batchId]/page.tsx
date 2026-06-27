import { notFound } from "next/navigation";
import Link from "next/link";
import { getBatchWithEntries } from "@/lib/repository";
import { mapDbEntry } from "@/lib/entry-map";
import { BulkTag } from "@/components/import/bulk-tag";
import { Button } from "@/components/ui/button";
import { paisaToRupees } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const batch = await getBatchWithEntries(batchId);
  if (!batch) notFound();

  const entries = batch.entries.map(mapDbEntry);
  const outEntries = entries.filter((e) => e.direction === "OUT" && "bucket" in e);

  // Build bucket groups for bulk-tag UI
  const groupMap = new Map<string, { count: number; untagged: number }>();
  for (const e of outEntries) {
    if (!("bucket" in e)) continue;
    const b = (e as { bucket: string }).bucket;
    const existing = groupMap.get(b) ?? { count: 0, untagged: 0 };
    existing.count++;
    if (!(e as { priority?: string }).priority) existing.untagged++;
    groupMap.set(b, existing);
  }

  const groups = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, g]) => ({ bucket, ...g }));

  const totalUntagged = groups.reduce((s, g) => s + g.untagged, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Import complete</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {batch.filename} · {batch.rowCount} rows imported · {batch.skipped} skipped
            · sheets: {batch.sheetNames}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <Button size="sm" variant="outline">← Dashboard</Button>
          </Link>
          <Link href="/import">
            <Button size="sm" variant="outline">Import another</Button>
          </Link>
        </div>
      </div>

      {/* Bulk-tag priority */}
      {outEntries.length > 0 && (
        <div className="rounded border border-gray-200 p-4 space-y-3">
          <BulkTag batchId={batchId} groups={groups} totalRows={outEntries.length} />
          {totalUntagged === 0 && (
            <p className="text-xs text-green-700">All OUT rows have a priority set.</p>
          )}
        </div>
      )}

      {/* Entry list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Imported entries</h2>
        <div className="rounded border border-gray-200 overflow-auto max-h-[60vh]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-gray-600">Date</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600">Bucket / Partner</th>
                <th className="px-2 py-2 text-right font-medium text-gray-600">Amount</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600">Priority</th>
                <th className="px-2 py-2 text-left font-medium text-gray-600">Counterparty</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const amount =
                  "amount" in e ? (e as { amount: number }).amount
                  : "billed" in e ? (e as { billed: number }).billed
                  : 0;
                const bucketOrPartner =
                  "bucket" in e ? (e as { bucket: string }).bucket
                  : "partner" in e ? (e as { partner: string }).partner
                  : "";
                const priority = "priority" in e ? (e as { priority?: string }).priority : undefined;
                const counterparty = "counterparty" in e ? (e as { counterparty?: string }).counterparty : undefined;

                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-2 py-1 font-mono">{e.date}</td>
                    <td className="px-2 py-1">{e.direction}</td>
                    <td className="px-2 py-1">{bucketOrPartner || "—"}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      Rs {paisaToRupees(amount ?? 0).toLocaleString("en-PK")}
                    </td>
                    <td className="px-2 py-1">
                      {priority ? (
                        <span className={`text-[10px] font-medium ${priority === "REQUIRED" ? "text-gray-700" : "text-amber-700"}`}>
                          {priority}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-600">{counterparty ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
