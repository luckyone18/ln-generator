// Build backtest report + enriched rows (dengan tanggal & zona per langkah + tardal 3D & 4D No Twin kress 7).
// Dipakai bersama oleh scripts dan app/api/update-history/route.js
import { runBacktest } from "../app/backtest.js";

export function buildReport(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return { error: "Minimal 2 result untuk backtest" };
  }
  const results = history.map((r) => r.result);

  // Jalankan backtest utama: kress 7, Tardal 3D No Twin, LN 2D No Twin
  const report3D = runBacktest(
    results,
    7,
    { type: "3", twin: "2", splitter: "*", enabled: true },
    { mode: 2, twin: "2" }
  );
  if (report3D.error) return report3D;

  // Jalankan backtest sekunder: Tardal 4D No Twin
  const report4D = runBacktest(
    results,
    7,
    { type: "4", twin: "2", splitter: "*", enabled: true },
    { mode: 2, twin: "2" }
  );

  // Rangkuman Tardal 3D & 4D
  const tardal = {
    kress: 7,
    twin: "no",
    t3: {
      type: "3",
      combos: 210,
      steps: report3D.tSteps || 0,
      hits: report3D.tHits || 0,
      hitRate: report3D.tHitRate || 0,
      avg: report3D.tAvg || 0,
      max: report3D.tMax || 0,
    },
    t4: {
      type: "4",
      combos: 840,
      steps: report4D.tSteps || 0,
      hits: report4D.tHits || 0,
      hitRate: report4D.tHitRate || 0,
      avg: report4D.tAvg || 0,
      max: report4D.tMax || 0,
    },
  };

  // report.rows[i] = langkah results[i] -> results[i+1]
  const enrichedRows = (report3D.rows || []).map((row, i) => {
    const row4 = report4D.rows?.[i] || {};
    return {
      date: history[i + 1]?.date || null,
      prev: results[i],
      next: results[i + 1],
      zone: row.lZone,
      kress: row.kress,
      t3Hit: (row.tCount || 0) > 0,
      t3Count: row.tCount || 0,
      t4Hit: (row4.tCount || 0) > 0,
      t4Count: row4.tCount || 0,
    };
  });

  return {
    ...report3D,
    tardal,
    enrichedRows,
  };
}

export function mergeHistory(oldRows, newRows) {
  // Terima dua bentuk: array legacy ATAU dokumen {rows: [...]} (hasil run sebelumnya).
  const oldArr = Array.isArray(oldRows) ? oldRows : oldRows?.rows || [];
  const map = new Map(oldArr.map((r) => [r.date, r]));
  for (const r of newRows || []) map.set(r.date, r); // new wins
  return [...map.values()]
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && /^\d{4}$/.test(r.result))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
