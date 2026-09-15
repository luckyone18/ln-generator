// Seed Supabase KV dari cache /tmp/hist_*.json (peninggalan era Vercel Blob).
// Pakai: node scripts/seed-supabase-kv.mjs   (env dibaca dari /home/ubuntu/.hermes/.env)
import { readFileSync, readdirSync, existsSync } from "node:fs";

function loadEnv() {
  const txt = readFileSync("/home/ubuntu/.hermes/.env", "utf8");
  const out = {};
  for (const line of txt.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && /^[A-Z_]/.test(line)) {
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      out[line.slice(0, i).trim()] = v;
    }
  }
  return out;
}

const env = loadEnv();
const names = Object.keys(env).filter((k) => k.startsWith("SUPABASE_"));
const base = env[names.find((n) => n.endsWith("URL"))];
const sec = env[names.find((n) => n.includes("SERV"))] || env[names.find((n) => n.endsWith("_KEY"))];
if (!base || !sec) {
  console.error("SUPABASE_URL / key tidak ditemukan di .env");
  process.exit(1);
}

const hdr = {
  apikey: sec,
  Authorization: "Bearer " + sec,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=minimal",
};

async function upsert(key, value) {
  const res = await fetch(base + "/rest/v1/ln_kv?on_conflict=key", {
    method: "POST",
    headers: hdr,
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status} ${(await res.text()).slice(0, 150)}`);
  console.log("✓ " + key);
}

// 1) history dari /tmp/hist_*.json (format: { pool, label, drawTimeWIB, updatedAt, rows:[...] })
const files = readdirSync("/tmp").filter((f) => /^hist_[a-z]+\.json$/.test(f));
if (files.length === 0) console.log("(tidak ada /tmp/hist_*.json — skip)");
for (const f of files) {
  const pool = f.replace(/^hist_/, "").replace(/\.json$/, "");
  let raw;
  try {
    raw = JSON.parse(readFileSync("/tmp/" + f, "utf8"));
  } catch (e) {
    console.log("✗ " + f + ": parse gagal — skip");
    continue;
  }
  const rows = Array.isArray(raw) ? raw : raw.rows || [];
  if (!rows.length) {
    console.log("- " + f + ": rows kosong — skip");
    continue;
  }
  const doc = { pool, label: raw.label || pool, drawTimeWIB: raw.drawTimeWIB || null, updatedAt: raw.updatedAt || null, rows };
  await upsert("ln/history/" + pool + ".json", doc);
  console.log("  " + pool + ": " + rows.length + " baris");
}

// 2) collection dari export manual bila ada
const collPath = "/home/ubuntu/ln-generator/scripts/tmp-collection.json";
if (existsSync(collPath)) {
  try {
    const coll = JSON.parse(readFileSync(collPath, "utf8"));
    if (coll.deviceId && Array.isArray(coll.items)) {
      await upsert("ln/scanner-collection/" + coll.deviceId + ".json", coll);
    }
  } catch (e) {
    console.log("collection export tidak valid: " + e.message);
  }
} else {
  console.log("(tidak ada tmp-collection.json — Bank Rumus akan terbentuk ulang saat device sync)");
}

console.log("Selesai.");
