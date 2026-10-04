// ── Rekap & Trek Gabungan Scanner (clone logika Scanner Angkanet Pro) ──

// Hitung rekap dari kumpulan rumus (items = [{type, ai}]).
// Pool = 00-99 2D; tiap angka dapat poin = berapa rumus yang mematikannya.
// tier: 0=[TOP] 1=[CAD 1] 2=[CAD 2] 3+=[MATI n]. Sekaligus hitung KRES.

// Poin "mati" utk satu angka 2D ("00".."99") dari satu formula.
function killPoint(a, f) {
  const k = parseInt(a[0], 10);
  const e = parseInt(a[1], 10);
  const biji = k + e > 9 ? k + e - 9 : k + e;
  const aiStr = String(f.ai || "");
  const digits = aiStr.replace(/[^0-9]/g, "").split("");
  const nums = aiStr.replace(/[^0-9]/g, " ").split(/\s+/).filter((v) => v.length > 0);
  if (digits.length === 0 && nums.length === 0) return 0;
  const typ = (f.type || "").toUpperCase();

  if (typ === "K" || typ === "KE" || typ === "KEP" || typ === "KEPALA" || typ === "KPL") {
    return digits.includes(String(k)) ? 0 : 1;
  }
  if (typ === "E" || typ === "EK" || typ === "EKR" || typ === "EKOR") {
    return digits.includes(String(e)) ? 0 : 1;
  }
  if (typ === "J" || typ === "JML" || typ === "JUMLAH" || typ === "BIJI") {
    return digits.includes(String(biji)) ? 0 : 1;
  }
  if (typ === "S" || typ === "SH" || typ === "SHIO") {
    let numVal = parseInt(a, 10);
    if (numVal === 0) numVal = 100;
    const shioVal = numVal % 12 || 12;
    for (const s of nums) if (parseInt(s, 10) === shioVal) return 0;
    return 1;
  }
  // default (AI, AID, CB, dst): hidup = minimal 1 digit termuat di angka
  for (const d of digits) if (a.includes(d)) return 0;
  return 1;
}

// Poin per angka 2D (00-99) utk sekumpulan formula → { "00": p, ... }
function scorePool(formulas) {
  const pts = {};
  for (let i = 0; i < 100; i++) {
    const a = String(i).padStart(2, "0");
    let p = 0;
    for (const f of formulas) p += killPoint(a, f);
    pts[a] = p;
  }
  return pts;
}

// Kelompokkan angka per poin → tiers[poin] = [angka, ...]
function groupTiers(pts) {
  const tiers = [];
  for (const [a, p] of Object.entries(pts)) {
    if (!tiers[p]) tiers[p] = [];
    tiers[p].push(a);
  }
  return tiers;
}

// KRES: digit muncul di >= 2 formula, dikelompokkan per frekuensi.
function kresOf(formulas) {
  const kresByLevel = {};
  if (formulas.length > 1) {
    const digitCount = {};
    formulas.forEach((f) => {
      const digits = new Set(
        String(f.ai || "").replace(/[^0-9]/g, "").split("").filter((d) => d !== "")
      );
      digits.forEach((d) => { digitCount[d] = (digitCount[d] || 0) + 1; });
    });
    Object.entries(digitCount).forEach(([digit, count]) => {
      if (count >= 2) {
        if (!kresByLevel[count]) kresByLevel[count] = [];
        kresByLevel[count].push(digit);
      }
    });
  }
  const kresLevels = Object.keys(kresByLevel).map(Number).sort((a, b) => b - a);
  return { kresByLevel, kresLevels };
}

export function buildRekap(formulas) {
  const pts = scorePool(formulas);
  const tiers = groupTiers(pts);
  const { kresByLevel, kresLevels } = kresOf(formulas);
  return { tiers, kresByLevel, kresLevels };
}

// Format teks rekap siap tampil di terminal.
export function renderRekap(formulas, impl) {
  const lines = [`Rekap — ${formulas.length} Rumus`, ""];
  formulas.forEach((f) => lines.push(`${(f.type + "    ").slice(0, 4)} : ${f.ai}`));

  if (impl.kresLevels.length > 0) {
    lines.push("---------------");
    impl.kresLevels.forEach((level) => {
      const digits = impl.kresByLevel[level].slice().sort().join("");
      lines.push(`KRES ${level}   : ${digits}`);
    });
  }

  lines.push("");
  lines.push("");
  for (let p = 0; p <= formulas.length; p++) {
    if (impl.tiers[p] && impl.tiers[p].length) {
      const label =
        p === 0 ? "[TOP]" : p === 1 ? "[CAD 1]" : p === 2 ? "[CAD 2]" : `[MATI ${p}]`;
      lines.push(`${label} ${impl.tiers[p].length} Line`);
      lines.push(impl.tiers[p].join("*"));
      lines.push("");
    }
  }
  return lines.join("\n");
}

// ── Trek Gabungan (max 10 rumus) ─────────────────────────────────────
// Gabungkan trek_log beberapa rumus jadi satu tabel kronologis:
//   RES : ai1 vs ai2 vs ai3  [label][status]
export function buildMergedTrek(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0].trek_log || "";

  const chunkSize = 50;
  const finalLogs = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const subList = items.slice(i, i + chunkSize);
    if (subList.length === 1) {
      finalLogs.push(subList[0].trek_log);
      continue;
    }

    const sorted = subList.slice().sort((a, b) => {
      const lenA = (a.trek_log || "").trim().split(/\r?\n/).length;
      const lenB = (b.trek_log || "").trim().split(/\r?\n/).length;
      return lenB - lenA;
    });

    const dataMap = {};
    const nextMap = {};
    const prevMap = {};
    const allRes = new Set();
    const keyLabels = [];

    sorted.forEach((item, idx) => {
      keyLabels.push(item.rumus_key || "K" + (idx + 1));
      const lines = (item.trek_log || "").trim().split(/\r?\n/);
      let prevRes = null;

      lines.forEach((line) => {
        const cleanLine = line.replace(/\[\/?[hmbi]\]/gi, "");
        const m = cleanLine.match(/^(\d{4,})\s*:\s*(.*?)$/);
        if (m) {
          const res = m[1];
          const content = m[2].trim();
          allRes.add(res);
          if (!dataMap[res]) dataMap[res] = { ai: [], status: "" };

          const parts = content.split(/\s+/);
          while (parts.length > 0 && (parts[parts.length - 1] === "(X)" || parts[parts.length - 1] === "?" || parts[parts.length - 1] === "𐄂")) {
            parts.pop();
          }
          if (parts.length > 0) {
            const knownLabels = ["ai", "k", "e", "a", "c", "cb", "s", "st", "sd", "j", "k/e", "ke", "kep", "ekr", "as", "kop", "jml", "shio", "ad", "at", "a3", "js", "jt", "jd", "j3", "j4"];
            if (knownLabels.includes(parts[parts.length - 1].toLowerCase())) parts.pop();
          }
          dataMap[res].ai[idx] = parts.join(" ") || "-";
          if (content.includes("(X)") || content.includes("𐄂")) dataMap[res].status = " X";
          else if (content.includes("?")) dataMap[res].status = " ?";

          if (prevRes && prevRes !== res) {
            if (!nextMap[prevRes]) nextMap[prevRes] = res;
            if (!prevMap[res]) prevMap[res] = prevRes;
          }
          prevRes = res;
        }
      });
    });

    let resOrder = [];
    let head = null;
    for (const res of allRes) {
      if (!prevMap[res]) { head = res; break; }
    }
    let current = head;
    const visited = new Set();
    while (current && !visited.has(current)) {
      resOrder.push(current);
      visited.add(current);
      current = nextMap[current];
    }
    if (resOrder.length < allRes.size) {
      for (const res of allRes) {
        if (!visited.has(res)) resOrder.push(res);
      }
    }

    let shortType = " ai";
    if (subList[0] && subList[0].type) {
      const t = subList[0].type.toUpperCase();
      shortType =
        t === "KEP" || t === "K" ? " k"
        : t === "EKR" || t === "E" ? " e"
        : t === "AS" || t === "A" ? " a"
        : t === "COP" || t === "C" ? " c"
        : t === "JML" || t === "J" ? " j"
        : t === "SHIO" || t === "S" ? " s"
        : t === "CB" ? " cb"
        : t === "K/E" || t === "KE" ? " k/e"
        : " ai";
    }

    let output =
      "Keys   :\n\n" +
      sorted
        .map((it, idx) => {
          const badge =
            it.source === "original" ? "☁️" : it.source === "manual" ? "✍️" : it.source === "local" ? "⚡" : "";
          const codeLine = it.code ? `\n    ${it.code}` : "";
          return `(${idx + 1}) ${it.rumus_key || "-"} | ${(it.type || "?").padEnd(14)} | ai ${it.ai || "-"} ${badge}${codeLine}`;
        })
        .join("\n") +
      "\n\n";

    resOrder.forEach((res) => {
      const entry = dataMap[res];
      const aiParts = sorted.map((_, j) => entry.ai[j] || "-");
      const status = entry.status || "";

      if (aiParts.every((x) => x === "-")) {
        output += `${res} :\n`;
        return;
      }
      const filteredParts = aiParts.filter((x) => x !== "-");
      output += `${res} : ${filteredParts.join(" vs ")}${shortType}${status}\n`;
    });

    const finalAi = sorted.map((it) => it.ai || "-").join(" vs ");
    const finalTypeLabel = subList[0] && subList[0].type ? subList[0].type : "AI";
    output += `\n${finalTypeLabel} : ${finalAi}`;
    finalLogs.push(output);
  }

  return finalLogs.join("\n\n" + "=".repeat(35) + "\n\n");
}

// ── Rekap 4D (AID depan × AI belakang, dengan filter AI3D / AIT) ────
// Semantik:
//   AID (AI 2D depan)   → poin-mati posisi 1-2
//   AI  (AI 2D belakang)→ poin-mati posisi 3-4
//   AI3D                → FILTER keras posisi 2-4 (C,K,E): sebuah 4D hanya
//                         dihitung jika 3 digit belakangnya == AI3D rumus.
//                         (Result 1745 & AI3D "745" → sah; "746" → tidak masuk
//                         TOP/CAD/MATI sama sekali.)
//   AIT (ai 2d tengah)  → FILTER keras posisi 2-3 (C,K): sama seperti AI3D
//                         tapi mengunci 2 digit tengah. (Result 1745 & AIT
//                         "74" → sah; "75" → dibuang.)
// Poin 4D sah = poinFront(ab) + poinBack(cd); tier 0=[TOP].
// Syarat UI: minimal 1 AID DAN 1 AI tercentang (AI3D/AIT opsional).
const FRONT_TYPES = new Set(["AID", "AD", "AI 2D DEPAN"]);
const BACK_TYPES = new Set(["AI", "AI 2D BELAKANG"]);
const AI3D_TYPES = new Set(["AI3D", "AI 3D", "A3"]);
const AIT_TYPES = new Set(["AIT", "AT", "AI 2D TENGAH"]);

function aiDigits(f) {
  return String(f.ai || "").replace(/\D/g, "");
}

// Kumpulkan kunci filter N-digit. Slice digit AI sesuai orientasi:
//   tail (AI3D) → N digit terakhir · head (AIT) → N digit pertama.
// Panjang AI tidak pas → dicatat sebagai diabaikan.
function filterKeys(formulas, len, label, orient) {
  const keys = new Set();
  const ignored = [];
  for (const f of formulas) {
    const d = aiDigits(f);
    if (d.length === len) keys.add(d);
    else if (d.length > len) keys.add(orient === "head" ? d.slice(0, len) : d.slice(-len));
    else ignored.push(`${f.type || label}:${f.ai || "-"}`);
  }
  return { keys: [...keys].sort(), ignored };
}

// Kunci AI3D (3 digit belakang = posisi 2-4).
export function ai3dKeys(formulas) {
  return filterKeys(formulas, 3, "AI3D", "tail");
}

// Kunci AIT (2 digit tengah = posisi 2-3).
export function aitKeys(formulas) {
  return filterKeys(formulas, 2, "AIT", "head");
}

export function buildRekap4D(items) {
  const norm = (t) => String(t || "").toUpperCase();
  const front = items.filter((x) => FRONT_TYPES.has(norm(x.type)));
  const back = items.filter((x) => BACK_TYPES.has(norm(x.type)));
  const ai3d = items.filter((x) => AI3D_TYPES.has(norm(x.type)));
  const ait = items.filter((x) => AIT_TYPES.has(norm(x.type)));
  const { keys: ai3dFilter, ignored: ai3dIgnored } = ai3dKeys(ai3d);
  const { keys: aitFilter, ignored: aitIgnored } = aitKeys(ait);
  const useFilter = ai3dFilter.length > 0 || aitFilter.length > 0;
  const hasAi3d = ai3dFilter.length > 0;
  const hasAit = aitFilter.length > 0;

  const ptsFront = scorePool(front);
  const ptsBack = scorePool(back);
  const tiersFront = groupTiers(ptsFront);
  const tiersBack = groupTiers(ptsBack);
  const kresFront = kresOf(front);
  const kresBack = kresOf(back);
  const kres3d = kresOf(ai3d);
  const kresTt = kresOf(ait);

  // konvolusi 4D: poinTotal = poinFront + poinBack.
  // Saat filter aktif: hanya kombinasi ab+cd yang lolos SEMUA kunci yang dihitung.
  const maxP = front.length + back.length;
  const tiers4D = [];   // tiers4D[poin] = ["abcd", ...] (hanya yang sah)
  const counts4D = [];  // counts4D[poin] = jumlah
  let kept = 0;         // total 4D lolos filter
  let dropped = 0;      // total 4D terbuang oleh filter
  for (let p = 0; p <= maxP; p++) {
    const list = [];
    for (let f = 0; f <= p; f++) {
      const b = p - f;
      const fs = tiersFront[f] || [];
      const bs = tiersBack[b] || [];
      for (const d2 of fs) {
        for (const d2b of bs) {
          const code = d2 + d2b;
          if (useFilter) {
            if (hasAi3d && !ai3dFilter.includes(code.slice(1, 4))) { dropped++; continue; }
            if (hasAit && !aitFilter.includes(code.slice(1, 3))) { dropped++; continue; }
          }
          list.push(code);
        }
      }
    }
    kept += list.length;
    counts4D[p] = list.length;
    if (list.length) tiers4D[p] = list;
  }

  return {
    front, back, ai3d, ait,
    ai3dFilter, ai3dIgnored, aitFilter, aitIgnored, useFilter, kept, dropped,
    ptsFront, ptsBack, tiersFront, tiersBack,
    kresFront, kresBack, kres3d, kresTt,
    tiers4D, counts4D,
  };
}

// Tier yang ditampilkan list penuh-nya (sisanya count saja):
// "top" = TOP saja | "cad12" = TOP+CAD1+CAD2 | "all" = semua tier.
function maxShowTiers(showTiers) {
  return showTiers === "all" ? 999 : showTiers === "cad12" ? 3 : 1;
}

// Bar ASCII sederhana (10 blok).
function bar(pct, width = 10) {
  const fill = Math.round((pct / 100) * width);
  return "█".repeat(Math.max(0, fill)) + "░".repeat(Math.max(0, width - fill));
}

// Statistik pool 4D atas angka yang SAH (lolos filter AI3D bila aktif):
// distribusi tier, akumulasi coverage, digit hidup per posisi di tier TOP.
export function buildStats4D(impl) {
  const TOTAL = impl.useFilter ? impl.kept : 10000;
  const tiers = [];
  const maxP = impl.front.length + impl.back.length;
  let cum = 0;
  for (let p = 0; p <= maxP; p++) {
    const n = impl.counts4D[p] || 0;
    if (!n) continue;
    cum += n;
    const label = p === 0 ? "TOP" : p === 1 ? "CAD 1" : p === 2 ? "CAD 2" : `MATI ${p}`;
    tiers.push({
      label,
      n,
      pct: TOTAL ? +((n / TOTAL) * 100).toFixed(1) : 0,
      cumN: cum,
      cumPct: TOTAL ? +((cum / TOTAL) * 100).toFixed(1) : 0,
    });
  }
  const topList = impl.tiers4D[0] || [];
  const posSets = [new Set(), new Set(), new Set(), new Set()];
  for (const code of topList) {
    if (code.length !== 4) continue;
    for (let i = 0; i < 4; i++) posSets[i].add(code[i]);
  }
  const positions = posSets.map((s, i) => ({
    pos: i + 1,
    digits: [...s].sort().join(""),
    count: s.size,
  }));
  return { TOTAL, tiers, positions };
}

export function renderRekap4D(impl, showTiers = "top") {
  const L = [];
  const filt = []
    .concat(impl.ai3d.length ? [`${impl.ai3d.length} AI3D`] : [])
    .concat(impl.ait.length ? [`${impl.ait.length} AIT`] : []);
  const header = impl.useFilter
    ? `Rekap 4D — ${impl.front.length} AID + ${impl.back.length} AI + ${filt.join(" + ")} (filter)`
    : `Rekap 4D — ${impl.front.length} AID + ${impl.back.length} AI`;
  L.push(header, "");

  L.push("── 2D DEPAN (AID) ──");
  impl.front.forEach((f) => L.push(`${f.type} : ${f.ai}`));
  L.push("");
  L.push("── 2D BELAKANG (AI) ──");
  impl.back.forEach((f) => L.push(`${f.type} : ${f.ai}`));
  L.push("");

  if (impl.ai3d.length) {
    L.push("── AI3D (filter posisi 2-4 / C K E) ──");
    impl.ai3d.forEach((f) => L.push(`${f.type} : ${f.ai}`));
    L.push(`KUNCI: ${impl.ai3dFilter.join("*") || "-"}`);
    if (impl.ai3dIgnored.length) {
      L.push(`diabaikan (bukan 3 digit): ${impl.ai3dIgnored.join(", ")}`);
    }
  }
  if (impl.ait.length) {
    L.push("── AIT (filter posisi 2-3 / C K) ──");
    impl.ait.forEach((f) => L.push(`${f.type} : ${f.ai}`));
    L.push(`KUNCI: ${impl.aitFilter.join("*") || "-"}`);
    if (impl.aitIgnored.length) {
      L.push(`diabaikan (bukan 2 digit): ${impl.aitIgnored.join(", ")}`);
    }
  }
  if (impl.useFilter) {
    L.push(
      `Filter membuang ${impl.dropped} kombinasi; ${impl.kept} 4D ikut dihitung.`
    );
    L.push("");
  }

  // KRES per grup
  const kresBlock = (name, kres) => {
    if (kres.kresLevels.length === 0) return;
    L.push(`--------------- ${name}`);
    kres.kresLevels.forEach((lv) => {
      const dg = kres.kresByLevel[lv].slice().sort().join("");
      L.push(`KRES ${lv}   : ${dg}`);
    });
  };
  kresBlock("DEPAN", impl.kresFront);
  kresBlock("BELAKANG", impl.kresBack);
  if (impl.ai3d.length) kresBlock("AI3D", impl.kres3d);
  if (impl.ait.length) kresBlock("AIT", impl.kresTt);
  if (impl.kresFront.kresLevels.length || impl.kresBack.kresLevels.length || impl.kres3d.kresLevels.length || impl.kresTt.kresLevels.length) L.push("");

  // blok tier 2D depan & belakang (ringkas)
  const tierBlock = (name, tiers, n) => {
    L.push(`── [${name}] TIER 2D ──`);
    for (let p = 0; p <= n; p++) {
      if (tiers[p] && tiers[p].length) {
        const t = p === 0 ? "TOP" : p === 1 ? "CAD 1" : p === 2 ? "CAD 2" : `MATI ${p}`;
        L.push(`[${t}] ${tiers[p].length} Line`);
        L.push(tiers[p].join("*"));
        L.push("");
      }
    }
  };
  tierBlock("DEPAN", impl.tiersFront, impl.front.length);
  tierBlock("BELAKANG", impl.tiersBack, impl.back.length);

  // blok 4D gabungan (hanya angka sah)
  L.push(impl.useFilter ? "── 4D GABUNGAN (lolos filter) ──" : "── 4D GABUNGAN ──");
  const maxP = impl.front.length + impl.back.length;
  const showMax = maxShowTiers(showTiers);
  for (let p = 0; p <= maxP; p++) {
    const n = impl.counts4D[p] || 0;
    if (!n) continue;
    const t = p === 0 ? "TOP" : p === 1 ? "CAD 1" : p === 2 ? "CAD 2" : `MATI ${p}`;
    L.push(`[${t}] ${n} Line`);
    if (p < showMax) L.push(impl.tiers4D[p].join("*"));
    else L.push("(daftar disembunyikan — pilih [TOP+CAD] atau [SEMUA] di opsi tampilan)");
    L.push("");
  }

  // blok statistik pool 4D
  const stats = buildStats4D(impl);
  L.push("── STATISTIK POOL 4D ──");
  L.push(
    impl.useFilter
      ? `Total sah (lolos filter) : ${stats.TOTAL} (dari 10.000; terbuang ${impl.dropped})`
      : `Total kombinasi : ${stats.TOTAL}`
  );
  stats.tiers.forEach((t) => {
    L.push(
      `[${t.label}]`.padEnd(9) +
      `${String(t.n).padStart(5)} (${t.pct}%)` +
      ` kumulatif ${t.cumN} (${t.cumPct}%) ${bar(t.cumPct)}`
    );
  });
  L.push("");
  L.push("Digit hidup per posisi (dari tier TOP 4D):");
  stats.positions.forEach((p) => {
    L.push(`  Posisi ${p.pos} : ${p.digits || "-"} (${p.count} digit)`);
  });
  return L.join("\n");
}
