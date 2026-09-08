"use client";

import { useState } from "react";
import { generate, parseInput } from "./algorithm";

const ALL_PAIRS = Array.from({ length: 100 }, (_, i) =>
  String(i).padStart(2, "0")
);

function Grid({ top, p1, p2, p3, p4, px }) {
  const topSet = new Set(top);
  const patahSet = new Set([...p1, ...p2, ...p3, ...p4, ...px]);

  return (
    <div className="gridWrap">
      {ALL_PAIRS.map((n) => {
        const cls =
          "cell" +
          (topSet.has(n) ? " cellTop" : "") +
          (patahSet.has(n) ? " cellPatah" : "");
        return (
          <div key={n} className={cls}>
            {n}
          </div>
        );
      })}
    </div>
  );
}

function Card({ title, count, items, accent }) {
  const [copied, setCopied] = useState(false);
  const val = items.join("*");

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(val);
    } catch {
      /* clipboard blocked (non-https) — ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className={"card card-" + accent}>
      <header className="cardHead">
        <h3>
          {title} <span className="cnt">= {count} LN</span>
        </h3>
        <button
          type="button"
          onClick={doCopy}
          className={"copyBtn" + (copied ? " copyBtnOk" : "")}
        >
          {copied ? "COPIED!" : "COPY LN"}
        </button>
      </header>
      <textarea readOnly value={val} rows={3} className="cardArea" />
    </section>
  );
}

export default function Page() {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function onChange(e) {
    setRaw(e.target.value.replace(/[^\d\n\r]/g, ""));
  }

  function doGenerate() {
    if (!parseInput(raw)) {
      alert("Masukkan result yang valid");
      return;
    }
    setBusy(true);
    // Brief delay for the "analysis" UX, then compute deterministically.
    setTimeout(() => {
      const r = generate(raw);
      setBusy(false);
      if (r.error) {
        alert(r.error);
        return;
      }

      // Self-check: partition must total exactly 100 with no duplicates.
      const all = [...r.top, ...r.p1, ...r.p2, ...r.p3, ...r.p4, ...r.px];
      const hasDup = new Set(all).size !== all.length;
      if (all.length !== 100 || hasDup) {
        console.warn(
          "[Generator LN] partition check failed: total=%d dup=%s",
          all.length,
          hasDup
        );
      }

      setResult(r);
    }, 600);
  }

  function doReset() {
    setRaw("");
    setResult(null);
    setBusy(false);
  }

  const top = result?.top ?? [];
  const p1 = result?.p1 ?? [];
  const p2 = result?.p2 ?? [];
  const p3 = result?.p3 ?? [];
  const p4 = result?.p4 ?? [];
  const px = result?.px ?? [];

  return (
    <main className="shell">
      <section className="heroWrap">
        <h1 className="title">GENERATOR LN</h1>
        <p className="subtitle">Analisa Result 4D → LN TOP &amp; Patah</p>
      </section>

      <section className="inputCard">
        <textarea
          value={raw}
          onChange={onChange}
          rows={4}
          inputMode="numeric"
          placeholder="Masukkan Result"
          className="inputArea"
        />
        <div className="btnRow">
          <button
            type="button"
            className="btn btnGreen"
            onClick={doGenerate}
            disabled={busy}
          >
            {busy ? "MEMPROSES…" : "GENERATE"}
          </button>
          <button
            type="button"
            className="btn btnGray"
            onClick={doReset}
            disabled={busy}
          >
            RESET
          </button>
        </div>
        {busy && <p className="loading">MEMPROSES ANALISA PREDIKSI...</p>}
      </section>

      {result && (
        <section className="resultPanel">
          {result.kress && (
            <p className="kressLine">
              <span className="kressLabel">Kress Ai:</span>{" "}
              <span className="kressVal">{result.kress}</span>
            </p>
          )}

          <Grid top={top} p1={p1} p2={p2} p3={p3} p4={p4} px={px} />

          {top.length > 0 && (
            <Card title="LN TOP" count={top.length} items={top} accent="green" />
          )}
          {p1.length > 0 && (
            <Card title="Patah 1" count={p1.length} items={p1} accent="red" />
          )}
          {p2.length > 0 && (
            <Card title="Patah 2" count={p2.length} items={p2} accent="red" />
          )}
          {p3.length > 0 && (
            <Card title="Patah 3" count={p3.length} items={p3} accent="red" />
          )}
          {p4.length > 0 && (
            <Card title="Patah 4" count={p4.length} items={p4} accent="red" />
          )}
          {px.length > 0 && (
            <Card title="Patah > 5" count={px.length} items={px} accent="red" />
          )}
        </section>
      )}

      <footer className="foot">
        Generator LN · by LuckyOne18
      </footer>
    </main>
  );
}
