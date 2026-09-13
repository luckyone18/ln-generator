// ── Scanner Rumus Engine (lokal, pakai filter_api via proxy /api/rumus-otomatis) ──
// Meniru semantik Scanner Angkanet Pro: generate formula acak -> evaluasi window
// paito -> saring berdasar patah (zonk) & jumlah digit -> kumpulkan kandidat valid.

export const KEY_NAMES = ["A", "C", "K", "E", "J", "Jt", "Jd", "Js", "J3D", "J4D", "J5D"];
export const MODS = ["", "ml", "ix", "mb", "ty", "m0", "m1", "m3", "m5", "m7", "m8", "m9"];

// kolom yang dibutuhkan tiap fCol untuk evaluasi hit (idx digit 0-9; 10=J3D,11=J4D dst tak dipakai di seq 4D)
export const REQ_COLS = {
  ai: [2, 3],       // K, E
  ke: [2, 3],       // K, E
  ait: [1, 2],      // C, K
  aid: [0, 1],      // A, C
  cb: [0, 1, 2, 3], // A, C, K, E
  ai3d: [0, 1, 2, 3],
  a: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  c: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  k: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  e: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  j: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  jt: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  jd: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  s: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  st: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  sd: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
};

export function buildState(market, opts) {
  const { fCol, limit, patah, days, formula } = opts;
  const req = REQ_COLS[fCol] || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const hidden = [];
  for (let i = 0; i < 10; i++) if (!req.includes(i)) hidden.push(i);

  return {
    market,
    limit,
    days: days ? [days] : [],
    patah: 0, // evaluasi sendiri dari baris x
    fCol,
    k1: formula.k1, m1: formula.m1, s1: formula.s1,
    op1: formula.op1,
    k2: formula.k2, m2: formula.m2, s2: formula.s2,
    op2: formula.op2,
    k3: formula.k3, m3: formula.m3, s3: formula.s3,
    sf: formula.sf || "off",
    hideEmpty: true,
    targetD: 0,
    showRef: 0,
    manualHidden: hidden,
    isFrozen: true,
  };
}

export function randomFormula(rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const oneKey = () => ({
    k: Math.floor(rand() * 11),
    m: 1 + Math.floor(rand() * 10),
    s: pick(MODS),
  });
  const f = { ...oneKey() };
  const nKeys = 1 + Math.floor(rand() * 3); // 1..3
  if (nKeys >= 2) {
    const k2 = oneKey();
    f.k2 = k2.k; f.m2 = k2.m; f.s2 = k2.s; f.op1 = pick(["+", "-"]);
  } else {
    f.k2 = -1; f.m2 = 1; f.s2 = "off"; f.op1 = "+";
  }
  if (nKeys === 3) {
    const k3 = oneKey();
    f.k3 = k3.k; f.m3 = k3.m; f.s3 = k3.s; f.op2 = pick(["+", "-"]);
  } else {
    f.k3 = -1; f.m3 = 1; f.s3 = "off"; f.op2 = "+";
  }
  f.sf = rand() < 0.25 ? pick(MODS.filter((m) => m !== "")) : "off";
  return f;
}

export function formulaKey(f) {
  const part = (k, m, s) =>
    k >= 0 ? `${KEY_NAMES[k] || "?"}${m > 1 ? m : ""}${s && s !== "off" ? s : ""}` : "";
  let r = part(f.k1, f.m1, f.s1);
  if (f.k2 >= 0) r += (f.op1 || "+") + part(f.k2, f.m2, f.s2);
  if (f.k3 >= 0) r += (f.op2 || "+") + part(f.k3, f.m3, f.s3);
  if (f.sf && f.sf !== "off") r += "." + f.sf;
  return r;
}

export function buildCode({ market, fCol, formula, limit, patah, days, activeCols }) {
  const fKey = formulaKey(formula);
  let daysStr = "";
  if (days) {
    const dm = { Minggu: "0", Senin: "1", Selasa: "2", Rabu: "3", Kamis: "4", Jumat: "5", Sabtu: "6" };
    daysStr = "-H" + (dm[days] || "");
  }
  const colLetters = [...activeCols].sort((a, b) => a - b).map((i) => String.fromCharCode(65 + i)).join("");
  return (
    "#" +
    market.toUpperCase() +
    "_" +
    fCol +
    "_" +
    fKey +
    "_L" +
    limit +
    "-P" +
    patah +
    "-D" +
    activeCols.length +
    daysStr +
    "_" +
    colLetters
  );
}

// Hit check per kolom seq sesuai semantik getHitColor halaman rumus-otomatis.
function colHit(d, fCol) {
  if (!d || !d.h) return false;
  const h = d.h;
  switch (fCol) {
    case "a": return !!h.A;
    case "c": return !!h.C;
    case "k": return !!h.K;
    case "e": return !!h.E;
    case "j": return !!h.J;
    case "jt": return !!h.Jt;
    case "jd": return !!h.Jd;
    case "s": return !!h.SH;
    case "st": return !!h.SHt;
    case "sd": return !!h.SHd;
    case "ke":
      return true; // handled separately (butuh K dan E kena)
    case "ai":
    case "ai3d":
    case "cb":
      return !!(h.K || h.E || h.A || h.C);
    case "aid":
      return !!(h.A || h.C);
    case "ait":
      return !!(h.C || h.K);
    default:
      return false;
  }
}

// Evaluasi window rows dari response filter_api.
// rows urut tua -> baru. Baris i (kecuali terakhir) dinilai dari flag h server;
// sukses = kolom-kolom aktif kena sesuai fCol. Baris terakhir = kandidat prediksi.
export function evaluateRows(rows, activeCols, fCol, maxPatah) {
  const evalRows = rows.filter((r) => !r.is_ref);
  if (evalRows.length < 2) return null;

  let misses = 0;
  const marks = [];

  for (let i = 0; i < evalRows.length; i++) {
    if (i === evalRows.length - 1) {
      marks.push(null);
      continue;
    }
    const row = evalRows[i];
    let ok;
    if (fCol === "ke") {
      // butuh hit K dan E di antara kolom aktif
      let hitsK = false, hitsE = false;
      for (const idx of activeCols) {
        const d = row.seq && row.seq[idx];
        if (d && d.h) {
          if (d.h.K) hitsK = true;
          if (d.h.E) hitsE = true;
        }
      }
      ok = hitsK && hitsE;
    } else {
      ok = false;
      for (const idx of activeCols) {
        const d = row.seq && row.seq[idx];
        if (colHit(d, fCol)) {
          ok = true;
          break;
        }
      }
    }
    marks.push(ok);
    if (!ok) {
      misses++;
      if (misses > maxPatah) return null; // gagal awal, hemat loop
    }
  }

  // Prediksi baris terakhir
  const last = evalRows[evalRows.length - 1];
  const dg = activeCols.map((idx) => (last.seq && last.seq[idx] ? last.seq[idx].v : null)).filter((v) => v !== null);
  const ai = dg.join("");

  return { patah: misses, ai, marks, rowsEval: evalRows.length - 1, lastRes: last.res };
}

// Trek log sederhana untuk preview (mirip format Angkanet)
export function buildTrekLog(rows, activeCols, fCol, formula, marks, ai) {
  const LABEL_MAP = { ai: "ai", ait: "at", aid: "ad", cb: "cb", k: "k", e: "e", a: "as", c: "kop", j: "j", jt: "jt", jd: "jd", s: "s", st: "st", sd: "sd", ai3d: "a3", ke: "ke" };
  const label = LABEL_MAP[fCol] || fCol;
  const lines = ["Key    : " + formulaKey(formula), ""];
  const evalRows = rows.filter((r) => !r.is_ref);
  evalRows.forEach((row, i) => {
    const seqStr = activeCols.map((idx) => (row.seq && row.seq[idx] ? String(row.seq[idx].v) : "")).join("");
    let suffix;
    if (marks[i] === null) suffix = " ??";
    else if (marks[i]) suffix = " [m]" + label + "[/m]";
    else suffix = " x";
    lines.push(row.res + " : " + seqStr + suffix);
  });
  lines.push("", label.toUpperCase() + " : " + ai);
  return lines.join("\n");
}
