-- ─────────────────────────────────────────────────────────────────────────────
-- Storefront の大量アクセスに耐えるため、username の lower() 検索を高速化する関数インデックス
-- ─────────────────────────────────────────────────────────────────────────────
create unique index if not exists profiles_lower_username_idx on public.profiles (lower(username));
