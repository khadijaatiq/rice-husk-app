import { getEntries, getCurrentRate } from "@/lib/repository";
import { summarize } from "@/lib/calc";
import { PositionCard } from "@/components/dashboard/position-card";
import { StockCard } from "@/components/dashboard/stock-card";
import { PartnersCard } from "@/components/dashboard/partners-card";
import { BucketCard } from "@/components/dashboard/bucket-card";
import { PriorityCard } from "@/components/dashboard/priority-card";
import { ReportsFilter } from "./_components/reports-filter";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from: rawFrom, to: rawTo } = await searchParams;
  const from = rawFrom ?? "";
  const to = rawTo ?? "";

  const [entries, ratePaisaPerKg] = await Promise.all([
    getEntries({ fromDate: from || undefined, toDate: to || undefined }),
    getCurrentRate(),
  ]);

  const summary = summarize(entries, { ratePaisaPerKg });

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  const qs = exportParams.toString();
  const exportUrl = `/api/export${qs ? "?" + qs : ""}`;

  const periodLabel =
    from || to
      ? `${from || "start"} → ${to || "today"} · ${entries.length} entries`
      : `All time · ${entries.length} entries`;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
        {/* Filter + export bar */}
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Reports</p>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>

          <ReportsFilter key={`${from}-${to}`} from={from} to={to} />

          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={exportUrl} download>
                Export to Excel
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="/api/export?type=full" download>
                Full Backup
              </a>
            </Button>
          </div>
        </div>

        {/* Row 1: Position · Stock · Partners */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PositionCard summary={summary} />
          <StockCard summary={summary} ratePaisaPerKg={ratePaisaPerKg} />
          <PartnersCard summary={summary} />
        </div>

        {/* Row 2: Bucket breakdown · Required vs Extra */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BucketCard summary={summary} />
          <PriorityCard summary={summary} />
        </div>
      </main>
    </div>
  );
}
