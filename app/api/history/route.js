// GET /api/history?pool=singapore
// Returns { pool, label, drawTimeWIB, updatedAt, rows, report } dari Vercel Blob.
import { POOLS } from "../../../scripts/paito-scraper.mjs";
import { readJson } from "../../lib/blobio.js";

const BLOB_PREFIX = "ln";

export async function GET(req) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json({ error: "Blob token tidak tersedia" }, { status: 500 });
  }
  const url = new URL(req.url);
  const pool = url.searchParams.get("pool") || "singapore";
  if (!POOLS[pool]) {
    return Response.json({ error: "Pool tidak dikenal" }, { status: 400 });
  }

  const hist = await readJson(`${BLOB_PREFIX}/history/${pool}.json`, null, token);
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

  const bt = await readJson(`${BLOB_PREFIX}/backtest/${pool}.json`, null, token);
  return Response.json({
    pool: hist.pool,
    label: hist.label,
    drawTimeWIB: POOLS[pool].drawTimeWIB,
    updatedAt: bt?.updatedAt || hist.updatedAt,
    rows: hist.rows || [],
    report: bt?.report || null,
  });
}
