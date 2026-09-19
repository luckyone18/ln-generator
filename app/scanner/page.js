"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  SCANNER_MARKETS,
  SCANNER_TARGETS,
  DIGIT_OPTIONS,
  LIMIT_OPTIONS,
  PATAH_OPTIONS,
  MAX_RUMUS_OPTIONS,
  DAY_OPTIONS,
  TYPE_MAP,
} from "./constants";
import {
  buildState,
  randomFormula,
  formulaKey,
  evaluateRows,
  buildCode,
  buildTrekLog,
  streakFromMarks,
} from "./engine";
import { buildRekap, renderRekap, buildMergedTrek, buildRekap4D, renderRekap4D } from "./rekap";
import { renderTrend, buildStreaks } from "./trend";
import { decodeFormulaCode } from "../rumus-otomatis/decoder";
import styles from "./scanner.module.css";

function parseCode(code) {
  const m = code.match(/^#?([A-Za-z0-9]+)_([A-Za-z0-9]+)_/);
  if (!m) return { market: "", type: "AI" };
  return {
    market: m[1].toUpperCase(),
    type: TYPE_MAP[m[2].toLowerCase()] || m[2].toUpperCase(),
  };
}

function renderTrekHtml(raw) {
  let s = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  s = s.replace(
    /\[h\]([\s\S]*?)\[\/h\]/gi,
    '<span style="color:#10b981;font-weight:900;">$1</span>'
  );
  s = s.replace(
    /\[m\]([\s\S]*?)\[\/m\]/gi,
    '<span style="color:#ef4444;font-weight:900;">$1</span>'
  );
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "<b>$1</b>");
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "<i>$1</i>");
  return s;
}

export default function ScannerPage() {
  const [market, setMarket] = useState("sgp");
  const [fCol, setFCOL] = useState("ai");
  const [digit, setDigit] = useState(4);
  const [limit, setLimit] = useState(30);
  const [patah, setPatah] = useState(0);
  const [maxRumus, setMaxRumus] = useState(5);
  const [day, setDay] = useState("");

  const [isScanning, setIsScanning] = useState(false);
  const [foundItems, setFoundItems] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("_> SIAP MEMINDAI");
  const [trekLog, setTrekLog] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [checkedCodes, setCheckedCodes] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [engineMode, setEngineMode] = useState("idle"); // idle | original | local
  const [copied, setCopied] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMsg, setManualMsg] = useState("");
  const [refreshBusyCode, setRefreshBusyCode] = useState(null); // code yang sedang di-refresh
  const [bulkRefresh, setBulkRefresh] = useState(null); // { done, total, cur }
  const [editDayCode, setEditDayCode] = useState(null); // code yg sedang di-edit hari (null = tampil teks)

  // ── Bank Rumus (opsi A: anonymous device ID + sync code) ────────
  const [showTiers, setShowTiers] = useState("top"); // top | cad12 | all
  const [poolFilter, setPoolFilter] = useState(""); // "" = semua pool
  const [dayFilter, setDayFilter] = useState(""); // "" = semua hari
  const [favOnly, setFavOnly] = useState(false); // tampilkan hanya favorit
  const [colSearch, setColSearch] = useState(""); // cari kode/rumus/pred

  // Daftar pool unik dari koleksi (urut abjad)
  const pools = useMemo(
    () =>
      [...new Set(savedItems.map((s) => String(s.market || "?").toUpperCase()).filter(Boolean))].sort(),
    [savedItems]
  );
  // Normalisasi nama hari (case-insensitive thd DAY_OPTIONS; tak dikenal → apa adanya)
  const dayList = DAY_OPTIONS.filter((d) => d.val).map((d) => d.val);
  const normDay = (v) => {
    const t = String(v || "").trim();
    if (!t) return "";
    const hit = dayList.find((d) => d.toLowerCase() === t.toLowerCase());
    return hit || t;
  };
  // Daftar hari unik dari koleksi (urutan kalender Senin–Minggu, tak dikenal di akhir)
  const days = useMemo(
    () =>
      [...new Set(savedItems.map((s) => normDay(s.days)).filter(Boolean))].sort((a, b) => {
        const ia = dayList.indexOf(a);
        const ib = dayList.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedItems]
  );
  // Koleksi tampil = filter pool + hari aktif (+ opsi favorit saja + search)
  const visibleItems = useMemo(() => {
    let list = poolFilter
      ? savedItems.filter((s) => String(s.market || "?").toUpperCase() === poolFilter)
      : savedItems;
    if (dayFilter) list = list.filter((s) => normDay(s.days) === dayFilter);
    if (favOnly) list = list.filter((s) => s.fav);
    const q = colSearch.trim().toLowerCase();
    if (q)
      list = list.filter(
        (s) =>
          String(s.code || "").toLowerCase().includes(q) ||
          String(s.rumus_key || "").toLowerCase().includes(q) ||
          String(s.ai || "").toLowerCase().includes(q)
      );
    return list;
  }, [savedItems, poolFilter, dayFilter, favOnly, colSearch]);
  // Buang centang rumus yang tidak lagi terlihat setelah filter berubah
  const pruneChecked = (pool, day) => {
    setCheckedCodes((prev) => {
      if (!prev.length) return prev;
      const stillVisible = new Set(
        savedItems
          .filter(
            (s) =>
              (!pool || String(s.market || "?").toUpperCase() === pool) &&
              (!day || normDay(s.days) === day)
          )
          .map((s) => s.code)
      );
      return prev.filter((c) => stillVisible.has(c));
    });
  };
  const [deviceId, setDeviceId] = useState("");
  const [syncCode, setSyncCode] = useState("");
  const [syncState, setSyncState] = useState("idle"); // idle | syncing | saved | error
  const [packages, setPackages] = useState([]); // [{ id, name, codes[], createdAt }]
  const packagesRef = useRef([]); // mirror utk persist yg selalu fresh
  const [newPkgName, setNewPkgName] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMsg, setClaimMsg] = useState("");

  const scanRef = useRef({ active: false, items: [], iter: 0 });
  const localModeRef = useRef(false);
  const bankInitRef = useRef(false);

  const persistCollection = useCallback((next, thisDeviceId) => {
    try {
      localStorage.setItem("ln_sk_saved", JSON.stringify(next));
    } catch {}
    if (!thisDeviceId) return;
    const packs = packagesRef.current || [];
    setSyncState("syncing");
    fetch("/api/scanner-collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: thisDeviceId, items: next, packages: packs }),
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

  // Restore koleksi saat load: localStorage dulu (instan), lalu server (paling baru).
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem("ln_sk_saved") || "[]");
      if (Array.isArray(local) && local.length) setSavedItems(local);
    } catch {}

    let did = "";
    try {
      did = localStorage.getItem("ln_sk_device") || "";
      if (!did) {
        did =
          (crypto.randomUUID && crypto.randomUUID().replace(/-/g, "").slice(0, 24)) ||
          ("d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
        localStorage.setItem("ln_sk_device", did);
      }
    } catch {
      did = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }
    setDeviceId(did);

    fetch(`/api/scanner-collection?deviceId=${encodeURIComponent(did)}`)
      .then((r) => r.json())
      .then((d) => {
        if (bankInitRef.current) return;
        bankInitRef.current = true;
        if (d && Array.isArray(d.packages)) {
          setPackages(d.packages);
          packagesRef.current = d.packages;
        }
        if (d && Array.isArray(d.items) && d.syncCode) {
          setSyncCode(d.syncCode);
          const serverCount = d.items.length;
          const localCount = JSON.parse(localStorage.getItem("ln_sk_saved") || "[]").length;
          if (serverCount > localCount) {
            setSavedItems(d.items);
            try {
              localStorage.setItem("ln_sk_saved", JSON.stringify(d.items));
            } catch {}
          } else if (serverCount < localCount) {
            persistCollection(JSON.parse(localStorage.getItem("ln_sk_saved") || "[]"), did);
          }
        } else if (d && d.syncCode) {
          setSyncCode(d.syncCode);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doFinish = useCallback((reason) => {
    scanRef.current.active = false;
    setIsScanning(false);
    if (reason === "stopped") {
      setStatusText(`_> DIHENTIKAN : ${scanRef.current.items.length} RUMUS`);
    } else if (reason === "timeout") {
      setStatusText("_> TIMEOUT : BATAS WAKTU TERCAPAI");
    } else {
      setStatusText(`_> PEMINDAIAN SELESAI : ${scanRef.current.items.length} RUMUS`);
    }
    setProgress(100);
    let cd = 3;
    setCooldown(cd);
    const iv = setInterval(() => {
      cd -= 1;
      setCooldown(cd);
      if (cd <= 0) clearInterval(iv);
    }, 1000);
  }, []);

  const startScan = useCallback(async () => {
    scanRef.current = { active: true, items: [], iter: 0 };
    localModeRef.current = false; // reset: coba asli dulu tiap scan baru
    setEngineMode("original");
    setIsScanning(true);
    setFoundItems([]);
    setTrekLog("");
    setProgress(0);
    setStatusText("_> ANALISA RADAR [ 0% ] — 0 MENYERAP...");

    const MAX_ITER = 400;
    const TIMEOUT_MS = 180000;
    const startTime = Date.now();
    const targetRms = parseInt(maxRumus, 10) || 5;

    const buildParams = (isFirst) => ({
      hub_action: "scanner_api",
      market,
      fCol,
      limit,
      patah,
      targetD: digit,
      days: day ? [day] : [],
      is_first: isFirst ? "1" : "0",
    });

    while (scanRef.current.active) {
      scanRef.current.iter += 1;

      if (scanRef.current.items.length >= targetRms) {
        doFinish("done");
        return;
      }
      if (scanRef.current.iter > MAX_ITER) {
        doFinish("timeout");
        return;
      }
      if (Date.now() - startTime > TIMEOUT_MS) {
        doFinish("timeout");
        return;
      }

      // ── HYBRID ENGINE ────────────────────────────────────────────────
      // Mode A (asli): coba endpoint scanner_api Angkanet (identik dengan situs).
      // Jika maintenance, kena daily limit, atau response bermasalah → otomatis
      // pindah Mode B (lokal): generate formula acak deterministik via filter_api.
      const curMaxPatah = parseInt(patah, 10) || 0;

      let item = null;

      if (!localModeRef.current) {
        // ── MODE A: scanner_api asli ──
        let resp;
        try {
          const res = await fetch("/api/scanner", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildParams(scanRef.current.iter === 1)),
          });
          resp = await res.json();
        } catch (err) {
          setStatusText(`_> SCM ERROR, PARASIT → LOKAL: ${err.message}`);
          localModeRef.current = true;
          setEngineMode("local");
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        if (!scanRef.current.active) {
          doFinish("stopped");
          return;
        }

        if (resp && resp.status === "success" && (resp.configs || resp.config)) {
          const itemsToProcess = resp.configs || [resp.config];
          let madeProgress = false;
          for (const cfg of itemsToProcess) {
            if (scanRef.current.items.length >= targetRms) break;
            if (!cfg || !cfg.state) continue;
            const s = cfg.state;

            let code = s.rumus_code ||
              buildCode({
                market,
                fCol,
                formula: {
                  k1: s.k1, m1: s.m1, s1: s.s1, op1: s.op1,
                  k2: s.k2, m2: s.m2, s2: s.s2, op2: s.op2,
                  k3: s.k3, m3: s.m3, s3: s.s3, sf: s.sf,
                },
                limit: s.limit || 30,
                patah: s.actual_patah ?? 0,
                days: Array.isArray(s.days) ? s.days[0] : s.days || "",
                activeCols: cfg.cols || [],
              });

            const activeColsApi = (cfg.cols || []).slice().sort((a, b) => a - b);
            const colsKey = JSON.stringify(activeColsApi);
            if (scanRef.current.items.some((x) => x.colsKey === colsKey)) continue;

            let ai = s.last_ai ?? "-";
            const patahVal = s.actual_patah ?? 0;
            let autoKey = s.rumus_key || "";

            const trackLogArr = s.track_log || [];
            if (trackLogArr.length > 0) {
              for (let li = trackLogArr.length - 1; li >= 0; li--) {
                const ln = trackLogArr[li];
                const mSum = ln.match(/^[a-z0-9/]{1,5}\s*:\s*([\d\s-]+)$/i);
                if (mSum && !ln.match(/^\d{4,}/)) {
                  const nat = mSum[1].trim();
                  if (nat && nat !== "-") { ai = nat; break; }
                }
              }
            }

            if (!autoKey) {
              const p = ["A", "C", "K", "E", "J", "Jt", "Jd", "Js", "J3D", "J4D"];
              let r = "";
              if (s.k1 !== undefined && s.k1 >= 0)
                r += (p[s.k1] || "?") + (s.m1 > 1 ? s.m1 : "") + (s.s1 && s.s1 !== "off" ? s.s1 : "");
              if (s.op1 && s.k2 !== undefined && s.k2 >= 0)
                r += s.op1 + (p[s.k2] || "?") + (s.m2 > 1 ? s.m2 : "") + (s.s2 && s.s2 !== "off" ? s.s2 : "");
              if (s.op2 && s.k3 !== undefined && s.k3 >= 0)
                r += s.op2 + (p[s.k3] || "?") + (s.m3 > 1 ? s.m3 : "") + (s.s3 && s.s3 !== "off" ? s.s3 : "");
              if (s.sf && s.sf !== "off") r += "." + s.sf;
              autoKey = r || "AUTO";
            }

            const trekText =
              "Key    : " + autoKey + "\nCode   : " + code + "\n\n" + trackLogArr.join("\n") + "\n\n" +
              fCol.toUpperCase() + " : " + ai;

            item = {
              code,
              baris: s.limit ?? "-",
              patah: patahVal,
              ai,
              colsKey,
              trek_log: trekText,
              rumus_key: autoKey,
              type: TYPE_MAP[fCol] || fCol.toUpperCase(),
              market: market.toUpperCase(),
              days: (Array.isArray(s.days) ? s.days[0] : s.days) || day || "",
              source: "original",
            };
            madeProgress = true;
            break;
          }

          setStatusText(`_> ANALISA RADAR [ ${Math.min(99, Math.round((scanRef.current.items.length / targetRms) * 100))}% ] — ${scanRef.current.items.length} MENYERAP... (try ${resp.attempts ?? 0})`);
          await new Promise((r) => setTimeout(r, 800));
        } else if (resp && resp.status === "error") {
          const msg = (resp.message || "").toLowerCase();
          const blocked =
            msg.includes("pemeliharaan") ||
            msg.includes("maintenance") ||
            msg.includes("limit") ||
            msg.includes("harus login") ||
            msg.includes("login");
          if (blocked) {
            setStatusText(`_> SCANNER ASLI ${msg.includes("limit") ? "DAILY LIMIT" : "MAINTENANCE"} → PARASIT LOKAL...`);
            localModeRef.current = true;
          setEngineMode("local");
            continue;
          }
          setStatusText(`_> ${resp.message || "ERROR DARI SERVER"}`);
          localModeRef.current = true;
          setEngineMode("local");
          continue;
        } else {
          // respons aneh/scanning terus → fallback lokal
          localModeRef.current = true;
          setEngineMode("local");
          continue;
        }
      } else {
        // ── MODE B: engine lokal (filter_api) — PARALLEL BATCH ──
        // Evaluasi beberapa formula acak sekaligus per tick (bukan 1 per round-trip),
        // buang bottleneck serial + sleep lama → scan jauh lebih cepat.
        const PARALLEL = 5;
        const batch = [];
        for (let bi = 0; bi < PARALLEL; bi++) {
          const formula = randomFormula();
          batch.push({
            formula,
            state: buildState(market, {
              fCol,
              limit,
              patah: curMaxPatah,
              days: day,
              formula,
            }),
          });
        }

        let responses = [];
        try {
          responses = await Promise.all(
            batch.map((b) =>
              fetch("/api/rumus-otomatis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(b.state),
              })
                .then((r) => r.json())
                .catch(() => null)
            )
          );
        } catch (err) {
          setStatusText(`_> KONEKSI ERROR : ${err.message}`);
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        if (!scanRef.current.active) {
          doFinish("stopped");
          return;
        }

        const collected = [];
        for (let bi = 0; bi < batch.length; bi++) {
          const resp = responses[bi];
          const formula = batch[bi].formula;
          if (!resp || !resp.rows) continue;
          const activeCols = resp.activeCols || [];
          // ENFORCE: jumlah digit prediksi harus = target DIGIT (spt scanner asli targetD)
          if (activeCols.length !== digit) continue; // formula menghasilkan N digit lain → ditolak
          const evalRes = evaluateRows(resp.rows, activeCols, fCol, curMaxPatah);
          if (!evalRes) continue;
          const sparePatah = patah - evalRes.patah;
          const colsKey = JSON.stringify([...activeCols].sort((a, b) => a - b));
          if (scanRef.current.items.some((x) => x.colsKey === colsKey)) continue;
          const stk = streakFromMarks(evalRes.marks);
          collected.push({
            code: buildCode({ market, fCol, formula, limit, patah: sparePatah, days: day, activeCols }),
            baris: evalRes.rowsEval,
            patah: sparePatah,
            ai: evalRes.ai,
            streak: stk.streak,
            streakType: stk.streakType,
            colsKey,
            trek_log: buildTrekLog(resp.rows, activeCols, fCol, formula, evalRes.marks, evalRes.ai, buildCode({ market, fCol, formula, limit, patah: sparePatah, days: day, activeCols })),
            rumus_key: formulaKey(formula),
            type: TYPE_MAP[fCol] || fCol.toUpperCase(),
            market: market.toUpperCase(),
            days: day,
            source: "local",
          });
        }
        if (collected.length) {
          scanRef.current.items.push(...collected);
          setFoundItems([...scanRef.current.items]);
          try {
            localStorage.setItem("ln_sk_last_scan", JSON.stringify(scanRef.current.items));
          } catch {}
        }
        item = null; // sudah di-push oleh blok parallel
      }

      if (item) {
        scanRef.current.items.push(item);
        setFoundItems([...scanRef.current.items]);
        try {
          localStorage.setItem("ln_sk_last_scan", JSON.stringify(scanRef.current.items));
        } catch {}
      }

      const pct = Math.min(99, Math.round((scanRef.current.items.length / targetRms) * 100));
      setProgress(pct);
      if (!localModeRef.current) {
        setStatusText(`_> ANALISA SCANNER ASLI [ ${pct}% ] — ${scanRef.current.items.length} MENYERAP...`);
      } else {
        setStatusText(
          `_> ANALISA RADAR [ ${pct}% ] — ${scanRef.current.items.length} MENYERAP... (iter ${scanRef.current.iter})`
        );
      }

      await new Promise((r) => setTimeout(r, localModeRef.current ? 350 : 800));
    }
  }, [market, fCol, digit, limit, patah, maxRumus, day, doFinish]);

  const handleScanClick = () => {
    if (cooldown > 0) return;
    if (isScanning) {
      scanRef.current.active = false;
      doFinish("stopped");
      return;
    }
    startScan();
  };

  const saveItem = (code) => {
    const item = foundItems.find((x) => x.code === code);
    if (!item) return;
    if (savedItems.some((s) => s.code === code)) return;
    const next = [...savedItems, { ...item, savedAt: Date.now() }];
    setSavedItems(next);
    persistCollection(next, deviceId);
  };

  const saveAllFound = () => {
    if (!foundItems.length) {
      alert("Tidak ada rumus di hasil scan.");
      return;
    }
    const next = [...savedItems];
    foundItems.forEach((item) => {
      if (!next.some((s) => s.code === item.code)) {
        next.push({ ...item, savedAt: Date.now() });
      }
    });
    setSavedItems(next);
    persistCollection(next, deviceId);
    setFoundItems([]);
    scanRef.current.items = [];
    try {
      localStorage.removeItem("ln_sk_last_scan");
    } catch {}
  };

  const deleteSaved = (code) => {
    const next = savedItems.filter((s) => s.code !== code);
    setSavedItems(next);
    persistCollection(next, deviceId);
  };

  const clearResults = () => {
    setFoundItems([]);
    scanRef.current.items = [];
    try {
      localStorage.removeItem("ln_sk_last_scan");
    } catch {}
  };

  const openTrek = (code) => {
    const item =
      foundItems.find((x) => x.code === code) || savedItems.find((x) => x.code === code);
    if (item && item.trek_log) setTrekLog(item.trek_log);
  };

  // ── Checkbox koleksi ──────────────────────────────────────────────
  const toggleCheck = (code) => {
    setCheckedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // ── Favorit (tandai rumus yang disukai) ───────────────────────────
  const toggleFav = (code) => {
    const next = savedItems.map((s) =>
      s.code === code ? { ...s, fav: !s.fav } : s
    );
    setSavedItems(next);
    persistCollection(next, deviceId);
  };

  // ── Atur hari item koleksi (kolom HARI, persist via sync) ─────────
  const setItemDay = (code, day) => {
    const next = savedItems.map((s) =>
      s.code === code ? { ...s, days: day } : s
    );
    setSavedItems(next);
    persistCollection(next, deviceId);
  };

  // ── Bank Rumus: Paket Gabungan (simpan grup rumus tercentang) ──────
  const syncPackages = (packs, items) => {
    setPackages(packs);
    packagesRef.current = packs;
    // simpan ke localStorage + server (pakai savedItems saat ini kecuali di-override)
    const cur = Array.isArray(items) ? items : savedItems;
    try {
      localStorage.setItem("ln_sk_saved", JSON.stringify(cur));
    } catch {}
    if (deviceId) {
      setSyncState("syncing");
      fetch("/api/scanner-collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, items: cur, packages: packs }),
      })
        .then((r) => r.json())
        .then((d) => setSyncState(d && d.ok ? "saved" : "error"))
        .catch(() => setSyncState("error"));
    }
  };

  const savePackage = (name) => {
    const codes = [...checkedCodes];
    if (!codes.length) {
      alert("Centang dulu minimal 1 rumus di Koleksi utk dibuat paket.");
      return;
    }
    const id =
      "pkg-" +
      (crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 14)
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    const packs = [
      ...packagesRef.current,
      { id, name: String(name || "Paket").trim() || "Paket", codes, createdAt: Date.now() },
    ];
    syncPackages(packs);
  };

  const renamePackage = (id, name) => {
    const packs = packagesRef.current.map((p) =>
      p.id === id ? { ...p, name: String(name || p.name).trim() || p.name } : p
    );
    syncPackages(packs);
  };

  const deletePackage = (id) => {
    const packs = packagesRef.current.filter((p) => p.id !== id);
    syncPackages(packs);
  };

  const loadPackage = (id) => {
    const p = packagesRef.current.find((x) => x.id === id);
    if (!p) return;
    // Centang rumus yang ada di paket (dan masih tersimpan)
    const exist = new Set(savedItems.map((s) => s.code));
    const hits = p.codes.filter((c) => exist.has(c));
    setCheckedCodes(hits);
    setSelectAll(false);
    alert(`✅ Paket "${p.name}": ${hits.length} dari ${p.codes.length} rumus dicentang.`);
  };

  const clearChecked = () => {
    setCheckedCodes([]);
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll || checkedCodes.length === visibleItems.length) {
      setCheckedCodes([]);
      setSelectAll(false);
    } else {
      setCheckedCodes(visibleItems.map((s) => s.code));
      setSelectAll(true);
    }
  };

  const deleteChecked = () => {
    if (!checkedCodes.length) return;
    const next = savedItems.filter((s) => !checkedCodes.includes(s.code));
    setSavedItems(next);
    setCheckedCodes([]);
    setSelectAll(false);
    persistCollection(next, deviceId);
  };

  // ── Rekap Rumus (dari formula tercentang) ─────────────────────────
  const doRekap = () => {
    if (!checkedCodes.length) {
      alert("Pilih minimal 1 rumus di Koleksi untuk membuat Rekap.");
      return;
    }
    const formulas = checkedCodes
      .map((code) =>
        savedItems.find((x) => x.code === code) || foundItems.find((x) => x.code === code)
      )
      .filter(Boolean)
      .map((item) => ({
        code: item.code,
        type: item.type || "AI",
        ai: item.ai,
      }));
    const impl = buildRekap(formulas);
    setTrekLog(renderRekap(formulas, impl));
  };

  // ── Rekap 4D (AID depan + AI belakang) ─────────────────────────────
  const doRekap4D = () => {
    if (!checkedCodes.length) {
      alert("Pilih minimal 1 rumus AI dan 1 rumus AID di Koleksi untuk Rekap 4D.");
      return;
    }
    const items = checkedCodes
      .map((code) =>
        savedItems.find((x) => x.code === code) || foundItems.find((x) => x.code === code)
      )
      .filter(Boolean);
    const typ = (t) => String(t || "").toUpperCase();
    const hasFront = items.some((x) => ["AID", "AD", "AI 2D DEPAN"].includes(typ(x.type)));
    const hasBack = items.some((x) => ["AI", "AI 2D BELAKANG"].includes(typ(x.type)));
    if (!hasFront || !hasBack) {
      alert(
        "Rekap 4D butuh minimal 1 rumus AID (2D depan) dan 1 rumus AI (2D belakang) yang dicentang."
      );
      return;
    }
    const impl = buildRekap4D(items);
    setTrekLog(renderRekap4D(impl, showTiers));
  };

  // ── Claim koleksi via kode sync (pindah device) ───────────────────
  const doClaim = async () => {
    const raw = claimCode.trim().toUpperCase();
    setClaimMsg("");
    if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(raw)) {
      setClaimMsg("Format kode: XXXX-XXXX (huruf & angka tanpa I/O/0/1)");
      return;
    }
    setClaimBusy(true);
    try {
      const res = await fetch(`/api/scanner-collection?code=${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!res.ok || !data || !Array.isArray(data.items)) {
        setClaimMsg(data?.error || "Kode sync tidak ditemukan.");
        return;
      }
      const merged = [...data.items];
      const current = JSON.parse(localStorage.getItem("ln_sk_saved") || "[]");
      current.forEach((it) => {
        if (!merged.some((m) => m.code === it.code)) merged.push(it);
      });
      const next = merged.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
      setSavedItems(next);
      try {
        localStorage.setItem("ln_sk_saved", JSON.stringify(next));
      } catch {}
      persistCollection(next, deviceId);
      setClaimMsg(
        `✓ ${data.items.length} rumus diambil dari kode ${raw}` +
          (current.length ? ` + ${current.length} lokal digabung` : "")
      );
      setClaimCode("");
    } catch (err) {
      setClaimMsg("Error koneksi: " + err.message);
    } finally {
      setClaimBusy(false);
    }
  };

  // ── Trek Gabungan (max 10 rumus) ──────────────────────────────────
  const doMergedTrek = () => {
    if (!checkedCodes.length) {
      alert("Pilih minimal 1 rumus di Koleksi untuk Trek Gabungan.");
      return;
    }
    const items = checkedCodes
      .map((code) =>
        savedItems.find((x) => x.code === code) || foundItems.find((x) => x.code === code)
      )
      .filter(Boolean);
    if (items.length > 10) {
      alert("Maksimal 10 rumus untuk Trek Gabungan.");
      return;
    }
    setTrekLog(buildMergedTrek(items));
  };

  // ── Trend Gabungan (analisa tren koleksi) ─────────────────────────
  const doTrend = () => {
    // Analisa rumus tercentang; jika tidak ada, seluruh koleksi
    let items = checkedCodes
      .map((code) =>
        savedItems.find((x) => x.code === code) || foundItems.find((x) => x.code === code)
      )
      .filter(Boolean);
    if (!items.length) items = savedItems;
    if (!items.length) {
      alert("Koleksi masih kosong — scan & simpan rumus dulu untuk analisa tren.");
      return;
    }
    setTrekLog(renderTrend(items));
  };

  // Trend satu rumus dari tombol 📈 di kolom STATUS (Bank Rumus)
  const doTrendOne = (item) => {
    if (!item || !item.code) return;
    setTrekLog(renderTrend([item]));
  };

  // ── Copy isi terminal ke clipboard ───────────────────────────────
  const copyTerminal = async () => {
    if (!trekLog) return;
    try {
      await navigator.clipboard.writeText(trekLog);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback untuk browser lama / non-secure context
      try {
        const ta = document.createElement("textarea");
        ta.value = trekLog;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert("Gagal copy — copy manual dari terminal.");
      }
    }
  };

  // ── Tambah rumus manual (paste kode) ──────────────────────────────
  const doAddManual = async () => {
    const raw = manualCode.trim();
    setManualMsg("");
    if (!raw) {
      setManualMsg("Masukkan kode rumus dulu (contoh: #SGP_ai_Km5+C6mb_L15-P0-D0_ACDE)");
      return;
    }
    const cfg = decodeFormulaCode(raw);
    if (!cfg || !cfg.market || !cfg.fCol) {
      setManualMsg("Kode tidak valid — format: #MARKET_TYPE_FORMULA_L15-P0-D0_ABCD");
      return;
    }
    setManualBusy(true);
    try {
      // aktif = komplemen manualHidden
      const isShio = ["s", "st", "sd"].includes(cfg.fCol);
      const maxCols = isShio ? 12 : 10;
      const activeCols = [];
      for (let i = 0; i < maxCols; i++) if (!(cfg.manualHidden || []).includes(i)) activeCols.push(i);

      // fetch paito & flag hit via proxy rumus-otomatis
      const state = {
        market: cfg.market,
        limit: cfg.limit || 15,
        days: cfg.days || [],
        patah: 0,
        fCol: cfg.fCol,
        k1: cfg.k1, m1: cfg.m1, s1: cfg.s1, op1: cfg.op1 || "+",
        k2: cfg.k2 ?? -1, m2: cfg.m2 ?? 1, s2: cfg.s2 ?? "off", op2: cfg.op2 || "+",
        k3: cfg.k3 ?? -1, m3: cfg.m3 ?? 1, s3: cfg.s3 ?? "off",
        sf: cfg.sf || "off",
        hideEmpty: true,
        targetD: 0,
        showRef: 0,
        manualHidden: cfg.manualHidden || [],
        isFrozen: true,
      };
      const res = await fetch("/api/rumus-otomatis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const resp = await res.json();
      if (!resp || !resp.rows || resp.rows.length < 2) {
        setManualMsg("Gagal memuat data paito untuk rumus ini. Coba lagi.");
        return;
      }

      const evalRes = evaluateRows(resp.rows, activeCols, cfg.fCol, 99);
      if (!evalRes) {
        setManualMsg("Data paito terlalu sedikit untuk dievaluasi.");
        return;
      }

      const formula = {
        k1: cfg.k1, m1: cfg.m1, s1: cfg.s1,
        op1: cfg.op1 || "+",
        k2: cfg.k2 ?? -1, m2: cfg.m2 ?? 1, s2: cfg.s2 ?? "off",
        op2: cfg.op2 || "+",
        k3: cfg.k3 ?? -1, m3: cfg.m3 ?? 1, s3: cfg.s3 ?? "off",
        sf: cfg.sf || "off",
      };
      const code = raw.startsWith("#") ? raw : "#" + raw;
      const stk = streakFromMarks(evalRes.marks);
      const item = {
        code,
        baris: evalRes.rowsEval,
        patah: evalRes.patah,
        ai: evalRes.ai,
        streak: stk.streak,
        streakType: stk.streakType,
        colsKey: JSON.stringify([...activeCols].sort((a, b) => a - b)),
        trek_log: buildTrekLog(resp.rows, activeCols, cfg.fCol, formula, evalRes.marks, evalRes.ai, code),
        rumus_key: formulaKey(formula),
        type: TYPE_MAP[cfg.fCol] || cfg.fCol.toUpperCase(),
        market: cfg.market.toUpperCase(),
        days: (cfg.days && cfg.days[0]) || "",
        source: "manual",
      };

      // dedup: kalau kode sama sudah ada, tolak
      if (savedItems.some((x) => x.code === code)) {
        setManualMsg("Rumus ini sudah ada di koleksi.");
        return;
      }
      const next = [item, ...savedItems];
      setSavedItems(next);
      persistCollection(next, deviceId);
      setManualCode("");
      setManualMsg(`✓ Rumus ${item.rumus_key} ditambahkan (patah ${evalRes.patah}, ai ${evalRes.ai})`);
    } catch (err) {
      setManualMsg(`Error: ${err.message}`);
    } finally {
      setManualBusy(false);
    }
  };

  // ── Hitung ulang item dari paito terbaru (dipakai refresh tunggal & massal) ──
  // Return { ok:true, freshItem, evalRes } atau { ok:false, error }. Kode rumus tetap.
  const computeFreshItem = async (item) => {
    const code = item.code;
    const cfg = decodeFormulaCode(code.replace(/^#/, ""));
    if (!cfg || !cfg.market || !cfg.fCol) {
      return { ok: false, error: "Kode rumus tidak dapat diparsing utk refresh." };
    }
    try {
      // aktif = komplemen manualHidden
      const isShio = ["s", "st", "sd"].includes(cfg.fCol);
      const maxCols = isShio ? 12 : 10;
      const activeCols = [];
      for (let i = 0; i < maxCols; i++) if (!(cfg.manualHidden || []).includes(i)) activeCols.push(i);

      const state = {
        market: cfg.market,
        limit: cfg.limit || 15,
        days: cfg.days || [],
        patah: 0,
        fCol: cfg.fCol,
        k1: cfg.k1, m1: cfg.m1, s1: cfg.s1, op1: cfg.op1 || "+",
        k2: cfg.k2 ?? -1, m2: cfg.m2 ?? 1, s2: cfg.s2 ?? "off", op2: cfg.op2 || "+",
        k3: cfg.k3 ?? -1, m3: cfg.m3 ?? 1, s3: cfg.s3 ?? "off",
        sf: cfg.sf || "off",
        hideEmpty: true,
        targetD: 0,
        showRef: 0,
        manualHidden: cfg.manualHidden || [],
        isFrozen: true,
      };
      const res = await fetch("/api/rumus-otomatis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const resp = await res.json();
      if (!resp || !resp.rows || resp.rows.length < 2) {
        return { ok: false, error: "Gagal memuat data paito terbaru. Coba lagi." };
      }
      const evalRes = evaluateRows(resp.rows, activeCols, cfg.fCol, 99);
      if (!evalRes) {
        return { ok: false, error: "Data paito terlalu sedikit utk dievaluasi ulang." };
      }

      const formula = {
        k1: cfg.k1, m1: cfg.m1, s1: cfg.s1,
        op1: cfg.op1 || "+",
        k2: cfg.k2 ?? -1, m2: cfg.m2 ?? 1, s2: cfg.s2 ?? "off",
        op2: cfg.op2 || "+",
        k3: cfg.k3 ?? -1, m3: cfg.m3 ?? 1, s3: cfg.s3 ?? "off",
        sf: cfg.sf || "off",
      };
      const { streak, streakType } = streakFromMarks(evalRes.marks);
      const freshItem = {
        ...item,
        baris: evalRes.rowsEval,
        patah: evalRes.patah,
        ai: evalRes.ai,
        streak,
        streakType,
        colsKey: JSON.stringify([...activeCols].sort((a, b) => a - b)),
        trek_log: buildTrekLog(resp.rows, activeCols, cfg.fCol, formula, evalRes.marks, evalRes.ai, item.code),
        rumus_key: formulaKey(formula),
      };
      return { ok: true, freshItem, evalRes };
    } catch (err) {
      return { ok: false, error: `Error refresh: ${err.message}` };
    }
  };

  // ── Refresh satu rumus (re-fetch paito, update PJG/strek/ai/patah, rumus tetap) ──
  const doRefreshRumus = async (code) => {
    setManualMsg("");
    const item =
      savedItems.find((x) => x.code === code) || foundItems.find((x) => x.code === code);
    if (!item) {
      setManualMsg("Rumus tidak ditemukan di koleksi.");
      return;
    }
    setRefreshBusyCode(code);
    const res = await computeFreshItem(item);
    setRefreshBusyCode(null);
    if (!res.ok) {
      setManualMsg(res.error);
      return;
    }
    const updSaved = savedItems.map((x) => (x.code === code ? res.freshItem : x));
    setSavedItems(updSaved);
    if (foundItems.some((x) => x.code === code)) {
      setFoundItems(foundItems.map((x) => (x.code === code ? res.freshItem : x)));
    }
    persistCollection(updSaved, deviceId);
    const e = res.evalRes;
    setManualMsg(
      `♻️ ${item.rumus_key} di-refresh (patah ${e.patah}, ai ${e.ai}, baris ${e.rowsEval}, streak ${res.freshItem.streak}x)`
    );
  };

  // ── Refresh massal rumus tercentang — sequential 1-per-1 + jeda (aman utk rate-limit) ──
  const doRefreshChecked = async () => {
    if (bulkRefresh) return;
    if (!checkedCodes.length) {
      setManualMsg("Centang minimal 1 rumus di Bank Rumus utk refresh massal.");
      return;
    }
    const list = checkedCodes
      .map((c) => savedItems.find((x) => x.code === c) || foundItems.find((x) => x.code === c))
      .filter(Boolean);
    const n = list.length;
    const working = [...savedItems];
    const workingFound = [...foundItems];
    let okCount = 0;
    let failCount = 0;
    setBulkRefresh({ done: 0, total: n, cur: "" });
    try {
      for (let i = 0; i < n; i++) {
        const it = list[i];
        setBulkRefresh({ done: i, total: n, cur: it.rumus_key || it.code });
        if (i > 0) await new Promise((r) => setTimeout(r, 400)); // jeda antar-request
        const res = await computeFreshItem(it);
        if (res.ok) {
          const idx = working.findIndex((x) => x.code === it.code);
          if (idx >= 0) working[idx] = res.freshItem;
          const idxF = workingFound.findIndex((x) => x.code === it.code);
          if (idxF >= 0) workingFound[idxF] = res.freshItem;
          okCount++;
        } else {
          failCount++;
        }
      }
      setSavedItems(working);
      setFoundItems(workingFound);
      persistCollection(working, deviceId);
      setManualMsg(
        `♻️ ${okCount}/${n} rumus di-refresh (PJG & trek ikut diperbarui)` +
          (failCount ? ` — ${failCount} gagal` : "")
      );
    } catch (err) {
      setManualMsg(`Error refresh massal: ${err.message}`);
    } finally {
      setBulkRefresh(null);
    }
  };

  // ── Info kolom PJG: strek live + jumlah baris eval (fallback: hitung dari trek_log) ──
  const pjgInfo = (item) => {
    if (typeof item.streak === "number") {
      return { streak: item.streak, streakType: item.streakType || null, baris: item.baris };
    }
    try {
      const s = buildStreaks([item])[0];
      return { streak: s.streak, streakType: s.streakType, baris: item.baris };
    } catch {
      return { streak: null, streakType: null, baris: item.baris };
    }
  };

  const renderPjg = (item) => {
    const p = pjgInfo(item);
    const cls = !p.streak ? styles.pjgNone : p.streakType === "hit" ? styles.pjgHit : styles.pjgMiss;
    const arrow = !p.streak ? "–" : p.streakType === "hit" ? "↑" : "↓";
    return (
      <span
        title="PJG = strek kena/patah beruntun dari draw terakhir • brs = jumlah baris trek dievaluasi (window limit rumus)"
        style={{ whiteSpace: "nowrap" }}
      >
        <span className={`${styles.pjgStreak} ${cls}`}>
          {p.streak ?? 0}x {arrow}
        </span>
        <span className={styles.pjgBaris}>{item.baris} brs</span>
      </span>
    );
  };

  const typeLabel = (code) => parseCode(code).type;

  const syncStateLabel =
    syncState === "syncing"
      ? "⏳ menyimpan..."
      : syncState === "saved"
      ? "✓ tersimpan"
      : syncState === "error"
      ? "⚠️ offline (lokal saja)"
      : "○ siap";

  return (
    <main className={styles.scannerWrap}>
      <header className={styles.scannerHeader}>
        <h1>🛰️ Scanner Rumus Pro</h1>
        <p>Pencarian Rumus Algoritma v2.0 (Synchronized)</p>
        <div className={styles.headerNav}>
          <Link href="/" className={styles.navPill}>Generator LN</Link>
          <Link href="/riwayat" className={styles.navPill}>Riwayat</Link>
          <Link href="/uji-kinerja" className={styles.navPill}>Uji Kinerja</Link>
          <Link href="/rumus-otomatis" className={styles.navPill}>Rumus Otomatis</Link>
          <Link href="/scanner" className={styles.navPill}>️Scanner Pro</Link>
          <Link href="/pembagi" className={styles.navPill}>✂️ Pembagi Angka</Link>
        </div>
      </header>

      <section className={styles.configPanel}>
        <div className={styles.configGrid}>
          <label className={styles.cfgField}>
            <span>Pasaran</span>
            <select value={market} onChange={(e) => setMarket(e.target.value)}>
              {SCANNER_MARKETS.map((m) => (
                <option key={m.val} value={m.val}>{m.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Rumus</span>
            <select value={fCol} onChange={(e) => setFCOL(e.target.value)}>
              {SCANNER_TARGETS.map((t) => (
                <option key={t.val} value={t.val}>{t.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Digit</span>
            <select value={digit} onChange={(e) => setDigit(parseInt(e.target.value, 10))}>
              {DIGIT_OPTIONS.map((d) => (
                <option key={d.val} value={d.val}>{d.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Limit</span>
            <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
              {LIMIT_OPTIONS.map((l) => (
                <option key={l.val} value={l.val}>{l.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Patah</span>
            <select value={patah} onChange={(e) => setPatah(parseInt(e.target.value, 10))}>
              {PATAH_OPTIONS.map((p) => (
                <option key={p.val} value={p.val}>{p.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Hari</span>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {DAY_OPTIONS.map((d) => (
                <option key={d.val} value={d.val}>{d.txt}</option>
              ))}
            </select>
          </label>

          <label className={styles.cfgField}>
            <span>Target Rumus</span>
            <select value={maxRumus} onChange={(e) => setMaxRumus(parseInt(e.target.value, 10))}>
              {MAX_RUMUS_OPTIONS.map((r) => (
                <option key={r.val} value={r.val}>{r.txt}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.controlRow}>
          <button
            type="button"
            onClick={handleScanClick}
            disabled={cooldown > 0}
            className={`${styles.btnScan} ${
              isScanning ? styles.btnScanStop : styles.btnScanStart
            }`}
          >
            {cooldown > 0 ? `⏳ ${cooldown}s...` : isScanning ? "⏹ STOP" : "🔍 SCAN"}
          </button>
          {foundItems.length > 0 && !isScanning && (
            <>
              <button type="button" onClick={saveAllFound} className={styles.btnSecondary}>
                💾 Simpan Semua ({foundItems.length})
              </button>
              <button type="button" onClick={clearResults} className={styles.btnDanger}>
                🗑 Bersihkan
              </button>
            </>
          )}
        </div>

        <div className={styles.progressArea}>
          <div className={styles.progressText}>
            {engineMode !== "idle" && (
              <span
                className={`${styles.engineBadge} ${
                  engineMode === "local" ? styles.engineBadgeLocal : styles.engineBadgeOriginal
                }`}
              >
                {engineMode === "local" ? "⚡ ENGINE LOKAL" : "☁️ SERVER ASLI ANGKANET"}
              </span>
            )}
            {statusText}
          </div>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressBar} ${
                isScanning ? styles.progressBarActive : styles.progressBarDone
              }`}
              style={{ width: progress + "%" }}
            />
          </div>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <h2 className={styles.tableTitle}>⚡ HASIL SCANNER</h2>
        <div className={styles.tableScroll}>
          <table className={styles.scannerTable}>
            <thead>
              <tr>
                <th>RMS</th>
                <th>FORMULA</th>
                <th>PRED</th>
                <th>PJG</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {foundItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    {isScanning ? "Memulai pencarian rumus..." : "Klik SCAN untuk mencari rumus..."}
                  </td>
                </tr>
              ) : (
                foundItems.map((item, idx) => (
                  <tr key={idx} className={styles.rowItem}>
                    <td className={styles.cellType}>
                      <span
                        className={`${styles.srcBadge} ${
                          item.source === "original"
                            ? styles.srcBadgeOriginal
                            : styles.srcBadgeLocal
                        }`}
                        title={
                          item.source === "original"
                            ? "Rumus dari server scanner asli Angkanet"
                            : "Rumus dari engine lokal (evaluasi filter_api)"
                        }
                      >
                        {item.source === "original" ? "☁️ ASLI" : "⚡ LOKAL"}
                      </span>{" "}
                      {typeLabel(item.code)}
                    </td>
                    <td className={styles.cellFormula}>
                      <button
                        type="button"
                        className={styles.codeChip}
                        onClick={() => openTrek(item.code)}
                        title="Klik untuk lihat trek"
                      >
                        {item.rumus_key}
                      </button>
                    </td>
                    <td className={styles.cellPred}>{item.ai}</td>
                    <td className={styles.cellPjg}>{renderPjg(item)}</td>
                    <td className={styles.cellAction}>
                      {item.patah === 0 ? (
                        <span className={styles.badgeOk}>✓ ok</span>
                      ) : (
                        <span className={styles.badgeZone}>{item.patah}x</span>
                      )}
                      <button
                        type="button"
                        onClick={() => saveItem(item.code)}
                        disabled={savedItems.some((s) => s.code === item.code)}
                        className={styles.btnSave}
                        title="Simpan ke koleksi"
                      >
                        {savedItems.some((s) => s.code === item.code) ? "✓" : "💾"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.collectionPanel}>
        <div className={styles.collectionHead}>
          <h2 className={styles.tableTitle}>
            📚 KOLEKSI RUMUS SAYA ({visibleItems.length}{poolFilter || dayFilter ? ` dari ${savedItems.length}` : ""})
          </h2>
          <div className={styles.collectionToolbar}>
            <select
              value={poolFilter}
              onChange={(e) => {
                setPoolFilter(e.target.value);
                pruneChecked(e.target.value, dayFilter);
              }}
              className={styles.tierSelect}
              title="Filter koleksi per pool/pasar"
            >
              <option value="">Pool: SEMUA</option>
              {pools.map((p) => (
                <option key={p} value={p}>
                  Pool: {p}
                </option>
              ))}
            </select>
            <select
              value={dayFilter}
              onChange={(e) => {
                setDayFilter(e.target.value);
                pruneChecked(poolFilter, e.target.value);
              }}
              className={styles.tierSelect}
              title="Filter koleksi per hari"
            >
              <option value="">Hari: SEMUA</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  Hari: {d}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={colSearch}
              onChange={(e) => {
                setColSearch(e.target.value);
                setColPage(0);
              }}
              placeholder="🔍 cari kode / rumus / pred…"
              className={styles.colSearch}
              title="Cari rumus di koleksi (kode, formula, prediksi)"
            />
            <button
              type="button"
              className={styles.btnRekap}
              onClick={doRekap}
              disabled={checkedCodes.length === 0}
              title="Rekap semua formula tercentang menjadi tier TOP/CAD/MATI"
            >
              🧮 REKAP ({checkedCodes.length})
            </button>
            <button
              type="button"
              className={styles.btnRekap4D}
              onClick={doRekap4D}
              disabled={checkedCodes.length === 0}
              title="Rekap 4D — gabungkan AID (2D depan) + AI (2D belakang) jadi 4D TOP/CAD/MATI"
            >
              🎯 REKAP 4D
            </button>
            <select
              value={showTiers}
              onChange={(e) => {
                const v = e.target.value;
                setShowTiers(v);
                const checked = checkedCodes
                  .map((c) => savedItems.find((x) => x.code === c) || foundItems.find((x) => x.code === c))
                  .filter(Boolean);
                const typ = (t) => String(t || "").toUpperCase();
                if (
                  trekLog.includes("4D GABUNGAN") &&
                  checked.some((x) => ["AID", "AD", "AI 2D DEPAN"].includes(typ(x.type))) &&
                  checked.some((x) => ["AI", "AI 2D BELAKANG"].includes(typ(x.type)))
                ) {
                  setTrekLog(renderRekap4D(buildRekap4D(checked), v));
                }
              }}
              className={styles.tierSelect}
              title="Tier 4D yang ditampilkan list penuhnya di terminal"
            >
              <option value="top">Tampil: TOP saja</option>
              <option value="cad12">Tampil: TOP+CAD 1+CAD 2</option>
              <option value="all">Tampil: SEMUA tier</option>
            </select>
            <button
              type="button"
              className={styles.btnTrend}
              onClick={doTrend}
              title="Trend Gabungan — performa per draw, hot/cold digit, streak rumus (centang utk pilih, kosong = semua koleksi)"
            >
              📈 TREND
            </button>
            <button
              type="button"
              className={styles.btnTrek}
              onClick={doMergedTrek}
              disabled={checkedCodes.length === 0}
              title="Gabungkan trek seluruh rumus tercentang (max 10)"
            >
              🔀 TREK GABUNGAN
            </button>
            <button
              type="button"
              className={styles.btnRefreshAll}
              onClick={doRefreshChecked}
              disabled={bulkRefresh !== null || checkedCodes.length === 0}
              title="Refresh data rumus tercentang — re-fetch paito terbaru satu per satu (update PJG/strek, trek, AI, patah; kode rumus tetap)"
            >
              {bulkRefresh
                ? `⏳ ${bulkRefresh.done}/${bulkRefresh.total}${
                    bulkRefresh.cur ? ` · ${String(bulkRefresh.cur).slice(0, 10)}` : ""
                  }`
                : `♻️ REFRESH (${checkedCodes.length})`}
            </button>
            <button
              type="button"
              className={styles.btnDeleteSel}
              onClick={deleteChecked}
              disabled={checkedCodes.length === 0}
              title="Hapus rumus tercentang"
            >
              🗑 HAPUS ({checkedCodes.length})
            </button>
          </div>
        </div>
        <div className={styles.manualAddBox}>
          <div className={styles.manualAddLabel}>➕ Tambah Rumus Manual</div>
          <div className={styles.manualAddRow}>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste kode rumus: #SGP_ai_Km5+C6mb_L15-P0-D0_ACDE"
              className={styles.manualInput}
              disabled={manualBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !manualBusy) doAddManual();
              }}
            />
            <button
              type="button"
              className={styles.btnManualAdd}
              onClick={doAddManual}
              disabled={manualBusy || !manualCode.trim()}
            >
              {manualBusy ? "⏳ Memuat..." : "➕ TAMBAH"}
            </button>
          </div>
          {manualMsg && <div className={styles.manualMsg}>{manualMsg}</div>}
          <div className={styles.manualHint}>
            Kode rumus dari halaman <strong>/rumus-otomatis</strong> (COPY CODE) atau dari scanner
            Angkanet bisa langsung ditempel di sini — sistem otomatis memuat trek & evaluasinya.
          </div>
        </div>
        <div className={styles.syncBox}>
          <div className={styles.syncLabel}>
            ☁️ Bank Rumus <span className={styles.syncBadge}>{syncStateLabel}</span>
          </div>
          <div className={styles.syncRow}>
            <span className={styles.syncCodeLabel}>Kode Sync:</span>
            <code className={styles.syncCode}>{syncCode || "(memuat...)"}</code>
            <button
              type="button"
              className={styles.btnSyncCopy}
              onClick={() => {
                if (syncCode && navigator.clipboard) {
                  navigator.clipboard.writeText(syncCode);
                }
              }}
              title="Copy kode sync"
            >
              📋
            </button>
          </div>
          <div className={styles.syncRow}>
            <span className={styles.syncCodeLabel}>Ambil di device lain:</span>
            <input
              type="text"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className={styles.claimInput}
              disabled={claimBusy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !claimBusy) doClaim();
              }}
            />
            <button
              type="button"
              className={styles.btnClaim}
              onClick={doClaim}
              disabled={claimBusy || !claimCode.trim()}
            >
              {claimBusy ? "⏳" : "⬇️ AMBIL"}
            </button>
          </div>
          {claimMsg && <div className={styles.claimMsg}>{claimMsg}</div>}
          <div className={styles.syncHint}>
            Koleksi otomatis tersimpan di server per device. Pindah HP/laptop? Copy kode sync ini
            lalu klik AMBIL di device baru. Hapus cache browser tidak lagi menghapus rumus Anda.
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.scannerTable}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className={styles.chkBulk}
                    title="Pilih semua rumus"
                  />
                </th>
                <th title="Tandai rumus favorit yang Anda sukai">⭐</th>
                <th title="Sumber rumus (server asli / engine lokal / manual)">
                  <span className={styles.cellType}>SRC</span>
                </th>
                <th title="Tipe rumus (AI / AID / CB / dst)">RMS</th>
                <th>POOL</th>
                <th>HARI</th>
                <th>PRED</th>
                <th>PJG</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {savedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.emptyCell}>
                    Belum ada rumus yang disimpan.
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className={styles.emptyCell}>
                    Tidak ada rumus{poolFilter ? ` dari pool ${poolFilter}` : ""}
                    {dayFilter ? ` hari ${dayFilter}` : ""}
                    {colSearch.trim() ? ` cocok "${colSearch.trim()}"` : ""}.
                  </td>
                </tr>
              ) : (
                visibleItems.map((item, idx) => (
                  <tr key={idx} className={styles.rowSaved}>
                    <td className={styles.cellChk}>
                      <input
                        type="checkbox"
                        checked={checkedCodes.includes(item.code)}
                        onChange={() => toggleCheck(item.code)}
                        className={styles.chkBulk}
                      />
                    </td>
                    <td className={styles.cellFav}>
                      <button
                        type="button"
                        className={`${styles.btnFav} ${
                          item.fav ? styles.btnFavActive : ""
                        }`}
                        onClick={() => toggleFav(item.code)}
                        title={item.fav ? "Hapus dari favorit" : "Tandai sebagai favorit"}
                      >
                        {item.fav ? "★" : "☆"}
                      </button>
                    </td>
                    <td className={styles.cellType}>
                      <span
                        className={`${styles.srcBadge} ${
                          item.source === "original"
                            ? styles.srcBadgeOriginal
                            : item.source === "manual"
                            ? styles.srcBadgeManual
                            : styles.srcBadgeLocal
                        }`}
                        title={
                          item.source === "original"
                            ? "Rumus dari server scanner asli Angkanet"
                            : item.source === "manual"
                            ? "Rumus ditambahkan manual (paste kode)"
                            : "Rumus dari engine lokal (evaluasi filter_api)"
                        }
                      >
                        {item.source === "original" ? "☁️ ASLI" : item.source === "manual" ? "✍️ MANUAL" : "⚡ LOKAL"}
                      </span>
                    </td>
                    <td className={styles.cellPred}>{typeLabel(item.code)}</td>
                    <td className={styles.cellPred}>
                      <span className={styles.poolChip}>{String(item.market || "?").toUpperCase()}</span>
                    </td>
                    <td className={styles.cellDay}>
                      {editDayCode === item.code ? (
                        <div className={styles.dayEditWrap}>
                          <select
                            value={normDay(item.days)}
                            onChange={(e) => setItemDay(item.code, e.target.value)}
                            className={styles.daySel}
                            autoFocus
                            title="Pilih hari lalu tekan ✓"
                          >
                            <option value="">-- SEMUA HARI --</option>
                            {DAY_OPTIONS.filter((d) => d.val).map((d) => (
                              <option key={d.val} value={d.val}>{d.txt}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={styles.btnDayOk}
                            onClick={() => setEditDayCode(null)}
                            title="Selesai atur hari"
                          >
                            ✓
                          </button>
                        </div>
                      ) : (
                        <div className={styles.dayAutoWrap}>
                          <span className={styles.dayAutoTxt}>
                            {normDay(item.days) || "–"}
                          </span>
                          <button
                            type="button"
                            className={styles.btnDayEdit}
                            onClick={() => setEditDayCode(item.code)}
                            title="Atur hari rumus ini (opsional, per rumus)"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>
                    <td className={styles.cellPred}>{item.ai}</td>
                    <td className={styles.cellPjg}>{renderPjg(item)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.codeChip}
                        onClick={() => openTrek(item.code)}
                      >
                        lihat trek
                      </button>{" "}
                      <button
                        type="button"
                        className={styles.btnTrendOne}
                        onClick={() => doTrendOne(item)}
                        title="Trend rumus ini saja — coverage per draw, hot/cold digit, streak (hasil di terminal)"
                      >
                        📈 trend
                      </button>
                    </td>
                    <td className={styles.cellAction}>
                      <button
                        type="button"
                        onClick={() => doRefreshRumus(item.code)}
                        className={styles.btnRefresh}
                        disabled={refreshBusyCode === item.code}
                        title="Refresh data rumus — re-fetch paito terbaru (update trek/AI/patah, kode rumus tetap)"
                      >
                        {refreshBusyCode === item.code ? "⏳" : "♻️"}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => deleteSaved(item.code)}
                        className={styles.btnDelete}
                        title="Hapus dari koleksi"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.bottomToolbar}>
          <div className={styles.bottomToolbarLabel}>⚡ AKSI CEPAT</div>
          <select
            value={poolFilter}
            onChange={(e) => {
              setPoolFilter(e.target.value);
              pruneChecked(e.target.value, dayFilter);
            }}
            className={styles.tierSelect}
            title="Filter koleksi per pool/pasar"
          >
            <option value="">Pool: SEMUA</option>
            {pools.map((p) => (
              <option key={p} value={p}>
                Pool: {p}
              </option>
            ))}
          </select>
          <select
            value={dayFilter}
            onChange={(e) => {
              setDayFilter(e.target.value);
              pruneChecked(poolFilter, e.target.value);
            }}
            className={styles.tierSelect}
            title="Filter koleksi per hari"
          >
            <option value="">Hari: SEMUA</option>
            {days.map((d) => (
              <option key={d} value={d}>
                Hari: {d}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${styles.btnFavFilter} ${favOnly ? styles.btnFavFilterActive : ""}`}
            onClick={() => setFavOnly((v) => !v)}
            title="Tampilkan hanya rumus favorit (★)"
          >
            {favOnly ? "★ FAVORIT ✓" : "☆ FAVORIT"}
          </button>
          <button
            type="button"
            className={styles.btnTrend}
            onClick={doTrend}
            title="Trend Gabungan — performa per draw, hot/cold digit, streak rumus"
          >
            📈 TREND
          </button>
          <button
            type="button"
            className={styles.btnRekap}
            onClick={doRekap}
            disabled={checkedCodes.length === 0}
            title="Rekap semua formula tercentang menjadi tier TOP/CAD/MATI"
          >
            🧮 REKAP GABUNGAN
          </button>
          <button
            type="button"
            className={styles.btnRefreshAll}
            onClick={doRefreshChecked}
            disabled={bulkRefresh !== null || checkedCodes.length === 0}
            title="Refresh data rumus tercentang — re-fetch paito terbaru"
          >
            {bulkRefresh
              ? `⏳ ${bulkRefresh.done}/${bulkRefresh.total}${
                  bulkRefresh.cur ? ` · ${String(bulkRefresh.cur).slice(0, 10)}` : ""
                }`
              : `♻️ REFRESH (${checkedCodes.length})`}
          </button>
        </div>
        <div className={styles.pkgPanel}>
          <div className={styles.pkgHead}>📦 PAKET GABUNGAN</div>
          <div className={styles.pkgRow}>
            <input
              type="text"
              value={newPkgName}
              onChange={(e) => setNewPkgName(e.target.value)}
              placeholder="Nama paket (mis. Paket Senin SGP)"
              className={styles.pkgInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  savePackage(newPkgName);
                  setNewPkgName("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                savePackage(newPkgName);
                setNewPkgName("");
              }}
              disabled={checkedCodes.length === 0}
              className={styles.btnPkgSave}
              title="Simpan rumus yang sedang dicentang jadi paket"
            >
              💾 SIMPAN ({checkedCodes.length})
            </button>
            <button
              type="button"
              onClick={clearChecked}
              disabled={checkedCodes.length === 0}
              className={styles.btnPkgClear}
              title="Kosongkan semua centang"
            >
              ✖ kosongkan
            </button>
          </div>
          {packages.length === 0 ? (
            <div className={styles.pkgEmpty}>
              Belum ada paket. Centang beberapa rumus di atas lalu simpan jadi paket.
            </div>
          ) : (
            <div className={styles.pkgList}>
              {packages.map((p) => (
                <div key={p.id} className={styles.pkgItem}>
                  <button
                    type="button"
                    onClick={() => loadPackage(p.id)}
                    className={styles.pkgNameBtn}
                    title={`Muat paket — centang ${p.codes.length} rumus (tersimpan utk yg masih ada)`}
                  >
                    📦 {p.name}
                    <span className={styles.pkgCount}>· {p.codes.length} rumus</span>
                  </button>
                  <button
                    type="button"
                    className={styles.btnPkgRename}
                    onClick={() => {
                      const n = prompt("Nama paket baru:", p.name);
                      if (n) renamePackage(p.id, n);
                    }}
                    title="Ubah nama paket"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className={styles.btnPkgDel}
                    onClick={() => {
                      if (confirm(`Hapus paket "${p.name}"?`)) deletePackage(p.id);
                    }}
                    title="Hapus paket"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className={styles.privateNote}>
          🏠 Pribadi: Koleksi rumus ini hanya tersimpan di browser Anda dan tidak dapat dilihat oleh
          siapapun termasuk admin.
        </p>
      </section>

      {trekLog && (
        <section className={styles.terminalPanel}>
          <div className={styles.terminalHead}>
            <h2>🖥️ HASIL TERMINAL</h2>
            <button
              type="button"
              onClick={copyTerminal}
              className={styles.btnCopyTrek}
              title="Copy seluruh isi terminal (rekap 2D/4D, trek, trend) ke clipboard"
            >
              {copied ? "✓ TERSALIN" : "📋 COPY"}
            </button>
          </div>
          <pre
            className={styles.terminalBody}
            dangerouslySetInnerHTML={{ __html: renderTrekHtml(trekLog) }}
          />
        </section>
      )}

      <section className={styles.infoPanel}>
        <h3>ℹ️ PUSAT INFORMASI</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <strong>🔷 Apa itu Scanner Rumus Pro?</strong>
            <p>
              Scanner menganalisis pola historis paito secara otomatis dengan mengeksplorasi jutaan
              kombinasi formula matematis (A, C, K, E, J + varian mistik) untuk menemukan rumus
              dengan track record stabil sesuai pasaran pilihan Anda.
            </p>
          </div>
          <div className={styles.infoItem}>
            <strong>⚙️ Bagaimana Cara Kerjanya?</strong>
            <p>
              Mesin bekerja secara acak bertingkat — setiap sesi menghasilkan kombinasi yang
              berbeda dan bersifat probabilistik. Proses melibatkan mesin komputasi berkecepatan
              tinggi yang berjalan paralel di server Angkanet.
            </p>
          </div>
          <div className={styles.infoItem}>
            <strong>💡 TIPS PRO</strong>
            <p>
              Gunakan Limit minimal <b>30 BRS</b> untuk memastikan stabilitas trek jangka panjang.
              Pilih pasaran yang rutin keluar setiap hari agar data history selalu segar.
            </p>
          </div>
        </div>
        <p className={styles.disclaimer}>
          <b>Disclaimer:</b> Hasil scanner bersifat analisa historis semata dan tidak menjamin hasil
          di masa depan. Gunakan sebagai hiburan.
        </p>
      </section>
    </main>
  );
}
