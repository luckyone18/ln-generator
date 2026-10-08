"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./rekap-manual.module.css";

// Parse daftar angka dari input bebas: pisah * spasi koma ; | newline.
// Token kelipatan pas dari len dipotong (mis. "123456" → 12,34,56 utk len=2).
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

export default function RekapManualPage() {
  const [raw, setRaw] = useState({ front: "", back: "", mid: "", d3: "" });
  const [copiedKey, setCopiedKey] = useState(null);

  // Opsi Pembagi & 3D
  const [perBatch, setPerBatch] = useState(50);

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

  // ── 1. Konvolusi + filter → hasil 4D ──────────────────────────────
  const result4D = useMemo(() => {
    if (!lists.front.length || !lists.back.length) return [];
    const hit = [];
    for (const f of lists.front) {
      for (const b of lists.back) {
        const code = f + b;
        if (code.length !== 4) continue;
        if (lists.mid.length && !lists.mid.includes(code.slice(1, 3))) continue; // pos 2-3
        if (lists.d3.length && !lists.d3.includes(code.slice(1, 4))) continue; // pos 2-4
        hit.push(code);
      }
    }
    return [...new Set(hit)].sort((a, b) => Number(a) - Number(b));
  }, [lists]);

  // ── 2. Pembagi: potong jadi deret N angka ─────────────────────────
  const batches = useMemo(() => {
    if (!result4D.length) return [];
    const size = Math.max(1, parseInt(perBatch, 10) || 50);
    const out = [];
    for (let i = 0; i < result4D.length; i += size) out.push(result4D.slice(i, i + size));
    return out;
  }, [result4D, perBatch]);

  // ── 3. 3D creator: ambil posisi 2-4 (3 digit belakang) dari tiap 4D ──
  const result3D = useMemo(() => {
    if (!result4D.length) return [];
    const conv = result4D.map((n) => n.padStart(4, "0").slice(-3));
    return [...new Set(conv)].sort();
  }, [result4D]);

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* noop */ }
  };

  const clearAll = () => {
    setRaw({ front: "", back: "", mid: "", d3: "" });
    setCopiedKey(null);
  };

  const needInput = !lists.front.length || !lists.back.length;

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1>🧮 REKAP MANUAL</h1>
        <p>Konvolusi manual dari angka TOP/CAD1/CAD2 → output 4D, lalu bagi jadi deret &amp; buat 3D</p>
        <div className={styles.navRow}>
          <Link href="/" className={styles.navPill}>Generator LN</Link>
          <Link href="/scanner" className={styles.navPill}>Scanner Pro</Link>
          <Link href="/riwayat" className={styles.navPill}>Riwayat</Link>
        </div>
      </header>

      {/* ── Input 4 kolom ── */}
      <section className={styles.inputPanel}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>① 2D ANGKA DEPAN (TOP/CAD…)</label>
            <textarea
              value={raw.front}
              onChange={set("front")}
              placeholder="12*34*56 atau 12 34 56"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Deretan angka 2D → sisi depan 4D.</span>
            <span className={styles.countChip}>{lists.front.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>② 2D ANGKA BELAKANG (TOP/CAD…)</label>
            <textarea
              value={raw.back}
              onChange={set("back")}
              placeholder="45*78"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Deretan angka 2D → sisi belakang 4D.</span>
            <span className={styles.countChip}>{lists.back.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>③ 2D TENGAH FILTER (posisi 2-3)</label>
            <textarea
              value={raw.mid}
              onChange={set("mid")}
              placeholder="74"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Filter keras: 4D harus punya posisi 2-3 = salah satu dari ini. Opsional.</span>
            <span className={styles.countChip}>{lists.mid.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>④ 3D FILTER (posisi 2-4)</label>
            <textarea
              value={raw.d3}
              onChange={set("d3")}
              placeholder="745"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Filter keras: 4D harus punya posisi 2-4 = salah satu dari ini. Opsional.</span>
            <span className={styles.countChip}>{lists.d3.length} angka</span>
          </div>
        </div>

        <div className={styles.ctrlRow}>
          <button type="button" className={styles.btnReset} onClick={clearAll}>
            🗑 KOSONGKAN
          </button>
          <span className={styles.statChip}>4D Sah: <b>{result4D.length}</b></span>
          {needInput && (
            <span className={styles.statChipWarn}>Butuh minimal 1 angka 2D depan &amp; 1 angka 2D belakang</span>
          )}
        </div>
      </section>

      {result4D.length > 0 && (
        <>
          {/* ── Panel 1: Hasil 4D ── */}
          <section className={styles.resultPanel}>
            <div className={styles.resultHead}>
              <h2>📦 HASIL 4D (LOLOS FILTER)</h2>
              <button type="button" className={styles.btnCopy} onClick={() => copyText(result4D.join("*"), "4d")}>
                {copiedKey === "4d" ? "✓ TERSALIN" : "📋 COPY"}
              </button>
            </div>
            <pre className={styles.terminalBody}>{result4D.join("*")}</pre>
          </section>

          {/* ── Panel 2: Pembagi (muncul hanya jika 4D > 400) ── */}
          {result4D.length > 400 && (
          <section className={styles.resultPanel}>
            <div className={styles.resultHead}>
              <h2>✂️ PEMBAGI 4D (PER DERET)</h2>
              <label className={styles.selLabel}>
                Angka per deret:
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={perBatch}
                  onChange={(e) => setPerBatch(e.target.value)}
                  className={styles.sizeInput}
                />
              </label>
              <button
                type="button"
                className={styles.btnCopy}
                onClick={() =>
                  copyText(batches.map((d, i) => `DERET ${i + 1}:\n${d.join("*")}`).join("\n\n"), "all")
                }
              >
                {copiedKey === "all" ? "✓ TERSALIN SEMUA" : "📋 COPY SEMUA DERET"}
              </button>
            </div>
            <div className={styles.hintText} style={{ marginBottom: "0.75rem" }}>
              Total <b>{result4D.length}</b> 4D → <b>{batches.length}</b> deret × maks <b>{Math.max(1, parseInt(perBatch, 10) || 50)}</b> angka
            </div>
            {batches.map((d, i) => (
              <div key={i} className={styles.deretCard}>
                <div className={styles.deretHead}>
                  <span className={styles.deretTitle}>DERET {i + 1}</span>
                  <span className={styles.deretCount}>{d.length} angka</span>
                  <button
                    type="button"
                    className={styles.btnCopyDeret}
                    onClick={() => copyText(d.join("*"), `d${i}`)}
                  >
                    {copiedKey === `d${i}` ? "✓" : "📋 COPY"}
                  </button>
                </div>
                <textarea readOnly value={d.join("*")} rows={Math.min(6, Math.max(2, Math.ceil(d.length / 25)))} className={styles.deretArea} />
              </div>
            ))}
          </section>
          )}

          {/* ── Panel 3: 3D Creator (muncul hanya jika 3D > 400) ── */}
          {result3D.length > 400 && (
          <section className={styles.resultPanel}>
            <div className={styles.resultHead}>
              <h2>🔢 PEMBUAT 3D (POSISI 2-4)</h2>
              <button type="button" className={styles.btnCopy} onClick={() => copyText(result3D.join("*"), "3d")}>
                {copiedKey === "3d" ? "✓ TERSALIN" : "📋 COPY"}
              </button>
            </div>
            <div className={styles.hintText} style={{ marginBottom: "0.75rem" }}>
              {result4D.length} 4D → <b>{result3D.length}</b> 3D unik (posisi 2-4)
            </div>
            <pre className={styles.terminalBody}>{result3D.join("*")}</pre>
          </section>
          )}
        </>
      )}
    </main>
  );
}
