"use client";

import { useState } from "react";
import Link from "next/link";
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
  const [lnMode, setLnMode] = useState("2"); // 2 = 2D (100 LN), 3 = 3D, 4 = 4D
  const [lnTwin, setLnTwin] = useState("1"); // "1" = Twin (default), "2" = No Twin
  const [showLN, setShowLN] = useState(false); // LN hidden until "TAMPILKAN LN"
  const [tardalDigits, setTardalDigits] = useState(""); // auto-filled from kress
  const [tardalToken, setTardalToken] = useState(0); // naik tiap generate -> auto tardal
  const [tardalOpen, setTardalOpen] = useState(false); // tardal terlihat setelah generate / tombol TARDAL

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
      const r = generate(
        raw,
        kressOpt === "" ? null : Number(kressOpt),
        Number(lnMode),
        lnTwin
      );
      setBusy(false);
      if (r.error) {
        alert(r.error);
        return;
      }

      // Self-check: partition must total exactly the pool size with no dupes.
      const all = [...r.top, ...r.p1, ...r.p2, ...r.p3, ...r.p4, ...r.px];
      const modeNum = Number(lnMode) === 3 || Number(lnMode) === 4 ? Number(lnMode) : 2;
      const expected = lnTwin === "2"
        ? modeNum === 2 ? 90 : modeNum === 3 ? 720 : 5040
        : 10 ** modeNum;
      const hasDup = new Set(all).size !== all.length;
      if (all.length !== expected || hasDup) {
        console.warn(
          "[Generator LN] partition check failed: total=%d expected=%d dup=%s",
          all.length,
          expected,
          hasDup
        );
      }

      setResult(r);
      setSelected(new Set()); // new result -> start a fresh selection
      setShowLN(false); // hasil cukup sampai Kress Ai; LN dibuka lewat tombol
      if (r.kress) {
        // Isi otomatis kotak TARDAL dengan digit kress (tanpa spasi)
        setTardalDigits(r.kress.replace(/\s/g, ""));
      }
      // Picu auto-generate tardal dari digit kress terbaru.
      setTardalToken((t) => t + 1);
      setTardalOpen(true); // tardal menjadi bagian dari hasil generate
    }, 600);
  }

  function doReset() {
    setRaw("");
    setResult(null);
    setSelected(new Set());
    setKressOpt("");
    setLnMode("2");
    setLnTwin("1");
    setShowLN(false);
    setTardalOpen(false);
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
        <div className="optRow">
          <label className="optLabel" htmlFor="lnMode">
            Pilih LN:
          </label>
          <select
            id="lnMode"
            className="optSelect"
            value={lnMode}
            onChange={(e) => setLnMode(e.target.value)}
          >
            <option value="2">2D (00–99) = 100 LN</option>
            <option value="3">3D (000–999) = 1.000 LN</option>
            <option value="4">4D (0000–9999) = 10.000 LN</option>
          </select>
        </div>
        <div className="optRow">
          <label className="optLabel" htmlFor="lnTwin">
            Mode Twin:
          </label>
          <select
            id="lnTwin"
            className="optSelect"
            value={lnTwin}
            onChange={(e) => setLnTwin(e.target.value)}
          >
            <option value="1">Twin (00–99) = pool penuh</option>
            <option value="2">No Twin = tanpa angka kembar</option>
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
          <button
            type="button"
            className={"btn btnInfo" + (tardalOpen ? " btnInfoActive" : "")}
            onClick={() => setTardalOpen((v) => !v)}
            title="Tampilkan/sembunyikan Generator Tardal"
          >
            TARDAL
          </button>
          <Link href="/uji-kinerja" className="btn btnBlue">
            UJI KINERJA
          </Link>
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

          <button
            type="button"
            className={"revealBtn" + (showLN ? " revealBtnOpen" : "")}
            onClick={() => setShowLN((v) => !v)}
          >
            {showLN ? "SEMBUNYIKAN LN" : "TAMPILKAN LN"}
          </button>

          {showLN && (
          <>
          {lnMode === "2" && (
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
          )}

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
          </>
          )}
        </section>
      )}

      {tardalOpen && (
        <TardalSection
          digits={tardalDigits}
          onDigitsChange={setTardalDigits}
          autoToken={tardalToken}
        />
      )}

      <footer className="foot">
        Generator LN ·{" "}
        <a href="https://unlaproject.my.id" className="footLink">
          unlaproject.my.id
        </a>
      </footer>
    </main>
  );
}
