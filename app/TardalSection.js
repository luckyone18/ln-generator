"use client";

import { useState } from "react";
import { generateTardal } from "./tardal";

export default function TardalSection({ digits, onDigitsChange }) {
  const [type, setType] = useState("2");
  const [twin, setTwin] = useState("1");
  const [splitter, setSplitter] = useState("*");
  const [output, setOutput] = useState(null); // { result, count } | null
  const [copied, setCopied] = useState(false);

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
    setType("2");
    setTwin("1");
    setSplitter("*");
    setOutput(null);
    setCopied(false);
  }

  async function doCopy() {
    if (!output?.result) return;
    try {
      await navigator.clipboard.writeText(output.result);
    } catch {
      /* clipboard blocked (non-https) — ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="inputCard" id="tardal">
      <h2 className="sectionTitle">GENERATOR TARDAL</h2>
      <p className="sectionHint">
        Digit Kress Ai dari hasil generate di atas terisi otomatis — ubah atau
        tambah angka sesuai keinginan.
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
          <div className="tardalOutHead">
            <p className="tardalLine">
              Total: {output.count} LN
            </p>
            <button
              type="button"
              className={"copyBtn" + (copied ? " copyBtnOk" : "")}
              onClick={doCopy}
            >
              {copied ? "COPIED!" : "Copy"}
            </button>
          </div>
          <textarea
            readOnly
            rows={5}
            className="cardArea"
            value={output.result}
          />
        </div>
      )}
    </section>
  );
}
