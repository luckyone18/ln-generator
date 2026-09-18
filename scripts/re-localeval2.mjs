// Verifikasi logika mistik & key turunan pada evaluasi formula Angkanet.
import { wlaFilterApi } from "../app/lib/wla.js";

function mkState(formula, fCol = "ai") {
  const activeCols = fCol === "ai" ? [2, 3] : [0, 1];
  const manualHidden = [];
  for (let i = 0; i < 10; i++) if (!activeCols.includes(i)) manualHidden.push(i);
  return {
    market: "sgp", limit: 15, days: [], patah: 0, fCol,
    k1: formula.k1 ?? 2, m1: formula.m1 ?? 1, s1: (formula.s1 ?? "") || "off",
    op1: formula.op1 || "+",
    k2: formula.k2 ?? -1, m2: formula.m2 ?? 1, s2: formula.s2 || "off",
    op2: formula.op2 || "+",
    k3: formula.k3 ?? -1, m3: formula.m3 ?? 1, s3: formula.s3 || "off",
    sf: formula.sf || "off",
    hideEmpty: true, targetD: 0, showRef: 0, manualHidden, isFrozen: true,
  };
}

const tests = [
  { label: "E1ml", f: { k1: 3, m1: 1, s1: "ml" } },
  { label: "E1mb", f: { k1: 3, m1: 1, s1: "mb" } },
  { label: "E1ix", f: { k1: 3, m1: 1, s1: "ix" } },
  { label: "A1ml", f: { k1: 0, m1: 1, s1: "ml" } },
  { label: "J1 (jumlah 2d)", f: { k1: 4, m1: 1, s1: "off" } },
  { label: "SH (shio)", f: { k1: 7, m1: 1, s1: "off" } },
  { label: "K5+C6mb", f: { k1: 2, m1: 5, s1: "off", op1: "+", k2: 1, m2: 6, s2: "mb" } },
];

const MISTIK_OLD = { 0:[0,5],1:[1,6],2:[2,7],3:[3,8],4:[4,9],5:[5,0],6:[6,1],7:[7,2],8:[8,3],9:[9,4] }; // tebakan pola lama? nanti koreksi dr data

async function dump(t) {
  const r = await wlaFilterApi(mkState(t.f));
  console.log("=".repeat(70));
  console.log(`${t.label}  activeCols=${JSON.stringify(r.activeCols)}`);
  for (const row of r.rows.filter((x) => !x.is_ref).slice(0, 5)) {
    const res = row.res;
    const v = row.seq.map((s) => s?.v);
    const h = row.seq.map((s) => s?.h ? Object.keys(s.h).filter((kk) => s.h[kk]) : []);
    console.log(`res=${res} | v=${JSON.stringify(v)}`);
    console.log(`      h-hits(cols where any flag) = ${JSON.stringify(h.map((x,i)=>x.length?i:null).filter(x=>x!==null))}`);
  }
}

try {
  for (const t of tests) { try { await dump(t); } catch (e) { console.log(`ERR ${t.label}:`, e.message); } }
} catch (e) { console.log("FATAL:", e.message); process.exit(1); }