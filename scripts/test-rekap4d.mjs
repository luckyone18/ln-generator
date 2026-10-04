// Test suite Rekap 4D — AID × AI dengan mode "gabung tier sama":
//   TOP 4D  = TOP dpn  × TOP blk
//   CAD1 4D = CAD1 dpn × CAD1 blk
//   CAD2 4D = CAD2 dpn × CAD2 blk
//   MATI n  = MATI n dpn × MATI n blk
// plus filter AI3D/AIT berbasis TOP/CAD (mode=top/full).
import { buildRekap4D, renderRekap4D } from "../app/scanner/rekap.js";

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}\n      expected ${e}\n      actual   ${a}`); }
}
function ok(cond, label) { eq(!!cond, true, label); }

const F = (type, ai) => ({ type, ai });

// ── 1. Baseline tanpa filter: gabung tier sama (diagonal saja) ──
{
  const impl = buildRekap4D([F("AID", "12"), F("AI", "34")]);
  eq(impl.useFilter, false, "tanpa filter: useFilter false");
  // 1 rumus AID + 1 rumus AI → poin depan 0/1, poin belakang 0/1.
  // TOP  = TOP×TOP, CAD1 = CAD1×CAD1 (tidak ada silang).
  const nTop = (impl.counts4D[0] || 0);
  const nCad1 = (impl.counts4D[1] || 0);
  const total = impl.counts4D.reduce((s, n) => s + (n || 0), 0);
  eq(total, impl.kept, "tanpa filter: total = kept (hanya diagonal tier)");
  ok(nTop > 0 && nCad1 > 0, "tanpa filter: TOP & CAD1 terisi");
  // Total < 10.000 karena bukan seluruh ruang 4D yang terisi.
  ok(total < 10000, "tanpa filter: total < 10.000 (mode diagonal)");
}

// ── 2. Komposisi tier sama (TOP=TOP×TOP, CAD1=CAD1×CAD1, CAD2=CAD2×CAD2) ──
{
  const impl = buildRekap4D([F("AID", "17"), F("AID", "25"), F("AI", "45"), F("AI", "89")]);
  const nF = impl.tiersFront, nB = impl.tiersBack;
  eq(impl.counts4D[0], (nF[0].length) * (nB[0].length), "TOP 4D = TOP dpn × TOP blk");
  eq(impl.counts4D[1], (nF[1].length) * (nB[1].length), "CAD1 4D = CAD1 dpn × CAD1 blk");
  eq(impl.counts4D[2], (nF[2].length) * (nB[2].length), "CAD2 4D = CAD2 dpn × CAD2 blk");
}

// ── 3. Filter mode="top": kandidat TOP dari rekap AI3D ──
{
  const withF = buildRekap4D([F("AID", "2"), F("AI", "0"), F("AI3D", "745")], "top");
  eq(withF.filterMode, "top", "mode=default='top'");
  ok(withF.useFilter, "filter aktif");
  ok(withF.ai3dFilter.includes("745"), "KUNCI 745 ada di TOP");
}

// ── 4. Multi-kunci AI3D: 2 rumus → union kunci ──
{
  const impl = buildRekap4D([F("AID", "9"), F("AI", "9"), F("AI3D", "012"), F("AI3D", "345")], "top");
  eq(impl.ai3dFilter.length >= 2, true, "kunci ≥2");
}

// ── 5. Render menyebut blok tier AI3D & AIT ──
{
  const impl = buildRekap4D([F("AID", "1"), F("AI", "2"), F("AI3D", "145"), F("AIT", "74")], "top");
  const txt = renderRekap4D(impl, "all");
  ok(txt.includes("AI3D (filter posisi 2-4"), "render: blok AI3D ada");
  ok(txt.includes("[AI3D] TIER 3D"), "render: blok [AI3D] TIER 3D");
  ok(txt.includes("[AIT] TIER 2D"), "render: blok [AIT] TIER 2D");
  ok(txt.includes("KUNCI:"), "render: KUNCI tampil");
  ok(txt.includes("mode: "), "render: filterMode tampil");
}

// ── 6. Filter mode="full": gabungan TOP+CAD1+CAD2 ──
{
  const full = buildRekap4D([F("AID", "1"), F("AI", "2"), F("AIT", "74")], "full");
  eq(full.filterMode, "full", "mode='full'");
  ok(full.aitFilter.length > 0, "KUNCI ada di mode full");
}

// ── 7. Filter membuang kombinasi (dropped > 0) ──
{
  const impl = buildRekap4D([F("AID", "1"), F("AI", "2"), F("AI3D", "145")], "top");
  ok(impl.dropped > 0, "filter: dropped > 0");
  ok(impl.kept < impl.kept + impl.dropped, "filter: kept < kept+dropped");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
