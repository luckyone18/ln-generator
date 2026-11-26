// GET  /api/settings/domains — seed domain aktif + domain hasil discovery terakhir.
// POST /api/settings/domains — ubah seed dari web (tanpa ubah kode / deploy).
//   body: { "seeds": ["https://angkanet30.com", ...] }  + header x-update-secret.
// Efek: tulis ln/seed-domains ke Supabase KV → discovery wla.js baca dari sana
// (cache 5 menit, invalidasi langsung). Simpan seed lama yang masih 301-redirect
// supaya auto-follow tetap jalan sebagai cadangan.
import { getSeedDomains, setSeedDomains, currentDomain } from "../../../lib/wla.js";
import { kvReady } from "../../../lib/kv.js";

function authorized(req) {
  const expected = process.env.UPDATE_SECRET_KEY || process.env.LN_UPDATE_SECRET || "";
  const secret = req.headers.get("x-update-secret") || "";
  return !!expected && secret === expected;
}

export async function GET(req) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { seeds, builtin } = await getSeedDomains();
  return Response.json({
    ok: true,
    seeds,
    builtin,
    source: seeds.join("|") === builtin.join("|") ? "kode bawaan" : "Supabase KV (web)",
    active_domain: currentDomain(),
    kv_ready: kvReady(),
  });
}

export async function POST(req) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!kvReady()) {
    return Response.json({ error: "KV storage (Supabase) tidak tersedia" }, { status: 500 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON: {\"seeds\":[...]}" }, { status: 400 });
  }
  const raw = Array.isArray(body?.seeds) ? body.seeds : [];
  if (!raw.length) {
    return Response.json({ error: "Field seeds (array URL) wajib diisi" }, { status: 400 });
  }
  try {
    const saved = await setSeedDomains(raw);
    // Probe ringan ke API scanner publik; jangan memakai filter_api lama yang
    // masih membutuhkan nonce WordPress.
    let probe = null;
    try {
      const { wlaScannerApi } = await import("../../../lib/wla.js");
      const res = await wlaScannerApi({
        market: "sgp",
        fCol: "ai",
        limit: 1,
        patahMax: 0,
        targetDMax: 0,
        maxTime: 1,
        maxResults: 1,
        daysFilter: [],
        is_first: true,
      });
      if (res?.status !== "success") throw new Error("scanner_api response invalid");
      probe = { ok: true, note: "scanner_api merespons (success)" };
    } catch (err) {
      probe = { ok: false, error: String(err?.message || err).slice(0, 160) };
    }
    return Response.json({ ok: true, seeds: saved, probe });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 400 });
  }
}
