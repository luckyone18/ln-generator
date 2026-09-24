"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./bbfs.module.css";
import { bbfsGenerate } from "../bbfs-lib.js";
import { generateTardal } from "../tardal.js";

const SEPARATORS = ["*", "#", ","];

const stripDigits = (v, max) => v.replace(/\D+/g, "").slice(0, max);

function CopyButton({ value, copied, onCopied }) {
  const doCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    onCopied();
  };
  return (
    <button type="button" className={styles.bbfsBtnCopyAll} onClick={doCopy}>
      {copied ? "✓ TERSALIN" : "📋 SALIN"}
    </button>
  );
}

export default function BbfsPage() {
  // --- BBFS (form atas, seperti referensi) ---
  const [as, setAs] = useState("");
  const [kop, setKop] = useState("");
  const [kepala, setKepala] = useState("");
  const [ekor, setEkor] = useState("");
  const [noTwin, setNoTwin] = useState(false);
  const [sepBbfs, setSepBbfs] = useState("*");
  const [copiedBbfs, setCopiedBbfs] = useState(false);

  // --- TARDAL (form bawah, seperti referensi) ---
  const [td, setTd] = useState("");
  const [tdType, setTdType] = useState("2");
  const [tdTwin, setTdTwin] = useState("1"); // 1 = Twin, 2 = No Twin
  const [sepTd, setSepTd] = useState("*");
  const [copiedTd, setCopiedTd] = useState(false);

  const bbfs = useMemo(
    () => bbfsGenerate({ as, kop, kepala, ekor, separator: sepBbfs, noTwin }),
    [as, kop, kepala, ekor, sepBbfs, noTwin]
  );
  const bbfsOutput = useMemo(() => bbfs.results.join(sepBbfs), [bbfs.results, sepBbfs]);

  const bbfsBreakdown = useMemo(() => {
    const map = new Map();
    for (const r of bbfs.results) map.set(r.length, (map.get(r.length) || 0) + 1);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [bbfs.results]);

  const tdRes = useMemo(() => {
    if (!td) return null;
    return generateTardal({ digits: td, type: tdType, twin: Number(tdTwin), splitter: sepTd });
  }, [td, tdType, tdTwin, sepTd]);
  const tdOutput = tdRes?.result || "";
  const tdCount = tdRes?.count || 0;

  const resetBbfs = () => {
    setAs(""); setKop(""); setKepala(""); setEkor("");
    setNoTwin(false); setSepBbfs("*"); setCopiedBbfs(false);
  };
  const resetTd = () => {
    setTd(""); setTdType("2"); setTdTwin("1"); setSepTd("*"); setCopiedTd(false);
  };

  const flash = (setter) => { setter(true); setTimeout(() => setter(false), 2000); };

  const bbfsFields = [
    { label: "As", value: as, set: setAs, ph: "12" },
    { label: "Kop", value: kop, set: setKop, ph: "34" },
    { label: "Kepala", value: kepala, set: setKepala, ph: "5" },
    { label: "Ekor", value: ekor, set: setEkor, ph: "6" },
  ];

  return (
    <main className={styles.bbfsContainer}>
      <header className={styles.bbfsHeader}>
        <h1>🔁 BBFS GENERATOR</h1>
        <p>
          BBFS (Bolak Balik Full Set) — kombinasi unik dari As × Kop × Kepala × Ekor · TARDAL —
          pasangan/acakan dari satu baris angka · dihitung langsung di browser
        </p>
        <div className={styles.bbfsNavRow}>
          <Link href="/" className={styles.bbfsNavPill}>Home</Link>
          <Link href="/riwayat" className={styles.bbfsNavPill}>Riwayat</Link>
          <Link href="/uji-kinerja" className={styles.bbfsNavPill}>Uji Kinerja</Link>
          <Link href="/rumus-otomatis" className={styles.bbfsNavPill}>Rumus Otomatis</Link>
          <Link href="/scanner" className={styles.bbfsNavPill}>Scanner Pro</Link>
        </div>
      </header>

      {/* ==================== SECTION 1: BBFS ==================== */}
      <section className={styles.bbfsSection}>
        <div className={styles.bbfsSectionTitle}>
          <h2>🔁 BBFS — Bolak Balik Full Set</h2>
          <CopyButton value={bbfsOutput} copied={copiedBbfs} onCopied={() => flash(setCopiedBbfs)} />
        </div>

        <div className={styles.bbfsInputPanel}>
          <div className={styles.bbfsFieldGrid}>
            {bbfsFields.map((f) => (
              <label key={f.label} className={styles.bbfsFieldWrap}>
                <span className={styles.bbfsFieldLabel}>{f.label}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={f.value}
                  placeholder={f.ph}
                  onChange={(e) => f.set(stripDigits(e.target.value, 10))}
                  className={styles.bbfsFieldInput}
                />
              </label>
            ))}
          </div>
          <div className={styles.bbfsCtrlRow}>
            <label className={styles.bbfsSepLabel}>
              Pemisah:
              <select
                value={sepBbfs}
                onChange={(e) => setSepBbfs(e.target.value)}
                className={styles.bbfsSepSelect}
              >
                {SEPARATORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className={styles.bbfsTwinLabel} title="Sembunyikan hasil dengan digit berulang (twin)">
              <input
                type="checkbox"
                checked={noTwin}
                onChange={(e) => setNoTwin(e.target.checked)}
                className={styles.bbfsTwinCheck}
              />
              TANPA TWIN
            </label>
            <button type="button" className={styles.bbfsBtnReset} onClick={resetBbfs}>
              🗑 RESET
            </button>
          </div>
          <div className={styles.bbfsStatRow}>
            <span className={styles.bbfsStatChip}>JUMLAH: <b>{bbfs.count}</b></span>
            {bbfsBreakdown.map(([len, n]) => (
              <span key={len} className={styles.bbfsStatChipSub}>{len}D: <b>{n}</b></span>
            ))}
          </div>
          <textarea
            readOnly
            value={bbfsOutput}
            rows={Math.min(10, Math.max(3, Math.ceil(bbfsOutput.length / 120)))}
            placeholder="Hasil BBFS muncul otomatis di sini…"
            className={styles.bbfsOutputArea}
          />
        </div>
      </section>

      {/* ==================== SECTION 2: TARDAL ==================== */}
      <section className={styles.bbfsSection}>
        <div className={styles.bbfsSectionTitle}>
          <h2>🎲 TARDAL</h2>
          <CopyButton value={tdOutput} copied={copiedTd} onCopied={() => flash(setCopiedTd)} />
        </div>

        <div className={styles.bbfsInputPanel}>
          <div className={styles.bbfsFieldGrid}>
            <label className={styles.bbfsFieldWrap}>
              <span className={styles.bbfsFieldLabel}>Tardal</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={td}
                placeholder="1234"
                onChange={(e) => setTd(stripDigits(e.target.value, 15))}
                className={styles.bbfsFieldInput}
              />
            </label>
          </div>
          <div className={styles.bbfsCtrlRow}>
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
            <label className={styles.bbfsSepLabel}>
              Pemisah:
              <select
                value={sepTd}
                onChange={(e) => setSepTd(e.target.value)}
                className={styles.bbfsSepSelect}
              >
                {SEPARATORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <button type="button" className={styles.bbfsBtnReset} onClick={resetTd}>
              🗑 RESET
            </button>
          </div>
          <div className={styles.bbfsStatRow}>
            <span className={styles.bbfsStatChip}>JUMLAH: <b>{tdCount}</b></span>
            {tdCount > 0 && (
              <span className={styles.bbfsStatChipSub}>{tdType}D: <b>{tdCount}</b></span>
            )}
            {td && tdRes?.error && (
              <span className={styles.bbfsStatChipSub}>⚠️ {tdRes.error}</span>
            )}
          </div>
          <textarea
            readOnly
            value={tdOutput}
            rows={Math.min(10, Math.max(3, Math.ceil(tdOutput.length / 120)))}
            placeholder="Hasil TARDAL muncul otomatis di sini…"
            className={styles.bbfsOutputArea}
          />
        </div>
      </section>
    </main>
  );
}
