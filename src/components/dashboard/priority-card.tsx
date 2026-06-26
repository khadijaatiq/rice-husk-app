import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPKR } from "@/lib/money";
import type { Summary } from "@/lib/calc";

export function PriorityCard({ summary }: { summary: Summary }) {
  const total = summary.requiredOutflow + summary.extraOutflow;
  const extraPct =
    total > 0 ? ((summary.extraOutflow / total) * 100).toFixed(1) : "0.0";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Required vs Extra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Required</p>
            <p className="font-semibold tabular-nums">
              {formatPKR(summary.requiredOutflow)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Extra</p>
            <p className="font-semibold tabular-nums">
              {formatPKR(summary.extraOutflow)}
            </p>
          </div>
        </div>
        {summary.extraOutflow > 0 && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${extraPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Extra is {extraPct}% of total outflow
            </p>
          </>
        )}
        <Separator />
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sales billed</span>
            <span className="tabular-nums">{formatPKR(summary.salesBilled)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sales received</span>
            <span className="tabular-nums">{formatPKR(summary.salesReceived)}</span>
          </div>
          {summary.receivable > 0 && (
            <div className="flex justify-between font-medium text-amber-600">
              <span>Receivable</span>
              <span className="tabular-nums">{formatPKR(summary.receivable)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
