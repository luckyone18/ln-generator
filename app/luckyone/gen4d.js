"use client";

import { useMemo, useState } from "react";
import styles from "./lucky.module.css";

// parse deretan 2D: pemisah bebas (* spasi koma ; | newline) atau digit panjang -> potong per 2
function parse2D(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: [], bad: [] };
  const hasDelim = /[*\s,;|]/.test(s);
  const tokens = hasDelim ? s.split(/[*\s,;|]+/).filter(Boolean) : (s.match(/\d{1,2}|\d/g) || []);
  const ok = [];
  const bad = [];
  if (!hasDelim && /^\d+$/.test(s)) {
    // tanpa pemisah sama sekali: potong tepat per 2 digit
    for (let i = 0; i + 2 <= s.length; i += 2) ok.push(s.slice(i, i + 2));
    if (s.length % 2) bad.push(s.slice(-1));
    return { ok, bad };
  }
  tokens.forEach((t) => (/^\d{2}$/.test(t) ? ok.push(t) : bad.push(t)));
  return { ok, bad };
}

// gabung => 4D depan-belakang tanpa mengubah susunan 2D
function build4D(boxes) {
  const filled = boxes.map((b) => b.filter(Boolean)).filter((b) => b.length);
  const seen = new Set();
  const out = [];
  const push = (v) => {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  };
  if (filled.length === 1) {
    // 1 kotak saja: pasangan terurut elemen berbeda dalam kotak (a!=b posisi)
    const arr = filled[0];
    for (let i = 0; i < arr.length; i++)
      for (let j = 0; j < arr.length; j++) if (i !== j) push(arr[i] + arr[j]);
    return out;
  }
  // >=2 kotak: tiap KOTAK dipasangkan dua arah dengan kotak lainnya,
  // urutan grup: pasangan terdekat dulu — (0,1),(1,0),(1,2),(2,1),(0,2),(2,0)
  const groups = [];
  for (let d = 1; d < filled.length; d++)
    for (let a = 0; a + d < filled.length; a++) groups.push([a, a + d]);
  // dua pass: jarak ascending, tiap grup arah maju lalu mundur
  for (const [a, b] of groups) {
    for (const x of filled[a]) for (const y of filled[b]) push(x + y);
    for (const x of filled[b]) for (const y of filled[a]) push(x + y);
  }
  return out;
}

export default function Gen4D() {
  const [raws, setRaws] = useState(["", "", ""]);
  const [sep, setSep] = useState("*");
  const [twin, setTwin] = useState("all"); // all=sertakan, no=tanpa, only=hanya twin
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => raws.map(parse2D), [raws]);
  const results = useMemo(() => {
    const raw = build4D(parsed.map((p) => p.ok));
    // twin = ada digit kembar di dalam 4D (mis. 1211, 1122, 1212)
    const isTwin = (v) => new Set(v.split("")).size < v.length;
    if (twin === "no") return raw.filter((v) => !isTwin(v));
    if (twin === "only") return raw.filter(isTwin);
    return raw;
  }, [parsed, twin]);
  const totalBad = parsed.reduce((n, p) => n + p.bad.length, 0);

  const setBox = (i, v) => setRaws((prev) => prev.map((x, j) => (j === i ? v : x)));

  const doCopy = async () => {
    const text = results.join(sep);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>🎱 G4D</h1>
        <p className={styles.sub}>
          Deretan 2D tiap kotak → gabungan 4D depan-belakang, susunan 2D tidak berubah
        </p>

        <div className={styles.boxes}>
          {raws.map((r, i) => (
            <label key={i} className={styles.boxWrap}>
              <span className={styles.boxLabel}>
                Kotak {i + 1}
                {parsed[i].ok.length > 0 && (
                  <em className={styles.boxCount}>{parsed[i].ok.length}×2D</em>
                )}
                {parsed[i].bad.length > 0 && (
                  <em className={styles.boxBad}>{parsed[i].bad.length} invalid</em>
                )}
              </span>
              <textarea
                className={styles.boxInput}
                value={r}
                onChange={(e) => setBox(i, e.target.value)}
                placeholder="mis. 12 34 56 atau 123456"
                rows={3}
                spellCheck={false}
              />
            </label>
          ))}
        </div>

        <div className={styles.row}>
          <label className={styles.sepWrap}>
            Pemisah:{" "}
            <select value={sep} onChange={(e) => setSep(e.target.value)} className={styles.sepSel}>
              <option value="*">＊ (bintang)</option>
              <option value=" ">spasi</option>
              <option value=",">koma</option>
              <option value="|">garis tegak |</option>
              <option value={"\n"}>baris baru</option>
            </select>
          </label>
          <label className={styles.sepWrap}>
            Twin:{" "}
            <select value={twin} onChange={(e) => setTwin(e.target.value)} className={styles.sepSel}>
              <option value="all">sertakan (semua)</option>
              <option value="no">no twin (4 digit beda semua)</option>
              <option value="only">hanya twin (ada digit kembar)</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.btnClear}
            onClick={() => setRaws(["", "", ""])}
            disabled={!raws.some(Boolean)}
          >
            ✖ kosongkan
          </button>
        </div>

        <section className={styles.outHead}>
          <span>
            Hasil: <b>{results.length}</b> angka 4D{totalBad ? ` · ${totalBad} token diabaikan` : ""}
          </span>
          <button type="button" className={styles.btnCopy} onClick={doCopy} disabled={!results.length}>
            {copied ? "✓ tersalin" : "📋 COPY SEMUA"}
          </button>
        </section>

        <div className={styles.resultBox}>
          {results.length ? (
            sep === "\n" ? (
              results.map((r) => <div key={r}>{r}</div>)
            ) : (
              results.join(sep)
            )
          ) : (
            <span className={styles.idle}>Isi minimal 1 kotak…</span>
          )}
        </div>
      </div>
    </main>
  );
}
