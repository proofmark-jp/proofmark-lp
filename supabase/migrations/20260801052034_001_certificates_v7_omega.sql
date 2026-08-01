-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/schema/001_certificates_v7_omega.sql
-- Phase 1.1: The Titanium Skeleton (Perfected Merge - ALTER Patch)
-- 目的: 既存の certificates テーブルを破壊せず、V7 OMEGA の絶対法典カラムを冪等に注入する
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. 新規カラムの冪等追加 (The Missing Links)
ALTER TABLE public.certificates
    ADD COLUMN IF NOT EXISTS chain_sha256 TEXT,
    ADD COLUMN IF NOT EXISTS dhash_64bit TEXT,
    ADD COLUMN IF NOT EXISTS consent_json JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS object_purged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verification_mode TEXT NOT NULL DEFAULT 'full' CHECK (verification_mode IN ('full', 'hash_only')),
    ADD COLUMN IF NOT EXISTS sha256_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_asset_purged BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;

-- 2. UNIQUE制約の冪等追加 (chain_sha256)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'certificates_chain_sha256_key') THEN
        ALTER TABLE public.certificates ADD CONSTRAINT certificates_chain_sha256_key UNIQUE (chain_sha256);
    END IF;
END $$;

-- 3. インデックスの冪等追加 (FinOps Query Optimization)
CREATE INDEX IF NOT EXISTS idx_certificates_chain_sha256 ON public.certificates(chain_sha256);

-- 4. Zero-Trust RLS (Row Level Security) の絶対封鎖と再構築
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- 既存の不確実なポリシーを物理削除し、V7 OMEGA の法典で上書きする
DROP POLICY IF EXISTS "Users can view their own or public certificates" ON public.certificates;
CREATE POLICY "Users can view their own or public certificates" ON public.certificates
    FOR SELECT USING (
        auth.uid() = user_id 
        OR visibility IN ('public', 'unlisted') 
        OR proof_mode = 'shareable'
    );

DROP POLICY IF EXISTS "No direct inserts from client" ON public.certificates;
CREATE POLICY "No direct inserts from client" ON public.certificates FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "No direct updates from client" ON public.certificates;
CREATE POLICY "No direct updates from client" ON public.certificates FOR UPDATE USING (false);

DROP POLICY IF EXISTS "No direct deletes from client" ON public.certificates;
CREATE POLICY "No direct deletes from client" ON public.certificates FOR DELETE USING (false);