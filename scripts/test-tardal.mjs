import { generateTardal } from "../app/tardal.js";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  PASS ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name} ${extra}`);
  }
}

// Golden vectors captured from the reference site's endpoint
// (wh_ccv61_bbfs_ajax, calc_type=tardal) on 2026-09-09.
const GOLDEN = [
  {
    name: "0123 t2 twin * -> 16, exact order",
    input: { digits: "0123", type: "2", twin: "1", splitter: "*" },
    expect:
      "00*01*02*03*10*11*12*13*20*21*22*23*30*31*32*33",
    count: 16,
  },
  {
    name: "0123 t2 no-twin * -> 12, exact order",
    input: { digits: "0123", type: "2", twin: "2", splitter: "*" },
    expect: "01*02*03*10*12*13*20*21*23*30*31*32",
    count: 12,
  },
  {
    name: "0123 t3 no-twin * -> 24, exact order",
    input: { digits: "0123", type: "3", twin: "2", splitter: "*" },
    expect:
      "012*013*021*023*031*032*102*103*120*123*130*132*201*203*210*213*230*231*301*302*310*312*320*321",
    count: 24,
  },
  {
    name: "3021 t2 no-twin * -> input order preserved",
    input: { digits: "3021", type: "2", twin: "2", splitter: "*" },
    expect: "30*32*31*03*02*01*23*20*21*13*10*12",
    count: 12,
  },
  {
    name: "0120 t2 no-twin * -> dedupe -> as 012",
    input: { digits: "0120", type: "2", twin: "2", splitter: "*" },
    expect: "01*02*10*12*20*21",
    count: 6,
  },
];

console.log("== Generator Tardal tests ==\n");

for (const g of GOLDEN) {
  const r = generateTardal(g.input);
  check(g.name, r.result === g.expect && r.count === g.count, `(got ${JSON.stringify(r).slice(0, 120)})`);
}

// Golden: 012 t4 twin # -> 81 = 3^4, first few exact
const g1 = generateTardal({ digits: "012", type: "4", twin: "1", splitter: "#" });
check("012 t4 twin # -> 81 combos", g1.count === 81, `(got ${g1.count})`);
check("012 t4 twin # -> starts 0000#0001#0002#0010", g1.result.startsWith("0000#0001#0002#0010"), `(got ${g1.result.slice(0, 40)})`);

// Golden: 0123 t3 twin -> 64 = 4^3, starts 000*001*002*003*010
const g2 = generateTardal({ digits: "0123", type: "3", twin: "1", splitter: "*" });
check("0123 t3 twin -> 64 combos", g2.count === 64, `(got ${g2.count})`);
check("0123 t3 twin -> starts 000*001*002*003*010", g2.result.startsWith("000*001*002*003*010"), `(got ${g2.result.slice(0, 40)})`);

// Golden: 0-9 t4 twin -> 10000 combos
const g3 = generateTardal({ digits: "0123456789", type: "4", twin: "1", splitter: "*" });
check("0-9 t4 twin -> 10000 combos", g3.count === 10000, `(got ${g3.count})`);
check("0-9 t4 twin result length 49999", g3.result.length === 49999, `(got ${g3.result.length})`);

// Edge: no-twin with fewer digits than type -> empty, count 0
const e1 = generateTardal({ digits: "012", type: "4", twin: "2", splitter: "*" });
check("012 t4 no-twin -> empty count 0", e1.result === "" && e1.count === 0);

// Edge: invalid inputs -> error
check("empty digits -> error", !!generateTardal({ digits: "", type: "2", twin: "1", splitter: "*" }).error);
check("non-digit input -> error", !!generateTardal({ digits: "abc", type: "2", twin: "1", splitter: "*" }).error);
check("bad type -> error", !!generateTardal({ digits: "0123", type: "5", twin: "1", splitter: "*" }).error);
check("bad twin -> error", !!generateTardal({ digits: "0123", type: "2", twin: "9", splitter: "*" }).error);

// Splitter variants
const s1 = generateTardal({ digits: "01", type: "2", twin: "1", splitter: "," });
check("splitter ,", s1.result === "00,01,10,11");
const s2 = generateTardal({ digits: "01", type: "2", twin: "1", splitter: "#" });
check("splitter #", s2.result === "00#01#10#11");
const s3 = generateTardal({ digits: "01", type: "2", twin: "1", splitter: "x" });
check("unknown splitter -> default *", s3.result === "00*01*10*11");

// maxlength 15 honored by UI; algorithm itself accepts up to 10 unique digits
const s4 = generateTardal({ digits: "0123456789012", type: "2", twin: "1", splitter: "*" });
check("15 digits with dupes -> dedupe to 10 -> 100 combos", s4.count === 100, `(got ${s4.count})`);

console.log(`\n${failures === 0 ? "✅ ALL TARDAL TESTS PASSED" : `❌ ${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
