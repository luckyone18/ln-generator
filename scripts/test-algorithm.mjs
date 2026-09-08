import { generate, parseInput, allPairs } from "../app/algorithm.js";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name} ${extra}`);
  }
}

const SAMPLES = [
  "1234",
  "0000",
  "9999",
  "5871",
  "9876",
  "12",
  "12345678",
  "1234\n5678",
  "5678\n1234",
  "  7731  ",
  "0",
];

const PAIRS = new Set(allPairs());

console.log("== Generator LN algorithm tests ==\n");

for (const raw of SAMPLES) {
  const label = JSON.stringify(raw.length > 20 ? raw.slice(0, 20) + "…" : raw);
  console.log(`Input: ${label}`);

  // 1. Determinism: 3 runs identical
  const runs = [generate(raw), generate(raw), generate(raw)];
  const sig = (r) => JSON.stringify([r.kress, r.top, r.p1, r.p2, r.p3, r.p4, r.px]);
  check("deterministic (3x identical)", sig(runs[0]) === sig(runs[1]) && sig(runs[1]) === sig(runs[2]));

  const r = runs[0];
  const groups = [r.top, r.p1, r.p2, r.p3, r.p4, r.px];
  const all = groups.flat();

  // 2. Partition: exactly 100, no dups, covers all pairs
  check("total = 100", all.length === 100, `(got ${all.length})`);
  check("no duplicates", new Set(all).size === 100);
  check("covers all 00-99", all.every((x) => PAIRS.has(x)) && new Set(all).size === 100);

  // 3. Format: every LN is a 2-digit string
  check('all LNs are 2-digit strings', all.every((x) => /^\d{2}$/.test(x)));

  // 4. Size constraints
  const [n1, n2, n3, n4, n5, n6] = groups.map((g) => g.length);
  check("TOP 30-50", n1 >= 30 && n1 <= 50, `(got ${n1})`);
  check("p1 20-30", n2 >= 20 && n2 <= 30, `(got ${n2})`);
  check("p2 5-15", n3 >= 5 && n3 <= 15, `(got ${n3})`);
  check("p3 1-8", n4 >= 1 && n4 <= 8, `(got ${n4})`);
  check("p4 1-6", n5 >= 1 && n5 <= 6, `(got ${n5})`);
  check("px >= 0", n6 >= 0, `(got ${n6})`);

  // 5. Kress: 3-6 distinct digits, space-joined
  const kd = r.kress.split(" ").map(Number);
  check("kress 3-6 distinct digits", kd.length >= 3 && kd.length <= 6 && new Set(kd).size === kd.length && kd.every((x) => x >= 0 && x <= 9), `(got "${r.kress}")`);

  console.log(`  -> TOP=${n1} p1=${n2} p2=${n3} p3=${n4} p4=${n5} px=${n6} | kress="${r.kress}"\n`);
}

// Multi-line: last non-empty line wins
console.log("Multi-line behavior:");
check("gen('1234\\n5678') == gen('5678')", sig2(generate("1234\n5678")) === sig2(generate("5678")));
check("gen('5678\\n1234') == gen('1234')", sig2(generate("5678\n1234")) === sig2(generate("1234")));
check("gen('  7731  ') == gen('7731')", sig2(generate("  7731  ")) === sig2(generate("7731")));

// Invalid inputs -> error object
check("gen('') -> error", generate("").error === "Masukkan result yang valid");
check("gen('abc') -> error", generate("abc").error === "Masukkan result yang valid");
check("parseInput(null) -> null", parseInput(null) === null);

// Different inputs -> different outputs (sanity, not guaranteed for all pairs)
const distinct = new Set(["1234", "5678", "9012", "4444", "7777"].map((s) => sig2(generate(s))));
check("5 distinct inputs give >= 4 distinct outputs", distinct.size >= 4, `(got ${distinct.size})`);

// Kress count option (3-7)
console.log("Kress digit count option:");
for (const want of [3, 4, 5, 6, 7]) {
  const r = generate("1234", want);
  const kd = r.kress.split(" ").map(Number);
  check(
    `kress fixed ${want} digit`,
    kd.length === want && new Set(kd).size === want,
    `(got "${r.kress}")`
  );
  const all = [r.top, r.p1, r.p2, r.p3, r.p4, r.px].flat();
  check(`  partition still 100 (kress=${want})`, all.length === 100 && new Set(all).size === 100);
  const r2 = generate("1234", want);
  check(`  deterministic (kress=${want})`, r.kress === r2.kress && JSON.stringify(r.top) === JSON.stringify(r2.top));
}
// out-of-range clamps
check("kress 1 -> clamp ke 3", generate("1234", 1).kress.split(" ").length === 3);
check("kress 99 -> clamp ke 7", generate("1234", 99).kress.split(" ").length === 7);
// null/undefined = acak 3-6
const acak = generate("1234");
check("kress acak 3-6", acak.kress.split(" ").length >= 3 && acak.kress.split(" ").length <= 6);

function sig2(r) {
  return JSON.stringify([r.kress, r.top, r.p1, r.p2, r.p3, r.p4, r.px]);
}

console.log(`\n${failures === 0 ? "✅ ALL TESTS PASSED" : `❌ ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
