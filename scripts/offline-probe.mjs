// Probe: tangkap data live filter_api utk riset rumus hit (offline engine).
// Simpan ke /tmp/offline_probe.json: per formula -> rows { res, v[], h[] }.
// Tujuan: reverse-engineer aturan seq[i].h (mistik/struktur) dari (formula, digit hasil).
import { wlaFilterApi } from "../app/lib/wla.js";
import { writeFileSync } from "node:fs";

const markets = ["sgp", "syd", "hkg"];
const formulas = [
  { k1: 2, m1: 1, s1: "off" },             // K1
  { k1: 3, m1: 1, s1: "off" },             // E1
  { k1: 0, m1: 1, s1: "off" },             // A1
  { k1: 1, m1: 1, s1: "off" },             // C1
  { k1: 2, m1: 5, s1: "off" },             // K5
  { k1: 2, m1: 1, s1: "ml" },              // K1ml
  { k1: 2, m1: 1, s1: "ix" },              // K1ix
  { k1: 2, m1: 1, s1: "mb" },              // K1mb
  { k1: 2, m1: 1, s1: "ty" },              // K1ty
  { k1: 2, m1: 5, s1: "off", op1: "+", k2: 1, m2: 6, s2: "mb" }, // K5+C6mb
  { k1: 4, m1: 1, s1: "off" },             // J1
  { k1: 7, m1: 1, s1: "off" },             // SH
];

const mkState = (market, formula) => {
  // activeCols default ai (K,E = idx 2,3) agar seq tetap 10 elemen
  const manualHidden = [];
  for (let i = 0; i < 10; i++) if (![2, 3].includes(i)) manualHidden.push(i);
  return {
    market, limit: 40, days: [], patah: 0, fCol: "ai",
    k1: formula.k1 ?? 2, m1: formula.m1 ?? 1, s1: (formula.s1 ?? "off"),
    op1: formula.op1 || "+", k2: formula.k2 ?? -1, m2: formula.m2 ?? 1, s2: formula.s2 || "off",
    op2: formula.op2 || "+", k3: formula.k3 ?? -1, m3: formula.m3 ?? 1, s3: formula.s3 || "off",
    sf: formula.sf || "off", hideEmpty: true, targetD: 0, showRef: 0, manualHidden, isFrozen: true,
  };
};

const out = {};
for (const market of markets) {
  for (const f of formulas) {
    const key = `${market}::${JSON.stringify(f)}`;
    try {
      const r = await wlaFilterApi(mkState(market, f));
      const rows = (r.rows || []).filter((x) => !x.is_ref).map((row) => ({
        res: row.res,
        v: row.seq.map((s) => (s && typeof s.v === "number" ? s.v : null)),
        h: row.seq.map((s) => s && s.h ? s.h : null),
      }));
      out[key] = { activeCols: r.activeCols, rows };
      console.log(`OK ${key} rows=${rows.length}`);
    } catch (e) {
      console.log(`ERR ${key}: ${e.message}`);
    }
  }
}
writeFileSync("/tmp/offline_probe.json", JSON.stringify(out, null, 2));
console.log("\nSaved /tmp/offline_probe.json  size=", (process._getActiveHandles && "/tmp/offline_probe.json"));