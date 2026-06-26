import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPKR } from "@/lib/money";
import type { Summary } from "@/lib/calc";
import { cn } from "@/lib/utils";

export function PartnersCard({ summary }: { summary: Summary }) {
  if (summary.partners.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No capital entries yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Partners (50 / 50)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Partner
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Capital
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Share
              </th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                Remaining
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.partners.map((p) => (
              <tr key={p.partner} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{p.partner}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPKR(p.netCapital)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatPKR(p.expenseShare)}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right tabular-nums font-medium",
                    p.capitalRemaining >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                  )}
                >
                  {formatPKR(p.capitalRemaining)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
