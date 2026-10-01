// Logika murni untuk tab "Gabung Angka" (2D/3D/4D).
// Dipisah dari komponen agar bisa diuji tanpa browser (lihat scripts/test-combiner.mjs).

// Parse deretan angka dari satu kolom.
// Pemisah utama "*" (juga toleran spasi/koma/; /| / baris baru).
// Hanya token yang murni digit dengan panjang 2–4 yang dianggap valid.
export function parseCol(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: [], bad: [] };
  const tokens = s.split(/[*\s,;|]+/).filter(Boolean);
  const ok = [];
  const bad = [];
  tokens.forEach((t) => {
    if (/^\d{2,4}$/.test(t)) ok.push(t);
    else bad.push(t);
  });
  return { ok, bad };
}

// Gabungkan semua angka dari beberapa kolom lalu buang yang kembar (hasil unik).
// Urutan kemunculan dipertahankan (kolom 1 dulu, dst).
export function combineUnique(cols) {
  const seen = new Set();
  const out = [];
  for (const col of cols) {
    for (const n of col) {
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
  }
  return out;
}

// Urutkan hasil: "asli" (tetap), "asc" (kecil→besar), "desc" (besar→kecil).
export function sortResult(list, mode) {
  if (mode === "asli") return list;
  const arr = [...list];
  arr.sort((a, b) => (mode === "asc" ? a.localeCompare(b) : b.localeCompare(a)));
  return arr;
}

// Saring: q = angka yang harus terkandung; buangList = potongan yang membuat angka dibuang.
export function filterResult(list, q, buangList) {
  let arr = list;
  if (q) arr = arr.filter((r) => r.includes(q));
  if (buangList && buangList.length) arr = arr.filter((r) => !buangList.some((t) => r.includes(t)));
  return arr;
}

// Cari angka yang muncul lebih dari sekali (double) di seluruh kolom.
// Mengembalikan daftar unik sesuai urutan kemunculan pertama, plus jumlah tiap angka.
export function findDoubles(cols) {
  const count = new Map();
  const order = [];
  for (const col of cols) {
    for (const n of col) {
      if (!count.has(n)) order.push(n);
      count.set(n, (count.get(n) || 0) + 1);
    }
  }
  const doubles = order.filter((n) => count.get(n) > 1);
  return { doubles, count };
}


// Ubah string input "buang" (pemisah *) menjadi daftar token unik.
export function parseBuang(buang) {
  return [
    ...new Set(
      String(buang || "")
        .split(/[*\s,;|]+/)
        .map((t) => t.replace(/\D/g, ""))
        .filter(Boolean)
    ),
  ];
}
