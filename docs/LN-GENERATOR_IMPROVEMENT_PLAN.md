# LN Generator — Rencana Perbaikan (2026-10-04)

> Status: **PLANNING — belum ada kode yang diubah.**
> Audit 2026-10-04: semua 9 route live 200, 5 test suite pass, build exit 0, fitur terakhir (Gabung Angka, `7479b43`) terverifikasi live di production chunk.

## Prioritas

| # | Item | Dampak | Prioritas |
|---|------|--------|-----------|
| 1 | Paito scraper tahan rotasi domain Angkanet | 4 cron auto-backtest mati permanen jika domain lama dimatikan | 🔴 KRITIS |
| 2 | CI gate (GitHub Actions: test + build) | Push bugus tidak langsung live ke production | 🟡 PENTING |
| 3 | Fix `scripts/check-live.mjs` (path `immutable`) + commit | Dev tool salah path = false negative | 🟢 KECIL |
| 4 | README usang (masih versi v1) | Dokumentasi tidak mencerminkan 8 halaman + 6 API | 🟢 KECIL |
| 5 | Baseline history penuh 2022–2026 ke Supabase KV | Uji Kinerja & Riwayat: 52 baris → ratusan baris | 💡 UPGRADE (butuh keputusan Lucky) |

---

## T1 — Paito scraper tahan rotasi domain 🔴

**Masalah:** `scripts/paito-scraper.mjs:37` hardcode `https://angkanet26.com/${slug}`. Hari ini (04-10) terverifikasi: `angkanet26.com` → 301 → `angkanet35.com` (masih selamat karena redirect). Pola rotasi Angkanet: 26→29→…→35. Jika domain lama dimatikan permanen (404/refused, bukan redirect), `/api/update-history` gagal → **semua cron ln-auto-{sgp,sydney,taiwan,hongkong} mati senyap**.

**Kenapa ironis:** Scanner sudah tahan rotasi (`app/lib/wla.js`: seed discovery + redirect-follow + 403 retry + seed bisa diganti dari `/pengaturan`, KV key `ln/seed-domains`). Tapi jalur paito/scraper tidak ikut.

**Desain fix:**
1. Fungsi baru `fetchPaitoWithFallback(poolKey, days)`:
   - Daftar kandidat URL = seed dari KV `ln/seed-domains` (via `app/lib/kv.js` `readJson`) → fallback `currentDomain()` dari `wla.js` → fallback hardcoded seed lama.
   - Coba tiap kandidat berurutan; terima respons jika `parsePaito(html).length > 0` (redirect otomatis di-follow `fetch`).
   - Track domain final yang berhasil (di respons API + log) supaya cron tahu kondisi sehat.
2. `app/api/update-history/route.js`: ganti `fetchPaito` → `fetchPaitoWithFallback`; respons tambah field `sourceDomain` per pool.
3. **Pitfall yang harus dihormati:** `wla.js` itu modul server Next (pakai cache module-level). Scraper diimpor dari route (aman) tapi juga dipakai standalone via `node` (dev). Solusi: scraper tetap dependency-light — terima `seeds: string[]` sebagai argumen; route yang baca KV dan meneruskannya. Jangan impor `wla.js` dari `scripts/*.mjs`.
4. Update seed default di `app/lib/wla.js` `DEFAULT_SEEDS` agar ikut `angkanet35.com` (fallback KV mati ikut segar).

**Verifikasi:**
- `node -e` probe: `fetchPaitoWithFallback` jalan dengan seed list berisi domain mati (`https://angkanet99.com`) → tetap sukses via fallback.
- Cron test manual: `POST /api/update-history` → `added ≥ 0`, `sourceDomain = angkanet35.com`.
- Regression: `node scripts/test-algorithm.mjs && npm run build`.

**Risk/Rollback:** murni additive; rollback = revert 1 commit. Deploy via push (auto Vercel).

---

## T2 — CI gate GitHub Actions 🟡

**Masalah:** GitHub push → Vercel auto-deploy production TANPA menjalankan test/build apa pun.

**Desain:**
- `.github/workflows/ci.yml`:
  - Trigger: push `main` + PR.
  - Steps: checkout → setup-node 22 (npm cache) → `node scripts/test-algorithm.mjs`, `test-backtest`, `test-combiner`, `test-tardal` (murni lokal, tanpa network) → `npm run build`.
  - `test-wla-helper.mjs` **tidak** ikut CI (butuh network ke Angkanet; bisa flaky) → tetap dev tool.
- Catatan: repo publik/private? (luckyone18/ln-generator — private; Actions free untuk private dengan menit terbatas, job ini < 2 menit.)

**Verifikasi:** workflow hijau di commit pertama; badge opsional di README.

---

## T3 — `check-live.mjs` salah path 🟢

**Bukti:** chunk live Next 16 ada di `/_next/static/immutable/chunks/…`; script lama fetch `/_next/static/chunks/…` → 404 → selalu report 0 match (false negative — barusan terbukti: script report kosong padahal marker ada 6+2 di `38dthsrp7ow0v.js`).

**Fix:** ikutkan prefix `immutable/` (regex dari HTML sudah menangkap path relatif — tinggal perbaiki dasar URL), generalize marker jadi argumen CLI (`node scripts/check-live.mjs "Gabung" "Angka Double"`), lalu commit (selama ini untracked 9 hari).

---

## T4 — README usang 🟢

Update ke kondisi sekarang: daftar 8 halaman (+nav), 6 API route, arsitektur (client-side engine + Supabase KV `ln_kv`, adapter `app/lib/kv.js`, proxy WLA tahan rotasi), cron auto-backtest 4 pool, cara deploy (push = auto Vercel; fallback CLI), cara test (lokal + CI). Sumber konten: [[Projects/ln-generator]] di Obsidian.

---

## T5 — Baseline history penuh (KEPUTUNGAN LUCKY) 💡

**Aset:** `/tmp/full-history.json` masih utuh (190,7 KB; SGP 1.223 / SDY 1.713 / HK 1.713 result 2022-01-03 → 2026-09-10; hasil rekonstruksi EV-analysis, match 100% dgn anchor Blob + hasil identik 2026-10 pada pool SGP/SDY saat ini).

**Opsi:**
- **A — Backfill via merge (rekomendasi):** naikkan window scraper ke penuh saat seed (mis. `days=2000`), jalankan 1x `POST /api/update-history` → `mergeHistory` mengisi tanggal-tanggal kosong (dedup by date). Cron rutin tetap window 120 hari. Riwayat & Uji Kinerja langsung kaya tanpa ubah API.
- **B — Upload file langsung:** script one-off baca `full-history.json` → `writeJson('ln/history/{pool}.json')` (jalur seed `scripts/seed-supabase-kv.mjs` sudah ada polanya).
- **C — Skip:** biarkan 52 baris.

**Konsekuensi yang perlu diketahui:** histori panjang mengubah angka statistik di /uji-kinerja & /riwayat (window rolling bisa jadi lebih stabil), dan memperlama build report sedikit (masih << 1 MB per pool, aman di Postgres JSONB).

**Rekomendasi tim: A** (paling sedikit kode baru, memvalidasi merge path sekaligus).

---

## Urutan eksekusi

1. T1 (kritis) → test → commit → push → verifikasi live `/api/update-history`
2. T3 + T4 (kecil, 1 commit chore) → push (sekalian jadi kelinci percobaan T2)
3. T2 → push → tunggu Actions hijau
4. T5 sesuai keputusan Lucky (A: 1x trigger manual + verifikasi row count)
5. Update [[Projects/ln-generator]] + daily note WIB

**Estimasi:** T1 ±20 mnt kerja, T2 ±10, T3–T4 ±10, T5(A) ±15.
