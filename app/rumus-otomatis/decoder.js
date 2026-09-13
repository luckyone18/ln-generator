const PHP_KEYS = ["A", "C", "K", "E", "J", "JT", "JD", "JS", "J3D", "J4D", "J5D"];

export function decodeAcc(val) {
  if (!val) return { k: -1, m: 1, s: "off" };
  const upper = val.toUpperCase();
  const sortedKeys = [...PHP_KEYS].sort((a, b) => b.length - a.length);
  const prx = sortedKeys.find((p) => upper.startsWith(p));
  if (!prx) return { k: -1, m: 1, s: "off" };
  const kIdx = PHP_KEYS.indexOf(prx);
  const remainder = val.substring(prx.length);
  const match = remainder.match(/^(\d+)(.*)$/i);
  if (!match) return { k: -1, m: 1, s: "off" };
  return {
    k: kIdx,
    m: parseInt(match[1], 10) || 1,
    s: match[2] ? match[2].toLowerCase() : "off",
  };
}

export function encodeFormulaCode(state, activeCols) {
  const fCol = state.fCol && state.fCol !== "off" ? state.fCol.toLowerCase() : "ai";
  const market = (state.market || "sgp").toUpperCase();

  const build = (k, m, s) => {
    if (k === undefined || k === -1 || k === "-1" || k === "") return "";
    const c = PHP_KEYS[k];
    if (!c) return "";
    const ms = s && s !== "off" ? s.toLowerCase() : "";
    return `${c}${m || 1}${ms}`;
  };

  const p1 = build(state.k1, state.m1, state.s1);
  const p2 = build(state.k2, state.m2, state.s2);
  const p3 = build(state.k3, state.m3, state.s3);

  let formula = p1;
  if (p2) formula += (state.op1 || "+") + p2;
  if (p3) formula += (state.op2 || "+") + p3;
  formula = formula.replace(/^[-+]/, "");
  if (state.sf && state.sf !== "off") formula += "." + state.sf.toLowerCase();

  let daysStr = "";
  if (state.days && Array.isArray(state.days) && state.days.length > 0) {
    const dm = {
      Minggu: "0",
      Senin: "1",
      Selasa: "2",
      Rabu: "3",
      Kamis: "4",
      Jumat: "5",
      Sabtu: "6",
    };
    const nums = state.days.map((d) => dm[d] || "").filter(Boolean).sort();
    if (nums.length > 0) daysStr = `-H${nums.join("")}`;
  }

  const settings = `L${state.limit || 15}-P${state.patah || 0}-D0${daysStr}`;
  const cols = activeCols && activeCols.length > 0 ? activeCols : [];
  const hiddenStr = cols.map((n) => String.fromCharCode(65 + n)).join("");

  return `${market}_${fCol}_${formula}_${settings}_${hiddenStr}`;
}

export function decodeFormulaCode(rawCode) {
  if (!rawCode) return null;
  const clean = rawCode.startsWith("#") ? rawCode.substring(1) : rawCode;
  const parts = clean.split("_");
  if (parts.length < 4) return null;

  let fCol = parts[1].toLowerCase();
  if (fCol === "am" || fCol === "am1" || fCol === "am2") fCol = "ai";

  const config = {
    market: parts[0].toLowerCase(),
    fCol: fCol,
    hideEmpty: true,
  };

  const isShio = ["s", "st", "sd"].includes(fCol);
  const maxCols = isShio ? 12 : 10;
  const manualHidden = [];

  if (parts[4]) {
    const activeSet = new Set(
      parts[4].split("").map((c) => c.toUpperCase().charCodeAt(0) - 65)
    );
    for (let i = 0; i < maxCols; i++) {
      if (!activeSet.has(i)) manualHidden.push(i);
    }
  }
  config.manualHidden = manualHidden;

  let formulaStr = parts[2];
  const settingsStr = parts[3];
  const smatch = settingsStr.match(/L(\d+)-P(\d+)-D(\d+)(?:-H(\d+))?/i);
  if (smatch) {
    config.limit = parseInt(smatch[1], 10);
    config.patah = parseInt(smatch[2], 10);
    if (smatch[4]) {
      const revDM = {
        "0": "Minggu",
        "1": "Senin",
        "2": "Selasa",
        "3": "Rabu",
        "4": "Kamis",
        "5": "Jumat",
        "6": "Sabtu",
      };
      config.days = smatch[4]
        .split("")
        .map((n) => revDM[n])
        .filter(Boolean);
    }
  }

  if (formulaStr.includes(".")) {
    const fP = formulaStr.split(".");
    formulaStr = fP[0];
    config.sf = fP[1].toLowerCase();
  }

  const fsplit = formulaStr.split(/([-+])/);
  const parsePart = (str) => {
    if (!str) return { k: -1, m: 1, s: "off" };
    return decodeAcc(str);
  };

  const r1 = parsePart(fsplit[0]);
  config.k1 = r1.k;
  config.m1 = r1.m;
  config.s1 = r1.s;
  if (fsplit[1]) {
    config.op1 = fsplit[1];
    const r2 = parsePart(fsplit[2]);
    config.k2 = r2.k;
    config.m2 = r2.m;
    config.s2 = r2.s;
  }
  if (fsplit[3]) {
    config.op2 = fsplit[3];
    const r3 = parsePart(fsplit[4]);
    config.k3 = r3.k;
    config.m3 = r3.m;
    config.s3 = r3.s;
  }

  return config;
}

export function getHitColor(d, fCol) {
  if (!d || !d.h) return null;
  const cMap = {
    a: "#0d6efd",
    c: "#fbbf24",
    k: "#ef4444",
    e: "#10b981",
    j: "#0dcaf0",
    jt: "#8b5cf6",
    jd: "#ec4899",
    sh: "#f97316",
  };
  if (fCol === "a" && d.h.A) return cMap.a;
  if (fCol === "c" && d.h.C) return cMap.c;
  if (fCol === "k" && d.h.K) return cMap.k;
  if (fCol === "e" && d.h.E) return cMap.e;
  if (fCol === "j" && d.h.J) return cMap.j;
  if (fCol === "jt" && d.h.Jt) return cMap.jt;
  if (fCol === "jd" && d.h.Jd) return cMap.jd;
  if (fCol === "s" && d.h.SH) return cMap.sh;
  if (fCol === "st" && d.h.SHt) return cMap.sh;
  if (fCol === "sd" && d.h.SHd) return cMap.sh;
  if (fCol === "ai" || fCol === "ke") {
    if (d.h.K) return cMap.k;
    if (d.h.E) return cMap.e;
  }
  if (fCol === "aid") {
    if (d.h.A) return cMap.a;
    if (d.h.C) return cMap.c;
  }
  if (fCol === "ait") {
    if (d.h.C) return cMap.c;
    if (d.h.K) return cMap.k;
  }
  if (fCol === "ai3d" || fCol === "cb") {
    if (d.h.A) return cMap.a;
    if (d.h.C) return cMap.c;
    if (d.h.K) return cMap.k;
    if (d.h.E) return cMap.e;
  }
  return null;
}
