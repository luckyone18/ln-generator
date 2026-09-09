"use client";

import { useState } from "react";
import { generate, parseInput } from "./algorithm";
import TardalSection from "./TardalSection";

const ALL_PAIRS = Array.from({ length: 100 }, (_, i) =>
  String(i).padStart(2, "0")
);

function Grid({ top, p1, p2, p3, p4, px, selected, onToggle }) {
  const topSet = new Set(top);
  const patahSet = new Set([...p1, ...p2, ...p3, ...p4, ...px]);

  return (
    <div className="gridWrap">
      {ALL_PAIRS.map((n) => {
        const inResult = topSet.has(n) || patahSet.has(n);
        const cls =
          "cell" +
          (topSet.has(n) ? " cellTop" : "") +
          (patahSet.has(n) ? " cellPatah" : "") +
          (selected.has(n) ? " cellSel" : "") +
          (inResult ? " cellPick" : "");
        return (
          <div
            key={n}
            className={cls}
            onClick={inResult ? () => onToggle(n) : undefined}
            title={inResult ? "Klik untuk pilih " + n : undefined}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
}

function Card({ title, count, items, accent, selected, onToggle, onPickAll }) {
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
        <div className="cardBtns">
          <button
            type="button"
            onClick={() => onPickAll(items)}
            className="pickBtn"
            title="Pilih semua angka kartu ini"
          >
            PILIH
          </button>
          <button
            type="button"
            onClick={doCopy}
            className={"copyBtn" + (copied ? " copyBtnOk" : "")}
          >
            {copied ? "COPIED!" : "COPY LN"}
          </button>
        </div>
      </header>
      <textarea readOnly value={val} rows={3} className="cardArea" />
      <div className="chipRow">
        {items.map((n) => (
          <span
            key={n}
            className={"chip" + (selected.has(n) ? " chipSel" : "")}
            onClick={() => onToggle(n)}
          >
            {n}
          </span>
        ))}
      </div>
    </section>
  );
}

function SelectionPanel({ selected, onToggle, onClear }) {
  const [copied, setCopied] = useState(false);
  const items = [...selected];
  const val = items.join("*");

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(val);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section className="selPanel">
      <header className="selHead">
        <h3>
          ⭐ PILIHAN SAYA <span className="cnt">= {items.length} LN</span>
        </h3>
        <div className="cardBtns">
          <button type="button" onClick={doCopy} className={"copyBtn" + (copied ? " copyBtnOk" : "")}>
            {copied ? "COPIED!" : "COPY PILIHAN"}
          </button>
          <button type="button" onClick={onClear} className="pickBtn">
            KOSONGKAN
          </button>
        </div>
      </header>
      {items.length > 0 ? (
        <div className="chipRow">
          {items.map((n) => (
            <span
              key={n}
              className="chip chipSel"
              onClick={() => onToggle(n)}
              title="Klik untuk hapus dari pilahan"
            >
              {n} ✕
            </span>
          ))}
        </div>
      ) : (
        <p className="selHint">
          Klik angka di grid atau kartu di atas untuk menyusun pilihanmu.
        </p>
      )}
    </section>
  );
}

export default function Page() {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [kressOpt, setKressOpt] = useState(""); // "" = acak (3-6)

  function onChange(e) {
    setRaw(e.target.value.replace(/[^\d\n\r]/g, ""));
  }

  function toggleSel(n) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  function pickAll(items) {
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((x) => next.add(x));
      return next;
    });
  }

  function clearSel() {
    setSelected(new Set());
  }

  function doGenerate() {
    if (!parseInput(raw)) {
      alert("Masukkan result yang valid");
      return;
    }
    setBusy(true);
    // Brief delay for the "analysis" UX, then compute deterministically.
    setTimeout(() => {
      const r = generate(raw, kressOpt === "" ? null : Number(kressOpt));
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
      setSelected(new Set()); // new result -> start a fresh selection
    }, 600);
  }

  function doReset() {
    setRaw("");
    setResult(null);
    setSelected(new Set());
    setKressOpt("");
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
        <div className="optRow">
          <label className="optLabel" htmlFor="kressOpt">
            Jumlah Digit Kress Ai:
          </label>
          <select
            id="kressOpt"
            className="optSelect"
            value={kressOpt}
            onChange={(e) => setKressOpt(e.target.value)}
          >
            <option value="">Acak (3–6)</option>
            <option value="3">3 digit</option>
            <option value="4">4 digit</option>
            <option value="5">5 digit</option>
            <option value="6">6 digit</option>
            <option value="7">7 digit</option>
          </select>
        </div>
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

          <Grid
            top={top}
            p1={p1}
            p2={p2}
            p3={p3}
            p4={p4}
            px={px}
            selected={selected}
            onToggle={toggleSel}
          />

          <SelectionPanel
            selected={selected}
            onToggle={toggleSel}
            onClear={clearSel}
          />

          {top.length > 0 && (
            <Card
              title="LN TOP"
              count={top.length}
              items={top}
              accent="green"
              selected={selected}
              onToggle={toggleSel}
              onPickAll={pickAll}
            />
          )}
          {p1.length > 0 && (
            <Card
              title="Patah 1"
              count={p1.length}
              items={p1}
              accent="red"
              selected={selected}
              onToggle={toggleSel}
              onPickAll={pickAll}
            />
          )}
          {p2.length > 0 && (
            <Card
              title="Patah 2"
              count={p2.length}
              items={p2}
              accent="red"
              selected={selected}
              onToggle={toggleSel}
              onPickAll={pickAll}
            />
          )}
          {p3.length > 0 && (
            <Card
              title="Patah 3"
              count={p3.length}
              items={p3}
              accent="red"
              selected={selected}
              onToggle={toggleSel}
              onPickAll={pickAll}
            />
          )}
          {p4.length > 0 && (
            <Card
              title="Patah 4"
              count={p4.length}
              items={p4}
              accent="red"
              selected={selected}
              onToggle={toggleSel}
              onPickAll={pickAll}
            />
          )}
          {px.length > 0 && (
            <Card
              title="Patah > 5"
              count={px.length}
              items={px}
              accent="red"
              selected={selected}
              onToggle={toggleSel}
              onPickAll={pickAll}
            />
          )}
        </section>
      )}

      <TardalSection />

      <footer className="foot">Generator LN · by LuckyOne18</footer>
    </main>
  );
}
