import { ImportWizard } from "@/components/import/import-wizard";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Import from Excel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Parses <strong>Rice Husk</strong> sheet (expenses) and <strong>partnership</strong> sheet (sales + capital).
          Sheet1, PUNN, and Sheet2 are ignored. Dates are normalised and ambiguous rows are flagged for review.
          Re-importing the same file is blocked.
        </p>
      </div>
      <ImportWizard />
    </main>
  );
}
