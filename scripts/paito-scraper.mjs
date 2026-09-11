// Scraper result 4D harian dari angkanet26.com (paito harian).
// Sumber: https://angkanet26.com/paito-harian-<slug>/
// Struktur baris: <td class="reside tgl">DD-MM-YYYY</td><td class="reside">d</td>... (4 digit pertama = result 4D prize 1)
// Read-only terhadap situs; tanpa dependency eksternal.

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const POOLS = {
  singapore: { slug: "paito-harian-singapore", label: "Singapore", drawTimeWIB: "17:40" },
  sydney: { slug: "paito-harian-sydney-pools", label: "Sydney", drawTimeWIB: "13:50" },
  hongkong: { slug: "paito-harian-hongkong-pools", label: "Hongkong", drawTimeWIB: "22:30" },
};

// Parse semua baris {date: "YYYY-MM-DD", result: "DDDD"} dari HTML paito.
export function parsePaito(html) {
  const rows = [];
  const re = /<td class="reside tgl">(\d{2})-(\d{2})-(\d{4})<\/td>((?:<td class="residex?">\d<\/td>){4,})/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, dd, mm, yyyy, cells] = m;
    const digits = (cells.match(/residex?">(\d)<\/td>/g) || [])
      .map((c) => c.replace(/\D/g, ""))
      .join("");
    if (digits.length >= 4) {
      rows.push({ date: `${yyyy}-${mm}-${dd}`, result: digits.slice(0, 4) });
    }
  }
  return rows;
}

// Ambil riwayat result satu pool (hari ini sampai X hari ke belakang, default 120).
export async function fetchPaito(poolKey, days = 120) {
  const pool = POOLS[poolKey];
  if (!pool) throw new Error(`Pool tidak dikenal: ${poolKey}`);
  const url = `https://angkanet26.com/${pool.slug}/`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${url}`);
  const html = await res.text();
  const rows = parsePaito(html).slice(-days);
  return { pool: poolKey, label: pool.label, rows };
}
