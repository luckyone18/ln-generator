"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./rekap-manual.module.css";
import { buildRekap4D, renderRekap4D } from "../scanner/rekap";

// Parse daftar angka dari input bebas: pisah * spasi koma ; | newline.
// Token yang panjangnya kelipatan pas dari len akan dipotong (mis. "745746" →
// 745,746 utk len=3). Token lebih pendek dibiarkan apa adanya (mis. "7"),
// persis seperti mesin Rekap 4D memperlakukan AI pendek.
function parseList(raw, len) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s.split(/[*\s,;|]+/).filter(Boolean);
  const out = [];
  for (const t of parts) {
    if (!/^\d+$/.test(t)) continue;
    if (len >= 1 && t.length > len && t.length % len === 0) {
      for (let i = 0; i < t.length; i += len) out.push(t.slice(i, i + len));
    } else {
      out.push(t);
    }
  }
  return out;
}

// renderTrekHtml sederhana (escape + tag warna [h]/[m]).
function renderTrekHtml(raw) {
  let s = String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  s = s.replace(/\[h\]([\s\S]*?)\[\/h\]/gi, '<span style="color:#10b981;font-weight:900;">$1</span>');
  s = s.replace(/\[m\]([\s\S]*?)\[\/m\]/gi, '<span style="color:#ef4444;font-weight:900;">$1</span>');
  return s;
}

const FIELD_META = [
  { key: "front", len: 2, label: "① 2D ANGKA DEPAN", ph: "mis: 12*34*56", hint: "Poin-mati posisi 1-2 (AID). Dipakai sebagai sisi depan 4D." },
  { key: "back", len: 2, label: "② 2D ANGKA BELAKANG", ph: "mis: 45*78", hint: "Poin-mati posisi 3-4 (AI). Dipakai sebagai sisi belakang 4D." },
  { key: "mid", len: 2, label: "③ 2D ANGKA TENGAH (filter)", ph: "mis: 74", hint: "FILTER keras posisi 2-3 (C·K). Kosongkan bila tidak dipakai." },
  { key: "d3", len: 3, label: "④ 3D (filter)", ph: "mis: 745", hint: "FILTER keras posisi 2-4 (C·K·E). Kosongkan bila tidak dipakai." },
];

export default function RekapManualPage() {
  const [raw, setRaw] = useState({ front: "", back: "", mid: "", d3: "" });
  const [showTiers, setShowTiers] = useState("cad12");
  const [filterMode, setFilterMode] = useState("top");
  const [outputMode, setOutputMode] = useState("bagi");
  const [copied, setCopied] = useState(false);

  const lists = useMemo(
    () => ({
      front: parseList(raw.front, 2),
      back: parseList(raw.back, 2),
      mid: parseList(raw.mid, 2),
      d3: parseList(raw.d3, 3),
    }),
    [raw]
  );

  const set = (k) => (e) => setRaw((p) => ({ ...p, [k]: e.target.value }));

  const output = useMemo(() => {
    // Butuh minimal 1 depan & 1 belakang
    if (!lists.front.length || !lists.back.length) return "";
    // Bentuk items seperti Rekap 4D: tiap angka = 1 "rumus".
    const items = [
      ...lists.front.map((ai) => ({ type: "AID", ai })),
      ...lists.back.map((ai) => ({ type: "AI", ai })),
      ...lists.mid.map((ai) => ({ type: "AIT", ai })),
      ...lists.d3.map((ai) => ({ type: "AI3D", ai })),
    ];
    const impl = buildRekap4D(items, filterMode, outputMode);
    return renderRekap4D(impl, showTiers, "Rekap Manual");
  }, [lists, showTiers, filterMode, outputMode]);

  const copyOut = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const clearAll = () => {
    setRaw({ front: "", back: "", mid: "", d3: "" });
    setCopied(false);
  };

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1>🧮 REKAP MANUAL</h1>
        <p>Rekap 4D dengan angka yang diisi manual — 2D depan × 2D belakang, difilter 2D tengah & 3D</p>
        <div className={styles.navRow}>
          <Link href="/" className={styles.navPill}>Generator LN</Link>
          <Link href="/scanner" className={styles.navPill}>Scanner Pro</Link>
          <Link href="/pembagi" className={styles.navPill}>Pembagi Angka</Link>
          <Link href="/riwayat" className={styles.navPill}>Riwayat</Link>
        </div>
      </header>

      <section className={styles.inputPanel}>
        <div className={styles.grid}>
          {FIELD_META.map((f) => (
            <div key={f.key} className={styles.field}>
              <label className={styles.fieldLabel}>{f.label}</label>
              <textarea
                value={raw[f.key]}
                onChange={set(f.key)}
                placeholder={f.ph}
                rows={3}
                className={styles.inputArea}
              />
              <span className={styles.hintText}>{f.hint}</span>
              <span className={styles.countChip}>{lists[f.key].length} angka</span>
            </div>
          ))}
        </div>

        <div className={styles.ctrlRow}>
          <label className={styles.selLabel}>
            Tampil:
            <select value={showTiers} onChange={(e) => setShowTiers(e.target.value)} className={styles.select}>
              <option value="cad12">TOP+CAD 1+CAD 2</option>
              <option value="top">TOP saja</option>
              <option value="all">SEMUA tier</option>
            </select>
          </label>
          <label className={styles.selLabel}>
            Filter:
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className={styles.select}>
              <option value="top">TOP saja</option>
              <option value="full">FULL (TOP+CAD 1+CAD 2)</option>
            </select>
          </label>
          <label className={styles.selLabel}>
            Output:
            <select value={outputMode} onChange={(e) => setOutputMode(e.target.value)} className={styles.select}>
              <option value="bagi">BAGI (per tier)</option>
              <option value="digabung">DIGABUNG (1 kelompok)</option>
            </select>
          </label>
          <button type="button" className={styles.btnReset} onClick={clearAll}>
            🗑 KOSONGKAN
          </button>
        </div>

        <div className={styles.statRow}>
          <span className={styles.statChip}>2D depan: <b>{lists.front.length}</b></span>
          <span className={styles.statChip}>2D belakang: <b>{lists.back.length}</b></span>
          <span className={styles.statChip}>2D tengah: <b>{lists.mid.length}</b></span>
          <span className={styles.statChip}>3D: <b>{lists.d3.length}</b></span>
          {(!lists.front.length || !lists.back.length) && (
            <span className={styles.statChipWarn}>Butuh minimal 1 angka 2D depan & 1 angka 2D belakang</span>
          )}
        </div>
      </section>

      {output && (
        <section className={styles.resultPanel}>
          <div className={styles.resultHead}>
            <h2>🖥️ HASIL REKAP MANUAL</h2>
            <button type="button" className={styles.btnCopy} onClick={copyOut}>
              {copied ? "✓ TERSALIN" : "📋 COPY"}
            </button>
          </div>
          <pre
            className={styles.terminalBody}
            dangerouslySetInnerHTML={{ __html: renderTrekHtml(output) }}
          />
        </section>
      )}
    </main>
  );
}
