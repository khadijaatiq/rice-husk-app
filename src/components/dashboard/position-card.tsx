import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPKR } from "@/lib/money";
import type { Summary } from "@/lib/calc";
import { cn } from "@/lib/utils";

export function PositionCard({ summary }: { summary: Summary }) {
  const positive = summary.position >= 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Operating Position
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            positive ? "text-emerald-600" : "text-red-600"
          )}
        >
          {formatPKR(summary.position)}
        </p>
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Sales received</span>
            <span className="tabular-nums">{formatPKR(summary.salesReceived)}</span>
          </div>
          <div className="flex justify-between">
            <span>Stock value</span>
            <span className="tabular-nums">{formatPKR(summary.stockValue)}</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span>Total expenses</span>
            <span className="tabular-nums text-foreground">
              − {formatPKR(summary.totalExpenses)}
            </span>
          </div>
        </div>
        {summary.receivable > 0 && (
          <p className="mt-2 text-xs text-amber-600">
            Receivable: {formatPKR(summary.receivable)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
