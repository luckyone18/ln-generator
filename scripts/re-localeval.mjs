// Reverse-engineer logika evaluasi formula Angkanet.
// Dump seq[].v per posisi untuk beberapa formula + hasil 4D, lalu cari pola.
import { wlaFilterApi } from "../app/lib/wla.js";

const PHP_KEYS = ["A", "C", "K", "E", "J", "JT", "JD", "JS", "J3D", "J4D", "J5D"];

function mkState(market, formula, fCol = "ai") {
  const activeCols = fCol === "ai" ? [2, 3] : [0, 1];
  const manualHidden = [];
  for (let i = 0; i < 10; i++) if (!activeCols.includes(i)) manualHidden.push(i);
  return {
    market, limit: 15, days: [], patah: 0, fCol,
    k1: formula.k1 ?? 2, m1: formula.m1 ?? 1, s1: (formula.s1 ?? "") || "off",
    op1: formula.op1 || "+",
    k2: formula.k2 ?? -1, m2: formula.m2 ?? 1, s2: formula.s2 || "off",
    op2: formula.op2 || "+",
    k3: formula.k3 ?? -1, m3: formula.m3 ?? 1, s3: formula.s3 || "off",
    sf: formula.sf || "off",
    hideEmpty: true, targetD: 0, showRef: 0, manualHidden, isFrozen: true,
  };
}

// formula: array of terms {label, k,m,s, extraTerms}
const tests = [
  { label: "E1 (ekor idx1)", f: { k1: 3, m1: 1, s1: "off" } },
  { label: "E2", f: { k1: 3, m1: 2, s1: "off" } },
  { label: "E3ml (ekor 3 mistik ml)", f: { k1: 3, m1: 3, s1: "ml" } },
  { label: "K1 (kepala idx1)", f: { k1: 2, m1: 1, s1: "off" } },
];

async function dump(market, { label, f }) {
  const r = await wlaFilterApi(mkState(market, f));
  console.log("=".repeat(70));
  console.log(`MARKET=${market} ${label}  activeCols=${JSON.stringify(r.activeCols)}`);
  const rows = r.rows.filter((x) => !x.is_ref);
  for (const row of rows.slice(0, 8)) {
    const res = row.res; // 4 digit: A C K E
    const a = +res[0], c = +res[1], k = +res[2], e = +res[3];
    const v = row.seq.map((s) => s?.v);
    console.log(
      `res=${res} | A=${a} C=${c} K=${k} E=${e} | v=${JSON.stringify(v)}`
    );
  }
}

try {
  for (const t of tests) {
    try { await dump("sgp", t); } catch (e) { console.log(`ERR ${t.label}:`, e.message); }
  }
} catch (e) {
  console.log("FATAL:", e.message);
  process.exit(1);
}