import { getEntries, getCurrentRate } from "@/lib/repository";
import { summarize } from "@/lib/calc";
import { PositionCard } from "@/components/dashboard/position-card";
import { StockCard } from "@/components/dashboard/stock-card";
import { PartnersCard } from "@/components/dashboard/partners-card";
import { BucketCard } from "@/components/dashboard/bucket-card";
import { PriorityCard } from "@/components/dashboard/priority-card";
import { LedgerSection } from "@/components/ledger/ledger-section";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [entries, ratePaisaPerKg] = await Promise.all([
    getEntries(),
    getCurrentRate(),
  ]);
  const summary = summarize(entries, { ratePaisaPerKg });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Rice Husk Ledger</h1>
        <p className="text-xs text-muted-foreground">
          Purchase-and-sale ledger · PKR · all amounts in paisa internally
        </p>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
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

        {/* Ledger */}
        <LedgerSection entries={entries} />
      </main>
    </div>
  );
}
