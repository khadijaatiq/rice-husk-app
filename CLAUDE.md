# Rice Husk Ledger — Project Constitution

Persistent context for Claude Code. These are binding decisions, already made
with the business owner. Do not relitigate them. When a prompt conflicts with
this file, this file wins — ask before deviating.

## What this is
A purchase-and-sale ledger for a rice-husk trading business (single owner +
partners). The spine is: **buy husk → hold stock (kg) → sell husk**. Expenses
(money given to people) and partner capital are supporting context, not the
focus. Single currency: PKR only.

## Tech stack (decided — do not substitute)
- Next.js (App Router) + TypeScript, strict mode.
- Tailwind + shadcn/ui. Clean, minimal, **no decorative animation**; transitions
  may be subtle and fast only. Prioritise smoothness and clarity.
- Database + auth + file storage: **Supabase** (Postgres) free tier.
- ORM: **Prisma**. Validation: **Zod** on every input and every imported row.
- Excel parsing: **SheetJS (xlsx)**. Tests: **vitest**.
- Deploy: Vercel (app) + Supabase (data). Both free tier.

## Money & weight — non-negotiable
- Money is stored and summed as **integer paisa** (1 PKR = 100 paisa). Never
  store or add money as a floating-point rupee value.
- Weight is **integer grams** (1 kg = 1000 g; **1 mund = 40 kg**).
- The market rate is **integer paisa per kg** and is **user-editable** (it
  fluctuates). Rate history is kept so old valuations stay explainable.
- Formatting to rupees/kg happens only at the display boundary.

## Domain rules (mirror the owner's spreadsheet exactly)
- Every OUT row falls in one bucket, and the buckets reconcile to the total
  (sheet: `D+E+F+G = C`):
  - `HUSK_PURCHASE` = **the investment** (sheet column G).
  - `PETTY_CASH`, `LABOUR`, `TRANSPORT`, `BROKER`, `MISC` = **money given to
    people / service charges** (sheet columns D, E, F).
- Priority is **binary** on OUT rows: `REQUIRED` or `EXTRA`.
  **Extra money = sum of all EXTRA-priority outflow** (requirement 5).
- Partners split **a fixed 50/50** (divisor = 2), **never weighted by
  contribution**. This matches the sheet's `/2`. Each partner's
  `capitalRemaining = netCapital − totalExpenses/2`.
- Stock on hand `= kg purchased − kg sold`; valued at the editable rate.
- Purchase-and-sale headline **position = sales received + stock value −
  total expenses**. Unsold stock counts as value, so a mid-cycle pile of husk
  must NOT read as a loss.
- A husk SALE tracks `billed` vs `received`; the difference is the receivable.

## Data integrity
- Rows are **soft-deleted** (`deletedAt`), never hard-deleted. Keep audit
  timestamps. Financial history is never silently erased.
- Excel imports are grouped into an `ImportBatch` so an upload can be reviewed
  and rolled back.

## Phase 1 is DONE — do not regenerate
`src/lib/money.ts`, `src/lib/types.ts`, `src/lib/calc.ts` and their tests are
built and passing (16 tests). Treat them as the source of truth for all
calculations. Build UI, persistence, and import **on top of** `summarize()` in
`calc.ts`; do not re-derive the math elsewhere. If a calculation seems wrong,
change the test first, get owner confirmation, then the code.

## Golden numbers (the contract the engine already satisfies)
From the real `Rice_Husk_Expenses.xlsx`. Any change that breaks these is a bug:
- total expenses 8,076,769.50  (= husk 4,662,941.50 + petty 675,923 + labour
  877,785 + transport 1,860,120)
- sales received 2,483,030
- stock on hand 291,150 kg → @ Rs 17/kg = 4,949,550
- Azeem capital remaining = 5,000,000 − 4,038,384.75 = 961,615.25

## Excel import map (the owner's real file)
- `Sheet1` and `PUNN ` → **ignore** (owner says useless).
- `partnership` → sales table + partner capital.
- `Rice Husk` → the categorised expense ledger; **source of truth** for imports.
- `Sheet2` → cross-check only. It re-lists the same husk purchases as
  `Rice Husk`; **do not import both** or husk cost double-counts.
- Date cleanup is required: the file mixes `DD/MM/YY`, raw Excel serials
  (e.g. 45669), day/month-swapped dates, and wrong years (a batch typed `2028`
  that means `2026`). Importer must normalise these and **flag anything
  ambiguous for human review before committing** — never guess silently.

## Working agreement
- One phase at a time. Run `npm test` and the dev server before declaring a
  phase done. Commit per phase.
- Keep the 16 existing tests green at all times.
- Prefer small, verifiable changes. Ask the owner when a money rule is unclear.
