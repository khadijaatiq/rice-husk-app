"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { bulkSetPriorityAction } from "@/app/import/actions";

interface BucketGroup {
  bucket: string;
  count: number;
  untagged: number;
}

interface Props {
  batchId: string;
  groups: BucketGroup[];
  totalRows: number;
}

export function BulkTag({ batchId, groups, totalRows }: Props) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<Record<string, string>>({});
  const router = useRouter();

  function tag(bucket: string | null, priority: "REQUIRED" | "EXTRA") {
    startTransition(async () => {
      const res = await bulkSetPriorityAction(
        batchId,
        priority,
        bucket ? { bucket } : {}
      );

      const key = bucket ?? "__all__";
      if ("error" in res) {
        setResults((r) => ({ ...r, [key]: `Error: ${res.error}` }));
      } else {
        setResults((r) => ({ ...r, [key]: `✓ ${res.count} rows set to ${priority}` }));
        router.refresh();
      }
    });
  }

  const untagged = groups.reduce((s, g) => s + g.untagged, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Set priority</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {untagged} of {totalRows} OUT rows have no priority. Tag them by bucket or in bulk.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || untagged === 0}
            onClick={() => tag(null, "REQUIRED")}
          >
            All → REQUIRED
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending || untagged === 0}
            onClick={() => tag(null, "EXTRA")}
          >
            All → EXTRA
          </Button>
        </div>
      </div>

      {groups.length > 0 && (
        <table className="w-full text-sm border border-gray-200 rounded">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Bucket</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Untagged</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.bucket} className="border-b border-gray-100">
                <td className="px-3 py-2 font-mono text-xs">{g.bucket}</td>
                <td className="px-3 py-2 text-right text-gray-700">{g.untagged}</td>
                <td className="px-3 py-2 text-right text-gray-500">{g.count}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-6 px-2"
                      disabled={isPending || g.untagged === 0}
                      onClick={() => tag(g.bucket, "REQUIRED")}
                    >
                      REQUIRED
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-6 px-2"
                      disabled={isPending || g.untagged === 0}
                      onClick={() => tag(g.bucket, "EXTRA")}
                    >
                      EXTRA
                    </Button>
                  </div>
                  {results[g.bucket] && (
                    <p className="text-center text-xs text-green-700 mt-0.5">
                      {results[g.bucket]}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {results["__all__"] && (
        <p className="text-xs text-green-700">{results["__all__"]}</p>
      )}
    </div>
  );
}
