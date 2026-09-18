// Probe bentuk response filter_api Angkanet utk beberapa market scanner.
// Jalankan: node --input-type=module -e "$(cat probe.mjs)"  (atau via import)
import { wlaFilterApi } from "../app/lib/wla.js";

const mkState = (market, formula, fCol = "ai") => {
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
};

const markets = ["sgp", "syd", "hkg", "twn", "jpn"];
const formulas = [
  { label: "simplest A1", f: { k1: 0, m1: 1, s1: "off" } },
  { label: "K5+C6mb", f: { k1: 2, m1: 5, s1: "off", op1: "+", k2: 1, m2: 6, s2: "mb" } },
];

try {
  for (const market of markets) {
    for (const { label, f } of formulas) {
      try {
        const state = mkState(market, f);
        const r = await wlaFilterApi(state);
        const rows = r?.rows;
        const first = rows?.[0];
        const last = rows?.[rows.length - 1];
        console.log("=".repeat(60));
        console.log(`MARKET=${market} formula=${label} fCol=ai`);
        console.log("keys:", Object.keys(r || {}).join(","));
        console.log("rows:", rows?.length, "| activeCols:", JSON.stringify(r?.activeCols));
        if (first) {
          console.log("row0 keys:", Object.keys(first).join(","));
          console.log("row0.res:", first.res, "| is_ref:", first.is_ref);
          const seq = first.seq;
          console.log("row0.seq type:", Array.isArray(seq) ? "array" : typeof seq, "len:", Array.isArray(seq) ? seq.length : "?");
          if (Array.isArray(seq) && seq[0]) {
            console.log("seq[0] keys:", Object.keys(seq[0]).join(","));
            console.log("seq[0]:", JSON.stringify(seq[0]));
            console.log("seq[2]:", JSON.stringify(seq[2]));
            console.log("seq[3]:", JSON.stringify(seq[3]));
          }
          if (!Array.isArray(seq) && seq) {
            console.log("seq sample:", JSON.stringify(seq).slice(0, 300));
          }
        }
        if (last && last !== first) {
          console.log("LAST res:", last.res, "| seq[2]:", JSON.stringify(last.seq?.[2] ?? null), "seq[3]:", JSON.stringify(last.seq?.[3] ?? null));
        }
      } catch (e) {
        console.log(`MARKET=${market} formula=${label} ERROR:`, e.message);
      }
    }
  }
} catch (e) {
  console.log("DISCOVERY ERROR:", e.message);
  process.exit(1);
}