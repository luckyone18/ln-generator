// Blob JSON IO helpers (token di-pass eksplisit; di deployment Vercel pakai process.env.BLOB_READ_WRITE_TOKEN).
import { head, put } from "@vercel/blob";

export async function readJson(key, fallback, token) {
  try {
    const h = await head(key, { token });
    const res = await fetch(h.url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export function writeJson(key, value, token) {
  return put(key, JSON.stringify(value), {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
