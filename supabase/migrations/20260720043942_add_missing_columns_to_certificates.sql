ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS cid text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS storage_key text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS status text;