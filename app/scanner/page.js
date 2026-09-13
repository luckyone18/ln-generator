"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  SCANNER_MARKETS,
  SCANNER_TARGETS,
  DIGIT_OPTIONS,
  LIMIT_OPTIONS,
  PATAH_OPTIONS,
  MAX_RUMUS_OPTIONS,
  DAY_OPTIONS,
  TYPE_MAP,
} from "./constants";
import {
  buildState,
  randomFormula,
  formulaKey,
  evaluateRows,
  buildCode,
  buildTrekLog,
} from "./engine";
import styles from "./scanner.module.css";

function parseCode(code) {
  const m = code.match(/^#?([A-Za-z0-9]+)_([A-Za-z0-9]+)_/);
  if (!m) return { market: "", type: "AI" };
  return {
    market: m[1].toUpperCase(),
    type: TYPE_MAP[m[2].toLowerCase()] || m[2].toUpperCase(),
  };
}

function renderTrekHtml(raw) {
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  s = s.replace(
    /\[h\]([\s\S]*?)\[\/h\]/gi,
    '<span style="color:#10b981;font-weight:900;">$1</span>'
  );
  s = s.replace(
    /\[m\]([\s\S]*?)\[\/m\]/gi,
    '<span style="color:#ef4444;font-weight:900;">$1</span>'
  );
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<b>$1</b>");
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<i>$1</i>");
  return s;
}

export default function ScannerPage() {
  const [market, setMarket] = useState("sgp");
  const [fCol, setFCOL] = useState("ai");
  const [digit, setDigit] = useState(4);
  const [limit, setLimit] = useState(30);
  const [patah, setPatah] = useState(0);
  const [maxRumus, setMaxRumus] = useState(5);
  const [day, setDay] = useState("");

  const [isScanning, setIsScanning] = useState(false);
  const [foundItems, setFoundItems] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("_> SIAP MEMINDAI");
  const [trekLog, setTrekLog] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const scanRef = useRef({ active: false, items: [], iter: 0 });
  const localModeRef = useRef(false);

  const doFinish = useCallback((reason) => {
    scanRef.current.active = false;
    setIsScanning(false);
    if (reason === "stopped") {
      setStatusText(`_> DIHENTIKAN : ${scanRef.current.items.length} RUMUS`);
    } else if (reason === "timeout") {
      setStatusText("_> TIMEOUT : BATAS WAKTU TERCAPAI");
    } else {
      setStatusText(`_> PEMINDAIAN SELESAI : ${scanRef.current.items.length} RUMUS`);
    }
    setProgress(100);
    let cd = 3;
    setCooldown(cd);
    const iv = setInterval(() => {
      cd -= 1;
      setCooldown(cd);
      if (cd <= 0) clearInterval(iv);
    }, 1000);
  }, []);

  const startScan = useCallback(async () => {
    scanRef.current = { active: true, items: [], iter: 0 };
    setIsScanning(true);
    setFoundItems([]);
    setTrekLog("");
    setProgress(0);
    setStatusText("_> ANALISA RADAR [ 0% ] — 0 MENYERAP...");

    const MAX_ITER = 400;
    const TIMEOUT_MS = 180000;
    const startTime = Date.now();
    const targetRms = parseInt(maxRumus, 10) || 5;

    const buildParams = (isFirst) => ({
      hub_action: "scanner_api",
      market,
      fCol,
      limit,
      patah,
      targetD: digit,
      days: day ? [day] : [],
      is_first: isFirst ? "1" : "0",
    });

    while (scanRef.current.active) {
      scanRef.current.iter += 1;

      if (scanRef.current.items.length >= targetRms) {
        doFinish("done");
        return;
      }
      if (scanRef.current.iter > MAX_ITER) {
        doFinish("timeout");
        return;
      }
      if (Date.now() - startTime > TIMEOUT_MS) {
        doFinish("timeout");
        return;
      }

      // ── HYBRID ENGINE ────────────────────────────────────────────────
      // Mode A (asli): coba endpoint scanner_api Angkanet (identik dengan situs).
      // Jika maintenance, kena daily limit, atau response bermasalah → otomatis
      // pindah Mode B (lokal): generate formula acak deterministik via filter_api.
      const curMaxPatah = parseInt(patah, 10) || 0;

      let item = null;

      if (!localModeRef.current) {
        // ── MODE A: scanner_api asli ──
        let resp;
        try {
          const res = await fetch("/api/scanner", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildParams(scanRef.current.iter === 1)),
          });
          resp = await res.json();
        } catch (err) {
          setStatusText(`_> SCM ERROR, PARASIT → LOKAL: ${err.message}`);
          localModeRef.current = true;
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        if (!scanRef.current.active) {
          doFinish("stopped");
          return;
        }

        if (resp && resp.status === "success" && (resp.configs || resp.config)) {
          const itemsToProcess = resp.configs || [resp.config];
          let madeProgress = false;
          for (const cfg of itemsToProcess) {
            if (scanRef.current.items.length >= targetRms) break;
            if (!cfg || !cfg.state) continue;
            const s = cfg.state;

            let code = s.rumus_code ||
              buildCode({
                market,
                fCol,
                formula: {
                  k1: s.k1, m1: s.m1, s1: s.s1, op1: s.op1,
                  k2: s.k2, m2: s.m2, s2: s.s2, op2: s.op2,
                  k3: s.k3, m3: s.m3, s3: s.s3, sf: s.sf,
                },
                limit: s.limit || 30,
                patah: s.actual_patah ?? 0,
                days: Array.isArray(s.days) ? s.days[0] : s.days || "",
                activeCols: cfg.cols || [],
              });

            const activeColsApi = (cfg.cols || []).slice().sort((a, b) => a - b);
            const colsKey = JSON.stringify(activeColsApi);
            if (scanRef.current.items.some((x) => x.colsKey === colsKey)) continue;

            let ai = s.last_ai ?? "-";
            const patahVal = s.actual_patah ?? 0;
            let autoKey = s.rumus_key || "";

            const trackLogArr = s.track_log || [];
            if (trackLogArr.length > 0) {
              for (let li = trackLogArr.length - 1; li >= 0; li--) {
                const ln = trackLogArr[li];
                const mSum = ln.match(/^[a-z0-9/]{1,5}\s*:\s*([\d\s-]+)$/i);
                if (mSum && !ln.match(/^\d{4,}/)) {
                  const nat = mSum[1].trim();
                  if (nat && nat !== "-") { ai = nat; break; }
                }
              }
            }

            if (!autoKey) {
              const p = ["A", "C", "K", "E", "J", "Jt", "Jd", "Js", "J3D", "J4D"];
              let r = "";
              if (s.k1 !== undefined && s.k1 >= 0)
                r += (p[s.k1] || "?") + (s.m1 > 1 ? s.m1 : "") + (s.s1 && s.s1 !== "off" ? s.s1 : "");
              if (s.op1 && s.k2 !== undefined && s.k2 >= 0)
                r += s.op1 + (p[s.k2] || "?") + (s.m2 > 1 ? s.m2 : "") + (s.s2 && s.s2 !== "off" ? s.s2 : "");
              if (s.op2 && s.k3 !== undefined && s.k3 >= 0)
                r += s.op2 + (p[s.k3] || "?") + (s.m3 > 1 ? s.m3 : "") + (s.s3 && s.s3 !== "off" ? s.s3 : "");
              if (s.sf && s.sf !== "off") r += "." + s.sf;
              autoKey = r || "AUTO";
            }

            const trekText =
              "Key    : " + autoKey + "\n\n" + trackLogArr.join("\n") + "\n\n" +
              fCol.toUpperCase() + " : " + ai;

            item = {
              code,
              baris: s.limit ?? "-",
              patah: patahVal,
              ai,
              colsKey,
              trek_log: trekText,
              rumus_key: autoKey,
              market: market.toUpperCase(),
              days: (Array.isArray(s.days) ? s.days[0] : s.days) || "",
            };
            madeProgress = true;
            break;
          }

          setStatusText(`_> ANALISA RADAR [ ${Math.min(99, Math.round((scanRef.current.items.length / targetRms) * 100))}% ] — ${scanRef.current.items.length} MENYERAP... (try ${resp.attempts ?? 0})`);
          await new Promise((r) => setTimeout(r, 800));
        } else if (resp && resp.status === "error") {
          const msg = (resp.message || "").toLowerCase();
          const blocked =
            msg.includes("pemeliharaan") ||
            msg.includes("maintenance") ||
            msg.includes("limit") ||
            msg.includes("harus login") ||
            msg.includes("login");
          if (blocked) {
            setStatusText(`_> SCANNER ASLI ${msg.includes("limit") ? "DAILY LIMIT" : "MAINTENANCE"} → PARASIT LOKAL...`);
            localModeRef.current = true;
            continue;
          }
          setStatusText(`_> ${resp.message || "ERROR DARI SERVER"}`);
          localModeRef.current = true;
          continue;
        } else {
          // respons aneh/scanning terus → fallback lokal
          localModeRef.current = true;
          continue;
        }
      } else {
        // ── MODE B: engine lokal (filter_api) ──
        const formula = randomFormula();
        const state = buildState(market, {
          fCol,
          limit,
          patah: curMaxPatah,
          days: day,
          formula,
        });

        let resp;
        try {
          const res = await fetch("/api/rumus-otomatis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state),
          });
          resp = await res.json();
        } catch (err) {
          setStatusText(`_> KONEKSI ERROR : ${err.message}`);
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        if (!scanRef.current.active) {
          doFinish("stopped");
          return;
        }

        if (resp && resp.rows) {
          const activeCols = resp.activeCols || [];
          const evalRes = evaluateRows(resp.rows, activeCols, fCol, curMaxPatah);
          if (evalRes) {
            const sparePatah = patah - evalRes.patah;
            const colsKey = JSON.stringify([...activeCols].sort((a, b) => a - b));
            if (!scanRef.current.items.some((x) => x.colsKey === colsKey)) {
              item = {
                code: buildCode({ market, fCol, formula, limit, patah: sparePatah, days: day, activeCols }),
                baris: evalRes.rowsEval,
                patah: sparePatah,
                ai: evalRes.ai,
                colsKey,
                trek_log: buildTrekLog(resp.rows, activeCols, fCol, formula, evalRes.marks, evalRes.ai),
                rumus_key: formulaKey(formula),
                market: market.toUpperCase(),
                days: day,
              };
            }
          }
        }
      }

      if (item) {
        scanRef.current.items.push(item);
        setFoundItems([...scanRef.current.items]);
        try {
          localStorage.setItem("ln_sk_last_scan", JSON.stringify(scanRef.current.items));
        } catch {}
      }

      const pct = Math.min(99, Math.round((scanRef.current.items.length / targetRms) * 100));
      setProgress(pct);
      if (!localModeRef.current) {
        setStatusText(`_> ANALISA SCANNER ASLI [ ${pct}% ] — ${scanRef.current.items.length} MENYERAP...`);
      } else {
        setStatusText(
          `_> ANALISA RADAR [ ${pct}% ] — ${scanRef.current.items.length} MENYERAP... (iter ${scanRef.current.iter})`
        );
      }

      await new Promise((r) => setTimeout(r, localModeRef.current ? 350 : 800));
    }
  }, [market, fCol, digit, limit, patah, maxRumus, day, doFinish]);

  const handleScanClick = () => {
    if (cooldown > 0) return;
    if (isScanning) {
      scanRef.current.active = false;
      doFinish("stopped");
      return;
    }
    startScan();
  };

  const saveItem = (code) => {
    const item = foundItems.find((x) => x.code === code);
    if (!item) return;
    if (savedItems.some((s) => s.code === code)) return;
    const next = [...savedItems, { ...item, savedAt: Date.now() }];
    setSavedItems(next);
    try {
      localStorage.setItem("ln_sk_saved", JSON.stringify(next));
    } catch {}
  };

  const saveAllFound = () => {
    if (!foundItems.length) {
      alert("Tidak ada rumus di hasil scan.");
      return;
    }
    const next = [...savedItems];
    foundItems.forEach((item) => {
      if (!next.some((s) => s.code === item.code)) {
        next.push({ ...item, savedAt: Date.now() });
      }
    });
    setSavedItems(next);
    try {
      localStorage.setItem("ln_sk_saved", JSON.stringify(next));
    } catch {}
    setFoundItems([]);
    scanRef.current.items = [];
    try {
      localStorage.removeItem("ln_sk_last_scan");
    } catch {}
  };

  const deleteSaved = (code) => {
    const next = savedItems.filter((s) => s.code !== code);
    setSavedItems(next);
    try {
      localStorage.setItem("ln_sk_saved", JSON.stringify(next));
    } catch {}
  };

  const clearResults = () => {
    setFoundItems([]);
    scanRef.current.items = [];
    try {
      localStorage.removeItem("ln_sk_last_scan");
    } catch {}
  };

  const openTrek = (code) => {
    const item =
      foundItems.find((x) => x.code === code) || savedItems.find((x) => x.code === code);
    if (item && item.trek_log) setTrekLog(item.trek_log);
  };

  const typeLabel = (code) => parseCode(code).type;

  return (
    <main className={styles.scannerWrap}>
      <header className={styles.scannerHeader}>
        <h1>🛰️ Scanner Rumus Pro</h1>
        <p>Pencarian Rumus Algoritma v2.0 (Synchronized)</p>
        <div className={styles.headerNav}>
          <Link href="/" className={styles.navPill}>Generator LN</Link>
          <Link href="/riwayat" className={styles.navPill}>Riwayat</Link>
          <Link href="/uji-kinerja" className={styles.navPill}>Uji Kinerja</Link>
          <Link href="/rumus-otomatis" className={styles.navPill}>Rumus Otomatis</Link>
          <Link href="/scanner" className={styles.navPill}>️Scanner Pro</Link>
        </div>
      </header>

      <section className={styles.configPanel}>
        <div className={styles.configGrid}>
          <label className={styles.cfgField}>
            <span>Pasaran</span>
            <select value={market} onChange={(e) => setMarket(e.target.value)}>
              {SCANNER_MARKETS.map((m) => (
                <option key={m.val} value={m.val}>{m.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Rumus</span>
            <select value={fCol} onChange={(e) => setFCOL(e.target.value)}>
              {SCANNER_TARGETS.map((t) => (
                <option key={t.val} value={t.val}>{t.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Digit</span>
            <select value={digit} onChange={(e) => setDigit(parseInt(e.target.value, 10))}>
              {DIGIT_OPTIONS.map((d) => (
                <option key={d.val} value={d.val}>{d.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Limit</span>
            <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
              {LIMIT_OPTIONS.map((l) => (
                <option key={l.val} value={l.val}>{l.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Patah</span>
            <select value={patah} onChange={(e) => setPatah(parseInt(e.target.value, 10))}>
              {PATAH_OPTIONS.map((p) => (
                <option key={p.val} value={p.val}>{p.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Hari</span>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {DAY_OPTIONS.map((d) => (
                <option key={d.val} value={d.val}>{d.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Target Rumus</span>
            <select value={maxRumus} onChange={(e) => setMaxRumus(parseInt(e.target.value, 10))}>
              {MAX_RUMUS_OPTIONS.map((r) => (
                <option key={r.val} value={r.val}>{r.txt}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.controlRow}>
          <button
            type="button"
            onClick={handleScanClick}
            disabled={cooldown > 0}
            className={`${styles.btnScan} ${
              isScanning ? styles.btnScanStop : styles.btnScanStart
            }`}
          >
            {cooldown > 0 ? `⏳ ${cooldown}s...` : isScanning ? "⏹ STOP" : "🔍 SCAN"}
          </button>
          {foundItems.length > 0 && !isScanning && (
            <>
              <button type="button" onClick={saveAllFound} className={styles.btnSecondary}>
                💾 Simpan Semua ({foundItems.length})
              </button>
              <button type="button" onClick={clearResults} className={styles.btnDanger}>
                🗑 Bersihkan
              </button>
            </>
          )}
        </div>

        <div className={styles.progressArea}>
          <div className={styles.progressText}>{statusText}</div>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressBar} ${
                isScanning ? styles.progressBarActive : styles.progressBarDone
              }`}
              style={{ width: progress + "%" }}
            />
          </div>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <h2 className={styles.tableTitle}>⚡ HASIL SCANNER</h2>
        <div className={styles.tableScroll}>
          <table className={styles.scannerTable}>
            <thead>
              <tr>
                <th>RMS</th>
                <th>FORMULA</th>
                <th>PRED</th>
                <th>PJG</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {foundItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    {isScanning ? "Memulai pencarian rumus..." : "Klik SCAN untuk mencari rumus..."}
                  </td>
                </tr>
              ) : (
                foundItems.map((item, idx) => (
                  <tr key={idx} className={styles.rowItem}>
                    <td className={styles.cellType}>{typeLabel(item.code)}</td>
                    <td className={styles.cellFormula}>
                      <button
                        type="button"
                        className={styles.codeChip}
                        onClick={() => openTrek(item.code)}
                        title="Klik untuk lihat trek"
                      >
                        {item.rumus_key}
                      </button>
                    </td>
                    <td className={styles.cellPred}>{item.ai}</td>
                    <td className={styles.cellPjg}>{item.baris}</td>
                    <td className={styles.cellAction}>
                      {item.patah === 0 ? (
                        <span className={styles.badgeOk}>✓ ok</span>
                      ) : (
                        <span className={styles.badgeZone}>{item.patah}x</span>
                      )}
                      <button
                        type="button"
                        onClick={() => saveItem(item.code)}
                        disabled={savedItems.some((s) => s.code === item.code)}
                        className={styles.btnSave}
                        title="Simpan ke koleksi"
                      >
                        {savedItems.some((s) => s.code === item.code) ? "✓" : "💾"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.collectionPanel}>
        <h2 className={styles.tableTitle}>📚 KOLEKSI RUMUS SAYA ({savedItems.length})</h2>
        <div className={styles.tableScroll}>
          <table className={styles.scannerTable}>
            <thead>
              <tr>
                <th>RMS</th>
                <th>PRED</th>
                <th>PJG</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {savedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    Belum ada rumus yang disimpan.
                  </td>
                </tr>
              ) : (
                savedItems.map((item, idx) => (
                  <tr key={idx} className={styles.rowSaved}>
                    <td className={styles.cellType}>{typeLabel(item.code)}</td>
                    <td className={styles.cellPred}>{item.ai}</td>
                    <td className={styles.cellPjg}>{item.baris}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.codeChip}
                        onClick={() => openTrek(item.code)}
                      >
                        lihat trek
                      </button>
                    </td>
                    <td className={styles.cellAction}>
                      <button
                        type="button"
                        onClick={() => deleteSaved(item.code)}
                        className={styles.btnDelete}
                        title="Hapus dari koleksi"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className={styles.privateNote}>
          🏠 Pribadi: Koleksi rumus ini hanya tersimpan di browser Anda dan tidak dapat dilihat oleh
          siapapun termasuk admin.
        </p>
      </section>

      {trekLog && (
        <section className={styles.terminalPanel}>
          <div className={styles.terminalHead}>
            <h2>🖥️ HASIL TERMINAL</h2>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(trekLog);
              }}
              className={styles.btnCopyTrek}
            >
              📋 COPY
            </button>
          </div>
          <pre
            className={styles.terminalBody}
            dangerouslySetInnerHTML={{ __html: renderTrekHtml(trekLog) }}
          />
        </section>
      )}

      <section className={styles.infoPanel}>
        <h3>ℹ️ PUSAT INFORMASI</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <strong>🔷 Apa itu Scanner Rumus Pro?</strong>
            <p>
              Scanner menganalisis pola historis paito secara otomatis dengan mengeksplorasi jutaan
              kombinasi formula matematis (A, C, K, E, J + varian mistik) untuk menemukan rumus
              dengan track record stabil sesuai pasaran pilihan Anda.
            </p>
          </div>
          <div className={styles.infoItem}>
            <strong>⚙️ Bagaimana Cara Kerjanya?</strong>
            <p>
              Mesin bekerja secara acak bertingkat — setiap sesi menghasilkan kombinasi yang
              berbeda dan bersifat probabilistik. Proses melibatkan mesin komputasi berkecepatan
              tinggi yang berjalan paralel di server Angkanet.
            </p>
          </div>
          <div className={styles.infoItem}>
            <strong>💡 TIPS PRO</strong>
            <p>
              Gunakan Limit minimal <b>30 BRS</b> untuk memastikan stabilitas trek jangka panjang.
              Pilih pasaran yang rutin keluar setiap hari agar data history selalu segar.
            </p>
          </div>
        </div>
        <p className={styles.disclaimer}>
          <b>Disclaimer:</b> Hasil scanner bersifat analisa historis semata dan tidak menjamin hasil
          di masa depan. Gunakan sebagai hiburan.
        </p>
      </section>
    </main>
  );
}
