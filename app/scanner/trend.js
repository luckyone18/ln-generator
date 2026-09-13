// ── Trend Gabungan & Analisa Tren Koleksi (fitur orisinal LN Generator) ──
// A. Coverage angka main gabungan per draw — patokan = angka 4D result:
// berapa posisi digit result yang tertutup union angka main. 4/4 = 100%.
// B. Hot/Cold digit (ranking frekuensi digit dari semua ai)
// C. Streak & statistik patah per rumus

// Parse satu trek_log → [{ res, seq, hit }] (hit: true/false/null)
// Format yang dikenali (3 sumber):
//   server Angkanet : [h]d[/h] [m]ai[/m]=kena, 𐄂=patah, ?=prediksi, polos=baris referensi
//   engine lokal    : [m]ai[/m]=kena, x=patah, ??=prediksi
//   format lama     : (X)=patah, ?=prediksi
export function parseTrek(log) {
  const out = [];
  if (!log) return out;
  const lines = String(log).split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^(\d{3,6})\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const res = m[1];
    const seq = (m[2] || "").trim();
    const isMiss = /𐄂/.test(seq) || /\(X\)/i.test(seq) || /(?:^|\s)[x](?:\s|$)/.test(seq);
    const isPred = /(?:^|\s)\?{1,2}(?:\s|$)/.test(seq);
    let hit = null;
    if (isMiss) hit = false;
    else if (isPred) hit = null;
    else if (/\[h\]/i.test(seq) || /\[m\]/i.test(seq)) hit = true;
    // tanpa marker sama sekali = baris referensi (di luar window penilaian) → null
    out.push({ res, seq, hit });
  }
  return out;
}

// A. Coverage per draw: patokan = angka 4D result.
// Konvensi trek: AI pada baris i memprediksi result baris i+1, jadi
// angka main yang dinilai utk result R = AI pada baris tepat sebelum R.
// Gabungan (union) angka main semua rumus → berapa posisi digit R yang
// tertutup. 4/4 digit = 100%.
export function buildDrawTrend(items) {
  const draws = new Map(); // res -> { res, aiSets: [Set digit, ...] }
  const order = [];
  items.forEach((item) => {
    const trek = parseTrek(item.trek_log);
    const perRes = new Map(); // res -> Set digit AI (kemunculan terakhir menang)
    for (let i = 0; i < trek.length - 1; i++) {
      const digits = new Set(
        String(trek[i].seq)
          .replace(/\[[^\]]*\]/g, "") // buang tag [h]..[/h], [m]ai[/m]
          .replace(/[^0-9]/g, "")
          .split("")
          .filter((x) => x !== "")
      );
      if (digits.size === 0) continue;
      perRes.set(trek[i + 1].res, digits);
    }
    for (const [res, digits] of perRes) {
      if (!draws.has(res)) {
        draws.set(res, { res, aiSets: [] });
        order.push(res);
      }
      draws.get(res).aiSets.push(digits);
    }
  });
  return order.map((res) => {
    const d = draws.get(res);
    const covered = new Set();
    d.aiSets.forEach((s) => s.forEach((x) => covered.add(x)));
    const digits = String(res).split("");
    const miss = digits.filter((x) => !covered.has(x));
    return {
      res,
      hits: digits.length - miss.length,
      total: digits.length,
      missDigits: [...new Set(miss)],
      rumusCount: d.aiSets.length,
      pct: digits.length ? Math.round(((digits.length - miss.length) / digits.length) * 100) : 0,
    };
  });
}

// Union angka main semua rumus untuk draw BERIKUTNYA (baris prediksi '?').
export function buildNextDrawAI(items) {
  const covered = new Set();
  let n = 0;
  items.forEach((item) => {
    const trek = parseTrek(item.trek_log);
    const last = trek[trek.length - 1];
    if (!last) return;
    const digits = String(last.seq)
      .replace(/\[[^\]]*\]/g, "")
      .replace(/[^0-9]/g, "")
      .split("")
      .filter((x) => x !== "");
    if (!digits.length) return;
    n++;
    digits.forEach((x) => covered.add(x));
  });
  return { digits: [...covered].sort().join(""), n };
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

  // ── 0. Rumus yang dipakai ──
  L.push("── 0. RUMUS YANG DIPAKAI ──");
  items.forEach((it, i) => {
    const badge =
      it.source === "original" ? "☁️ ASLI" : it.source === "manual" ? "✍️ MANUAL" : it.source === "local" ? "⚡ LOKAL" : "";
    L.push(
      `(${i + 1}) ${it.rumus_key || "-"} | ${(it.type || "?").padEnd(14)} | ai ${it.ai || "-"} ${badge}`
    );
  });
  L.push("");

  // ── A. Coverage per draw ──
  L.push("── A. COVERAGE ANGKA MAIN PER DRAW ──");
  L.push("(patokan = 4 digit result; angka main = union AI semua rumus)", "");
  if (drawTrend.length === 0) {
    L.push("(tidak ada data trek)");
  } else {
    const show = drawTrend.slice(-20);
    show.forEach((d) => {
      const icon = d.pct === 100 ? "🔥" : d.pct >= 75 ? "➖" : "❄️";
      const miss = d.missDigits.length ? ` — lepas: ${d.missDigits.join("")}` : "";
      L.push(`${d.res} : ${d.hits}/${d.total} digit ${miss} ${bar(d.pct)} ${d.pct}% ${icon}`);
    });
    const avg = drawTrend.length
      ? Math.round((drawTrend.reduce((a, d) => a + d.pct, 0) / drawTrend.length) * 10) / 10
      : 0;
    L.push("");
    L.push(`Rata-rata coverage koleksi: ${avg}% ${avg === 100 ? "🔥 SEMPURNA" : avg >= 75 ? "➖ KUAT" : "❄️ LOLOSAN"}`);
    L.push("");
    const next = buildNextDrawAI(items);
    if (next.digits) {
      L.push(`Angka main gabungan utk draw berikutnya: ${next.digits} (dari ${next.n} rumus)`);
    }
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
