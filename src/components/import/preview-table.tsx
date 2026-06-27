"use client";

import type { PreviewRow } from "@/lib/import/types";
import { paisaToRupees } from "@/lib/money";

interface Props {
  rows: PreviewRow[];
}

export function PreviewTable({ rows }: Props) {
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const ambiguous = rows.filter((r) => r.dateAmbiguous && r.errors.length === 0);
  const clean = rows.filter((r) => r.errors.length === 0 && !r.dateAmbiguous);

  return (
    <div className="space-y-4">
      {errorRows.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <strong>{errorRows.length} row{errorRows.length > 1 ? "s" : ""} will be skipped</strong> due to parse errors.
        </div>
      )}
      {ambiguous.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>{ambiguous.length} row{ambiguous.length > 1 ? "s" : ""} have ambiguous dates</strong> — review them below before confirming.
        </div>
      )}
      {clean.length > 0 && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          <strong>{clean.length} row{clean.length > 1 ? "s" : ""} ready to import.</strong>
        </div>
      )}

      <div className="max-h-[60vh] overflow-auto rounded border border-gray-200">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-600">Row</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">Sheet</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">Date</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">Type</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">Bucket / Partner</th>
              <th className="px-2 py-2 text-right font-medium text-gray-600">Amount</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">Counterparty</th>
              <th className="px-2 py-2 text-left font-medium text-gray-600">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const hasError = row.errors.length > 0;
              const hasWarning = row.dateAmbiguous || row.warnings.length > 0;
              const rowCls = hasError
                ? "bg-red-50 border-b border-red-100"
                : hasWarning
                  ? "bg-amber-50 border-b border-amber-100"
                  : "border-b border-gray-100";

              const amount = row.rowType === "SALE"
                ? (row.billed ?? 0)
                : (row.amount ?? 0);

              return (
                <tr key={idx} className={rowCls}>
                  <td className="px-2 py-1 text-gray-400">{row.rowNum}</td>
                  <td className="px-2 py-1 text-gray-500">{row.sheet}</td>
                  <td className="px-2 py-1 font-mono">
                    {row.date || <span className="text-red-500">{row.rawDate || "—"}</span>}
                    {row.dateAmbiguous && (
                      <span className="ml-1 text-amber-600" title={row.dateFlag}>⚠</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${
                      row.rowType === "OUT" ? "bg-red-100 text-red-700"
                      : row.rowType === "SALE" ? "bg-blue-100 text-blue-700"
                      : "bg-purple-100 text-purple-700"
                    }`}>
                      {row.rowType}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-gray-700">
                    {row.bucket ?? row.partner ?? "—"}
                  </td>
                  <td className="px-2 py-1 text-right font-mono">
                    {amount > 0 ? `Rs ${paisaToRupees(amount).toLocaleString("en-PK")}` : "—"}
                  </td>
                  <td className="px-2 py-1 text-gray-600 max-w-[160px] truncate">
                    {row.counterparty ?? "—"}
                  </td>
                  <td className="px-2 py-1 max-w-[200px]">
                    {row.errors.map((e, i) => (
                      <div key={i} className="text-red-600">{e}</div>
                    ))}
                    {row.dateFlag && row.dateAmbiguous && (
                      <div className="text-amber-700">{row.dateFlag}</div>
                    )}
                    {row.warnings.filter((w) => !row.dateFlag || !w.includes("date")).map((w, i) => (
                      <div key={i} className="text-amber-600">{w}</div>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
