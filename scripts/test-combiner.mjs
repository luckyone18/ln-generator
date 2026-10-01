// Test suite logika tab "Gabung Angka" (combiner-lib.js)
// Jalankan: node scripts/test-combiner.mjs
import {
  parseCol,
  combineUnique,
  sortResult,
  filterResult,
  parseBuang,
  findDoubles,
} from "../app/luckyone/combiner-lib.js";

let pass = 0;
let fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  XX  ${label}\n      got=${a}\n      exp=${b}`);
  }
}

// 1) parse per kolom: pemisah * , campur spasi, invalid
eq(parseCol("12*34*56").ok, ["12", "34", "56"], "parse 2D pemisah *");
eq(parseCol("123*456").ok, ["123", "456"], "parse 3D pemisah *");
eq(parseCol("1234*5678").ok, ["1234", "5678"], "parse 4D pemisah *");
eq(parseCol("12 34,56;78").ok, ["12", "34", "56", "78"], "parse toleran spasi/koma/;");
eq(parseCol("1*12345*abc*12").ok, ["12"], "token invalid dibuang (1 digit, 5 digit, abc)");
eq(parseCol("1*12345*abc*12").bad, ["1", "12345", "abc"], "token invalid terdaftar di bad");
eq(parseCol("").ok, [], "kolom kosong -> []");

// 2) gabung unik antar 3 kolom (angka sama dibuang)
eq(
  combineUnique([
    ["12", "34", "56"],
    ["34", "78", "90"],
    ["12", "78", "99"],
  ]),
  ["12", "34", "56", "78", "90", "99"],
  "gabung 3 kolom buang duplikat"
);

// 3) gabung mempertahankan urutan kemunculan
eq(combineUnique([["56", "12"], ["12", "99"]]), ["56", "12", "99"], "urutan kemunculan dijaga");

// 4) gabung campur 2D/3D/4D, dedupe lintas panjang
eq(
  combineUnique([["12"], ["123"], ["1234"], ["12"]]),
  ["12", "123", "1234"],
  "gabung campur 2D/3D/4D unik"
);

// 5) sorting
eq(sortResult(["34", "12", "123", "99"], "asli"), ["34", "12", "123", "99"], "sort asli");
eq(sortResult(["34", "12", "123", "99"], "asc"), ["12", "123", "34", "99"], "sort asc");
eq(sortResult(["34", "12", "123", "99"], "desc"), ["99", "34", "123", "12"], "sort desc");

// 6) filter temukan
eq(filterResult(["1234", "5678", "1234"], "34", []), ["1234", "1234"], "cari 34");
eq(filterResult(["1234", "5678"], "99", []), [], "cari 99 (tak ada)");

// 7) filter buang (parseBuang + filterResult)
eq(parseBuang("34*12*9"), ["34", "12", "9"], "parseBuang *");
eq(parseBuang("34 12"), ["34", "12"], "parseBuang spasi");
eq(filterResult(["1234", "5678", "1290"], "", ["12"]), ["5678"], "buang yg mengandung 12");

// 8) gabung + filter end-to-end
const cols = [parseCol("12*34*12"), parseCol("34*567"), parseCol("1234*12*999")];
const uniq = combineUnique(cols.map((c) => c.ok));
eq(uniq, ["12", "34", "567", "1234", "999"], "e2e gabung unik (12 & 34 muncul 2x)");

// 9) angka double (muncul > 1x)
const d1 = findDoubles([["12", "34", "56"], ["34", "78"], ["12", "78", "99"]]);
eq(d1.doubles, ["12", "34", "78"], "double: 12/34/78 muncul 2x");
eq([...d1.count.entries()], [["12", 2], ["34", 2], ["56", 1], ["78", 2], ["99", 1]], "double: hitungan tiap angka");

const d2 = findDoubles([["12", "12", "12"], ["12"]]);
eq(d2.doubles, ["12"], "double: satu angka muncul 4x");
eq(d2.count.get("12"), 4, "double: hitungan 4x");

const d3 = findDoubles([["12", "34"], ["56", "78"]]);
eq(d3.doubles, [], "double: tidak ada yang double");

// 10) double mengikuti filter 🔎 & 🗑
eq(filterResult(["12", "34", "78"], "3", []), ["34"], "double difilter cari '3'");
eq(filterResult(["12", "34", "78"], "", ["78"]), ["12", "34"], "double difilter buang '78'");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
