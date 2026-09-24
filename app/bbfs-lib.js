// BBFS (Bolak Balik Full Set) — pure logic, tanpa React, 100% client-side.
// Cartesian product posisi: As × Kop × Kepala × Ekor (As paling luar, Ekor paling dalam).

// Buang non-digit, lalu dedupe per posisi mempertahankan urutan kemunculan pertama.
function cleanDigits(raw) {
  const s = String(raw == null ? "" : raw).replace(/\D+/g, "");
  const seen = new Set();
  let out = "";
  for (const ch of s) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

// Twin = ada digit berulang di dalam satu hasil; noTwin = semua digit berbeda.
function hasTwin(s) {
  return new Set(s).size !== s.length;
}

export function bbfsGenerate({
  as = "",
  kop = "",
  kepala = "",
  ekor = "",
  separator = "*",
  noTwin = false,
} = {}) {
  // `separator` diterima untuk kompatibilitas API; penggabungan string dilakukan di UI.
  void separator;

  const posisi = [cleanDigits(as), cleanDigits(kop), cleanDigits(kepala), cleanDigits(ekor)].filter(
    (p) => p.length > 0
  );

  // Semua posisi kosong → tidak ada kombinasi sama sekali.
  if (!posisi.length) return { results: [], count: 0 };

  let out = [""];
  for (const p of posisi) {
    const next = [];
    for (const prefix of out) {
      for (const d of p) next.push(prefix + d);
    }
    out = next;
  }

  const results = noTwin ? out.filter((r) => !hasTwin(r)) : out;
  return { results, count: results.length };
}
