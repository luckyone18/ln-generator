// Dev tool: cek string tertentu ada di chunk live /luckyone (atau halaman mana pun).
// Pemakaian: node scripts/check-live.mjs "/luckyone" "Gabung" "Angka Double"
// Tanpa argumen: pakai default di bawah.
// Catatan: Next 16 serve chunk di /_next/static/immutable/chunks/ (bukan /_next/static/chunks/).
const BASE = "https://ln.unlabot.eu.cc";
const args = process.argv.slice(2);
const page = args[0]?.startsWith("/") ? args[0] : "/luckyone";
const markers = (args[0]?.startsWith("/") ? args.slice(1) : args).length
  ? (args[0]?.startsWith("/") ? args.slice(1) : args)
  : ["temukan", "hapus angka", "pemisah", "Ditemukan:"];

const html = await (await fetch(`${BASE}${page}?x=${Date.now()}`, { cache: "no-store" })).text();
const chunkPaths = [...new Set(html.match(/\/_next\/static\/[A-Za-z0-9_/-]*chunks\/[A-Za-z0-9_-]*\.js/g) || [])];
let hits = 0;
for (const p of chunkPaths) {
  const js = await (await fetch(`${BASE}${p}`, { cache: "no-store" })).text();
  const marks = markers.map((m) => `${m}=${js.includes(m) ? "Y" : "."}`).join(" ");
  if (markers.some((m) => js.includes(m))) { hits++; console.log("HIT", p, marks); }
}
console.log(`page=${page} chunks=${chunkPaths.length} markers="${markers.join(",")}" → ${hits ? "LIVE ✅" : "TIDAK DITEMUKAN ❌"}`);
process.exit(hits ? 0 : 1);
