import { randomInt } from "node:crypto";
import { readJson, writeJson, findBySyncCode, kvReady } from "../../lib/kv.js";

const SYNC_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SYNC_CODE_LENGTH = 8;
const BLOB_PREFIX = "ln/rekap-manual/";
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SYNC_CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const MAX_SETS = 500;
const MAX_SETS_BYTES = 512000;

function generateSyncCode() {
  const chars = [];
  for (let i = 0; i < SYNC_CODE_LENGTH; i++) {
    chars.push(SYNC_CODE_CHARSET[randomInt(0, SYNC_CODE_CHARSET.length)]);
  }
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function sanitizeSets(sets) {
  if (!Array.isArray(sets)) return null;
  return sets
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      id: String(s.id || "").slice(0, 64),
      name: String(s.name || "Set").slice(0, 80),
      front: String(s.front || "").slice(0, 20000),
      back: String(s.back || "").slice(0, 20000),
      mid: String(s.mid || "").slice(0, 20000),
      d3: String(s.d3 || "").slice(0, 20000),
      savedAt: s.savedAt || Date.now(),
    }))
    .slice(0, MAX_SETS);
}

export async function GET(req) {
  if (!kvReady()) {
    return Response.json({ error: "KV storage (Supabase) tidak tersedia" }, { status: 500 });
  }

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  const code = url.searchParams.get("code");

  if (!deviceId && !code) {
    return Response.json({ error: "Parameter deviceId atau code wajib" }, { status: 400 });
  }

  if (deviceId) {
    if (!DEVICE_ID_RE.test(deviceId)) {
      return Response.json({ error: "Format ID atau kode tidak valid" }, { status: 400 });
    }
    const key = `${BLOB_PREFIX}${deviceId}.json`;
    const store = await readJson(key, null);
    if (!store) {
      const fresh = {
        deviceId,
        syncCode: generateSyncCode(),
        sets: [],
        updatedAt: new Date().toISOString(),
      };
      await writeJson(key, fresh);
      return Response.json(fresh);
    }
    return Response.json(store);
  }

  if (code) {
    if (!SYNC_CODE_RE.test(code)) {
      return Response.json({ error: "Format ID atau kode tidak valid" }, { status: 400 });
    }
    const target = code.toUpperCase();
    try {
      const store = await findBySyncCode(BLOB_PREFIX, target);
      if (store) return Response.json(store);
      const byKey = await readJson(`${BLOB_PREFIX}${target}.json`, null);
      if (byKey && Array.isArray(byKey.sets) && byKey.sets.length) return Response.json(byKey);
      return Response.json({ error: "Kode sync tidak ditemukan" }, { status: 404 });
    } catch {
      return Response.json({ error: "Gagal membaca penyimpanan" }, { status: 500 });
    }
  }
}

export async function POST(req) {
  if (!kvReady()) {
    return Response.json({ error: "KV storage (Supabase) tidak tersedia" }, { status: 500 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const { deviceId, sets } = body;

  if (!deviceId || !DEVICE_ID_RE.test(deviceId)) {
    return Response.json({ error: "deviceId tidak valid" }, { status: 400 });
  }

  const sanitized = sanitizeSets(sets);
  if (sanitized === null) {
    return Response.json({ error: "sets harus array" }, { status: 400 });
  }

  if (JSON.stringify(sanitized).length > MAX_SETS_BYTES) {
    return Response.json({ error: "Koleksi terlalu besar" }, { status: 400 });
  }

  const key = `${BLOB_PREFIX}${deviceId}.json`;
  const existing = await readJson(key, null);
  const syncCode =
    existing && typeof existing.syncCode === "string"
      ? existing.syncCode
      : generateSyncCode();

  const store = {
    deviceId,
    syncCode,
    sets: sanitized,
    updatedAt: new Date().toISOString(),
  };

  await writeJson(key, store);

  return Response.json({ ok: true, deviceId, syncCode, updatedAt: store.updatedAt });
}
