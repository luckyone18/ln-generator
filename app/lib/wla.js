// WLA (Angkanet) proxy helper — tahan rotasi domain + nonce expired.
//
// Situs angkanet rutin ganti domain (angkanet26 → ...29). Domain lama menjawab
// 301 ke domain baru. Nonce WP juga kadaluarsa. Helper ini:
//   1. Coba domain terakhir yang diketahui (cache modul).
//   2. Fetch halaman rumus-otomatis, ikuti redirect, ambil domain final dari res.url,
//      ekstrak 2 nonce (nonce umum utk filter_api, WLA_CONFIG nonce utk scanner_api).
//   3. Saat 403 → refresh discovery sekali, lalu retry request.
//
// Cache: 10 menit (nonce fresh ~12 jam di WP). Scope modul — warm antar-request
// di instance serverless yang sama.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

import { readJson, writeJson, kvReady } from "./kv.js";

// Seed bisa dikontrol dari web (tanpa ubah kode): Supabase KV key `ln/seed-domains`.
// Fallback bawaan kalau KV kosong/unreachable:
const DEFAULT_SEEDS = ["https://angkanet26.com", "https://angkanet29.com"];
const SEED_KEY = "***";

let seedCache = { list: DEFAULT_SEEDS, at: 0 };

async function getSeeds() {
  if (Date.now() - seedCache.at < 5 * 60 * 1000) return seedCache.list;
  try {
    if (kvReady()) {
      const data = await readJson(SEED_KEY, null);
      const list = Array.isArray(data?.seeds)
        ? data.seeds.map((s) => String(s).trim()).filter((s) => /^https?:\/\//.test(s))
        : [];
      if (list.length) seedCache = { list, at: Date.now() };
    }
  } catch {
    /* KV mati → pakai cache/bawaan, scanner tetap hidup */
  }
  return seedCache.list;
}

export async function setSeedDomains(seeds) {
  const list = [...new Set(seeds.map((s) => String(s).trim()).filter((s) => /^https?:\/\//.test(s)))];
  if (!list.length) throw new Error("Tidak ada URL valid (harus mulai http:// atau https://)");
  await writeJson(SEED_KEY, { seeds: list, updated_at: new Date().toISOString() });
  seedCache = { list, at: Date.now() };
  invalidate(); // paksa discovery ulang dengan seed baru
  return list;
}

export async function getSeedDomains() {
  return { seeds: await getSeeds(), builtin: DEFAULT_SEEDS };
}

let cache = { domain: null, filterNonce: null, scannerNonce: null, at: 0 };
let inflight = null;

export function currentDomain() {
  return cache.domain;
}

function isFresh() {
  return cache.domain && Date.now() - cache.at < 10 * 60 * 1000;
}

async function discover() {
  if (isFresh()) return { ...cache };

  if (!inflight) {
    inflight = (async () => {
      let lastErr = null;
      for (const seed of await getSeeds()) {
        try {
          const res = await fetch(`${seed}/rumus-otomatis/`, {
            headers: { "User-Agent": UA },
            redirect: "follow",
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} from ${seed}`);
          const finalUrl = res.url; // domain final setelah redirect 301
          const m = finalUrl.match(/^https?:\/\/([^/]+)/);
          if (!m) throw new Error("no domain in final url");
          const domain = m[1];
          const html = await res.text();

          // nonce umum (filter_api): "nonce":"xxxxxxxxxx" pertama
          const n1 = html.match(/"nonce":"([a-f0-9]{8,12})"/);
          // WLA_CONFIG nonce (scanner_api): blok WLA_CONFIG
          const n2 = html.match(/WLA_CONFIG=\{[^}]*"nonce":"([a-f0-9]{8,12})"/);

          if (!n1) throw new Error("no nonce found");
          cache = {
            domain,
            filterNonce: n1[1],
            scannerNonce: (n2 && n2[1]) || n1[1],
            at: Date.now(),
          };
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error("discovery failed");
    })().finally(() => {
      inflight = null;
    });
  }
  await inflight;
  return { ...cache };
}

function invalidate() {
  cache = { domain: null, filterNonce: null, scannerNonce: null, at: 0 };
}

// POST JSON ke filter_api (paito utk rumus-otomatis / refresh / manual add).
export async function wlaFilterApi(body) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { domain, filterNonce } = await discover();
    try {
      const res = await fetch(
        `https://${domain}/wp-admin/admin-ajax.php?action=wla_app_api&hub_action=filter_api&_wpnonce=${filterNonce}&ajax=1`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": UA,
            Origin: `https://${domain}`,
            Referer: `https://${domain}/rumus-otomatis/`,
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        }
      );
      if (res.status === 403) {
        invalidate();
        continue; // retry dengan discovery fresh
      }
      if (!res.ok) throw Object.assign(new Error(`WLA HTTP ${res.status}`), { status: res.status });
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      invalidate();
    }
  }
  throw new Error("WLA filter_api unreachable");
}

// POST form ke scanner_api (scanner utama).
export async function wlaScannerApi(formFields) {
  const formData = new URLSearchParams();
  formData.append("action", "wla_app_api");
  formData.append("hub_action", "scanner_api");
  formData.append("ajax", "1");
  for (const [k, v] of Object.entries(formFields)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      // days[] per elemen (format form WP)
      v.forEach((item) => formData.append(`${k}[]`, String(item)));
    } else {
      formData.append(k, String(v));
    }
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { domain, scannerNonce } = await discover();
    formData.set("nonce", scannerNonce);
    try {
      const res = await fetch(`https://${domain}/wp-admin/admin-ajax.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
          Origin: `https://${domain}`,
          Referer: `https://${domain}/scanner-angkanet-pro/`,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 403) {
        invalidate();
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`WLA HTTP ${res.status}`), { status: res.status });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw Object.assign(new Error("Invalid JSON from WLA server"), { status: 502 });
      }
    } catch (err) {
      if (attempt === 2) throw err;
      invalidate();
    }
  }
  throw new Error("WLA scanner_api unreachable");
}
