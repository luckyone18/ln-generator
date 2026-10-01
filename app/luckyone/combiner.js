"use client";

import { useMemo, useState } from "react";
import styles from "./lucky.module.css";
import {
  parseCol,
  combineUnique,
  sortResult,
  filterResult,
  parseBuang,
} from "./combiner-lib.js";

export default function Combiner() {
  const [raws, setRaws] = useState(["", "", ""]);
  const [sep, setSep] = useState("*");
  const [sortMode, setSortMode] = useState("asli"); // asli | asc | desc
  const [find, setFind] = useState(""); // cari angka di hasil
  const [buang, setBuang] = useState(""); // buang angka dari hasil, pemisah *
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => raws.map(parseCol), [raws]);

  // hasil gabungan unik (tanpa angka yang sama / duplikat)
  const unique = useMemo(() => combineUnique(parsed.map((p) => p.ok)), [parsed]);

  // terapkan sorting bila dipilih
  const sorted = useMemo(() => sortResult(unique, sortMode), [unique, sortMode]);

  // 🔎 saring hasil: hanya angka yang mengandung angka yang dicari
  const q = find.replace(/\D/g, "");
  // 🗑 buang hasil: angka dipisah * — token yang mengandung salah satunya dibuang
  const buangList = useMemo(() => parseBuang(buang), [buang]);

  const shown = useMemo(
    () => filterResult(sorted, q, buangList),
    [sorted, q, buangList]
  );

  // rincian jumlah per panjang (2D / 3D / 4D) dari hasil tampil
  const stats = useMemo(() => {
    const s = { 2: 0, 3: 0, 4: 0 };
    for (const r of shown) s[r.length] = (s[r.length] || 0) + 1;
    return s;
  }, [shown]);

  const totalBad = parsed.reduce((n, p) => n + p.bad.length, 0);

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

  const doCopy = async () => {
    const text = shown.join(sep === "\n" ? "\n" : sep);
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
    <div>
      <p className={styles.sub}>
        Isi deretan angka 2D/3D/4D di 3 kolom (pemisah <b>*</b>) → hasil gabungan
        tanpa angka yang sama
      </p>

      <div className={styles.boxes}>
        {raws.map((r, i) => (
          <label key={i} className={styles.boxWrap}>
            <span className={styles.boxLabel}>
              Kolom {i + 1}
              {parsed[i].ok.length > 0 && (
                <em className={styles.boxCount}>{parsed[i].ok.length} angka</em>
              )}
              {parsed[i].bad.length > 0 && (
                <em className={styles.boxBad}>{parsed[i].bad.length} invalid</em>
              )}
            </span>
            <textarea
              className={styles.boxInput}
              value={r}
              onChange={(e) => setBox(i, e.target.value)}
              placeholder="mis. 12*34*56 atau 123*456"
              rows={3}
              spellCheck={false}
            />
          </label>
        ))}
      </div>

      <div className={styles.row}>
        <label className={styles.sepWrap}>
          Pemisah hasil:{" "}
          <select value={sep} onChange={(e) => setSep(e.target.value)} className={styles.sepSel}>
            <option value="*">＊ (bintang)</option>
            <option value=" ">spasi</option>
            <option value=",">koma</option>
            <option value="|">garis tegak |</option>
            <option value={"\n"}>baris baru</option>
          </select>
        </label>
        <label className={styles.sepWrap}>
          Urutkan:{" "}
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className={styles.sepSel}
          >
            <option value="asli">sesuai isi</option>
            <option value="asc">kecil → besar</option>
            <option value="desc">besar → kecil</option>
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
          disabled={!unique.length}
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
          disabled={!unique.length}
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
              Ditemukan: <b>{shown.length}</b> angka dari {unique.length} angka unik
              {q ? <> untuk <b>{q}</b></> : null}
              {buangList.length ? (
                <> · dibuang <b>{unique.length - shown.length}</b> (🗑 {buangList.join("*")})</>
              ) : null}
            </>
          ) : (
            <>
              Hasil: <b>{unique.length}</b> angka unik
              {unique.length ? (
                <>
                  {" "}
                  · <b>{stats[2] || 0}</b>×2D · <b>{stats[3] || 0}</b>×3D ·{" "}
                  <b>{stats[4] || 0}</b>×4D
                </>
              ) : null}
            </>
          )}
          {totalBad ? ` · ${totalBad} token diabaikan` : ""}
        </span>
        <button
          type="button"
          className={styles.btnCopy}
          onClick={doCopy}
          disabled={!shown.length}
        >
          {copied ? "✓ tersalin" : "📋 COPY HASIL"}
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
        ) : unique.length ? (
          <span className={styles.idle}>
            {q && !shown.length
              ? `Tidak ada angka yang mengandung “${q}”…`
              : `Semua angka terbuang oleh 🗑 ${buangList.join("*")}…`}
          </span>
        ) : (
          <span className={styles.idle}>Isi minimal 1 kolom…</span>
        )}
      </div>
    </div>
  );
}
