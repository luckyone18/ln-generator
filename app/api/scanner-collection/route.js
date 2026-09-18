import { randomInt } from "node:crypto";
import { readJson, writeJson, findBySyncCode, kvReady } from "../../lib/kv.js";

const SYNC_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SYNC_CODE_LENGTH = 8;
const BLOB_PREFIX = "ln/scanner-collection/";
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SYNC_CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const MAX_ITEMS = 500;
const MAX_ITEMS_BYTES = 512000;

function generateSyncCode() {
  const chars = [];
  for (let i = 0; i < SYNC_CODE_LENGTH; i++) {
    chars.push(SYNC_CODE_CHARSET[randomInt(0, SYNC_CODE_CHARSET.length)]);
  }
  // Insert "-" after the 4th character: "AB2C-DE3F"
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

function kvCheck() {
  return kvReady();
}

export async function GET(req) {
  if (!kvCheck()) {
    return Response.json({ error: "KV storage (Supabase) tidak tersedia" }, { status: 500 });
  }

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  const code = url.searchParams.get("code");

  if (!deviceId && !code) {
    return Response.json(
      { error: "Parameter deviceId atau code wajib" },
      { status: 400 }
    );
  }

  if (deviceId) {
    if (!DEVICE_ID_RE.test(deviceId)) {
      return Response.json(
        { error: "Format ID atau kode tidak valid" },
        { status: 400 }
      );
    }
    const key = `${BLOB_PREFIX}${deviceId}.json`;
    const store = await readJson(key, null);
    if (!store) {
      const fresh = {
        deviceId,
        syncCode: generateSyncCode(),
        items: [],
        packages: [],
        updatedAt: new Date().toISOString(),
      };
      await writeJson(key, fresh);
      return Response.json(fresh);
    }
    return Response.json(store);
  }

  // code lookup: scan all collection blobs
  if (code) {
    if (!SYNC_CODE_RE.test(code)) {
      return Response.json(
        { error: "Format ID atau kode tidak valid" },
        { status: 400 }
      );
    }
    const target = code.toUpperCase();
    try {
      // Query JSONB langsung: value->>'syncCode' = target (hemat — tanpa scan semua key)
      const store = await findBySyncCode(BLOB_PREFIX, target);
      if (store) return Response.json(store);
      // fallback lama: key = ln/scanner-collection/{syncCode}.json
      const byKey = await readJson(`${BLOB_PREFIX}${target}.json`, null);
      if (byKey && byKey.items && byKey.items.length) return Response.json(byKey);
      return Response.json(
        { error: "Kode sync tidak ditemukan" },
        { status: 404 }
      );
    } catch {
      return Response.json(
        { error: "Gagal membaca penyimpanan" },
        { status: 500 }
      );
    }
  }
}

export async function POST(req) {
  if (!kvCheck()) {
    return Response.json({ error: "KV storage (Supabase) tidak tersedia" }, { status: 500 });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }

  const { deviceId, items, packages } = body;

  if (!deviceId || !DEVICE_ID_RE.test(deviceId)) {
    return Response.json({ error: "deviceId tidak valid" }, { status: 400 });
  }

  if (!Array.isArray(items)) {
    return Response.json({ error: "items harus array" }, { status: 400 });
  }

  if (items.length > MAX_ITEMS) {
    return Response.json(
      { error: "Koleksi terlalu besar" },
      { status: 400 }
    );
  }

  if (JSON.stringify(items).length > MAX_ITEMS_BYTES) {
    return Response.json(
      { error: "Koleksi terlalu besar" },
      { status: 400 }
    );
  }

  // packages lho: hanya terima objek valid (id, name, codes[])
  let sanitizedPackages = Array.isArray(packages) ? packages : null;
  if (sanitizedPackages !== null) {
    sanitizedPackages = sanitizedPackages
      .filter(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.name === "string" &&
          Array.isArray(p.codes)
      )
      .map((p) => ({
        id: p.id,
        name: String(p.name).slice(0, 80),
        codes: p.codes
          .filter((c) => typeof c === "string")
          .slice(0, MAX_ITEMS),
        createdAt: p.createdAt || Date.now(),
      }))
      .slice(0, 200);
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
    items,
    packages: sanitizedPackages ?? (existing?.packages || []),
    updatedAt: new Date().toISOString(),
  };

  await writeJson(key, store);

  return Response.json({
    ok: true,
    deviceId,
    syncCode,
    updatedAt: store.updatedAt,
  });
}
