"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import styles from "./rekap-manual.module.css";

const LS_SETS = "ln_rm_sets";
const LS_DEVICE = "ln_rm_device";

// Parse daftar angka dari input bebas: pisah * spasi koma ; | newline.
// Token kelipatan pas dari len dipotong (mis. "123456" → 12,34,56 utk len=2).
function parseList(raw, len) {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s.split(/[*\s,;|]+/).filter(Boolean);
  const out = [];
  for (const t of parts) {
    if (!/^\d+$/.test(t)) continue;
    if (len >= 1 && t.length > len && t.length % len === 0) {
      for (let i = 0; i < t.length; i += len) out.push(t.slice(i, i + len));
    } else {
      out.push(t);
    }
  }
  return out;
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return "rm-" + crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  }
  return "rm-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function RekapManualPage() {
  const [raw, setRaw] = useState({ front: "", back: "", mid: "", d3: "" });
  const [copiedKey, setCopiedKey] = useState(null);

  // Opsi Pembagi & 3D
  const [perBatch, setPerBatch] = useState(50);
  const [perBatch3D, setPerBatch3D] = useState(50);

  // ── Mode simpan (set angka) ──────────────────────────────────────
  const [sets, setSets] = useState([]);
  const [setName, setSetName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [syncCode, setSyncCode] = useState("");
  const [syncState, setSyncState] = useState("idle"); // idle|syncing|saved|error
  const [claimCode, setClaimCode] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [showSets, setShowSets] = useState(false);
  const [find4d, setFind4d] = useState("");
  const [find3d, setFind3d] = useState("");
  const setsRef = useRef([]);
  const initRef = useRef(false);

  const lists = useMemo(
    () => ({
      front: parseList(raw.front, 2),
      back: parseList(raw.back, 2),
      mid: parseList(raw.mid, 2),
      d3: parseList(raw.d3, 3),
    }),
    [raw]
  );

  const set = (k) => (e) => setRaw((p) => ({ ...p, [k]: e.target.value }));

  // ── 1. Konvolusi + filter → hasil 4D ──────────────────────────────
  const result4D = useMemo(() => {
    if (!lists.front.length || !lists.back.length) return [];
    const hit = [];
    for (const f of lists.front) {
      for (const b of lists.back) {
        const code = f + b;
        if (code.length !== 4) continue;
        if (lists.mid.length && !lists.mid.includes(code.slice(1, 3))) continue; // pos 2-3
        if (lists.d3.length && !lists.d3.includes(code.slice(1, 4))) continue; // pos 2-4
        hit.push(code);
      }
    }
    return [...new Set(hit)].sort((a, b) => Number(a) - Number(b));
  }, [lists]);

  // ── 2. Pembagi: potong jadi deret N angka ─────────────────────────
  const batches = useMemo(() => {
    if (!result4D.length) return [];
    const size = Math.max(1, parseInt(perBatch, 10) || 50);
    const out = [];
    for (let i = 0; i < result4D.length; i += size) out.push(result4D.slice(i, i + size));
    return out;
  }, [result4D, perBatch]);

  // ── 3. 3D creator: ambil posisi 2-4 (3 digit belakang) dari tiap 4D ──
  const result3D = useMemo(() => {
    if (!result4D.length) return [];
    const conv = result4D.map((n) => n.padStart(4, "0").slice(-3));
    return [...new Set(conv)].sort();
  }, [result4D]);

  // ── 4. Pembagi 3D: potong jadi deret N angka ──────────────────────
  const batches3D = useMemo(() => {
    if (!result3D.length) return [];
    const size = Math.max(1, parseInt(perBatch3D, 10) || 50);
    const out = [];
    for (let i = 0; i < result3D.length; i += size) out.push(result3D.slice(i, i + size));
    return out;
  }, [result3D, perBatch3D]);

  // ── Pencarian angka (temukan) ────────────────────────────────────
  const findResult = (query, list, batchList, batchSize) => {
    const tokens = parseList(query, 0);
    if (!tokens.length || !list.length) return null;
    const idxMap = new Map();
    list.forEach((n, i) => idxMap.set(n, i));
    const size = Math.max(1, parseInt(batchSize, 10) || 50);
    const rows = tokens.map((t) => {
      const idx = idxMap.has(t) ? idxMap.get(t) : -1;
      return {
        token: t,
        found: idx >= 0,
        position: idx >= 0 ? idx + 1 : 0,
        deret: idx >= 0 ? Math.floor(idx / size) + 1 : 0,
      };
    });
    return rows;
  };

  const find4dRows = useMemo(
    () => findResult(find4d, result4D, batches, perBatch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [find4d, result4D, batches, perBatch]
  );

  const find3dRows = useMemo(
    () => findResult(find3d, result3D, batches3D, perBatch3D),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [find3d, result3D, batches3D, perBatch3D]
  );

  // ── Persist set ke localStorage + server ─────────────────────────
  const persistSets = useCallback((next, thisDeviceId) => {
    setsRef.current = next;
    setSets(next);
    try {
      localStorage.setItem(LS_SETS, JSON.stringify(next));
    } catch { /* noop */ }
    if (!thisDeviceId) return;
    setSyncState("syncing");
    fetch("/api/rekap-manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: thisDeviceId, sets: next }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) {
          setSyncState("saved");
          if (d.syncCode) setSyncCode(d.syncCode);
        } else {
          setSyncState("error");
        }
      })
      .catch(() => setSyncState("error"));
  }, []);

  // ── Restore saat load: localStorage dulu (instan), lalu server ────
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem(LS_SETS) || "[]");
      if (Array.isArray(local) && local.length) {
        setsRef.current = local;
        setSets(local);
      }
    } catch { /* noop */ }

    let did = "";
    try {
      did = localStorage.getItem(LS_DEVICE) || "";
      if (!did) {
        did =
          (crypto.randomUUID && crypto.randomUUID().replace(/-/g, "").slice(0, 24)) ||
          ("d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
        localStorage.setItem(LS_DEVICE, did);
      }
    } catch {
      did = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    setDeviceId(did);

    fetch(`/api/rekap-manual?deviceId=${encodeURIComponent(did)}`)
      .then((r) => r.json())
      .then((d) => {
        if (initRef.current) return;
        initRef.current = true;
        if (d && d.syncCode) setSyncCode(d.syncCode);
        if (d && Array.isArray(d.sets)) {
          const serverCount = d.sets.length;
          const localCount = (() => {
            try { return JSON.parse(localStorage.getItem(LS_SETS) || "[]").length; } catch { return 0; }
          })();
          if (serverCount > localCount) {
            setsRef.current = d.sets;
            setSets(d.sets);
            try { localStorage.setItem(LS_SETS, JSON.stringify(d.sets)); } catch { /* noop */ }
          } else if (serverCount < localCount) {
            persistSets(setsRef.current, did);
          }
        }
      })
      .catch(() => { /* noop */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Simpan set input saat ini ────────────────────────────────────
  const saveCurrentSet = () => {
    const name = (setName || "").trim();
    if (!name) {
      setSaveMsg("⚠️ Isi nama set dulu.");
      setTimeout(() => setSaveMsg(""), 2500);
      return;
    }
    if (!raw.front.trim() && !raw.back.trim() && !raw.mid.trim() && !raw.d3.trim()) {
      setSaveMsg("⚠️ Tidak ada angka untuk disimpan.");
      setTimeout(() => setSaveMsg(""), 2500);
      return;
    }
    const entry = {
      id: genId(),
      name,
      front: raw.front,
      back: raw.back,
      mid: raw.mid,
      d3: raw.d3,
      savedAt: Date.now(),
    };
    persistSets([...setsRef.current, entry], deviceId);
    setSetName("");
    setSaveMsg("✓ Tersimpan");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  // ── Muat set ke input ────────────────────────────────────────────
  const loadSet = (s) => {
    setRaw({ front: s.front || "", back: s.back || "", mid: s.mid || "", d3: s.d3 || "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteSet = (id) => {
    persistSets(setsRef.current.filter((s) => s.id !== id), deviceId);
  };

  const renameSet = (id) => {
    const cur = setsRef.current.find((s) => s.id === id);
    if (!cur) return;
    const name = window.prompt("Nama baru untuk set ini:", cur.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    persistSets(
      setsRef.current.map((s) => (s.id === id ? { ...s, name: trimmed.slice(0, 80) } : s)),
      deviceId
    );
  };

  // ── Claim set dari device lain via kode sync ─────────────────────
  const doClaim = async () => {
    const code = claimCode.trim().toUpperCase();
    setClaimMsg("");
    if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) {
      setClaimMsg("Format kode: XXXX-XXXX (tanpa I/O/0/1)");
      return;
    }
    try {
      const res = await fetch(`/api/rekap-manual?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok || !data || !Array.isArray(data.sets)) {
        setClaimMsg(data?.error || "Kode sync tidak ditemukan.");
        return;
      }
      // merge: hindari duplikat id
      const exist = new Set(setsRef.current.map((s) => s.id));
      const merged = [...setsRef.current];
      data.sets.forEach((s) => {
        if (!exist.has(s.id)) merged.push(s);
      });
      persistSets(merged, deviceId);
      setClaimMsg(`✓ ${data.sets.length} set dimuat (${merged.length} total).`);
      setClaimCode("");
    } catch {
      setClaimMsg("Gagal menghubungi server.");
    }
  };

  const copyText = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* noop */ }
  };

  const clearAll = () => {
    setRaw({ front: "", back: "", mid: "", d3: "" });
    setCopiedKey(null);
  };

  const needInput = !lists.front.length || !lists.back.length;

  const syncBadge =
    syncState === "syncing" ? "⏳ sync…"
    : syncState === "saved" ? "☁️ tersimpan"
    : syncState === "error" ? "⚠️ offline (tersimpan lokal)"
    : "💾 lokal";

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1>🧮 REKAP MANUAL</h1>
        <p>Konvolusi manual dari angka TOP/CAD1/CAD2 → output 4D, lalu bagi jadi deret &amp; buat 3D</p>
        <div className={styles.navRow}>
          <Link href="/" className={styles.navPill}>Generator LN</Link>
          <Link href="/scanner" className={styles.navPill}>Scanner Pro</Link>
          <Link href="/pembagi" className={styles.navPill}>Pembagi Angka</Link>
          <Link href="/riwayat" className={styles.navPill}>Riwayat</Link>
          <Link href="/uji-kinerja" className={styles.navPill}>Uji Kinerja</Link>
          <Link href="/rumus-otomatis" className={styles.navPill}>Rumus Otomatis</Link>
        </div>
      </header>

      {/* ── Bar simpan / muat set ── */}
      <section className={styles.savePanel}>
        <div className={styles.saveRow}>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="Nama set (mis: SGP 04-10)"
            className={styles.saveNameInput}
            onKeyDown={(e) => { if (e.key === "Enter") saveCurrentSet(); }}
          />
          <button type="button" className={styles.btnSave} onClick={saveCurrentSet}>
            💾 SIMPAN SET
          </button>
          <span className={styles.syncBadge}>{syncBadge}</span>
          {saveMsg && <span className={styles.saveMsg}>{saveMsg}</span>}
        </div>

        <div className={styles.saveRow}>
          <button
            type="button"
            className={styles.btnToggleSets}
            onClick={() => setShowSets((v) => !v)}
          >
            {showSets ? "🔽 SEMBUNYIKAN SET" : "📂 TAMPILKAN SET"} ({sets.length})
          </button>
          <span className={styles.saveCount}>
            Tersimpan: <b>{sets.length}</b> set
            {syncCode ? <> · kode sync <b className={styles.codeText}>{syncCode}</b></> : null}
          </span>
          {syncCode && (
            <button
              type="button"
              className={styles.btnMini}
              onClick={() => copyText(syncCode, "sync")}
            >
              {copiedKey === "sync" ? "✓" : "📋 kode"}
            </button>
          )}
          <input
            type="text"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            placeholder="XXXX-XXXX (pindah device)"
            className={styles.claimInput}
            onKeyDown={(e) => { if (e.key === "Enter") doClaim(); }}
          />
          <button type="button" className={styles.btnMini} onClick={doClaim}>
            ⬇️ AMBIL
          </button>
        </div>
        {claimMsg && <div className={styles.claimMsg}>{claimMsg}</div>}

        {showSets && sets.length > 0 && (
          <div className={styles.setsGrid}>
            {sets.map((s) => {
              const c =
                (parseList(s.front, 2).length) + "/" +
                (parseList(s.back, 2).length);
              return (
                <div key={s.id} className={styles.setCard}>
                  <div className={styles.setCardHead}>
                    <span className={styles.setCardName} title={s.name}>{s.name}</span>
                    <span className={styles.setCardMeta}>D/B: {c}</span>
                  </div>
                  <div className={styles.setCardBody}>
                    <span>D: {s.front || "-"}</span>
                    <span>B: {s.back || "-"}</span>
                    {(s.mid || s.d3) && (
                      <span>T: {s.mid || "-"} · 3D: {s.d3 || "-"}</span>
                    )}
                  </div>
                  <div className={styles.setCardActions}>
                    <button type="button" className={styles.btnMiniPrimary} onClick={() => loadSet(s)}>
                      ⬆️ MUAT
                    </button>
                    <button type="button" className={styles.btnMini} onClick={() => renameSet(s.id)}>
                      ✏️
                    </button>
                    <button type="button" className={styles.btnMiniDanger} onClick={() => deleteSet(s.id)}>
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Input 4 kolom ── */}
      <section className={styles.inputPanel}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>① 2D ANGKA DEPAN (TOP/CAD…)</label>
            <textarea
              value={raw.front}
              onChange={set("front")}
              placeholder="12*34*56 atau 12 34 56"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Deretan angka 2D → sisi depan 4D.</span>
            <span className={styles.countChip}>{lists.front.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>② 2D ANGKA BELAKANG (TOP/CAD…)</label>
            <textarea
              value={raw.back}
              onChange={set("back")}
              placeholder="45*78"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Deretan angka 2D → sisi belakang 4D.</span>
            <span className={styles.countChip}>{lists.back.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>③ 2D TENGAH FILTER (posisi 2-3)</label>
            <textarea
              value={raw.mid}
              onChange={set("mid")}
              placeholder="74"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Filter keras: 4D harus punya posisi 2-3 = salah satu dari ini. Opsional.</span>
            <span className={styles.countChip}>{lists.mid.length} angka</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>④ 3D FILTER (posisi 2-4)</label>
            <textarea
              value={raw.d3}
              onChange={set("d3")}
              placeholder="745"
              rows={3}
              className={styles.inputArea}
            />
            <span className={styles.hintText}>Filter keras: 4D harus punya posisi 2-4 = salah satu dari ini. Opsional.</span>
            <span className={styles.countChip}>{lists.d3.length} angka</span>
          </div>
        </div>

        <div className={styles.ctrlRow}>
          <button type="button" className={styles.btnReset} onClick={clearAll}>
            🗑 KOSONGKAN
          </button>
          <span className={styles.statChip}>4D Sah: <b>{result4D.length}</b></span>
          {needInput && (
            <span className={styles.statChipWarn}>Butuh minimal 1 angka 2D depan &amp; 1 angka 2D belakang</span>
          )}
        </div>
      </section>

      {result4D.length > 0 && (
        <>
          {/* ── Panel 1: Hasil 4D ── */}
          <section className={styles.resultPanel}>
            <div className={styles.resultHead}>
              <h2>📦 HASIL 4D (LOLOS FILTER)</h2>
              <button type="button" className={styles.btnCopy} onClick={() => copyText(result4D.join("*"), "4d")}>
                {copiedKey === "4d" ? "✓ TERSALIN" : "📋 COPY"}
              </button>
            </div>
            <pre className={styles.terminalBody}>{result4D.join("*")}</pre>
            <div className={styles.findRow}>
              <input
                type="text"
                value={find4d}
                onChange={(e) => setFind4d(e.target.value)}
                placeholder="🔍 Temukan angka 4D (mis: 1745*2745 atau 1745 2745)"
                className={styles.findInput}
              />
              {find4d.trim() && find4dRows && (
                <span className={styles.findSummary}>
                  {find4dRows.filter((r) => r.found).length}/{find4dRows.length} ditemukan
                </span>
              )}
            </div>
            {find4dRows && find4dRows.length > 0 && (
              <div className={styles.findResults}>
                {find4dRows.map((r, i) => (
                  <div key={i} className={r.found ? styles.findHit : styles.findMiss}>
                    <span className={styles.findToken}>{r.token}</span>
                    {r.found ? (
                      <span className={styles.findInfo}>
                        ✓ ada · posisi <b>#{r.position}</b> · <b>DERET {r.deret}</b>
                      </span>
                    ) : (
                      <span className={styles.findInfo}>✗ tidak ada di hasil</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Panel 2: Pembagi (muncul hanya jika 4D > 400) ── */}
          {result4D.length > 400 && (
          <section className={styles.resultPanel}>
            <div className={styles.resultHead}>
              <h2>✂️ PEMBAGI 4D (PER DERET)</h2>
              <label className={styles.selLabel}>
                Angka per deret:
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={perBatch}
                  onChange={(e) => setPerBatch(e.target.value)}
                  className={styles.sizeInput}
                />
              </label>
              <button
                type="button"
                className={styles.btnCopy}
                onClick={() =>
                  copyText(batches.map((d, i) => `DERET ${i + 1}:\n${d.join("*")}`).join("\n\n"), "all")
                }
              >
                {copiedKey === "all" ? "✓ TERSALIN SEMUA" : "📋 COPY SEMUA DERET"}
              </button>
            </div>
            <div className={styles.hintText} style={{ marginBottom: "0.75rem" }}>
              Total <b>{result4D.length}</b> 4D → <b>{batches.length}</b> deret × maks <b>{Math.max(1, parseInt(perBatch, 10) || 50)}</b> angka
            </div>
            {batches.map((d, i) => (
              <div key={i} className={styles.deretCard}>
                <div className={styles.deretHead}>
                  <span className={styles.deretTitle}>DERET {i + 1}</span>
                  <span className={styles.deretCount}>{d.length} angka</span>
                  <button
                    type="button"
                    className={styles.btnCopyDeret}
                    onClick={() => copyText(d.join("*"), `d${i}`)}
                  >
                    {copiedKey === `d${i}` ? "✓" : "📋 COPY"}
                  </button>
                </div>
                <textarea readOnly value={d.join("*")} rows={Math.min(6, Math.max(2, Math.ceil(d.length / 25)))} className={styles.deretArea} />
              </div>
            ))}
          </section>
          )}

          {/* ── Panel 3: 3D Creator (selalu muncul) ── */}
          <section className={styles.resultPanel}>
            <div className={styles.resultHead}>
              <h2>🔢 PEMBUAT 3D (POSISI 2-4)</h2>
              <button type="button" className={styles.btnCopy} onClick={() => copyText(result3D.join("*"), "3d")}>
                {copiedKey === "3d" ? "✓ TERSALIN" : "📋 COPY"}
              </button>
            </div>
            <div className={styles.hintText} style={{ marginBottom: "0.75rem" }}>
              {result4D.length} 4D → <b>{result3D.length}</b> 3D unik (posisi 2-4)
            </div>
            <pre className={styles.terminalBody}>{result3D.join("*")}</pre>
            <div className={styles.findRow}>
              <input
                type="text"
                value={find3d}
                onChange={(e) => setFind3d(e.target.value)}
                placeholder="🔍 Temukan angka 3D (mis: 745*746 atau 745 746)"
                className={styles.findInput}
              />
              {find3d.trim() && find3dRows && (
                <span className={styles.findSummary}>
                  {find3dRows.filter((r) => r.found).length}/{find3dRows.length} ditemukan
                </span>
              )}
            </div>
            {find3dRows && find3dRows.length > 0 && (
              <div className={styles.findResults}>
                {find3dRows.map((r, i) => (
                  <div key={i} className={r.found ? styles.findHit : styles.findMiss}>
                    <span className={styles.findToken}>{r.token}</span>
                    {r.found ? (
                      <span className={styles.findInfo}>
                        ✓ ada · posisi <b>#{r.position}</b>
                        {result3D.length > 400 ? <> · <b>DERET {r.deret}</b></> : null}
                      </span>
                    ) : (
                      <span className={styles.findInfo}>✗ tidak ada di hasil</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Panel 4: Pembagi 3D (muncul hanya jika 3D > 400) ── */}
          {result3D.length > 400 && (
          <section className={styles.resultPanel}>
            <div className={styles.resultHead}>
              <h2>✂️ PEMBAGI 3D (PER DERET)</h2>
              <label className={styles.selLabel}>
                Angka per deret:
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={perBatch3D}
                  onChange={(e) => setPerBatch3D(e.target.value)}
                  className={styles.sizeInput}
                />
              </label>
              <button
                type="button"
                className={styles.btnCopy}
                onClick={() =>
                  copyText(batches3D.map((d, i) => `DERET ${i + 1}:\n${d.join("*")}`).join("\n\n"), "all3d")
                }
              >
                {copiedKey === "all3d" ? "✓ TERSALIN SEMUA" : "📋 COPY SEMUA DERET"}
              </button>
            </div>
            <div className={styles.hintText} style={{ marginBottom: "0.75rem" }}>
              Total <b>{result3D.length}</b> 3D → <b>{batches3D.length}</b> deret × maks <b>{Math.max(1, parseInt(perBatch3D, 10) || 50)}</b> angka
            </div>
            {batches3D.map((d, i) => (
              <div key={i} className={styles.deretCard}>
                <div className={styles.deretHead}>
                  <span className={styles.deretTitle}>DERET {i + 1}</span>
                  <span className={styles.deretCount}>{d.length} angka</span>
                  <button
                    type="button"
                    className={styles.btnCopyDeret}
                    onClick={() => copyText(d.join("*"), `d3d${i}`)}
                  >
                    {copiedKey === `d3d${i}` ? "✓" : "📋 COPY"}
                  </button>
                </div>
                <textarea readOnly value={d.join("*")} rows={Math.min(6, Math.max(2, Math.ceil(d.length / 25)))} className={styles.deretArea} />
              </div>
            ))}
          </section>
          )}
        </>
      )}
    </main>
  );
}
