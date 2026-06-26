import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPKR } from "@/lib/money";
import type { Summary } from "@/lib/calc";

const BUCKET_LABELS: Record<string, string> = {
  HUSK_PURCHASE: "Husk Purchase",
  PETTY_CASH: "Petty Cash",
  LABOUR: "Labour",
  TRANSPORT: "Transport",
  BROKER: "Broker",
  MISC: "Misc",
};

export function BucketCard({ summary }: { summary: Summary }) {
  const peopleBuckets = (
    ["PETTY_CASH", "LABOUR", "TRANSPORT", "BROKER", "MISC"] as const
  ).filter((b) => summary.bucketTotals[b] > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Expense Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Investment</p>
            <p className="font-semibold tabular-nums">
              {formatPKR(summary.investment)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Given to People</p>
            <p className="font-semibold tabular-nums">
              {formatPKR(summary.givenToPeople)}
            </p>
          </div>
        </div>
        <Separator />
        <div className="space-y-1">
          {peopleBuckets.map((b) => (
            <div key={b} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{BUCKET_LABELS[b]}</span>
              <span className="tabular-nums">
                {formatPKR(summary.bucketTotals[b])}
              </span>
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between text-xs font-medium">
          <span>Total Expenses</span>
          <span className="tabular-nums">{formatPKR(summary.totalExpenses)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
