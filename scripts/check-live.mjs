// Dev tool: cek string tertentu ada di chunk live /luckyone
const html = await (await fetch("https://ln.unlabot.eu.cc/luckyone?x=" + Date.now(), { cache: "no-store" })).text();
const chunks = [...new Set(html.match(/chunks\/[A-Za-z0-9_-]*\.js/g) || [])];
for (const f of chunks) {
  const js = await (await fetch(`https://ln.unlabot.eu.cc/_next/static/${f}`, { cache: "no-store" })).text();
  const marks = ["temukan", "hapus angka", "pemisah", "Ditemukan:"].map((m) => `${m}=${js.includes(m) ? "Y" : "."}`).join(" ");
  if (/[Y]/.test(marks)) console.log(f, marks);
}
console.log("chunks:", chunks.length);
