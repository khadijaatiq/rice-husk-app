import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPKR, formatKg, gramsToKg } from "@/lib/money";
import type { Summary } from "@/lib/calc";
import { RateControl } from "@/components/rate-control";

export function StockCard({
  summary,
  ratePaisaPerKg,
}: {
  summary: Summary;
  ratePaisaPerKg: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Stock on Hand
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">
          {formatKg(summary.kgOnHand)}
        </p>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          {formatPKR(summary.stockValue)}
        </p>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Purchased</span>
            <span className="tabular-nums">
              {gramsToKg(summary.kgPurchased).toLocaleString("en-PK")} kg
            </span>
          </div>
          <div className="flex justify-between">
            <span>Sold</span>
            <span className="tabular-nums">
              {gramsToKg(summary.kgSold).toLocaleString("en-PK")} kg
            </span>
          </div>
        </div>
        <div className="mt-3 border-t pt-3">
          <RateControl current={ratePaisaPerKg} />
        </div>
      </CardContent>
    </Card>
  );
}
