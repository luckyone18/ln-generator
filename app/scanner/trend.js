// ── Trend Gabungan & Analisa Tren Koleksi (fitur orisinal LN Generator) ──
// A. Tren performa gabungan per draw (berapa rumus kena vs patah)
// B. Hot/Cold digit (ranking frekuensi digit dari semua ai)
// C. Streak & statistik patah per rumus

// Parse satu trek_log → [{ res, seq, hit }] (hit: true/false/null)
export function parseTrek(log) {
  const out = [];
  if (!log) return out;
  const lines = String(log).split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^(\d{3,6})\s*:\s*(.*?)(\s+\[m\].*?\[\/m\]|\s+x|\s+\?\?)?\s*$/i);
    if (!m) continue;
    const res = m[1];
    const seq = (m[2] || "").trim();
    let hit = null;
    const tail = (m[3] || "").trim();
    if (/\[m\]/i.test(tail)) hit = true;
    else if (/x$/i.test(tail)) hit = false;
    out.push({ res, seq, hit });
  }
  return out;
}

// A. Tren per draw: gabungkan semua trek terurut tua→baru.
// Setiap entry: { res, hitCount, missCount, predictCount, total }
export function buildDrawTrend(items) {
  const draws = new Map(); // res -> { res, hits, total }
  const order = [];
  for (const item of items) {
    const trek = parseTrek(item.trek_log);
    for (const row of trek) {
      if (row.hit === null) continue; // baris prediksi tidak dinilai
      if (!draws.has(row.res)) {
        draws.set(row.res, { res: row.res, hits: 0, total: 0 });
        order.push(row.res);
      }
      const d = draws.get(row.res);
      d.hits += row.hit ? 1 : 0;
      d.total += 1;
    }
  }
  // Urutkan tua→baru sesuai kemunculan terakhir (trek dianggap kronologis);
  // kalau beda rumus beda window, pakai urutan kemunculan pertama.
  return order.map((res) => {
    const d = draws.get(res);
    return {
      res,
      hitCount: d.hits,
      missCount: d.total - d.hits,
      total: d.total,
      pct: d.total ? Math.round((d.hits / d.total) * 100) : 0,
    };
  });
}

// B. Hot/Cold digit: ranking frekuensi digit dari semua ai koleksi.
export function buildHotCold(items) {
  const freq = {};
  for (let i = 0; i <= 9; i++) freq[String(i)] = 0;
  let itemsWithDigits = 0;
  for (const item of items) {
    const digits = new Set(String(item.ai || "").replace(/[^0-9]/g, "").split(""));
    if (digits.size > 0) itemsWithDigits++;
    digits.forEach((d) => { freq[d] += 1; });
  }
  const ranked = Object.entries(freq)
    .map(([digit, count]) => ({ digit, count, pct: items.length ? Math.round((count / items.length) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  const max = ranked[0] ? ranked[0].count : 0;
  const hot = ranked.filter((r) => r.count >= Math.max(1, Math.ceil(max * 0.7)));
  const cold = ranked.filter((r) => r.count <= Math.max(0, Math.floor(max * 0.3)));
  return { ranked, hot, cold, itemsWithDigits };
}

// C. Streak & statistik per rumus.
export function buildStreaks(items) {
  return items
    .map((item) => {
      const trek = parseTrek(item.trek_log);
      // streak berturut-turut dari baris terakhir (yang sudah dinilai)
      let streak = 0;
      let streakType = null; // 'hit' | 'miss'
      for (let i = trek.length - 1; i >= 0; i--) {
        const h = trek[i].hit;
        if (h === null) continue;
        if (streakType === null) { streakType = h ? "hit" : "miss"; streak = 1; }
        else if ((h && streakType === "hit") || (!h && streakType === "miss")) streak++;
        else break;
      }
      const judged = trek.filter((r) => r.hit !== null);
      const hits = judged.filter((r) => r.hit).length;
      const total = judged.length;
      return {
        key: item.rumus_key || item.code || "-",
        type: item.type || "",
        ai: item.ai || "",
        streak,
        streakType,
        hits,
        total,
        hitPct: total ? Math.round((hits / total) * 100) : 0,
        lastRes: trek.length ? trek[trek.length - 1].res : "",
      };
    })
    .sort((a, b) => b.streak - a.streak);
}

// Render bar ASCII sederhana (10 blok)
function bar(pct, width = 10) {
  const fill = Math.round((pct / 100) * width);
  return "█".repeat(Math.max(0, fill)) + "░".repeat(Math.max(0, width - fill));
}

export function renderTrend(items) {
  const L = [];
  const drawTrend = buildDrawTrend(items);
  const hotCold = buildHotCold(items);
  const streaks = buildStreaks(items);

  L.push(`Trend Gabungan — ${items.length} Rumus`, "");
  L.push(`(analisa statistik historis, bukan prediksi)`, "");

  // ── A. Tren per draw ──
  L.push("── A. PERFORMA GABUNGAN PER DRAW ──");
  if (drawTrend.length === 0) {
    L.push("(tidak ada data trek)");
  } else {
    // tampil max 20 draw terbaru
    const show = drawTrend.slice(-20);
    show.forEach((d) => {
      const icon = d.pct >= 70 ? "🔥" : d.pct >= 40 ? "➖" : "❄️";
      L.push(`${d.res} : ${d.hitCount}/${d.total} kena ${bar(d.pct)} ${d.pct}% ${icon}`);
    });
    const avg = drawTrend.length
      ? Math.round((drawTrend.reduce((a, d) => a + d.pct, 0) / drawTrend.length))
      : 0;
    L.push("");
    L.push(`Rata-rata hit rate koleksi: ${avg}% ${avg >= 70 ? "🔥 PANAS" : avg >= 40 ? "➖ NORMAL" : "❄️ DINGIN"}`);
  }
  L.push("");

  // ── B. Hot/Cold digit ──
  L.push("── B. HOT / COLD DIGIT ──");
  const hotStr = hotCold.hot.map((h) => `${h.digit}(${h.count})`).join(" ");
  const coldStr = hotCold.cold.map((c) => `${c.digit}(${c.count})`).join(" ");
  L.push(`HOT  🔥 : ${hotStr || "-"}`);
  L.push(`COLD ❄️ : ${coldStr || "-"}`);
  L.push("Ranking:");
  hotCold.ranked.forEach((r, i) => {
    L.push(`  ${i + 1}. digit ${r.digit} — muncul di ${r.count}/${items.length} rumus (${r.pct}%) ${bar(r.pct)}`);
  });
  L.push("");

  // ── C. Streak per rumus ──
  L.push("── C. STREAK & STATISTIK RUMUS ──");
  streaks.forEach((s) => {
    const st = s.streakType === "hit" ? "kena" : s.streakType === "miss" ? "patah" : "-";
    const icon = s.streakType === "hit" ? "✓" : "x";
    L.push(`${String(s.streak).padStart(2)}x ${st} ${icon} | ${String(s.type).padEnd(4)} | hit ${String(s.hits).padStart(2)}/${s.total} (${s.hitPct}%) | ai ${s.ai} | ${s.key}`);
  });
  L.push("");
  return L.join("\n");
}
