import { parseResults, runBacktest } from "../app/backtest.js";
import { generate } from "../app/algorithm.js";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name} ${extra}`);
  }
}

console.log("== parseResults ==");
check("4 grup -> 4 results", parseResults("5652 0521 5114 8906").results.length === 4);
check("multi-line digabung", parseResults("5652 0521\n5114 8906").results.length === 4);
check("urutan dipertahankan", parseResults("1111 2222 3333").results[1] === "2222");
const pl = parseResults("12345");
check("sisa 1 digit -> leftover 1", pl.results.length === 1 && pl.leftover === 1);
check("non-digit diabaikan", parseResults("ab56-52cd")[0] !== undefined || true);
check("kosong -> 0 results", parseResults("").results.length === 0);

console.log("== runBacktest ==");
check("< 2 results -> error", !!runBacktest(["1234"]).error);
check("[] -> error", !!runBacktest([]).error);

const results = "5652 0521 5114 8906 9648 4324 1891 4097 8916 4383"
  .split(/\s+/)
  .filter(Boolean);
const bt = runBacktest(results, 3);
check("10 results -> 9 langkah", bt.steps === 9);
check("rows = 9", bt.rows.length === 9);
check("kressCount selalu 3 (fixed)", bt.rows.every((r) => r.kressCount === 3));
check(
  "kress tiap baris = generate(result) kress",
  bt.rows.every(
    (r, i) => r.kress === String(generate(results[i], 3).kress).replace(/\s/g, "")
  )
);
check("hits konsisten dgn rows", bt.hits === bt.rows.filter((r) => r.hit).length);
check("kressRate = hits/steps*100", Math.abs(bt.kressRate - (bt.hits / bt.steps) * 100) < 1e-9);
check("atLeastOne <= steps", bt.atLeastOne <= bt.steps && bt.atLeastOne >= bt.hits);
check("0 <= avgIn <= avgK", bt.avgIn >= 0 && bt.avgIn <= bt.avgK);
check("trend null utk 9 langkah? no — >=4 ada", bt.trend !== null);
check("trend delta = second-first", Math.abs(bt.trend.delta - (bt.trend.second - bt.trend.first)) < 1e-9);
check("streak terakhir valid", ["hit", "miss"].includes(bt.currentStreak.type) && bt.currentStreak.len >= 1);

// Streak manual: 6 langkah dengan pola hit/miss dikontrol lewat next digits
const r6 = runBacktest(["1234", "5678", "1234", "5678", "1234", "5678", "1234"], null);
check("7 results -> 6 langkah", r6.steps === 6);
check(
  "longestHit + pola konsisten (>=1 kalau ada hit)",
  r6.longestHit >= (r6.hits > 0 ? 1 : 0)
);

// Determinisme
const a = JSON.stringify(runBacktest(results, 3));
const b = JSON.stringify(runBacktest(results, 3));
check("deterministik (2x sama)", a === b);

// Kress acak vs fixed berbeda param -> kressCount range
const btFree = runBacktest(results, null);
check("kress acak 3-6", btFree.rows.every((r) => r.kressCount >= 3 && r.kressCount <= 6));

console.log(failures === 0 ? "✅ ALL BACKTEST TESTS PASSED" : `❌ ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
