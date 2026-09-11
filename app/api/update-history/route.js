// POST /api/update-history?pools=singapore,sydney,hongkong
// Proteksi: header x-update-secret harus sama dengan env UPDATE_SECRET_KEY.
// Alur: scrape paito -> merge history -> simpan ln/history/{pool}.json + ln/backtest/{pool}.json di Vercel Blob.
import { fetchPaito, POOLS } from "../../../scripts/paito-scraper.mjs";
import { buildReport, mergeHistory } from "../../../scripts/build-report.mjs";
import { readJson, writeJson } from "../../lib/blobio.js";

const BLOB_PREFIX = "ln";

function nowWIB() {
  return new Date(Date.now() + 7 * 3600 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);
}

export async function POST(req) {
  const secret = req.headers.get("x-update-secret") || "";
  if (!process.env.UPDATE_SECRET_KEY || secret !== process.env.UPDATE_SECRET_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json({ error: "Blob token tidak tersedia" }, { status: 500 });
  }

  const url = new URL(req.url);
  const poolsParam = url.searchParams.get("pools") || "";
  const requested = poolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  const targets = requested.length ? requested : Object.keys(POOLS);

  const ts = nowWIB();
  const results = [];

  for (const pool of targets) {
    if (!POOLS[pool]) {
      results.push({ pool, error: "Pool tidak dikenal" });
      continue;
    }
    try {
      const { rows, label } = await fetchPaito(pool, 120);
      const key = `${BLOB_PREFIX}/history/${pool}.json`;
      const old = await readJson(key, [], token);
      const oldArr = Array.isArray(old) ? old : old?.rows || [];
      const history = mergeHistory(old, rows);
      const added = history.length - oldArr.length;

      await writeJson(
        key,
        { pool, label, updatedAt: ts, rows: history },
        token
      );

      const report = buildReport(history);
      await writeJson(
        `${BLOB_PREFIX}/backtest/${pool}.json`,
        { pool, label, updatedAt: ts, n: history.length, report },
        token
      );

      const last = history[history.length - 1] || null;
      results.push({ pool, label, total: history.length, added, last });
    } catch (e) {
      results.push({
        pool,
        error: e.message,
        stack: String(e.stack || "").split("\n").slice(0, 4),
      });
    }
  }

  return Response.json({ updatedAt: ts, results });
}
