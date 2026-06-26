/**
 * money.ts — exact-money + exact-weight primitives.
 *
 * RULE: never store or sum money as a floating-point rupee value.
 * Money lives as integer PAISA (1 rupee = 100 paisa). Weight lives as
 * integer GRAMS (1 kg = 1000 g; 1 mund = 40 kg = 40_000 g). All engine
 * math is integer math, so 0.1 + 0.2 problems cannot occur. Floats appear
 * only at the display boundary (formatPKR / formatKg).
 *
 * The spreadsheet carries values like 8,076,769.5 and 4,038,384.75, i.e.
 * down to a quarter-rupee. Paisa (2 dp) represents these exactly.
 */

export type Paisa = number; // integer
export type Grams = number; // integer
export type PaisaPerKg = number; // integer; e.g. Rs 17/kg => 1700

const isInt = (n: number) => Number.isInteger(n);

// ---- money ----------------------------------------------------------------

/** Convert a rupee figure (possibly fractional, e.g. 4038384.75) to paisa. */
export function rupeesToPaisa(rupees: number): Paisa {
  return Math.round(rupees * 100);
}

export function paisaToRupees(p: Paisa): number {
  assertIntPaisa(p);
  return p / 100;
}

export function assertIntPaisa(p: Paisa): void {
  if (!isInt(p)) throw new Error(`Paisa must be an integer, got ${p}`);
}

/** Sum a list of paisa amounts exactly. */
export function sumPaisa(amounts: Paisa[]): Paisa {
  let total = 0;
  for (const a of amounts) {
    assertIntPaisa(a);
    total += a;
  }
  return total;
}

/**
 * The partnership splits everything in two (per the spreadsheet's `/2`,
 * regardless of each partner's capital). Odd paisa go to the first share so
 * the two halves always re-sum to the original to the paisa.
 */
export function halve(p: Paisa): [Paisa, Paisa] {
  assertIntPaisa(p);
  const low = Math.trunc(p / 2);
  const high = p - low; // absorbs the odd paisa
  return [high, low];
}

/** Display only. Pakistani rupee, 2 decimals. */
export function formatPKR(p: Paisa): string {
  const r = paisaToRupees(p);
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
  }).format(r);
}

// ---- weight ---------------------------------------------------------------

export const GRAMS_PER_KG = 1000;
export const KG_PER_MUND = 40; // domain constant used throughout the sheet

export function kgToGrams(kg: number): Grams {
  return Math.round(kg * GRAMS_PER_KG);
}
export function mundToGrams(mund: number): Grams {
  return Math.round(mund * KG_PER_MUND * GRAMS_PER_KG);
}
export function gramsToKg(g: Grams): number {
  return g / GRAMS_PER_KG;
}

export function sumGrams(weights: Grams[]): Grams {
  let total = 0;
  for (const w of weights) total += w;
  return total;
}

/**
 * Value of stock on hand = grams x (paisa per kg) / 1000, rounded to the
 * nearest paisa. Editable rate, because the market price per kg fluctuates.
 * e.g. 291,150 kg @ Rs 17/kg => 4,949,550.00.
 */
export function valueAtRate(grams: Grams, ratePaisaPerKg: PaisaPerKg): Paisa {
  return Math.round((grams * ratePaisaPerKg) / GRAMS_PER_KG);
}

export function formatKg(g: Grams): string {
  return `${new Intl.NumberFormat("en-PK").format(gramsToKg(g))} kg`;
}
