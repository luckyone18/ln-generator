"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./pembagi.module.css";

// parse angka dari input bebas: pisah *, spasi, koma, newline, atau tanpa pemisah (fixed-length)
function parseNumbers(raw, len) {
  const s = String(raw || "").trim();
  if (!s) return [];
  // coba pisah via delimiter umum
  const parts = s.split(/[*\s,;|]+/).filter(Boolean);
  if (parts.length > 1) return parts.filter((p) => /^\d+$/.test(p));
  // tanpa delimiter: potong per panjang digit
  if (/^\d+$/.test(s) && len >= 2 && len <= 6) {
    const out = [];
    for (let i = 0; i + len <= s.length; i += len) out.push(s.slice(i, i + len));
    return out;
  }
  return parts.filter((p) => /^\d+$/.test(p));
}

// Konversi daftar angka dari len A menjadi len B
// Mode: "depan" (ambil n digit pertama), "tengah" (n digit tengah), "belakang" (ambil n digit terakhir)
function convertNumbers(numbers, fromLen, toLen, mode = "depan") {
  if (mode === "depan") {
    return numbers.map((n) => n.toString().padStart(fromLen, "0").slice(0, toLen));
  } else if (mode === "belakang") {
    return numbers.map((n) => n.toString().padStart(fromLen, "0").slice(-toLen));
  } else if (mode === "tengah") {
    // ambil 2 digit tengah dari 4-digit → slice index 1:3
    if (fromLen !== 4 || toLen !== 3) return [];
    return numbers.map((n) => n.toString().padStart(fromLen, "0").slice(1, 4));
  }
  return numbers;
}

// Hapus angka duplikat dari array string
function uniqueNumbers(arr) {
  const seen = new Set();
  const out = [];
  for (const n of arr) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export default function PembagiPage() {
  const [raw, setRaw] = useState("");
  const [size, setSize] = useState(400);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [convert4to3, setConvert4to3] = useState(false); // true = ambil 3 digit belakang + unique

  const digits = useMemo(() => {
    const m = String(raw).match(/\d+/g);
    if (!m) return 4;
    return m[0].length;
  }, [raw]);

  const numbers = useMemo(() => parseNumbers(raw, digits), [raw, digits]);

  // Konversi: jika convert4to3=true, ambil 3 digit BELAKANG lalu unique
  const convertedNumbers = useMemo(() => {
    if (!convert4to3 || !numbers.length) return numbers;
    // Ambil 3 digit belakang dari 4-digit
    const back3 = numbers.map((n) => n.toString().padStart(4, "0").slice(-3));
    // Hapus duplikat
    return uniqueNumbers(back3);
  }, [numbers, convert4to3, digits]);

  const derets = useMemo(() => {
    if (!convertedNumbers.length) return [];
    const per = Math.max(1, parseInt(size, 10) || 400);
    const out = [];
    for (let i = 0; i < convertedNumbers.length; i += per) {
      out.push(convertedNumbers.slice(i, i + per));
    }
    return out;
  }, [convertedNumbers, size]);

  const doCopy = async (text, idx) => {
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
    if (idx === "all") {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  };

  return (
    <main className={styles.pembagiContainer}>
      <header className={styles.pembagiHeader}>
        <h1>✂️ PEMBAGI ANGKA</h1>
        <p>Bagi pool angka besar jadi beberapa deret — atur sendiri jumlah angka per deret</p>
        <div className={styles.navRow}>
          <Link href="/" className={styles.navPill}>Generator LN</Link>
          <Link href="/riwayat" className={styles.navPill}>Riwayat</Link>
          <Link href="/uji-kinerja" className={styles.navPill}>Uji Kinerja</Link>
          <Link href="/rumus-otomatis" className={styles.navPill}>Rumus Otomatis</Link>
          <Link href="/scanner" className={styles.navPill}>Scanner Pro</Link>
        </div>
      </header>

      <section className={styles.inputPanel}>
        <label className={styles.panelLabel}>📥 Paste pool angka (pisah * / spasi / baris):</label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Contoh: 0124*0126*0127*0128*... — atau paste langsung dari Rekap 4D / Generator LN"
          rows={6}
          className={styles.inputArea}
        />
        <div className={styles.ctrlRow}>
          <label className={styles.sizeLabel}>
            Angka per deret:
            <input
              type="number"
              min={1}
              max={10000}
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={styles.sizeInput}
            />
          </label>
          <button
            type="button"
            className={styles.btnReset}
            onClick={() => {
              setRaw("");
              setConvert4to3(false);
              setCopiedIdx(null);
            }}
          >
            🗑 KOSONGKAN
          </button>
        </div>
        {/* Opsi konversi 4D → 3D (3 digit belakang + unique) */}
        {digits === 4 && (
          <div className={styles.ctrlRow}>
            <label className={styles.sizeLabel} style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={convert4to3}
                onChange={(e) => setConvert4to3(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              🔄 Konversi 4D → 3D
            </label>
            <span className={styles.hintText}>
              Ambil 3 digit BELAKANG + hapus duplikat (contoh: 1234→234, 5678→678)
            </span>
          </div>
        )}
        {numbers.length > 0 && (
          <div className={styles.statRow}>
            <span className={styles.statChip}>Total: <b>{numbers.length}</b> angka</span>
            <span className={styles.statChip}>Digit: <b>{digits}</b>D</span>
            <span className={styles.statChip}>Deret: <b>{derets.length}</b></span>
            {convert4to3 && convertedNumbers.length !== numbers.length && (
              <span className={styles.statChipWarn}>
                Konversi 4D → 3D (BELAKANG + UNIQUE): <b>{numbers.length} → {convertedNumbers.length}</b> angka
              </span>
            )}
            {numbers.length % Math.max(1, parseInt(size, 10) || 400) !== 0 && (
              <span className={styles.statChipWarn}>
                Deret terakhir: <b>{numbers.length % Math.max(1, parseInt(size, 10) || 400)}</b> angka (sisa)
              </span>
            )}
          </div>
        )}
      </section>

      {derets.length > 0 && (
        <section className={styles.resultPanel}>
          <div className={styles.resultHead}>
            <h2>📦 HASIL PEMBAGIAN</h2>
            <button
              type="button"
              className={styles.btnCopyAll}
              onClick={() => doCopy(derets.map((d, i) => `DERET ${i + 1}:\n${d.join("*")}`).join("\n\n"), "all")}
            >
              {copiedAll ? "✓ TERSALIN SEMUA" : "📋 COPY SEMUA DERET"}
            </button>
          </div>
          {derets.map((d, i) => (
            <div key={i} className={styles.deretCard}>
              <div className={styles.deretHead}>
                <span className={styles.deretTitle}>DERET {i + 1}</span>
                <span className={styles.deretCount}>{d.length} angka</span>
                <button
                  type="button"
                  className={styles.btnCopyDeret}
                  onClick={() => doCopy(d.join("*"), i)}
                >
                  {copiedIdx === i ? "✓ TERSALIN" : "📋 COPY"}
                </button>
              </div>
              <textarea
                readOnly
                value={d.join("*")}
                rows={Math.min(8, Math.max(2, Math.ceil(d.length / 25)))}
                className={styles.deretArea}
              />
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
