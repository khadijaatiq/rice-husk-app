/**
 * partnership-import.cjs
 * Run from project root: node partnership-import.cjs
 *
 * Imports ONLY the partnership sheet from Rice_Husk_Expenses.xlsx as a NEW
 * ImportBatch, leaving the existing Rice Husk entries untouched.
 *
 * Partnership sheet layout (confirmed from raw dump):
 *   LEFT  col 0=partner/return, col 1=date, col 2=capital amount
 *   RIGHT col 6=sale date, col 7=buyer, col 8=kg, col 10=billed, col 11=received
 */

require("dotenv").config({ path: ".env" });

const XLSX = require("xlsx");
const { createHash } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const FILE_PATH = "C:/Users/user/Downloads/Rice Husk Expenses.xlsx";
const SHEET_NAME = "partnership";

// ── helpers ───────────────────────────────────────────────────────────────────

function cellNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function cellStr(v) {
  const s = String(v ?? "").trim();
  return s || undefined;
}

function rupeesToPaisa(r) {
  // Round to avoid float precision errors
  return Math.round(r * 100);
}

function kgToGrams(kg) {
  return Math.round(kg * 1000);
}

function serialToISO(serial) {
  // Excel serial → UTC ISO date string
  const ms = (serial - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function normaliseDate(raw) {
  if (raw == null || raw === "") return { date: "", err: true };
  if (typeof raw === "number") {
    return { date: serialToISO(raw), err: false };
  }
  if (typeof raw === "string") {
    const m = raw.trim().match(/^(\d{1,2})[\/\-.]([\d]{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      let d = parseInt(m[1]),
        mo = parseInt(m[2]),
        y = parseInt(m[3]);
      if (y < 100) y += 2000;
      // swap if month > 12 but day ≤ 12
      if (mo > 12 && d <= 12) [d, mo] = [mo, d];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return { date: "", err: true };
      return {
        date:
          y +
          "-" +
          String(mo).padStart(2, "0") +
          "-" +
          String(d).padStart(2, "0"),
        err: false,
      };
    }
  }
  return { date: "", err: true };
}

// ── parse partnership sheet ───────────────────────────────────────────────────

function parsePartnership(ws) {
  const rawNums = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (!rawNums || rawNums.length < 2) return [];

  const header = rawNums[0];

  // Detect columns (same logic as parsePartnershipSheet in TS)
  let capAmountIdx = null, capDateIdx = null, saleDateIdx = null;
  let saleBuyerIdx = null, saleKgIdx = null, saleBilledIdx = null, saleReceivedIdx = null;

  for (let i = 0; i < header.length; i++) {
    const h = String(header[i] ?? "").trim().toLowerCase();
    if (!h) continue;
    if (/capital|investment/i.test(h) && capAmountIdx == null) capAmountIdx = i;
    else if (/^date|^dt/i.test(h)) {
      if (capDateIdx == null) capDateIdx = i;
      else if (saleDateIdx == null) saleDateIdx = i;
    } else if (/billing|buyer|customer|party|client/i.test(h) && saleBuyerIdx == null) saleBuyerIdx = i;
    else if (/\bkg\b|weight|qty|quantity/i.test(h) && saleKgIdx == null) saleKgIdx = i;
    else if (/bill[ei]?d|invoice|total|amount/i.test(h) && saleBilledIdx == null) saleBilledIdx = i;
    else if (/receiv[ei]?d|reciev[ei]?d/i.test(h) && saleReceivedIdx == null) saleReceivedIdx = i;
  }

  const effectiveSaleDateIdx = saleDateIdx ?? capDateIdx;
  const results = [];

  for (let ri = 1; ri < rawNums.length; ri++) {
    const row = rawNums[ri];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const col0 = String(row[0] ?? "").trim();

    // ── LEFT side: CAPITAL / CAPITAL_RETURN ──────────────────────────────────
    if (col0 && !/^total$/i.test(col0) && capAmountIdx != null) {
      const amt = cellNum(row[capAmountIdx]);
      if (amt != null && amt > 0) {
        const isReturn = /^return\s+to\b/i.test(col0);
        const partner = isReturn
          ? col0.replace(/^return\s+to\s+/i, "").trim()
          : col0;
        const capDateRaw = capDateIdx != null ? row[capDateIdx] : null;
        const { date } = capDateRaw != null && capDateRaw !== ""
          ? normaliseDate(capDateRaw)
          : { date: "" };
        results.push({
          rowType: isReturn ? "CAPITAL_RETURN" : "CAPITAL",
          partner,
          amount: rupeesToPaisa(amt),
          date,
          row: ri + 1,
        });
      }
    }

    // ── RIGHT side: SALE ─────────────────────────────────────────────────────
    if (effectiveSaleDateIdx != null && saleBilledIdx != null) {
      const rawDate = row[effectiveSaleDateIdx];
      const billed = cellNum(row[saleBilledIdx]);
      if (rawDate != null && rawDate !== "" && billed != null && billed > 0) {
        const receivedRaw = saleReceivedIdx != null ? cellNum(row[saleReceivedIdx]) : null;
        const kgRaw = saleKgIdx != null ? cellNum(row[saleKgIdx]) : null;
        const buyer = saleBuyerIdx != null ? cellStr(row[saleBuyerIdx]) : undefined;
        const { date, err } = normaliseDate(rawDate);
        results.push({
          rowType: "SALE",
          date,
          dateErr: err,
          counterparty: buyer,
          weight: kgRaw != null && kgRaw > 0 ? kgToGrams(kgRaw) : null,
          billed: rupeesToPaisa(billed),
          received: rupeesToPaisa(receivedRaw ?? 0),
          row: ri + 1,
        });
      }
    }
  }

  return results;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Read and parse file
  const buf = require("fs").readFileSync(FILE_PATH);
  const fileHash =
    createHash("sha256").update(buf).digest("hex") + "-partnership";

  const wb = XLSX.read(buf, { type: "buffer", raw: true });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" not found`);

  const entries = parsePartnership(ws);

  const sales = entries.filter((e) => e.rowType === "SALE");
  const caps = entries.filter((e) => e.rowType === "CAPITAL");
  const rets = entries.filter((e) => e.rowType === "CAPITAL_RETURN");

  console.log("\n── Parsed entries ──────────────────────────────────────────");
  console.log(`CAPITAL (${caps.length}):`);
  caps.forEach((c) =>
    console.log(
      `  Row ${c.row}: ${c.partner} Rs ${(c.amount / 100).toLocaleString()} date=${c.date || "(fallback today)"}`
    )
  );
  console.log(`\nCAPITAL_RETURN (${rets.length}):`);
  rets.forEach((r) =>
    console.log(
      `  Row ${r.row}: return to ${r.partner} Rs ${(r.amount / 100).toLocaleString()} date=${r.date}`
    )
  );
  console.log(`\nSALES (${sales.length}):`);
  sales.forEach((s) =>
    console.log(
      `  Row ${s.row}: ${s.date} ${s.counterparty} kg=${s.weight ? s.weight / 1000 : "??"} billed=${s.billed / 100} recv=${s.received / 100}`
    )
  );

  const totalBilled = sales.reduce((sum, s) => sum + s.billed, 0);
  const totalReceived = sales.reduce((sum, s) => sum + s.received, 0);
  const totalKg = sales.reduce((sum, s) => sum + (s.weight ? s.weight / 1000 : 0), 0);
  console.log(`\nTotals: billed=Rs ${(totalBilled / 100).toLocaleString()} received=Rs ${(totalReceived / 100).toLocaleString()} kg=${totalKg}`);

  // 2. Validate expected totals before committing
  const EXPECTED_BILLED = 277857500; // 2778575 × 100 paisa
  const EXPECTED_RECV = 248303000;   // 2483030 × 100 paisa
  const EXPECTED_KG = 168254;
  if (totalBilled !== EXPECTED_BILLED)
    throw new Error(`Billed mismatch: got ${totalBilled}, want ${EXPECTED_BILLED}`);
  if (totalReceived !== EXPECTED_RECV)
    throw new Error(`Received mismatch: got ${totalReceived}, want ${EXPECTED_RECV}`);
  if (totalKg !== EXPECTED_KG)
    throw new Error(`KG mismatch: got ${totalKg}, want ${EXPECTED_KG}`);
  console.log("\n✓ All totals verified against golden numbers");

  // 3. Connect to DB
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // 4. Check if this partnership batch already exists
  const existing = await prisma.importBatch.findFirst({ where: { fileHash } });
  if (existing) {
    console.log(`\n⚠ Partnership batch already imported (id=${existing.id}). Skipping.`);
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  // 5. Count existing Rice Husk entries (must stay untouched)
  const existingBefore = await prisma.entry.count({ where: { deletedAt: null } });
  console.log(`\nExisting entries before import: ${existingBefore}`);

  // 6. Create a new ImportBatch for partnership only
  const today = new Date();
  const batch = await prisma.importBatch.create({
    data: {
      filename: "Rice Husk Expenses.xlsx (partnership)",
      fileHash,
      sheetNames: SHEET_NAME,
      rowCount: entries.length,
      skipped: 0,
    },
  });
  console.log(`\nCreated ImportBatch id=${batch.id}`);

  // 7. Insert entries
  for (const e of entries) {
    const date = e.date ? new Date(e.date) : today;

    if (e.rowType === "CAPITAL") {
      await prisma.entry.create({
        data: {
          date,
          direction: "IN",
          kind: "CAPITAL",
          amount: BigInt(e.amount),
          partner: e.partner ?? null,
          source: "IMPORT",
          importBatchId: batch.id,
        },
      });
    } else if (e.rowType === "CAPITAL_RETURN") {
      await prisma.entry.create({
        data: {
          date,
          direction: "OUT",
          kind: "CAPITAL_RETURN",
          amount: BigInt(e.amount),
          partner: e.partner ?? null,
          source: "IMPORT",
          importBatchId: batch.id,
        },
      });
    } else if (e.rowType === "SALE") {
      await prisma.entry.create({
        data: {
          date,
          direction: "IN",
          kind: "SALE",
          billed: BigInt(e.billed),
          received: BigInt(e.received),
          weight: e.weight != null ? BigInt(e.weight) : null,
          counterparty: e.counterparty ?? null,
          source: "IMPORT",
          importBatchId: batch.id,
        },
      });
    }
  }

  // 8. Verify nothing was deleted from existing entries
  const existingAfter = await prisma.entry.count({
    where: { deletedAt: null, importBatchId: { not: batch.id } },
  });
  if (existingAfter !== existingBefore) {
    throw new Error(
      `Existing entry count changed! Before=${existingBefore} After=${existingAfter} — rollback needed`
    );
  }

  // 9. Show final DB state
  const batchEntries = await prisma.entry.count({
    where: { importBatchId: batch.id, deletedAt: null },
  });
  console.log(`\nCommitted ${batchEntries} entries to batch ${batch.id}`);
  console.log(`Existing Rice Husk entries untouched: ${existingAfter}`);

  // 10. Quick verification query
  const saleSums = await prisma.entry.aggregate({
    where: { importBatchId: batch.id, kind: "SALE", deletedAt: null },
    _sum: { billed: true, received: true, weight: true },
    _count: { id: true },
  });
  const capSums = await prisma.entry.findMany({
    where: { importBatchId: batch.id, kind: "CAPITAL", deletedAt: null },
    select: { partner: true, amount: true },
  });

  console.log("\n── Verification ────────────────────────────────────────────");
  console.log(`Sales count: ${saleSums._count.id}`);
  console.log(`Sales billed: Rs ${(Number(saleSums._sum.billed ?? 0) / 100).toLocaleString()}`);
  console.log(`Sales received: Rs ${(Number(saleSums._sum.received ?? 0) / 100).toLocaleString()}`);
  console.log(`Stock sold: ${Number(saleSums._sum.weight ?? 0) / 1000} kg`);
  console.log(`Capital entries:`);
  capSums.forEach((c) =>
    console.log(`  ${c.partner}: Rs ${(Number(c.amount) / 100).toLocaleString()}`)
  );

  await prisma.$disconnect();
  await pool.end();
  console.log("\n✓ Partnership import complete");
}

main().catch((err) => {
  console.error("\n✗ Import failed:", err);
  process.exit(1);
});
