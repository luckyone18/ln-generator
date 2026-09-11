// Blob JSON IO helpers (private store: return-management-blob).
// Token di-pass eksplisit; di deployment Vercel pakai process.env.BLOB_READ_WRITE_TOKEN.
import { get, put } from "@vercel/blob";

export async function readJson(key, fallback, token) {
  try {
    const res = await get(key, { access: "private", useCache: false, token });
    if (!res || !res.stream) return fallback;
    const text = await new Response(res.stream).text();
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value, token) {
  return put(key, JSON.stringify(value), {
    access: "private",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
