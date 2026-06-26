/**
 * calc.ts — the calculation engine.
 *
 * Pure functions, no I/O. Given the ledger + the editable rate, it returns
 * every headline the business cares about, computed the way the Rice Husk
 * sheet computes them:
 *
 *   - expenses split into buckets that reconcile to the total (sheet: D+E+F+G = C)
 *   - investment        = husk-purchase total          (sheet column G)
 *   - given to people   = petty cash + labour + ...    (sheet columns D,E,F)
 *   - extra money       = sum of EXTRA-priority OUT     (req 5)
 *   - sales billed vs received -> receivable
 *   - stock = kg purchased - kg sold; valued at the editable rate (sheet S, T)
 *   - everything halved 50/50 between the two partners (sheet's `/2`)
 *
 * Because the business is purchase-and-sale led, the headline position is
 * expressed the sheet's way: (cash received from sales + value of stock on
 * hand) - total expenses. Stock-on-hand is counted, so being mid-cycle with
 * unsold husk does not read as a loss.
 */

import {
  halve,
  sumGrams,
  sumPaisa,
  valueAtRate,
  type Grams,
  type Paisa,
} from "./money.js";
import {
  PEOPLE_BUCKETS,
  isCapital,
  isCapitalReturn,
  isOut,
  isSale,
  type Entry,
  type EngineConfig,
  type OutBucket,
} from "./types.js";

/** Fixed partnership divisor — the sheet always splits by 2, never by capital. */
export const PARTNER_SPLIT = 2;

export interface PartnerPosition {
  partner: string;
  capitalContributed: Paisa;
  capitalReturned: Paisa;
  /** capital in, net of returns */
  netCapital: Paisa;
  /** this partner's 50% share of total expenses (sheet: C2/2) */
  expenseShare: Paisa;
  /** this partner's 50% share of cash received from sales */
  salesReceivedShare: Paisa;
  /** netCapital - expenseShare (sheet: 5,000,000 - 4,038,385) */
  capitalRemaining: Paisa;
}

export interface Summary {
  // --- expenses, by bucket (reconciles to totalExpenses) ---
  bucketTotals: Record<OutBucket, Paisa>;
  totalExpenses: Paisa; // sheet C121

  // --- the two headline expense groups ---
  investment: Paisa; // HUSK_PURCHASE total (sheet G121)
  givenToPeople: Paisa; // people buckets total (sheet D+E+F)

  // --- priority view (req 4 & 5) ---
  requiredOutflow: Paisa;
  extraOutflow: Paisa; // "extra money given to people" = EXTRA priority OUT

  // --- sales ---
  salesBilled: Paisa;
  salesReceived: Paisa; // sheet L28
  receivable: Paisa; // billed - received

  // --- stock (kg) ---
  kgPurchased: Grams;
  kgSold: Grams;
  kgOnHand: Grams; // sheet S (running purchased - sold)
  stockValue: Paisa; // kgOnHand x editable rate (sheet T)

  // --- partners (50/50) ---
  partners: PartnerPosition[];

  // --- purchase-and-sale headline ---
  /** (salesReceived + stockValue) - totalExpenses. Counts unsold stock as value. */
  position: Paisa;
}

function emptyBuckets(): Record<OutBucket, Paisa> {
  return {
    HUSK_PURCHASE: 0,
    PETTY_CASH: 0,
    LABOUR: 0,
    TRANSPORT: 0,
    BROKER: 0,
    MISC: 0,
  };
}

export function summarize(entries: Entry[], config: EngineConfig): Summary {
  const bucketTotals = emptyBuckets();
  const requiredAmts: Paisa[] = [];
  const extraAmts: Paisa[] = [];
  const billedAmts: Paisa[] = [];
  const receivedAmts: Paisa[] = [];
  const purchasedKg: Grams[] = [];
  const soldKg: Grams[] = [];

  // partner accumulators
  const capIn = new Map<string, Paisa[]>();
  const capOut = new Map<string, Paisa[]>();
  const push = (m: Map<string, Paisa[]>, k: string, v: Paisa) => {
    const arr = m.get(k) ?? [];
    arr.push(v);
    m.set(k, arr);
  };

  for (const e of entries) {
    if (isOut(e)) {
      bucketTotals[e.bucket] += e.amount;
      if (e.priority === "EXTRA") extraAmts.push(e.amount);
      else requiredAmts.push(e.amount);
      if (e.bucket === "HUSK_PURCHASE" && e.weight) purchasedKg.push(e.weight);
    } else if (isSale(e)) {
      billedAmts.push(e.billed);
      receivedAmts.push(e.received);
      soldKg.push(e.weight);
    } else if (isCapital(e)) {
      push(capIn, e.partner, e.amount);
    } else if (isCapitalReturn(e)) {
      push(capOut, e.partner, e.amount);
    }
  }

  const investment = bucketTotals.HUSK_PURCHASE;
  const givenToPeople = sumPaisa(PEOPLE_BUCKETS.map((b) => bucketTotals[b]));
  const totalExpenses = sumPaisa(Object.values(bucketTotals));

  const salesBilled = sumPaisa(billedAmts);
  const salesReceived = sumPaisa(receivedAmts);
  const receivable = salesBilled - salesReceived;

  const kgPurchased = sumGrams(purchasedKg);
  const kgSold = sumGrams(soldKg);
  const kgOnHand = kgPurchased - kgSold;
  const stockValue = valueAtRate(kgOnHand, config.ratePaisaPerKg);

  // partner positions — every partner gets an equal 50/50 share of the
  // shared pools, regardless of contribution (sheet's fixed `/2`).
  const [expenseShare] = halve(totalExpenses);
  const [salesReceivedShare] = halve(salesReceived);
  const partnerNames = new Set<string>([...capIn.keys(), ...capOut.keys()]);
  const partners: PartnerPosition[] = [...partnerNames].sort().map((name) => {
    const contributed = sumPaisa(capIn.get(name) ?? []);
    const returned = sumPaisa(capOut.get(name) ?? []);
    const netCapital = contributed - returned;
    return {
      partner: name,
      capitalContributed: contributed,
      capitalReturned: returned,
      netCapital,
      expenseShare,
      salesReceivedShare,
      capitalRemaining: netCapital - expenseShare,
    };
  });

  const position = salesReceived + stockValue - totalExpenses;

  return {
    bucketTotals,
    totalExpenses,
    investment,
    givenToPeople,
    requiredOutflow: sumPaisa(requiredAmts),
    extraOutflow: sumPaisa(extraAmts),
    salesBilled,
    salesReceived,
    receivable,
    kgPurchased,
    kgSold,
    kgOnHand,
    stockValue,
    partners,
    position,
  };
}
