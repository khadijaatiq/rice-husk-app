import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getEntries, getCurrentRate } from "@/lib/repository";
import { summarize } from "@/lib/calc";
import { buildWorkbook } from "@/lib/export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const isFullBackup = type === "full";

  const [entries, ratePaisaPerKg] = await Promise.all([
    getEntries(isFullBackup ? {} : { fromDate: from, toDate: to }),
    getCurrentRate(),
  ]);

  const summary = summarize(entries, { ratePaisaPerKg });

  let period: string | undefined;
  if (!isFullBackup && (from || to)) {
    period = `${from ?? "start"} to ${to ?? "today"}`;
  } else if (isFullBackup) {
    period = "Full backup — all time";
  }

  const wb = buildWorkbook(entries, summary, ratePaisaPerKg, { period });
  // type:"array" → number[] → Uint8Array<ArrayBuffer> satisfies BodyInit
  const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as number[];
  const buf = new Uint8Array(arr);

  const today = new Date().toISOString().split("T")[0];
  const filename = isFullBackup
    ? `rice-husk-backup-${today}.xlsx`
    : `rice-husk-report-${from ?? "all"}-to-${to ?? "all"}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
