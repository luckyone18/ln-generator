// GET /api/history?pool=singapore
// Returns { pool, label, drawTimeWIB, updatedAt, rows, report } dari Supabase KV.
import { POOLS } from "../../../scripts/paito-scraper.mjs";
import { readJson, kvReady } from "../../lib/kv.js";

const BLOB_PREFIX = "ln";

export async function GET(req) {
  if (!kvReady()) {
    return Response.json({ error: "KV storage (Supabase) tidak tersedia" }, { status: 500 });
  }
  const url = new URL(req.url);
  const pool = url.searchParams.get("pool") || "singapore";
  if (!POOLS[pool]) {
    return Response.json({ error: "Pool tidak dikenal" }, { status: 400 });
  }

  const hist = await readJson(`${BLOB_PREFIX}/history/${pool}.json`, null);
  if (!hist) {
    return Response.json({
      pool,
      label: POOLS[pool].label,
      drawTimeWIB: POOLS[pool].drawTimeWIB,
      updatedAt: null,
      rows: [],
      report: null,
      empty: true,
    });
  }

  const bt = await readJson(`${BLOB_PREFIX}/backtest/${pool}.json`, null);
  return Response.json({
    pool: hist.pool,
    label: hist.label,
    drawTimeWIB: POOLS[pool].drawTimeWIB,
    updatedAt: bt?.updatedAt || hist.updatedAt,
    rows: hist.rows || [],
    report: bt?.report || null,
  });
}
