"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const POOLS = [
  { key: "singapore", label: "Singapore", draw: "17:40 WIB" },
  { key: "sydney", label: "Sydney", draw: "13:50 WIB" },
  { key: "hongkong", label: "Hongkong", draw: "22:30 WIB" },
];

const ZONE_LABEL = {
  top: "TOP",
  p1: "Patah 1",
  p2: "Patah 2",
  p3: "Patah 3",
  p4: "Patah 4",
  px: "Patah >5",
};

export default function RiwayatPage() {
  const [pool, setPool] = useState("singapore");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/history?pool=${pool}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        if (alive) setData(j);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [pool]);

  const rows = (data?.rows || []).slice().reverse();
  const enriched = (data?.report?.enrichedRows || []).slice().reverse();
  const zr = data?.report?.lZoneRates || null;

  return (
    <main className="page">
      <h1 className="title">Riwayat &amp; Auto-Backtest</h1>
      <p className="subtitle">
        Result harian di-scrape otomatis dari paito, backtest dijalankan tiap update.
      </p>

      <div className="poolRow">
        {POOLS.map((p) => (
          <button
            key={p.key}
            className={`poolBtn ${pool === p.key ? "poolBtnActive" : ""}`}
            onClick={() => setPool(p.key)}
          >
            {p.label}
            <span className="poolDraw">{p.draw}</span>
          </button>
        ))}
      </div>

      {loading && <p className="muted">Memuat data…</p>}
      {error && <p className="errorText">Gagal memuat: {error}</p>}

      {data && !loading && (data.empty || !data.rows?.length) && (
        <div className="emptyBox">
          Belum ada data untuk {data.label}. Update otomatis berjalan sesuai jadwal
          result — kembali lagi setelah jam draw.
        </div>
      )}

      {data && !loading && data.rows?.length > 0 && (
        <>
          <div className="statGrid">
            <div className="statBox">
              <div className="statLabel">Total Result</div>
              <div className="statVal">{data.rows.length}</div>
              <div className="statSub">Update: {data.updatedAt || "-"} WIB</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Result Terakhir</div>
              <div className="statVal">
                {rows[0]?.result || "-"}
              </div>
              <div className="statSub">{rows[0]?.date || "-"}</div>
            </div>
            <div className="statBox">
              <div className="statLabel">Hit-rate Kress</div>
              <div className="statVal">
                {data.report?.kressRate !== undefined
                  ? `${data.report.kressRate.toFixed(1)}%`
                  : "-"}
              </div>
              <div className="statSub">
                {data.report?.steps ? `${data.report.steps} langkah` : "menunggu data"}
              </div>
            </div>
            <div className="statBox">
              <div className="statLabel">Streak</div>
              <div className="statVal">
                {data.report?.currentStreak?.len !== undefined
                  ? `${data.report.currentStreak.len}x ${data.report.currentStreak.type === "hit" ? "HIT" : "MISS"}`
                  : "-"}
              </div>
              <div className="statSub">
                max hit {data.report?.longestHit ?? "-"} / max miss{" "}
                {data.report?.longestMiss ?? "-"}
              </div>
            </div>
          </div>

          {zr && (
            <div className="zoneWrap">
              <h2 className="sectionTitle">Distribusi Zona LN (2D No Twin)</h2>
              <div className="zoneRow">
                {Object.entries(ZONE_LABEL).map(([z, label]) => (
                  <div key={z} className="zoneChip">
                    <span className="zoneName">{label}</span>
                    <span className="zonePct">{(zr[z] || 0).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="sectionTitle">Langkah Terakhir (terbaru dulu)</h2>
          <div className="tableWrap">
            <table className="histTable">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Sebelum</th>
                  <th>Result</th>
                  <th>Zona ekor vs partisi sebelumnya</th>
                </tr>
              </thead>
              <tbody>
                {enriched.slice(0, 30).map((r, i) => (
                  <tr key={`${r.date}-${i}`}>
                    <td>{r.date || "-"}</td>
                    <td className="mono">{r.prev}</td>
                    <td className="mono strong">{r.next}</td>
                    <td>
                      <span className={`zoneBadge zone-${r.zone}`}>
                        {ZONE_LABEL[r.zone] || r.zone || "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="navRow">
        <Link href="/" className="btn">
          ← Generator
        </Link>
        <Link href="/uji-kinerja" className="btn">
          Uji Kinerja Manual
        </Link>
      </div>
    </main>
  );
}
