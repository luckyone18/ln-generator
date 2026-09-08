# Generator LN

Klon fungsional "Generator LN" ala Angkanet dengan **algoritma deterministic sendiri** (bukan kode/logika Angkanet).

Masukkan result 4D → dapatkan:

- **LN TOP** (30–50 LN)
- **Patah 1–4** + **Patah > 5**
- **Kress Ai** (3–6 digit)
- Grid highlight 00–99 + tombol COPY per kartu

## Karakteristik

- 100% client-side, tanpa backend
- **Deterministik**: input sama → output sama selamanya
- Partisi dijamin **tepat 100 LN** (00–99) tanpa duplikat antar kartu
- Input multi-line: hanya baris terakhir yang dipakai (perilaku sama seperti referensi)

## Struktur

- `app/page.js` — UI (React client component)
- `app/algorithm.js` — engine deterministic (mulberry32 PRNG + Fisher–Yates)
- `scripts/test-algorithm.mjs` — test suite algoritma

## Test

```bash
node scripts/test-algorithm.mjs
npm run build
```

## Deploy

Vercel-ready (Next.js 16, App Router). Import repo di Vercel → deploy.
