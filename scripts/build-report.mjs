// Build backtest report + enriched rows (dengan tanggal & zona per langkah).
// Dipakai bersama oleh scripts/daily-update.mjs dan app/api/update-history/route.js
import { runBacktest } from "../app/backtest.js";

export function buildReport(history) {
  if (!Array.isArray(history) || history.length < 2) {
    return { error: "Minimal 2 result untuk backtest" };
  }
  const results = history.map((r) => r.result);
  const report = runBacktest(results, null, null, { mode: 2, twin: "2" });
  if (report.error) return report;

  // report.rows[i] = langkah results[i] -> results[i+1]
  const enrichedRows = (report.rows || []).map((row, i) => ({
    date: history[i + 1]?.date || null,
    prev: results[i],
    next: results[i + 1],
    zone: row.lZone,
  }));
  return { ...report, enrichedRows };
}

export function mergeHistory(oldRows, newRows) {
  const map = new Map((oldRows || []).map((r) => [r.date, r]));
  for (const r of newRows || []) map.set(r.date, r); // new wins
  return [...map.values()]
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && /^\d{4}$/.test(r.result))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
