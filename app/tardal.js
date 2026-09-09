/* ------------------------------------------------------------------ */
/* Generator Tardal — pure combinatorics (identical to the reference    */
/* site's behavior, verified against captured golden outputs).          */
/*                                                                      */
/* Rules:                                                               */
/*  - digits: keep digits only, DEDUPE preserving first-appearance      */
/*    order ("0120" behaves as "012")                                   */
/*  - type k in {2,3,4}: output strings of length k                     */
/*  - twin=1: with repetition (n^k combos)                              */
/*  - twin=2: without repetition (n!/(n-k)!; empty when n < k)          */
/*  - output ordering: nested loops following the input digit order     */
/* ------------------------------------------------------------------ */

export const TARDAL_TYPES = [2, 3, 4];
export const TARDAL_SPLITTERS = ["*", "#", ","];

export function generateTardal({ digits, type, twin, splitter }) {
  const k = Number(type);
  const twinMode = Number(twin);
  const sep = TARDAL_SPLITTERS.includes(splitter) ? splitter : "*";

  if (!digits || !TARDAL_TYPES.includes(k) || ![1, 2].includes(twinMode)) {
    return { error: "Masukkan angka tardal yang valid" };
  }

  // Dedupe digits, preserving first-appearance order.
  const uniq = [];
  for (const ch of String(digits)) {
    if (/[0-9]/.test(ch) && !uniq.includes(ch)) uniq.push(ch);
  }
  if (uniq.length === 0) {
    return { error: "Masukkan angka tardal yang valid" };
  }

  const combos = [];

  if (twinMode === 1) {
    // Cartesian product with repetition (n^k).
    const rec = (prefix) => {
      if (prefix.length === k) {
        combos.push(prefix);
        return;
      }
      for (const d of uniq) rec(prefix + d);
    };
    rec("");
  } else {
    // Permutations without repetition (n!/(n-k)!).
    if (uniq.length < k) {
      return { result: "", count: 0 };
    }
    const rec = (prefix, avail) => {
      if (prefix.length === k) {
        combos.push(prefix);
        return;
      }
      for (let i = 0; i < avail.length; i++) {
        rec(prefix + avail[i], avail.slice(0, i) + avail.slice(i + 1));
      }
    };
    rec("", uniq.join(""));
  }

  return { result: combos.join(sep), count: combos.length };
}
