/* ------------------------------------------------------------------ */
/* Uji Kinerja (backtest) — pure engine, testable di Node.              */
/*                                                                      */
/* Konsep: deret result 4D berurutan (terlama -> terbaru). Setiap       */
/* result dipakai untuk generate Kress Ai; diukur apakah digit kress    */
/* muncul di result BERIKUTNYA (4 digit).                               */
/*                                                                      */
/* Metrik (sesuai keputusan user):                                      */
/*  1. Kress: % langkah di mana SEMUA digit kress muncul di result      */
/*     berikutnya, rata-rata digit kress yang muncul, % langkah >=1     */
/*     digit muncul.                                                    */
/*  2. Streak & tren: rekaman hit/miss terpanjang, streak terakhir,     */
/*     perbandingan hit-rate paruh awal vs paruh akhir.                 */
/* ------------------------------------------------------------------ */

import { generate } from "./algorithm.js";
import { generateTardal } from "./tardal.js";

// Parse bebas: ambil semua digit, potong per 4 (data user selalu grup 4 digit).
// Sisa digit < 4 di akhir dibuang dan dihitung sebagai trailing terpotong.
export function parseResults(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const n = Math.floor(digits.length / 4);
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(digits.slice(i * 4, i * 4 + 4));
  }
  const leftover = digits.length % 4;
  return { results, leftover };
}

export function runBacktest(
  results,
  kressWanted = null,
  tardalOpts = null,
  lnOpts = null
) {
  if (!Array.isArray(results) || results.length < 2) {
    return { error: "Minimal 2 result untuk menguji kinerja" };
  }

  const tOpt = {
    type: String(tardalOpts?.type || "4"),
    twin: String(tardalOpts?.twin || "2"),
    splitter: String(tardalOpts?.splitter || "*"),
    enabled: tardalOpts ? tardalOpts.enabled !== false : true,
  };

  const lnModeRaw = Number(lnOpts?.mode);
  const ln = {
    mode: lnModeRaw === 3 || lnModeRaw === 4 ? lnModeRaw : 2,
    twin: String(lnOpts?.twin) === "2" ? "2" : "1",
    enabled: lnOpts ? lnOpts.enabled !== false : true,
  };

  const rows = [];
  let hits = 0;
  let sumIn = 0;
  let sumK = 0;
  let atLeastOne = 0;
  let tSteps = 0;
  let tHits = 0;
  let tSum = 0;
  let tMax = 0;
  const lZoneCounts = { top: 0, p1: 0, p2: 0, p3: 0, p4: 0, px: 0 };
  let lTwinSkipped = 0;

  for (let i = 0; i < results.length - 1; i++) {
    const prev = results[i];
    const next = results[i + 1];
    const r = generate(prev, kressWanted, ln.enabled ? ln.mode : 2, ln.twin);
    if (r.error) continue;

    const kressDigits = String(r.kress || "")
      .split(/\s+/)
      .filter(Boolean);
    const nextSet = new Set(next.split(""));

    let inCount = 0;
    for (const d of kressDigits) {
      if (nextSet.has(d)) inCount++;
    }

    const hit = kressDigits.length > 0 && inCount === kressDigits.length;
    if (hit) hits++;
    if (inCount > 0) atLeastOne++;
    sumIn += inCount;
    sumK += kressDigits.length;

    // LN (mode 2D/3D/4D): ekor result berikutnya (2/3/4 digit terakhir)
    // dicek zona-nya di partisi hasil generate. Karena partisi menutup
    // seluruh pool, setiap langkah pasti masuk salah satu zona — metrik
    // yang berarti adalah proporsi per zona (TOP vs Patah 1..>5).
    let lZone = null;
    let lTwinSkip = false;
    if (ln.enabled) {
      const suffix = next.slice(-ln.mode);
      const hasTwin = new Set(suffix).size !== suffix.length;
      lTwinSkip = ln.twin === "2" && hasTwin;
      if (lTwinSkip) {
        // Ekor kembar di luar pool No Twin — langkah ini tak bisa kena.
      } else if (r.top.includes(suffix)) lZone = "top";
      else if (r.p1.includes(suffix)) lZone = "p1";
      else if (r.p2.includes(suffix)) lZone = "p2";
      else if (r.p3.includes(suffix)) lZone = "p3";
      else if (r.p4.includes(suffix)) lZone = "p4";
      else if (r.px.includes(suffix)) lZone = "px";
      if (lZone) lZoneCounts[lZone]++;
      if (lTwinSkip) lTwinSkipped++;
    }

    // Tardal: kombinasi dari digit kress dianggap "kena" bila kombinasi
    // muncul di POSISI PERSIS yang sama pada result berikutnya
    // (kombinasi tardal diurutkan sesuai urutan digit input).
    // Langkah tanpa kombinasi (mis. 4D No Twin dgn kress 3 digit) tidak
    // diikutkan dalam statistik tardal.
    let tAvailable = false;
    let tCount = 0;
    let tCombos = 0;
    if (tOpt.enabled) {
      const t = generateTardal({
        digits: kressDigits.join(""),
        type: tOpt.type,
        twin: tOpt.twin,
        splitter: tOpt.splitter,
      });
      tAvailable = !!t && !t.error && t.combos.length > 0;
      if (tAvailable) {
        tCombos = t.combos.length;
        tSteps++;
        for (const combo of t.combos) {
          let ok = true;
          for (let p = 0; p < combo.length; p++) {
            if (next[p] !== combo[p]) {
              ok = false;
              break;
            }
          }
          if (ok) tCount++;
        }
        if (tCount > 0) tHits++;
        tSum += tCount;
        if (tCount > tMax) tMax = tCount;
      }
    }

    rows.push({
      prev,
      next,
      kress: kressDigits.join(""),
      kressCount: kressDigits.length,
      inCount,
      hit,
      lZone,
      lTwinSkip,
      tAvailable,
      tCombos,
      tCount,
    });
  }

  const steps = rows.length;
  if (steps === 0) {
    return { error: "Tidak ada langkah uji yang bisa dihitung" };
  }

  // Streaks
  let longestHit = 0;
  let longestMiss = 0;
  let curType = null;
  let curLen = 0;
  for (const row of rows) {
    const t = row.hit ? "hit" : "miss";
    if (t === curType) {
      curLen++;
    } else {
      curType = t;
      curLen = 1;
    }
    if (t === "hit" && curLen > longestHit) longestHit = curLen;
    if (t === "miss" && curLen > longestMiss) longestMiss = curLen;
  }
  const currentStreak = { type: curType, len: curLen };

  // Tren: hit-rate paruh awal vs paruh akhir (butuh >= 4 langkah)
  let trend = null;
  if (steps >= 4) {
    const half = Math.floor(steps / 2);
    const rate = (arr) =>
      arr.length ? (arr.filter((x) => x.hit).length / arr.length) * 100 : 0;
    const first = rate(rows.slice(0, half));
    const second = rate(rows.slice(steps - half));
    trend = { first, second, delta: second - first };
  }

  return {
    steps,
    hits,
    kressRate: (hits / steps) * 100,
    atLeastOne,
    atLeastOneRate: (atLeastOne / steps) * 100,
    avgIn: sumIn / steps,
    avgK: sumK / steps,
    longestHit,
    longestMiss,
    currentStreak,
    trend,
    lnOpt: ln,
    lSteps: ln.enabled ? steps : 0,
    lTested: ln.enabled ? steps - lTwinSkipped : 0,
    lTwinSkipped,
    lZoneCounts,
    lZoneRates: ln.enabled && steps > 0
      ? Object.fromEntries(
          Object.entries(lZoneCounts).map(([z, c]) => [z, (c / steps) * 100])
        )
      : null,
    tOpt,
    tSteps: tOpt.enabled ? tSteps : 0,
    tHits,
    tHitRate: tOpt.enabled && tSteps > 0 ? (tHits / tSteps) * 100 : null,
    tAvg: tOpt.enabled && tSteps > 0 ? tSum / tSteps : 0,
    tMax,
    rows,
  };
}
