"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  MARKETS,
  DAYS,
  RUMUS_TARGETS,
  PATAH_OPTIONS,
  MISTIK_OPTIONS,
  ACC_OPTIONS,
} from "./constants";
import {
  decodeAcc,
  encodeFormulaCode,
  decodeFormulaCode,
  getHitColor,
} from "./decoder";
import styles from "./rumus.module.css";

export default function RumusOtomatisPage() {
  const [pasteCode, setPasteCode] = useState("");
  const [market, setMarket] = useState("sgp");
  const [day, setDay] = useState("");
  const [limit, setLimit] = useState(15);
  const [rumus, setRumus] = useState("ai");
  const [patah, setPatah] = useState(0);
  const [showRef, setShowRef] = useState(0);

  const [acc1, setAcc1] = useState("A1");
  const [opp1, setOpp1] = useState("+");
  const [acc2, setAcc2] = useState("");
  const [opp2, setOpp2] = useState("+");
  const [acc3, setAcc3] = useState("");
  const [mistik, setMistik] = useState("");

  const [isLocked, setIsLocked] = useState(false);
  const [lockedCols, setLockedCols] = useState([]);

  const [loading, setLoading] = useState(false);
  const [outputHtml, setOutputHtml] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const lastStateRef = useRef(null);

  const triggerCalculate = useCallback(
    async (overrideState = null) => {
      setLoading(true);

      const v1 = decodeAcc(overrideState ? overrideState.acc1 : acc1);
      const v2 = decodeAcc(overrideState ? overrideState.acc2 : acc2);
      const v3 = decodeAcc(overrideState ? overrideState.acc3 : acc3);

      const fCol = (overrideState ? overrideState.rumus : rumus).toLowerCase();
      const curMarket = overrideState ? overrideState.market : market;
      const curLimit = overrideState ? overrideState.limit : limit;
      const curDay = overrideState ? overrideState.day : day;
      const curPatah = overrideState ? overrideState.patah : patah;
      const curShowRef = overrideState ? overrideState.showRef : showRef;
      const curOp1 = overrideState ? overrideState.opp1 : opp1;
      const curOp2 = overrideState ? overrideState.opp2 : opp2;
      const curMistik = (overrideState ? overrideState.mistik : mistik) || "off";

      const statePayload = {
        market: curMarket,
        limit: parseInt(curLimit, 10) || 15,
        days: curDay ? [curDay] : [],
        patah: parseInt(curPatah, 10) || 0,
        fCol: fCol,
        k1: v1.k,
        m1: v1.m,
        s1: v1.s,
        op1: curOp1 || "+",
        k2: v2.k,
        m2: v2.m,
        s2: v2.s,
        op2: curOp2 || "+",
        k3: v3.k,
        m3: v3.m,
        s3: v3.s,
        sf: curMistik,
        hideEmpty: true,
        targetD: 0,
        showRef: curShowRef === 0 ? 0 : 1,
      };

      if (isLocked && lockedCols.length > 0) {
        statePayload._lockedCols = lockedCols;
      }

      lastStateRef.current = statePayload;

      try {
        const res = await fetch("/api/rumus-otomatis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(statePayload),
        });
        const data = await res.json();

        if (!data || !data.rows) {
          setOutputHtml("Gagal memuat baris data dari API.");
          setLoading(false);
          return;
        }

        let activeArr = isLocked && lockedCols.length > 0 ? lockedCols : data.activeCols || [];
        activeArr = [...activeArr].sort((a, b) => a - b);
        if (!isLocked && data.activeCols) {
          setLockedCols(data.activeCols);
        }

        const isShioGroup = ["s", "sd", "st"].includes(fCol);
        let formHeader = (overrideState ? overrideState.acc1 : acc1) || "";
        const curAcc2 = overrideState ? overrideState.acc2 : acc2;
        const curAcc3 = overrideState ? overrideState.acc3 : acc3;
        if (curAcc2) formHeader += curOp1 + curAcc2;
        if (curAcc3) formHeader += curOp2 + curAcc3;
        if (curMistik !== "off") formHeader += "." + curMistik;
        formHeader = formHeader.toLowerCase();

        const targetObj = RUMUS_TARGETS.find((r) => r.val === fCol);
        const targetName = targetObj ? targetObj.txt : fCol;
        const digitCount = activeArr.length;
        const descStr = `Rumus ${targetName} ${digitCount} Digit`;

        let htmlTxt = `<div style="font-size:14px; font-weight:bold; margin-bottom:8px;">${descStr}</div>`;
        htmlTxt += `<div style="margin-bottom: 15px;"><span style="color: #000; font-weight: 900; font-size: 15px;">KEY :</span> <span style="color: #0d9488; font-size: 16px; font-weight: 800; letter-spacing: 1px;">${formHeader}</span></div>\n`;

        data.rows.forEach((row, index) => {
          if (row.is_ref) {
            if (curShowRef === 0) return;
            htmlTxt += row.res + " :\n";
            return;
          }

          const isLastRow = index === data.rows.length - 1;
          const seqValuesHtml = [];
          let hasValidSeq = false;
          let rowHasHit = false;
          let hitsK = false;
          let hitsE = false;

          activeArr.forEach((idx) => {
            if (row.seq && row.seq[idx]) {
              hasValidSeq = true;
              const d = row.seq[idx];
              const valStr = isShioGroup ? String(d.v).padStart(2, "0") : String(d.v);
              const hitColor = !row.is_ref && !isLastRow ? getHitColor(d, fCol) : null;
              if (hitColor) {
                seqValuesHtml.push(
                  `<span style="color:${hitColor}; font-weight:800;">${valStr}</span>`
                );
                rowHasHit = true;
                if (d.h?.K) hitsK = true;
                if (d.h?.E) hitsE = true;
              } else {
                seqValuesHtml.push(`<span>${valStr}</span>`);
              }
            }
          });

          const seqStr = seqValuesHtml.join(isShioGroup ? ", " : "");
          let suffix = "";
          if (!row.is_ref && hasValidSeq && fCol) {
            if (isLastRow) {
              suffix = " ??";
            } else {
              const isRowSuccess = fCol === "ke" ? hitsK && hitsE : rowHasHit;
              if (!isRowSuccess) {
                suffix = ' <span style="color:red; font-weight:bold;">x</span>';
              } else {
                suffix = " " + fCol;
              }
            }
          }
          htmlTxt += row.res + " : " + seqStr + suffix + "\n";
        });

        let predictionStr = "";
        let digits = "";
        const fColStyledBot = fCol
          ? `<span style="color: #0d9488; font-size: 16px; font-weight: 800; letter-spacing: 1px;">${fCol}</span>`
          : "";

        if (data.rows.length > 0 && fCol) {
          const lastRow = data.rows[data.rows.length - 1];
          const dgArr = [];
          activeArr.forEach((idx) => {
            if (lastRow.seq && lastRow.seq[idx]) dgArr.push(lastRow.seq[idx].v);
          });
          if (fCol === "ke") {
            const possible = isShioGroup
              ? Array.from({ length: 12 }, (_, i) => i + 1)
              : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
            const lemah = possible.filter((n) => !dgArr.includes(n));
            digits = isShioGroup
              ? lemah.map((v) => String(v).padStart(2, "0")).join(", ")
              : lemah.join("");
            const lemahLabel = `<span style="color: #ef4444; font-size: 16px; font-weight: 800; letter-spacing: 1px;">ke lemah</span>`;
            predictionStr =
              lemah.length > 0
                ? `${lemahLabel} : ${digits}`
                : `${fColStyledBot} : Full (tidak ada lemah)`;
          } else {
            digits = isShioGroup
              ? dgArr.map((v) => String(v).padStart(2, "0")).join(", ")
              : dgArr.join("");
            predictionStr = `${fColStyledBot} : ${digits}`;
          }
        }

        if (predictionStr) htmlTxt += "\n" + predictionStr;

        setOutputHtml(htmlTxt);

        const enc = encodeFormulaCode(statePayload, activeArr);
        setOutputCode(enc);
      } catch (err) {
        setOutputHtml("Terjadi kesalahan koneksi ke Server: " + err.message);
      } finally {
        setLoading(false);
      }
    },
    [
      market,
      day,
      limit,
      rumus,
      patah,
      showRef,
      acc1,
      opp1,
      acc2,
      opp2,
      acc3,
      mistik,
      isLocked,
      lockedCols,
    ]
  );

  useEffect(() => {
    triggerCalculate();
  }, [
    market,
    day,
    limit,
    rumus,
    patah,
    showRef,
    acc1,
    opp1,
    acc2,
    opp2,
    acc3,
    mistik,
    triggerCalculate,
  ]);

  const handleNextPrev = (dir) => {
    const accList = ACC_OPTIONS.map((o) => o.val);
    const curIdx = accList.indexOf(acc1);
    let nextIdx = curIdx + dir;
    if (nextIdx >= accList.length) nextIdx = 1;
    if (nextIdx < 1) nextIdx = accList.length - 1;
    setAcc1(accList[nextIdx]);
  };

  const handleToggleLock = () => {
    if (!isLocked) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
      setLockedCols([]);
      triggerCalculate();
    }
  };

  const handleLoadCode = () => {
    if (!pasteCode.trim()) return;
    const decoded = decodeFormulaCode(pasteCode.trim());
    if (!decoded) {
      alert("Format kode rumus tidak valid!");
      return;
    }

    if (decoded.market) setMarket(decoded.market);
    if (decoded.fCol) setRumus(decoded.fCol);
    if (decoded.limit) setLimit(decoded.limit);
    if (decoded.patah !== undefined) setPatah(decoded.patah);
    if (decoded.days && decoded.days.length > 0) setDay(decoded.days[0]);

    const ksObj = ["A", "C", "K", "E", "J", "Jt", "Jd", "Js", "J3D", "J4D", "J5D"];
    const reK = (k) => (ksObj[k] ? ksObj[k] : "");
    const reS = (s) => (s && s !== "off" ? s : "");

    const v1 = decoded.k1 !== -1 ? reK(decoded.k1) + decoded.m1 + reS(decoded.s1) : "";
    const v2 = decoded.k2 !== -1 ? reK(decoded.k2) + decoded.m2 + reS(decoded.s2) : "";
    const v3 = decoded.k3 !== -1 ? reK(decoded.k3) + decoded.m3 + reS(decoded.s3) : "";

    setAcc1(v1);
    setOpp1(decoded.op1 || "+");
    setAcc2(v2);
    setOpp2(decoded.op2 || "+");
    setAcc3(v3);
    setMistik(decoded.sf && decoded.sf !== "off" ? decoded.sf : "");

    const maxCols = ["s", "sd", "st"].includes(decoded.fCol) ? 12 : 10;
    if (
      decoded.manualHidden &&
      decoded.manualHidden.length > 0 &&
      decoded.manualHidden.length < maxCols
    ) {
      setIsLocked(true);
      const hSet = new Set(decoded.manualHidden);
      const kept = [];
      for (let i = 0; i < maxCols; i++) {
        if (!hSet.has(i)) kept.push(i);
      }
      setLockedCols(kept);
    } else {
      setIsLocked(false);
      setLockedCols([]);
    }
  };

  const handleReset = () => {
    setPasteCode("");
    setMarket("sgp");
    setDay("");
    setLimit(15);
    setRumus("ai");
    setPatah(0);
    setShowRef(0);
    setAcc1("A1");
    setOpp1("+");
    setAcc2("");
    setOpp2("+");
    setAcc3("");
    setMistik("");
    setIsLocked(false);
    setLockedCols([]);
  };

  const copyText = (txt, label) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt);
      setCopyStatus(label);
      setTimeout(() => setCopyStatus(""), 1500);
    }
  };

  return (
    <main className={styles.rumusContainer}>
      <header className={styles.rumusHeader}>
        <h1>RUMUS OTOMATIS</h1>
        <p>Scan &amp; kalkulasi rumus akurasi tinggi otomatis dengan multi-market</p>
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.5rem" }}>
          <Link href="/" className="btn btnBlue">
            GENERATOR LN
          </Link>
          <Link href="/riwayat" className="btn btnBlue">
            RIWAYAT &amp; BACKTEST
          </Link>
          <Link href="/uji-kinerja" className="btn btnBlue">
            UJI KINERJA
          </Link>
        </div>
      </header>

      <div className={styles.toolbarPaste}>
        <input
          type="text"
          className={styles.inputCode}
          placeholder="🔍 Paste kode rumus..."
          value={pasteCode}
          onChange={(e) => setPasteCode(e.target.value)}
        />
        <button type="button" className={styles.btnLoad} onClick={handleLoadCode}>
          ⚡ LOAD
        </button>
        <button type="button" className={styles.btnReset} onClick={handleReset}>
          ↺ RESET
        </button>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.rowGroup}>
          <div className={styles.fieldItem} style={{ flex: 2 }}>
            <label className={styles.fieldLabel}>Pasaran</label>
            <select
              className={styles.selectInput}
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            >
              {MARKETS.map((m, idx) => (
                <option key={idx} value={m.val}>
                  {m.txt}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>Hari</label>
            <select
              className={styles.selectInput}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              {DAYS.map((d, idx) => (
                <option key={idx} value={d.val}>
                  {d.txt}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>Baris</label>
            <input
              type="number"
              className={styles.textInput}
              min="4"
              max="50"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>

          <div className={styles.fieldItem} style={{ flex: 1.5 }}>
            <label className={styles.fieldLabel}>Rumus Target</label>
            <select
              className={styles.selectInput}
              value={rumus}
              onChange={(e) => setRumus(e.target.value)}
            >
              {RUMUS_TARGETS.map((r, idx) => (
                <option key={idx} value={r.val}>
                  {r.txt}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>ZONK</label>
            <select
              className={styles.selectInput}
              value={patah}
              onChange={(e) => setPatah(e.target.value)}
            >
              {PATAH_OPTIONS.map((p, idx) => (
                <option key={idx} value={p.val}>
                  {p.txt}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>Referensi</label>
            <select
              className={styles.selectInput}
              value={showRef}
              onChange={(e) => setShowRef(parseInt(e.target.value, 10))}
            >
              <option value={0}>Sembunyi Referensi</option>
              <option value={1}>Tampil Referensi</option>
            </select>
          </div>
        </div>

        <div className={styles.formulaRow}>
          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>Key 1</label>
            <select
              className={styles.selectInput}
              value={acc1}
              onChange={(e) => setAcc1(e.target.value)}
            >
              {ACC_OPTIONS.map((a, idx) => (
                <option key={idx} value={a.val}>
                  {a.txt}
                </option>
              ))}
            </select>
          </div>

          <select
            className={styles.opSelect}
            value={opp1}
            onChange={(e) => setOpp1(e.target.value)}
          >
            <option value="+">+</option>
            <option value="-">-</option>
          </select>

          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>Key 2</label>
            <select
              className={styles.selectInput}
              value={acc2}
              onChange={(e) => setAcc2(e.target.value)}
            >
              {ACC_OPTIONS.map((a, idx) => (
                <option key={idx} value={a.val}>
                  {a.txt}
                </option>
              ))}
            </select>
          </div>

          <select
            className={styles.opSelect}
            value={opp2}
            onChange={(e) => setOpp2(e.target.value)}
          >
            <option value="+">+</option>
            <option value="-">-</option>
          </select>

          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>Key 3</label>
            <select
              className={styles.selectInput}
              value={acc3}
              onChange={(e) => setAcc3(e.target.value)}
            >
              {ACC_OPTIONS.map((a, idx) => (
                <option key={idx} value={a.val}>
                  {a.txt}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldItem}>
            <label className={styles.fieldLabel}>Mistik Global</label>
            <select
              className={styles.selectInput}
              value={mistik}
              onChange={(e) => setMistik(e.target.value)}
            >
              {MISTIK_OPTIONS.map((m, idx) => (
                <option key={idx} value={m.val}>
                  {m.txt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={styles.actionNavRow}>
        <div className={styles.navBtns}>
          <button
            type="button"
            className={styles.btnNav}
            onClick={() => handleNextPrev(-1)}
          >
            ◀ Prev
          </button>
          <button
            type="button"
            className={`${styles.btnNav} ${styles.btnNavNext}`}
            onClick={() => handleNextPrev(1)}
          >
            Next ▶
          </button>
        </div>

        <button
          type="button"
          className={`${styles.btnLock} ${
            isLocked ? styles.btnLockLocked : styles.btnLockUnlocked
          }`}
          onClick={handleToggleLock}
        >
          {isLocked ? "🔒 Terkunci" : "🔓 Terbuka"}
        </button>
      </div>

      <div className={styles.resultsCard}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#6366f1" }}>
            <strong>MEMPROSES PERHITUNGAN RUMUS...</strong>
          </div>
        ) : (
          <div
            className={styles.resultsTerminal}
            dangerouslySetInnerHTML={{ __html: outputHtml }}
          />
        )}

        <textarea
          className={styles.codeOutputArea}
          rows={1}
          readOnly
          value={outputCode}
          onClick={(e) => e.target.select()}
        />

        <div className={styles.bottomActionRow}>
          <button
            type="button"
            className={`${styles.btnActionCopy} ${styles.btnCopyRumus}`}
            onClick={() => {
              const el = document.querySelector(`.${styles.resultsTerminal}`);
              if (el) copyText(el.innerText, "RUMUS TERSALIN!");
            }}
          >
            {copyStatus === "RUMUS TERSALIN!" ? "✅ TERSALIN!" : "📋 COPY RUMUS"}
          </button>
          <button
            type="button"
            className={`${styles.btnActionCopy} ${styles.btnCopyCode}`}
            onClick={() => copyText(outputCode, "CODE TERSALIN!")}
          >
            {copyStatus === "CODE TERSALIN!" ? "✅ CODE TERSALIN!" : "💻 COPY CODE"}
          </button>
        </div>
      </div>
    </main>
  );
}
