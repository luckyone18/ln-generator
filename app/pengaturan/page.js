"use client";
// /pengaturan — ubah seed domain Angkanet dari web (tanpa rombak kode/deploy).
// Simpan → tulis ke Supabase KV (ln/seed-domains) → scanner ikut domain baru.
import { useEffect, useState } from "react";
import styles from "../scanner/scanner.module.css";

export default function PengaturanPage() {
  const [secret, setSecret] = useState("");
  const [seeds, setSeeds] = useState("");
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("ln_admin_secret") || "";
    setSecret(s);
    if (s) load(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(sec = secret) {
    try {
      const r = await fetch("/api/settings/domains", {
        headers: { "x-update-secret": sec },
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(`⚠️ ${j.error || "gagal load"} — masukkan secret dulu.`);
        return;
      }
      setInfo(j);
      setSeeds(j.seeds.join("\n"));
      setMsg("");
    } catch (e) {
      setMsg(`⚠️ ${e.message}`);
    }
  }

  async function save() {
    const list = seeds.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
    if (!list.length) { setMsg("Isi minimal 1 URL seed."); return; }
    setBusy(true);
    setMsg("⏳ menyimpan + probe domain baru...");
    try {
      localStorage.setItem("ln_admin_secret", secret);
      const r = await fetch("/api/settings/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-update-secret": secret },
        body: JSON.stringify({ seeds: list }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(`❌ ${j.error || "gagal"}`);
      } else {
        setInfo(j);
        setSeeds(j.seeds.join("\n"));
        setMsg(
          j.probe?.ok
            ? `✅ Tersimpan. Domain baru merespons: ${j.probe.note}`
            : `✅ Tersimpan, TAPI probe gagal: ${j.probe?.error || "?"} — cek lagi URL-nya.`
        );
      }
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page} style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: "1.1rem" }}>⚙️ Pengaturan — Seed Domain Angkanet</h1>
      <p style={{ fontSize: "0.8rem", opacity: 0.75 }}>
        Kalau situs angkanet ganti domain (mis. angkanet30), tambah URL barunya di sini — scanner
        langsung ikut tanpa ubah kode. Seed lama biarkan tetap ada (masih 301 ke domain baru, jadi
        cadangan auto-follow).
      </p>

      <label style={{ display: "block", fontSize: "0.8rem", margin: "12px 0 4px" }}>
        Secret admin
      </label>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="UPDATE_SECRET_KEY"
        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
      />

      <label style={{ display: "block", fontSize: "0.8rem", margin: "12px 0 4px" }}>
        Seed domains (1 per baris)
      </label>
      <textarea
        value={seeds}
        onChange={(e) => setSeeds(e.target.value)}
        rows={5}
        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", fontFamily: "monospace" }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className={styles.btnTrend} onClick={save} disabled={busy}>
          {busy ? "⏳..." : "💾 SIMPAN"}
        </button>
        <button type="button" className={styles.btnRefresh} onClick={() => load()} disabled={busy}>
          🔄 Muat ulang
        </button>
      </div>

      {msg && <p style={{ fontSize: "0.8rem", marginTop: 10, whiteSpace: "pre-wrap" }}>{msg}</p>}

      {info && (
        <div style={{ fontSize: "0.75rem", marginTop: 14, padding: 10, background: "#f1f5f9", borderRadius: 8, fontFamily: "monospace" }}>
          Sumber seed aktif: {info.source}
          <br />
          Domain hasil discovery terakhir: {info.active_domain || "(belum ada — nanti otomatis saat scan)"}
          <br />
          KV: {info.kv_ready ? "✓ siap" : "✗ tidak tersedia"}
        </div>
      )}
    </main>
  );
}
