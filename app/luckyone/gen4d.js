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
  const [find, setFind] = useState(""); // cari angka di hasil 4D
  const [buang, setBuang] = useState(""); // buang angka dari hasil, pemisah *
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

  // 🔎 saring hasil: hanya 4D yang mengandung angka yang dicari
  const q = find.replace(/\D/g, "");
  // 🗑 buang hasil: angka dipisah * (spasi/koma juga diterima) — 4D yang mengandung salah satunya dibuang
  const buangList = useMemo(
    () => [...new Set(buang.split(/[*\s,;|]+/).map((t) => t.replace(/\D/g, "")).filter(Boolean))],
    [buang]
  );
  const isBuang = (r) => buangList.some((t) => r.includes(t));
  const shown = useMemo(
    () => (q ? results.filter((r) => r.includes(q) && !isBuang(r)) : results.filter((r) => !isBuang(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, q, buangList]
  );

  // render hasil dengan highlight potongan yang cocok
  const renderToken = (r) => {
    const i = q ? r.indexOf(q) : -1;
    if (i < 0) return r;
    return (
      <>
        {r.slice(0, i)}
        <span className={styles.hit}>{r.slice(i, i + q.length)}</span>
        {r.slice(i + q.length)}
      </>
    );
  };

  const setBox = (i, v) => setRaws((prev) => prev.map((x, j) => (j === i ? v : x)));

  // 🎲 hasil 3D: buang digit pertama dari tiap 4D, lalu dedup (Set menjamin unik)
  const results3D = useMemo(() => {
    const seen = new Set();
    for (const r of results) seen.add(r.slice(1));
    return [...seen];
  }, [results]);
  const shown3D = useMemo(
    () => (q ? results3D.filter((r) => r.includes(q) && !isBuang(r)) : results3D.filter((r) => !isBuang(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results3D, q, buangList]
  );

  const doCopy = async (list) => {
    const text = list.join(sep === "\n" ? "\n" : sep);
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

        <div className={styles.findRow}>
          <input
            type="text"
            inputMode="numeric"
            value={find}
            onChange={(e) => setFind(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="🔎 temukan angka… mis. 34 atau 1234"
            className={styles.findInput}
            disabled={!results.length}
          />
          {find && (
            <button type="button" className={styles.btnClear} onClick={() => setFind("")}>
              ✖
            </button>
          )}
        </div>

        <div className={styles.findRow}>
          <input
            type="text"
            inputMode="numeric"
            value={buang}
            onChange={(e) => setBuang(e.target.value.replace(/[^\d* ]/g, ""))}
            placeholder="🗑 hapus angka dari hasil… mis. 34*12*9 (pemisah *)"
            className={styles.findInput}
            disabled={!results.length}
          />
          {buang && (
            <button type="button" className={styles.btnClear} onClick={() => setBuang("")}>
              ✖
            </button>
          )}
        </div>

        <section className={styles.outHead}>
          <span>
            {q || buangList.length ? (
              <>
                Ditemukan: <b>{shown.length}</b>×4D · <b>{shown3D.length}</b>×3D dari{" "}
                {results.length} angka 4D
                {q ? <> untuk <b>{q}</b></> : null}
                {buangList.length ? <> · dibuang <b>{results.length - shown.length}</b> (🗑 {buangList.join("*")})</> : null}
              </>
            ) : (
              <>
                Hasil: <b>{results.length}</b> angka 4D · <b>{results3D.length}</b> angka 3D
              </>
            )}
            {totalBad ? ` · ${totalBad} token diabaikan` : ""}
          </span>
          <button type="button" className={styles.btnCopy} onClick={() => doCopy(shown)} disabled={!shown.length}>
            {copied ? "✓ tersalin" : q || buangList.length ? "📋 COPY 4D CARI" : "📋 COPY 4D"}
          </button>
        </section>

        <div className={styles.resultBox}>
          {shown.length ? (
            sep === "\n" ? (
              shown.map((r) => <div key={r}>{renderToken(r)}</div>)
            ) : (
              shown.map((r, i) => (
                <span key={r}>
                  {renderToken(r)}
                  {i < shown.length - 1 ? sep : ""}
                </span>
              ))
            )
          ) : results.length ? (
            <span className={styles.idle}>
              {q && !shown.length
                ? `Tidak ada 4D yang mengandung “${q}”…`
                : `Semua 4D terbuang oleh 🗑 ${buangList.join("*")}…`}
            </span>
          ) : (
            <span className={styles.idle}>Isi minimal 1 kotak…</span>
          )}
        </div>

        {results.length > 0 && (
          <>
            <section className={styles.outHead}>
              <span>
                Turunan 3D{" "}
                <em className={styles.hint3d}>(hapus digit pertama, sudah tanpa duplikat)</em>
              </span>
              <button
                type="button"
                className={styles.btnCopy}
                onClick={() => doCopy(shown3D)}
                disabled={!shown3D.length}
              >
                {copied ? "✓ tersalin" : q ? "📋 COPY 3D CARI" : "📋 COPY 3D"}
              </button>
            </section>

            <div className={styles.resultBox}>
              {shown3D.length ? (
                sep === "\n" ? (
                  shown3D.map((r) => <div key={r}>{renderToken(r)}</div>)
                ) : (
                  shown3D.map((r, i) => (
                    <span key={r}>
                      {renderToken(r)}
                      {i < shown3D.length - 1 ? sep : ""}
                    </span>
                  ))
                )
              ) : (
                <span className={styles.idle}>
                  {q && !shown3D.length
                    ? `Tidak ada 3D yang mengandung “${q}”…`
                    : `Semua 3D terbuang oleh 🗑 ${buangList.join("*")}…`}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
