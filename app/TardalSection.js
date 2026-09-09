"use client";

import { useEffect, useState } from "react";
import { autoTardal } from "./tardal";

export default function TardalSection({ digits, onDigitsChange, autoToken = 0 }) {
  const [type, setType] = useState("4"); // default 4D
  const [twin, setTwin] = useState("2"); // default No Twin
  const [splitter, setSplitter] = useState("*");
  const [output, setOutput] = useState(null); // { result, count, combos, sep } | null
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState(""); // cari angka di hasil

  function onChange(e) {
    const cleaned = e.target.value.replace(/[^\d]/g, "").slice(0, 15);
    onDigitsChange(cleaned);
  }

  function doGenerate(e) {
    e.preventDefault();
    const r = generateTardal({
      digits,
      type,
      twin,
      splitter,
    });
    if (r.error) {
      alert(r.error);
      return;
    }
    setOutput(r);
  }

  function doReset() {
    onDigitsChange("");
    setType("4");
    setTwin("2");
    setSplitter("*");
    setOutput(null);
    setCopied(false);
    setQuery("");
  }

  async function doCopy() {
    if (!show) return;
    try {
      await navigator.clipboard.writeText(show);
    } catch {
      /* clipboard blocked (non-https) — ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  // Search/filter over the generated combos (substring match, e.g. "12").
  const q = query.trim();
  const filtered = output
    ? q
      ? output.combos.filter((c) => c.includes(q))
      : output.combos
    : [];
  const show = output ? filtered.join(output.sep) : "";

  // Auto-generate: setiap Kress Ai di-generate ulang (autoToken naik),
  // tardal langsung dihitung dari digit terbaru dengan setelan saat ini.
  useEffect(() => {
    setOutput(autoTardal(digits, type, twin, splitter));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoToken]);

  return (
    <section className="inputCard" id="tardal">
      <h2 className="sectionTitle">GENERATOR TARDAL</h2>
      <p className="sectionHint">
        Digit Kress Ai terisi otomatis &amp; langsung di-generate — ubah angka
        atau setelan lalu klik Tardal untuk hitung ulang.
      </p>

      <form onSubmit={doGenerate} onReset={doReset}>
        <div className="tardalRow">
          <input
            type="text"
            inputMode="numeric"
            className="tardalInput"
            placeholder="TARDAL"
            maxLength={15}
            value={digits}
            onChange={onChange}
          />
          <select
            className="optSelect tardalSel"
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Panjang kombinasi"
          >
            <option value="2">2D</option>
            <option value="3">3D</option>
            <option value="4">4D</option>
          </select>
          <select
            className="optSelect tardalSel"
            value={twin}
            onChange={(e) => setTwin(e.target.value)}
            aria-label="Twin atau tidak"
          >
            <option value="1">Twin</option>
            <option value="2">No Twin</option>
          </select>
        </div>
        <div className="tardalRow tardalRow2">
          <select
            className="optSelect tardalSelSm"
            value={splitter}
            onChange={(e) => setSplitter(e.target.value)}
            aria-label="Pemisah output"
          >
            <option value="*">*</option>
            <option value="#">#</option>
            <option value=",">,</option>
          </select>
          <button type="submit" className="btn btnInfo tardalBtn">
            Tardal
          </button>
          <button type="reset" className="btn btnRed tardalBtn">
            Reset
          </button>
        </div>
      </form>

      {output && (
        <div className="tardalOut">
          <div className="searchRow">
            <input
              type="text"
              inputMode="numeric"
              className="searchInput"
              placeholder="Cari angka…"
              maxLength={4}
              value={query}
              onChange={(e) =>
                setQuery(e.target.value.replace(/[^\d]/g, "").slice(0, 4))
              }
              aria-label="Cari angka dari hasil tardal"
            />
            {query && (
              <button
                type="button"
                className="searchClear"
                onClick={() => setQuery("")}
                aria-label="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>
          <div className="tardalOutHead">
            <p className="tardalLine">
              {q
                ? `Ditemukan: ${filtered.length} dari ${output.count} LN`
                : `Total: ${output.count} LN`}
            </p>
            <button
              type="button"
              className={"copyBtn" + (copied ? " copyBtnOk" : "")}
              onClick={doCopy}
              disabled={!show}
            >
              {copied ? "COPIED!" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            rows={5}
            className="cardArea"
            value={show}
          />
        </div>
      )}
    </section>
  );
}
