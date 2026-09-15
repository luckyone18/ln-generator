// Seed Supabase KV dari cache /tmp/hist_*.json (peninggalan era Vercel Blob).
// Pakai: SUPABASE_URL=... SUPABASE_KEY=*** node scripts/seed-supabase-kv.mjs
// (key = service_role / secret key)
import { readFileSync, readdirSync } from "node:fs";

const BASE = process.env.SUPABASE_URL;
const KEY = *** || process.env.SUPABASE_KEY;
if (!BASE || !KEY) {
  console.error("Wajib: SUPABASE_URL + SUPABASE_SERVICE_KEY (atau SUPABASE_KEY)");
  process.exit(1);
}

async function upsert(key, value) {
  const res = await fetch(`${BASE}/rest/v1/ln_kv?on_conflict=key`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) {
    throw new Error(`${key}: HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
  }
  console.log(`✓ ${key}`);
}

// 1) history + backtest dari /tmp/hist_*.json
const files = readdirSync("/tmp").filter((f) => /^hist_[a-z]+\.json$/.test(f));
if (files.length === 0) console.log("(tidak ada /tmp/hist_*.json — skip)");
for (const f of files) {
  const pool = f.replace(/^hist_/, "").replace(/\.json$/, "");
  let raw;
  try {
    raw = JSON.parse(readFileSync(`/tmp/${f}`, "utf8"));
  } catch (e) {
    console.log(`✗ ${f}: parse gagal (${e.message}) — skip`);
    continue;
  }
  const rows = Array.isArray(raw) ? raw : raw?.rows || [];
  if (!rows.length) {
    console.log(`- ${f}: rows kosong — skip`);
    continue;
  }
  const doc = {
    pool,
    label: raw?.label || pool,
    updatedAt: raw?.updatedAt || null,
    rows,
  };
  await upsert(`ln/history/${pool}.json`, doc);
  // backtest report dihitung di server saat update-history berikutnya; seed tanpa report
  console.log(`  ${pool}: ${rows.length} baris`);
}

// 2) collection: dari file export manual bila ada (ln-generator/tmp-collection.json)
try {
  const coll = JSON.parse(readFileSync(new URL("./tmp-collection.json", import.meta.url)));
  if (coll.deviceId && Array.isArray(coll.items)) {
    await upsert(`ln/scanner-collection/${coll.deviceId}.json`, coll);
  }
} catch {
  console.log("(tidak ada scripts/tmp-collection.json — collection skip; Bank Rumus akan terbentuk ulang saat device sync)");
}

console.log("Selesai.");
