// KV JSON storage — Supabase PostgREST (pengganti Vercel Blob yang suspended).
// Interface disamakan dgn blobio.js lama: readJson(key, fallback) / writeJson(key, value).
// Param `token` lama tetap diterima agar route tidak perlu banyak berubah (diabaikan).
//
// Tabel: public.ln_kv (key text PK, value jsonb, updated_at timestamptz)
// Env  : SUPABASE_URL + salah satu dari SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY
//        / SUPABASE_SECRET_KEY / SUPABASE_ANON_KEY (urut prioritas).
//        SUPABASE_SCHEMA default "public".

const BASE = () => (process.env.SUPABASE_URL || "").replace(/^["']|["']$/g, "");
function cred() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}
const SCHEMA = () => process.env.SUPABASE_SCHEMA || "public";

export function kvReady() {
  return Boolean(BASE() && cred());
}

function headers() {
  const s = cred();
  return {
    apikey: s,
    Authorization: `Bearer ${s}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

const TABLE = () => `${BASE()}/rest/v1/ln_kv`;

// Baca satu JSON by key; fallback kalau tidak ada / error.
export async function readJson(key, fallback) {
  try {
    const res = await fetch(
      `${TABLE()}?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return fallback;
    const rows = await res.json();
    if (!rows || rows.length === 0) return fallback;
    return rows[0].value ?? fallback;
  } catch {
    return fallback;
  }
}

// Upsert satu JSON by key.
export async function writeJson(key, value) {
  const res = await fetch(`${TABLE()}?on_conflict=key`, {
    method: "POST",
    headers: {
      ...headers(),
      "Content-Profile": SCHEMA(),
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase KV write failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return { key };
}

// List key dengan prefix tertentu (pengganti @vercel/blob list()).
export async function listKeys(prefix) {
  try {
    const res = await fetch(
      `${TABLE()}?key=like.${encodeURIComponent(prefix + "*")}&select=key&order=key.asc`,
      { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows || []).map((r) => ({ pathname: r.key }));
  } catch {
    return [];
  }
}

// Cari store koleksi via value->>'syncCode' (query JSONB, hemat tanpa scan semua key).
export async function findBySyncCode(prefix, syncCode) {
  try {
    const res = await fetch(
      `${TABLE()}?key=like.${encodeURIComponent(prefix + "*")}&value->>syncCode=eq.${encodeURIComponent(syncCode)}&select=value`,
      { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows && rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}
