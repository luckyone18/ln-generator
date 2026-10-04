// Test suite Rekap 4D — AID × AI + filter AI3D/AIT berbasis TOP/CAD (mode=top/full).
import { buildRekap4D, renderRekap4D } from "../app/scanner/rekap.js";

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}\n      expected ${e}\n      actual   ${a}`); }
}
function ok(cond, label) { eq(!!cond, true, label); }

const F = (type, ai) => ({ type, ai });

// ── 1. Baseline tanpa filter ──
{
  const impl = buildRekap4D([F("AID", "12"), F("AI", "34")]);
  eq(impl.useFilter, false, "tanpa filter: useFilter false");
  const total = impl.counts4D.reduce((s, n) => s + (n || 0), 0);
  eq(total, 10000, "tanpa filter: total 4D = 10.000");
}

// ── 2. Filter mode="top": ambil kandidat TOP dari rekap AI3D ──
{
  // AI3D "745" → scorePoolN 3-digit → tiers[0]=TOP. Misal top={...}. KUNCI diambil dari TOP saja.
  const withF = buildRekap4D([F("AID", "2"), F("AI", "0"), F("AI3D", "745")], "top");
  eq(withF.filterMode, "top", "mode=default='top'");
  ok(withF.useFilter, "filter aktif");
  // Kunci 745 masuk karena angka ini punya poin 0 di rekapnya sendiri? (cek di killPoint default)
  // Default killPoint AI3D "745": angka 3-digit harus MEMUAT digit 7,4,5 (default rule digits.includes).
  // Untuk 745: memuat 7,4,5 ✓ → poin 0 → TOP. Jadi 745 ∈ TOP.
  ok(withF.ai3dFilter.includes("745"), "KUNCI 745 ada di TOP");
}

// ── 3. Multi-kunci AI3D: 2 rumus → union kunci ──
{
  const impl = buildRekap4D([F("AID", "9"), F("AI", "9"), F("AI3D", "012"), F("AI3D", "345")], "top");
  eq(impl.ai3dFilter.length >= 2, true, "kunci ≥2");
}

// ── 4. Render menyebut blok tier AI3D & AIT ──
{
  const impl = buildRekap4D([F("AID", "1"), F("AI", "2"), F("AI3D", "145"), F("AIT", "74")], "top");
  const txt = renderRekap4D(impl, "all");
  ok(txt.includes("AI3D (filter posisi 2-4"), "render: blok AI3D ada");
  ok(txt.includes("[AI3D] TIER 3D"), "render: blok [AI3D] TIER 3D");
  ok(txt.includes("[AIT] TIER 2D"), "render: blok [AIT] TIER 2D");
  ok(txt.includes("KUNCI:"), "render: KUNCI tampil");
  ok(txt.includes("mode: "), "render: filterMode tampil");
}

// ── 5. Filter mode="full": gabungan TOP+CAD1+CAD2 ──
{
  const f = "top";
  const full = buildRekap4D([F("AID", "1"), F("AI", "2"), F("AIT", "74")], "full");
  eq(full.filterMode, "full", "mode='full'");
  ok(full.aitFilter.length > 0, "KUNCI ada di mode full");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
