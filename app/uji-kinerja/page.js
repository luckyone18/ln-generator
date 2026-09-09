"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseResults, runBacktest } from "../backtest";

const pct = (v) => (v == null ? "–" : v.toFixed(1) + "%");

export default function UjiKinerjaPage() {
  const [raw, setRaw] = useState("");
  const [kressOpt, setKressOpt] = useState("");
  const [lnMode, setLnMode] = useState("2");
  const [useLN, setUseLN] = useState(true);
  const [useTardal, setUseTardal] = useState(true);
  const [tardalType, setTardalType] = useState("4");
  const [tardalTwin, setTardalTwin] = useState("2");
  const [tardalSplitter, setTardalSplitter] = useState("*");
  const [ran, setRan] = useState(false);

  const parsed = useMemo(() => parseResults(raw), [raw]);
  const report = useMemo(() => {
    if (!ran) return null;
    return runBacktest(
      parsed.results,
      kressOpt === "" ? null : Number(kressOpt),
      {
        type: tardalType,
        twin: tardalTwin,
        splitter: tardalSplitter,
        enabled: useTardal,
      },
      { mode: lnMode, enabled: useLN }
    );
  }, [ran, parsed, kressOpt, lnMode, useLN, useTardal, tardalType, tardalTwin, tardalSplitter]);

  function onChange(e) {
    setRaw(e.target.value.replace(/[^\d\n\r\s]/g, ""));
    setRan(false);
  }

  function doRun() {
    if (parsed.results.length < 2) {
      alert("Minimal 2 result (8 digit) untuk menguji kinerja");
      return;
    }
    setRan(true);
  }

  function doReset() {
    setRaw("");
    setKressOpt("");
    setLnMode("2");
    setUseLN(true);
    setUseTardal(true);
    setTardalType("4");
    setTardalTwin("2");
    setTardalSplitter("*");
    setRan(false);
  }

  return (
    <main className="shell">
      <section className="heroWrap">
        <h1 className="title">UJI KINERJA</h1>
        <p className="subtitle">
          Backtest Kress Ai — seberapa sering digit kress muncul di result berikutnya
        </p>
      </section>

      <section className="inputCard">
        <textarea
          value={raw}
          onChange={onChange}
          rows={6}
          inputMode="numeric"
          placeholder={"Masukkan deret result 4D (urutan lama ke baru)\nContoh:\n5652 0521 5114 8906\n9648 4324 1891 4097"}
          className="inputArea"
        />
        <div className="parseInfo">
          {parsed.results.length > 0 && (
            <span>
              Terbaca: <b>{parsed.results.length}</b> result
              {parsed.leftover > 0 && (
                <span className="parseWarn"> · {parsed.leftover} digit sisa dibuang</span>
              )}
            </span>
          )}
        </div>
        <div className="optRow">
          <label className="optLabel" htmlFor="bkKressOpt">
            Jumlah Digit Kress Ai:
          </label>
          <select
            id="bkKressOpt"
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
          <label className="optLabel" htmlFor="bkLnMode">
            Pilih LN:
          </label>
          <select
            id="bkLnMode"
            className="optSelect"
            value={lnMode}
            onChange={(e) => setLnMode(e.target.value)}
            disabled={!useLN}
          >
            <option value="2">2D (00–99) = 100 LN</option>
            <option value="3">3D (000–999) = 1.000 LN</option>
            <option value="4">4D (0000–9999) = 10.000 LN</option>
          </select>
        </div>

        <div className="optRow">
          <label className="optLabel">Uji yang diaktifkan:</label>
          <div className="checkRow">
            <label className="checkItem">
              <input
                type="checkbox"
                checked={useLN}
                onChange={(e) => setUseLN(e.target.checked)}
              />
              <span>LN (TOP / Patah)</span>
            </label>
            <label className="checkItem">
              <input
                type="checkbox"
                checked={useTardal}
                onChange={(e) => setUseTardal(e.target.checked)}
              />
              <span>Tardal</span>
            </label>
          </div>
        </div>

        {useTardal && (
          <>
            <div className="sectionTitle">Setelan Tardal</div>
            <div className="tardalRow">
              <select
                aria-label="Tipe tardal"
                className="tardalSelect"
                value={tardalType}
                onChange={(e) => setTardalType(e.target.value)}
              >
                <option value="2">2D</option>
                <option value="3">3D</option>
                <option value="4">4D</option>
              </select>
              <select
                aria-label="Mode twin"
                className="tardalSelect"
                value={tardalTwin}
                onChange={(e) => setTardalTwin(e.target.value)}
              >
                <option value="1">Twin</option>
                <option value="2">No Twin</option>
              </select>
              <select
                aria-label="Pemisah"
                className="tardalSelect"
                value={tardalSplitter}
                onChange={(e) => setTardalSplitter(e.target.value)}
              >
                <option value="*">*</option>
                <option value="#">#</option>
                <option value=",">,</option>
              </select>
            </div>
            <p className="sectionHint">
              Kombinasi tardal dihitung dari digit Kress Ai tiap langkah, dianggap kena bila muncul pada posisi persis di result berikutnya.
            </p>
          </>
        )}

        <div className="btnRow">
          <button type="button" className="btn btnGreen" onClick={doRun}>
            UJI KINERJA
          </button>
          <button type="button" className="btn btnGray" onClick={doReset}>
            RESET
          </button>
        </div>
      </section>

      {report && !report.error && (
        <section className="resultPanel">
          <div className="statGrid">
            <div className="statBox statMain">
              <div className="statVal">{pct(report.kressRate)}</div>
              <div className="statLabel">Kress Hit Rate</div>
              <div className="statSub">
                {report.hits} hit dari {report.steps} langkah
              </div>
            </div>
            <div className="statBox">
              <div className="statVal">{pct(report.atLeastOneRate)}</div>
              <div className="statLabel">≥1 Digit Muncul</div>
              <div className="statSub">
                {report.atLeastOne} dari {report.steps} langkah
              </div>
            </div>
            <div className="statBox">
              <div className="statVal">
                {report.avgIn.toFixed(2)}
                <span className="statSmall">/{report.avgK.toFixed(2)}</span>
              </div>
              <div className="statLabel">Rata-rata Digit Kena</div>
              <div className="statSub">per langkah</div>
            </div>
          </div>

          <div className="statGrid statGrid3">
            <div className="statBox">
              <div className="statVal">{report.longestHit}×</div>
              <div className="statLabel">Hit Beruntun Terpanjang</div>
            </div>
            <div className="statBox">
              <div className="statVal">{report.longestMiss}×</div>
              <div className="statLabel">Miss Beruntun Terpanjang</div>
            </div>
            <div className="statBox">
              <div className="statVal">
                {report.currentStreak.type === "hit" ? "HIT" : "MISS"}{" "}
                {report.currentStreak.len}×
              </div>
              <div className="statLabel">Streak Terakhir</div>
            </div>
          </div>

          {useLN && report.lSteps > 0 && (
            <>
              <div className="sectionTitle">Kinerja LN ({report.lnOpt.mode}D)</div>
              <div className="statGrid statGrid3">
                <div className="statBox statMain">
                  <div className="statVal">{pct(report.lTopRate)}</div>
                  <div className="statLabel">Kena Zona TOP</div>
                  <div className="statSub">
                    {report.lTopHits} dari {report.lSteps} langkah
                  </div>
                </div>
                <div className="statBox">
                  <div className="statVal">{pct(report.lPatahRate)}</div>
                  <div className="statLabel">Kena Zona Patah</div>
                  <div className="statSub">
                    {report.lPatahHits} dari {report.lSteps} langkah
                  </div>
                </div>
                <div className="statBox">
                  <div className="statVal">{report.lnOpt.mode} digit</div>
                  <div className="statLabel">Ekor Result Dicek</div>
                  <div className="statSub">digit terakhir result berikutnya</div>
                </div>
              </div>
            </>
          )}

          {useTardal && (
            <>
              <div className="sectionTitle">Kinerja Tardal ({report.tOpt.type}D · {report.tOpt.twin === "1" ? "Twin" : "No Twin"})</div>
              {report.tSteps > 0 ? (
            <div className="statGrid statGrid3">
              <div className="statBox statMain">
                <div className="statVal">{pct(report.tHitRate)}</div>
                <div className="statLabel">Tardal Hit Rate</div>
                <div className="statSub">
                  {report.tHits} langkah kena dari {report.tSteps} teruji
                </div>
              </div>
              <div className="statBox">
                <div className="statVal">{report.tAvg.toFixed(2)}</div>
                <div className="statLabel">Rata-rata Kombinasi Kena</div>
                <div className="statSub">per langkah</div>
              </div>
              <div className="statBox">
                <div className="statVal">{report.tMax}</div>
                <div className="statLabel">Kombinasi Kena Terbanyak</div>
                <div className="statSub">dalam satu langkah</div>
              </div>
            </div>
              ) : (
                <p className="trendLine">
                  Tidak ada langkah tardal yang bisa diuji dengan setelan ini — coba pilih tipe lebih kecil (2D/3D) atau mode Twin.
                </p>
              )}
            </>
          )}

          {report.trend && (
            <p className="trendLine">
              Tren: paruh awal <b>{pct(report.trend.first)}</b> → paruh akhir{" "}
              <b>{pct(report.trend.second)}</b>{" "}
              <span className={report.trend.delta >= 0 ? "trendUp" : "trendDown"}>
                ({report.trend.delta >= 0 ? "▲ +" : "▼ "}
                {report.trend.delta.toFixed(1)} pp)
              </span>
            </p>
          )}
        </section>
      )}

      {report?.error && (
        <section className="resultPanel">
          <p className="tardalLine">{report.error}</p>
        </section>
      )}

      <footer className="foot">
        <Link href="/" className="footLink">
          ← Kembali ke Generator LN
        </Link>
        {" · "}
        Generator LN ·{" "}
        <a href="https://unlaproject.my.id" className="footLink">
          unlaproject.my.id
        </a>
      </footer>
    </main>
  );
}
