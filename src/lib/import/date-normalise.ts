/**
 * Normalise date values coming out of SheetJS.
 *
 * The real file mixes four formats that must be handled:
 *   1. DD/MM/YY strings  (Pakistani convention — day first)
 *   2. Raw Excel date serials (integer, e.g. 45669)
 *   3. Day/month-swapped strings (month field > 12 after initial parse → swap)
 *   4. Wrong-year entries (a batch typed "2028" that means "2026")
 *
 * "Never guess silently" (CLAUDE.md): ambiguous cells are flagged for human
 * review; the function still returns its best-guess date so the preview can
 * render, but `ambiguous: true` blocks commit until the user confirms.
 */

const CURRENT_YEAR = 2026; // update when the business year changes

export interface DateResult {
  /** ISO yyyy-mm-dd. Always set, even when ambiguous. Empty string on hard parse failure. */
  date: string;
  /** Requires human confirmation before this row can be committed. */
  ambiguous: boolean;
  /** Human-readable reason this date was flagged (ambiguous or wrong-year). */
  flag?: string;
  /** True when we cannot produce any date at all. */
  parseError: boolean;
}

/**
 * Convert an Excel date serial to a UTC date triple.
 * Uses the standard (serial − 25569) × 86400 s formula which correctly
 * skips the phantom Lotus 1-2-3 leap-day at serial 60.
 */
function serialToYMD(serial: number): { y: number; m: number; d: number } {
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function buildResult(y: number, m: number, d: number, ambiguous: boolean): DateResult {
  if (m < 1 || m > 12) return fail(`invalid month ${m}`);
  if (d < 1 || d > 31) return fail(`invalid day ${d}`);

  let flag: string | undefined;
  if (y > CURRENT_YEAR) {
    flag = `year ${y} is in the future — likely a typo (e.g. ${y} → ${y - 2}?)`;
    ambiguous = true;
  }

  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { date: iso, ambiguous, flag, parseError: false };
}

function fail(reason: string): DateResult {
  return { date: "", ambiguous: false, flag: reason, parseError: true };
}

export function normaliseDate(raw: unknown): DateResult {
  if (raw == null || raw === "") return fail("empty cell");

  // JS Date — SheetJS with cellDates:true returns these for date-formatted cells
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return fail("invalid Date object");
    return buildResult(raw.getFullYear(), raw.getMonth() + 1, raw.getDate(), false);
  }

  // Number — unformatted Excel date serial
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 1) return fail(`bad serial ${raw}`);
    const { y, m, d } = serialToYMD(raw);
    return buildResult(y, m, d, false);
  }

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return fail("empty string");

    // DD/MM/YY, DD/MM/YYYY, DD-MM-YY, DD.MM.YY …
    const slash = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (slash) {
      let day = parseInt(slash[1], 10);
      let month = parseInt(slash[2], 10);
      let year = parseInt(slash[3], 10);
      if (year < 100) year += 2000;

      // Day/month-swapped: if the "month" position is > 12, the pair was MM/DD
      if (month > 12 && day <= 12) {
        [day, month] = [month, day];
      }

      // Ambiguous: could be DD/MM or MM/DD (both ≤ 12)
      const ambiguous = day <= 12 && month <= 12;
      return buildResult(year, month, day, ambiguous);
    }

    // ISO yyyy-mm-dd (already normalised — pass through with a year check)
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return buildResult(parseInt(iso[1]), parseInt(iso[2]), parseInt(iso[3]), false);
    }

    // Numeric string that might be a serial
    const asNum = Number(s);
    if (Number.isInteger(asNum) && asNum > 40000 && asNum < 60000) {
      const { y, m, d } = serialToYMD(asNum);
      return buildResult(y, m, d, false);
    }

    return fail(`unrecognised format: "${s}"`);
  }

  return fail(`unexpected type: ${typeof raw}`);
}
