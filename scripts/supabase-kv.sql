-- ln-generator KV store (pengganti Vercel Blob yang suspended)
-- Jalankan di Supabase SQL Editor (project mana pun yang aktif).

CREATE TABLE IF NOT EXISTS public.ln_kv (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index utk lookup by device/sync (query utama pakai PK key; ini utk value->>syncCode)
CREATE INDEX IF NOT EXISTS ln_kv_value_synccode
  ON public.ln_kv ((value->>'syncCode'));

-- Table colsize ~1000 device tidak masalah (free tier 500MB jauh lebih dari cukup).

-- RLS: aktifkan + TANPA policy = anon key tidak bisa baca/tulis.
-- Service key menembus RLS, jadi aman dipakai server-side.
ALTER TABLE public.ln_kv ENABLE ROW LEVEL SECURITY;
