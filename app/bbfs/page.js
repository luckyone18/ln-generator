"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./bbfs.module.css";
import { bbfsGenerate } from "../bbfs-lib.js";
import { generateTardal } from "../tardal.js";

const SEPARATORS = ["*", "#", ","];

export default function BbfsPage() {
  const [mode, setMode] = useState("bbfs"); // "bbfs" | "tardal"

  // --- BBFS state ---
  const [as, setAs] = useState("");
  const [kop, setKop] = useState("");
  const [kepala, setKepala] = useState("");
  const [ekor, setEkor] = useState("");
  const [noTwin, setNoTwin] = useState(false);

  // --- TARDAL state ---
  const [td, setTd] = useState("");
  const [tdType, setTdType] = useState("2");
  const [tdTwin, setTdTwin] = useState("1"); // 1 = Twin, 2 = No Twin

  // --- shared ---
  const [separator, setSeparator] = useState("*");
  const [copied, setCopied] = useState(false);

  const stripDigits = (v) => v.replace(/\D+/g, "").slice(0, 10);

  const { results, count: bbfsCount } = useMemo(
    () => bbfsGenerate({ as, kop, kepala, ekor, separator, noTwin }),
    [as, kop, kepala, ekor, separator, noTwin]
  );
  const bbfsOutput = useMemo(() => results.join(separator), [results, separator]);

  const tdRes = useMemo(() => {
    if (!td) return null;
    return generateTardal({ digits: td, type: tdType, twin: Number(tdTwin), splitter: separator });
  }, [td, tdType, tdTwin, separator]);

  const isBbfs = mode === "bbfs";
  const output = isBbfs ? bbfsOutput : tdRes?.result || "";
  const count = isBbfs ? bbfsCount : tdRes?.count || 0;

  // Rincian panjang hasil, contoh: "4D: 4"
  const lengthBreakdown = useMemo(() => {
    const map = new Map();
    for (const r of results) map.set(r.length, (map.get(r.length) || 0) + 1);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [results]);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = output;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doReset = () => {
    setAs("");
    setKop("");
    setKepala("");
    setEkor("");
    setNoTwin(false);
    setTd("");
    setTdType("2");
    setTdTwin("1");
    setSeparator("*");
    setCopied(false);
  };

  const fields = [
    { label: "As", value: as, set: setAs, ph: "12" },
    { label: "Kop", value: kop, set: setKop, ph: "34" },
    { label: "Kepala", value: kepala, set: setKepala, ph: "5" },
    { label: "Ekor", value: ekor, set: setEkor, ph: "6" },
  ];

  return (
    <main className={styles.bbfsContainer}>
      <header className={styles.bbfsHeader}>
        <h1>🔁 BBFS GENERATOR</h1>
        <p>Dua mode — BBFS (As × Kop × Kepala × Ekor) dan TARDAL — dihitung langsung di browser</p>
        <div className={styles.bbfsNavRow}>
          <Link href="/" className={styles.bbfsNavPill}>Home</Link>
          <Link href="/riwayat" className={styles.bbfsNavPill}>Riwayat</Link>
          <Link href="/uji-kinerja" className={styles.bbfsNavPill}>Uji Kinerja</Link>
          <Link href="/rumus-otomatis" className={styles.bbfsNavPill}>Rumus Otomatis</Link>
          <Link href="/scanner" className={styles.bbfsNavPill}>Scanner Pro</Link>
        </div>
      </header>

      <div className={styles.bbfsTabRow}>
        <button
          type="button"
          className={isBbfs ? styles.bbfsTabActive : styles.bbfsTab}
          onClick={() => setMode("bbfs")}
        >
          🔁 BBFS
        </button>
        <button
          type="button"
          className={!isBbfs ? styles.bbfsTabActive : styles.bbfsTab}
          onClick={() => setMode("tardal")}
        >
          🎲 TARDAL
        </button>
      </div>

      <section className={styles.bbfsInputPanel}>
        {isBbfs ? (
          <div className={styles.bbfsFieldGrid}>
            {fields.map((f) => (
              <label key={f.label} className={styles.bbfsFieldWrap}>
                <span className={styles.bbfsFieldLabel}>{f.label}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={f.value}
                  placeholder={f.ph}
                  onChange={(e) => f.set(stripDigits(e.target.value))}
                  className={styles.bbfsFieldInput}
                />
              </label>
            ))}
          </div>
        ) : (
          <div className={styles.bbfsFieldGrid}>
            <label className={styles.bbfsFieldWrap}>
              <span className={styles.bbfsFieldLabel}>Tardal</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={td}
                placeholder="1234"
                onChange={(e) => setTd(e.target.value.replace(/\D+/g, "").slice(0, 15))}
                className={styles.bbfsFieldInput}
              />
            </label>
          </div>
        )}
        <div className={styles.bbfsCtrlRow}>
          {!isBbfs && (
            <>
              <label className={styles.bbfsSepLabel}>
                Tipe:
                <select
                  value={tdType}
                  onChange={(e) => setTdType(e.target.value)}
                  className={styles.bbfsSepSelect}
                >
                  <option value="2">2D</option>
                  <option value="3">3D</option>
                  <option value="4">4D</option>
                </select>
              </label>
              <label className={styles.bbfsSepLabel}>
                Twin:
                <select
                  value={tdTwin}
                  onChange={(e) => setTdTwin(e.target.value)}
                  className={styles.bbfsSepSelect}
                >
                  <option value="1">Twin</option>
                  <option value="2">No Twin</option>
                </select>
              </label>
            </>
          )}
          <label className={styles.bbfsSepLabel}>
            Pemisah:
            <select
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              className={styles.bbfsSepSelect}
            >
              {SEPARATORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {isBbfs && (
            <label className={styles.bbfsTwinLabel} title="Sembunyikan hasil dengan digit berulang (twin)">
              <input
                type="checkbox"
                checked={noTwin}
                onChange={(e) => setNoTwin(e.target.checked)}
                className={styles.bbfsTwinCheck}
              />
              TANPA TWIN
            </label>
          )}
          <button type="button" className={styles.bbfsBtnReset} onClick={doReset}>
            🗑 RESET
          </button>
        </div>
        <div className={styles.bbfsStatRow}>
          <span className={styles.bbfsStatChip}>JUMLAH: <b>{count}</b></span>
          {isBbfs &&
            lengthBreakdown.map(([len, n]) => (
              <span key={len} className={styles.bbfsStatChipSub}>
                {len}D: <b>{n}</b>
              </span>
            ))}
          {!isBbfs && count > 0 && (
            <span className={styles.bbfsStatChipSub}>
              {tdType}D: <b>{count}</b>
            </span>
          )}
          {!isBbfs && td && tdRes?.error && (
            <span className={styles.bbfsStatChipSub}>⚠️ {tdRes.error}</span>
          )}
        </div>
      </section>

      {count > 0 && (
        <section className={styles.bbfsResultPanel}>
          <div className={styles.bbfsResultHead}>
            <h2>{isBbfs ? "📦 HASIL BBFS" : "📦 HASIL TARDAL"}</h2>
            <button type="button" className={styles.bbfsBtnCopyAll} onClick={doCopy}>
              {copied ? "✓ TERSALIN" : "📋 SALIN SEMUA"}
            </button>
          </div>
          <textarea
            readOnly
            value={output}
            rows={Math.min(12, Math.max(3, Math.ceil(output.length / 120)))}
            className={styles.bbfsOutputArea}
          />
        </section>
      )}
    </main>
  );
}
