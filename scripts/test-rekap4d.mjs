// Test suite Rekap 4D — AID × AI + filter AI3D (posisi 2-4).
// Jalankan: node scripts/test-rekap4d.mjs
import { buildRekap4D, renderRekap4D, ai3dKeys } from "../app/scanner/rekap.js";

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}\n      expected ${e}\n      actual   ${a}`); }
}
function ok(cond, label) { eq(!!cond, true, label); }

const F = (type, ai) => ({ type, ai });

// ── 1. Baseline tanpa AI3D = perilaku lama: 10.000 kombinasi penuh ──
{
  const impl = buildRekap4D([F("AID", "12"), F("AI", "34")]);
  eq(ai3dKeys([F("AI3D", "745")].filter(() => false)).keys, [], "tanpa AI3D: useFilter false");
  eq(impl.useFilter, false, "tanpa AI3D: filter tidak aktif");
  const total = impl.counts4D.reduce((s, n) => s + (n || 0), 0);
  eq(total, 10000, "tanpa AI3D: total 4D = 10.000");
}

// ── 2. AI3D kunci digit 1-3; "2" mati di posisi 1 ──
// AID ai "2" (default kill: digit tak ada di angka → mati). AI ai "0".
// Tanpa filter: 4D TOP = angka dengan digit1=2 (bukan, TOP=0 poin → AID hidup →
//   killPoint AID: angka 2D depan harus MEMUAT digit "2"). AI "0" → belakang memuat 0.
//   TOP = {2x0? } depan ∈ {02..92,20..29} → 19 angka (20-29,02,12,...92 = 10+9=19),
//   belakang 19 → 19×19 = 361 TOP.
{
  const noF = buildRekap4D([F("AID", "2"), F("AI", "0")]);
  eq(noF.counts4D[0], 361, "tanpa filter: TOP = 19×19 = 361");

  // Dengan AI3D "145": hanya 4D abcd dengan bcd="145" → harus depan=2 → 2x:
  // "21" (memuat 2 ✓) dan "24"? bcd tetap 145 → abc=214? code = ab+cd, bcd=145
  // → a=1? tidak: 4D = a b c d, filter ambil slice(1,4)=b,c,d. code=abcd.
  // bcd="145" → code ∈ {0,1,2,3,4,5,6,7,8,9}+"145" → a=2 → "2145".
  // cek killPoint AID "2" utk ab="21": memuat 2 → hidup (0). AI "0" utk cd="45": mati (1).
  // poin = 0+1 = 1 → CAD 1. TOP kosong.
  const withF = buildRekap4D([F("AID", "2"), F("AI", "0"), F("AI3D", "145")]);
  eq(withF.useFilter, true, "AI3D aktif: useFilter true");
  eq(withF.kept, 10, "hanya 10 kombinasi lolos (a=0..9 tetap dihitung 1 per a)");
  eq(withF.dropped, 9990, "9.990 terbuang");
  const cad1 = withF.tiers4D[1] || [];
  ok(cad1.includes("2145"), "2145 di CAD 1 (depan TOP × belakang MATI)");
  eq((withF.tiers4D[0] || []).length || 0, 0, "TOP kosong utk kasus ini");
}

// ── 3. Multi-kunci AI3D: 2 rumus → union kunci ──
{
  const impl = buildRekap4D([F("AID", "9"), F("AI", "9"), F("AI3D", "012"), F("AI3D", "345")]);
  eq(impl.ai3dFilter, ["012", "345"], "kunci = gabungan sorted");
  eq(impl.kept, 20, "2 kunci × 10 digit depan = 20");
}

// ── 4. AI3D digit abnormal ──
{
  eq(ai3dKeys([F("AI3D", "12"), F("AI3D", "1234"), F("AI3D", "7x89")]).keys, ["234", "789"], "2-digit diabaikan, 4-digit ambil 3 terakhir");
  eq(ai3dKeys([F("AI3D", "12")]).ignored, ["AI3D:12"], "yang diabaikan tercatat");
}

// ── 5. Render menyebut blok filter + total sah ──
{
  const impl = buildRekap4D([F("AID", "1"), F("AI", "2"), F("AI3D", "145")]);
  const txt = renderRekap4D(impl, "all");
  ok(txt.includes("AI3D (filter posisi 2-4"), "render: blok AI3D ada");
  ok(txt.includes("KUNCI: 145"), "render: kunci tampil");
  ok(txt.includes("Filter membuang"), "render: ringkasan buang/kept");
  ok(txt.includes("4D GABUNGAN (lolos filter AI3D)"), "render: judul gabungan berlabel filter");
  ok(txt.includes("Total sah (lolos AI3D) : 10"), "render: statistik berbasis total sah");
  // semua angka 4D pada blok gabungan harus lolos filter
  const blok = txt.slice(txt.indexOf("4D GABUNGAN"), txt.indexOf("STATISTIK"));
  const codes = [...blok.matchAll(/\b(\d{4})\b/g)].map((m) => m[1]);
  ok(codes.length > 0 && codes.every((c) => c.slice(1, 4) === "145"), "semua kode hasil = bcd 145");
}

// ── 6. Render tanpa AI3D identik struktur lama (tak ada blok filter) ──
{
  const impl = buildRekap4D([F("AID", "1"), F("AI", "2")]);
  const txt = renderRekap4D(impl, "top");
  ok(!txt.includes("KUNCI:"), "tanpa AI3D: tak ada blok KUNCI");
  ok(txt.includes("Total kombinasi : 10000"), "tanpa AI3D: basis tetap 10.000");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
