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
          while (parts.length > 0 && (parts[parts.length - 1] === "(X)" || parts[parts.length - 1] === "?")) {
            parts.pop();
          }
          if (parts.length > 0) {
            const knownLabels = ["ai", "k", "e", "a", "c", "cb", "s", "st", "sd", "j", "k/e", "ke", "kep", "ekr", "as", "kop", "jml", "shio", "ad", "at", "a3", "js", "jt", "jd", "j3", "j4"];
            if (knownLabels.includes(parts[parts.length - 1].toLowerCase())) parts.pop();
          }
          dataMap[res].ai[idx] = parts.join(" ") || "-";
          if (content.includes("(X)")) dataMap[res].status = " X";
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
          return `(${idx + 1}) ${it.rumus_key || "-"}`;
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

// ── Rekap 4D (gabungan AID depan + AI belakang) ──────────────────────
// Front = rumus AID (2D depan), Back = rumus AI (2D belakang).
// Poin 4D = poinFront(ab) + poinBack(cd); tier 0=[TOP4D].
// Syarat (divalidasi di UI): minimal 1 rumus AI DAN 1 rumus AID tercentang.
const FRONT_TYPES = new Set(["AID", "AD", "AI 2D DEPAN"]);
const BACK_TYPES = new Set(["AI", "AI 2D BELAKANG"]);

export function buildRekap4D(items) {
  const front = items.filter((x) => FRONT_TYPES.has(String(x.type || "").toUpperCase()));
  const back = items.filter((x) => BACK_TYPES.has(String(x.type || "").toUpperCase()));

  const ptsFront = scorePool(front);
  const ptsBack = scorePool(back);
  const tiersFront = groupTiers(ptsFront);
  const tiersBack = groupTiers(ptsBack);
  const kresFront = kresOf(front);
  const kresBack = kresOf(back);

  // konvolusi 4D: poinTotal = poinFront + poinBack
  const maxP = front.length + back.length;
  const tiers4D = []; // tiers4D[poin] = [ "abcd", ... ]
  const counts4D = []; // counts4D[poin] = jumlah kombinasi
  for (let p = 0; p <= maxP; p++) {
    let list = [];
    for (let f = 0; f <= p; f++) {
      const b = p - f;
      const fs = tiersFront[f] || [];
      const bs = tiersBack[b] || [];
      for (const d2 of fs) {
        for (const d2b of bs) list.push(d2 + d2b);
      }
    }
    counts4D[p] = list.length;
    if (list.length) tiers4D[p] = list;
  }

  return {
    front, back,
    ptsFront, ptsBack, tiersFront, tiersBack,
    kresFront, kresBack,
    tiers4D, counts4D,
  };
}

// Batas jumlah tier yang ditampilkan list penuh-nya (sisanya count saja).
const LIST_TIERS_MAX = 1;

export function renderRekap4D(impl) {
  const L = [];
  const label = (f, isFront) =>
    isFront ? `${f.type} : ${f.ai}` : `${f.type} : ${f.ai}`;

  L.push(`Rekap 4D — ${impl.front.length} AID + ${impl.back.length} AI`, "");

  L.push("── 2D DEPAN (AID) ──");
  impl.front.forEach((f) => L.push(label(f, true)));
  L.push("");
  L.push("── 2D BELAKANG (AI) ──");
  impl.back.forEach((f) => L.push(label(f, false)));
  L.push("");

  // KRES front & back
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
  if (impl.kresFront.kresLevels.length || impl.kresBack.kresLevels.length) L.push("");

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

  // blok 4D gabungan
  L.push("── 4D GABUNGAN ──");
  const maxP = impl.front.length + impl.back.length;
  for (let p = 0; p <= maxP; p++) {
    const n = impl.counts4D[p] || 0;
    if (!n) continue;
    const t = p === 0 ? "TOP" : p === 1 ? "CAD 1" : p === 2 ? "CAD 2" : `MATI ${p}`;
    L.push(`[${t}] ${n} Line`);
    if (p < LIST_TIERS_MAX) L.push(impl.tiers4D[p].join("*"));
    else L.push("(daftar disembunyikan — poin terlalu banyak)");
    L.push("");
  }
  return L.join("\n");
}