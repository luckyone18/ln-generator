"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./rekap-manual.module.css";

// Parse daftar angka dari input bebas: pisah * spasi koma ; | newline.
// Token yang panjangnya kelipatan pas dari len akan dipotong (mis. "123456" →
// 12,34,56 utk len=2; "745746" → 745,746 utk len=3).
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

  const result4D = useMemo(() => {
    // Butuh minimal 1 depan & 1 belakang
    if (!lists.front.length || !lists.back.length) return [];

    const hit = [];
    for (const f of lists.front) {
      for (const b of lists.back) {
        const code = (f + b); // 4-digit string
        if (code.length !== 4) continue;

        // Filter AIT (pos 2-3 / C·K)
        if (lists.mid.length) {
          const ck = code.slice(1, 3);
          if (!lists.mid.includes(ck)) continue;
        }
        // Filter AI3D (pos 2-4 / C·K·E)
        if (lists.d3.length) {
          const cke = code.slice(1, 4);
          if (!lists.d3.includes(cke)) continue;
        }
        hit.push(code);
      }
    }
    // Hapus duplikat & urut numerik
    return [...new Set(hit)].sort((a, b) => Number(a) - Number(b));
  }, [lists]);

  const copyOut = async () => {
    try {
      await navigator.clipboard.writeText(result4D.join("*"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const clearAll = () => {
    setRaw({ front: "", back: "", mid: "", d3: "" });
    setCopied(false);
  };

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1>🧮 REKAP MANUAL</h1>
        <p>Konvolusi langsung dari angka TOP/CAD1/CAD2 — output 4D saja, filtered by 2D tengah & 3D</p>
        <div className={styles.navRow}>
          <Link href="/" className={styles.navPill}>Generator LN</Link>
          <Link href="/scanner" className={styles.navPill}>Scanner Pro</Link>
          <Link href="/pembagi" className={styles.navPill}>Pembagi Angka</Link>
          <Link href="/riwayat" className={styles.navPill}>Riwayat</Link>
        </div>
      </header>

      <section className={styles.inputPanel}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>① 2D ANGKA DEPAN (TOP/CAD…)</label>
            <textarea
              value={raw.front}
              onChange={(e) => set("front")(e)}
              placeholder="12*34*56 atau 12 34 56"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Tulis deretan angka 2D (TOP/CAD1/CAD2). Auto-pisah bila pakai * / spasi.</span>
            <span className={styles.countChip}>{lists.front.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>② 2D ANGKA BELAKANG (TOP/CAD…)</label>
            <textarea
              value={raw.back}
              onChange={(e) => set("back")(e)}
              placeholder="45*78"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Tulis deretan angka 2D (TOP/CAD1/CAD2).</span>
            <span className={styles.countChip}>{lists.back.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>③ 2D TENGAH FILTER (posisi 2-3)</label>
            <textarea
              value={raw.mid}
              onChange={(e) => set("mid")(e)}
              placeholder="74"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Filter keras: kode 4D harus punya posisi 2-3 = salah satu angka di sini. Kosongkan jika tidak dipakai.</span>
            <span className={styles.countChip}>{lists.mid.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>④ 3D FILTER (posisi 2-4)</label>
            <textarea
              value={raw.d3}
              onChange={(e) => set("d3")(e)}
              placeholder="745"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Filter keras: kode 4D harus punya posisi 2-4 = salah satu angka di sini. Kosongkan jika tidak dipakai.</span>
            <span className={styles.countChip}>{lists.d3.length} angka</span>
          </div>
        </div>

        <div className={styles.ctrlRow}>
          <button type="button" className={styles.btnReset} onClick={clearAll}>
            🗑 KOSONGKAN
          </button>
          <span className={styles.statChip}>4D Sah: <b>{result4D.length}</b></span>
          {(!lists.front.length || !lists.back.length) && (
            <span className={styles.statChipWarn}>Butuh minimal 1 angka 2D depan & 1 angka 2D belakang</span>
          )}
        </div>
      </section>

      {result4D.length > 0 && (
        <section className={styles.resultPanel}>
          <div className={styles.resultHead}>
            <h2>📦 HASIL 4D (LOLOS FILTER)</h2>
            <button type="button" className={styles.btnCopy} onClick={copyOut}>
              {copied ? "✓ TERSALIN" : "📋 COPY"}
            </button>
          </div>
          <pre
            className={styles.terminalBody}
          >
{result4D.join("\n")}
          </pre>
        </section>
      )}
    </main>
  );
}
