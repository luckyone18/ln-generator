/* ------------------------------------------------------------------ */
/* Generator LN — deterministic engine (own design, not Angkanet's)    */
/* Pure functions only: same input -> same output, zero side effects.  */
/* ------------------------------------------------------------------ */

// mulberry32: tiny, fast, deterministic PRNG (seed -> [0,1)).
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Parse the LAST non-empty line, keep digits only, take the last 4
// digits (pad-left with 0). Returns null when there are no digits.
export function parseInput(raw) {
  if (raw == null) return null;
  const lines = String(raw)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const last = lines.length ? lines[lines.length - 1] : "";
  const digits = last.replace(/\D/g, "");
  if (!digits) return null;
  const four = ("0000" + digits).slice(-4);
  return {
    a: four.charCodeAt(0) - 48,
    b: four.charCodeAt(1) - 48,
    c: four.charCodeAt(2) - 48,
    d: four.charCodeAt(3) - 48,
  };
}

// All 100 two-digit strings "00".."99".
export function allPairs() {
  const arr = [];
  for (let i = 0; i < 100; i++) arr.push(String(i).padStart(2, "0"));
  return arr;
}

// All LN items for a mode: 2D "00".."99", 3D "000".."999", 4D "0000".."9999".
export function allItems(mode = 2) {
  if (mode === 2) return allPairs();
  const total = 10 ** mode;
  const arr = [];
  for (let i = 0; i < total; i++) arr.push(String(i).padStart(mode, "0"));
  return arr;
}

// Deterministic Fisher–Yates shuffle driven by rng().
export function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// Build the partition from the 4-digit input.
// kressWanted: optional fixed number of Kress digits (3-7). null = acak (3-6).
// lnMode: 2 (default, "00".."99" = 100 LN), 3 (000..999 = 1.000 LN),
//         4 (0000..9999 = 10.000 LN). Any other value falls back to 2.
// Guarantees: top+p1+p2+p3+p4+px = 10^lnMode, no duplicates, full coverage.
export function generate(raw, kressWanted = null, lnMode = 2) {
  const parsed = parseInput(raw);
  if (!parsed) return { error: "Masukkan result yang valid" };

  const modeRaw = Number(lnMode);
  const mode = modeRaw === 3 || modeRaw === 4 ? modeRaw : 2;
  const TOTAL = 10 ** mode; // 100 / 1000 / 10000

  const { a, b, c, d } = parsed;

  // 1. Seed: (((a*33+b)*33+c)*33+d) ^ 0x9E3779B9
  const seed = (((a * 33 + b) * 33 + c) * 33 + d) ^ 0x9e3779b9;
  const rng = mulberry32(seed);

  // 2. Kress digits: mixed from the input digits and small arithmetic
  //    offsets. If a fixed count is requested, deterministically extend
  //    the candidate pool until it has enough distinct digits.
  const poolArr = Array.from(
    new Set([
      a,
      b,
      c,
      d,
      (a + b) % 10,
      (c + d) % 10,
      (a + 7) % 10,
      (b + 3) % 10,
      (c + 5) % 10,
      (d + 1) % 10,
    ])
  );

  let kressFixed = null;
  if (kressWanted != null && Number.isFinite(Number(kressWanted))) {
    kressFixed = Math.max(3, Math.min(7, Math.floor(Number(kressWanted))));
  }

  if (kressFixed != null) {
    let guard = 0;
    while (poolArr.length < kressFixed && guard < 20) {
      let cand = (poolArr[poolArr.length - 1] * 7 + 3) % 10;
      let g2 = 0;
      while (poolArr.includes(cand) && g2 < 10) {
        cand = (cand + 1) % 10;
        g2++;
      }
      if (poolArr.includes(cand)) break;
      poolArr.push(cand);
      guard++;
    }
  }

  const shuffledPool = shuffled(poolArr, rng);
  const kressCount =
    kressFixed != null ? kressFixed : 3 + Math.floor(rng() * 4); // acak: 3..6
  const kressDigits = shuffledPool
    .slice(0, Math.min(kressCount, shuffledPool.length))
    .sort((x, y) => x - y);
  const kress = kressDigits.map((x) => String(x)).join(" ");

  // 3. Split sizes N1..N6. mode 2 keeps the EXACT original draw sequence
  //    (2D output identical forever). mode 3/4 use proportional splits with
  //    safety clamps so every zone is >= its floor and px >= 1.
  function draw(min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }
  let N1, N2, N3, N4, N5, N6;
  if (mode === 2) {
    N1 = draw(30, 50); // TOP
    N2 = draw(20, 30); // patah 1
    const remaining2 = 100 - N1 - N2; // 20..50
    N3 = draw(5, Math.min(15, remaining2 - 5));
    const after3a = remaining2 - N3; // >= 5
    N4 = draw(1, Math.min(8, after3a - 4));
    const after4a = after3a - N4; // >= 4
    N5 = draw(1, Math.min(6, after4a - 1));
    N6 = after4a - N5; // >= 1
  } else {
    const r = (pct) => Math.round((pct / 100) * TOTAL);
    const lo4 = r(1); // floor patah 3 & 4 (10 / 100)
    const hi4 = r(6);
    N1 = draw(r(30), r(50)); // TOP: 300-500 / 3000-5000
    N2 = draw(r(20), r(30)); // patah 1: 200-300 / 2000-3000
    const rem = TOTAL - N1 - N2;
    N3 = draw(r(5), Math.min(r(15), rem - lo4 - hi4 - 1));
    const after3b = rem - N3;
    N4 = draw(lo4, Math.max(lo4, Math.min(r(8), after3b - lo4 - 1)));
    const after4b = after3b - N4;
    N5 = draw(lo4, Math.max(lo4, Math.min(hi4, after4b - 1)));
    N6 = after4b - N5; // >= 1
  }

  // 4. Working list: shuffle the pool (00-99 / 000-999 / 0000-9999), then
  //    give items containing a kress digit a deterministic boost (swapped
  //    toward the TOP zone) so the kress visibly correlates with the TOP set.
  const pool2 = shuffled(allItems(mode), rng);
  const kressSet = new Set(kressDigits);
  for (let i = 0; i < pool2.length; i++) {
    const x = pool2[i];
    if (
      kressSet.has(x.charCodeAt(0) - 48) ||
      kressSet.has(x.charCodeAt(1) - 48)
    ) {
      const target = Math.floor(rng() * N1);
      const tmp = pool2[i];
      pool2[i] = pool2[target];
      pool2[target] = tmp;
    }
  }

  // 5. Slice the partition in fixed order.
  const top = pool2.slice(0, N1);
  const p1 = pool2.slice(N1, N1 + N2);
  const p2 = pool2.slice(N1 + N2, N1 + N2 + N3);
  const p3 = pool2.slice(N1 + N2 + N3, N1 + N2 + N3 + N4);
  const p4 = pool2.slice(N1 + N2 + N3 + N4, N1 + N2 + N3 + N4 + N5);
  const px = pool2.slice(N1 + N2 + N3 + N4 + N5);

  return { kress, mode, top, p1, p2, p3, p4, px, inputDigits: parsed };
}
