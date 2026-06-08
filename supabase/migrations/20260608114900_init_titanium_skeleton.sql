-- =============================================================================
-- Phase 1: The Titanium Skeleton (Perfect v2) - 防弾・チェーン対応 WORMスキーマ
-- =============================================================================

-- 1. 古い幻のテーブルを完全破棄 (※既存データリセット)
DROP TABLE IF EXISTS public.timestamp_ledger CASCADE;
DROP TABLE IF EXISTS public.proven_assets CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;

-- 2. 新生・統合WORM台帳テーブルの構築
CREATE TABLE public.certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 👤 オーナー情報（退会時は匿名化して台帳維持 / Spot決済時はNULL許容）
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, 
    
    -- 🔗 Chain of Evidence (150枚のタイムラインを強固に束ねる)
    bundle_id UUID, 
    step_index INTEGER DEFAULT 0, 

    -- 📝 基本メタデータ
    title TEXT NOT NULL,
    description TEXT,
    proof_mode TEXT NOT NULL CHECK (proof_mode IN ('private', 'shareable', 'spot')),
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
    
    -- 🔒 暗号学的証明データ (The WORM Core)
    sha256 CHAR(64) NOT NULL UNIQUE, 
    timestamp_token TEXT,
    certified_at TIMESTAMPTZ,
    tsa_provider TEXT,
    
    -- 📦 ファイル実体とストレージ情報
    storage_path TEXT,
    public_image_url TEXT,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT NOT NULL,
    
    -- 🧩 拡張データとライフサイクル
    c2pa_manifest JSONB, 
    metadata_json JSONB DEFAULT '{}'::jsonb,
    is_asset_purged BOOLEAN DEFAULT false,
    purged_at TIMESTAMPTZ, -- 物理ファイル破棄の厳密な監査証跡
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 🛡️ 【絶対防衛線】 同一チェーン内で順番(step_index)の重複を物理的に許さない
    -- (※ PostgreSQLの仕様上、bundle_id が NULL の単発証明書同士は衝突しません)
    UNIQUE(bundle_id, step_index)
);

-- 3. インデックスの超最適化 (Lookupの爆速化)
CREATE INDEX idx_certificates_user_id ON public.certificates(user_id);
CREATE INDEX idx_certificates_bundle_id ON public.certificates(bundle_id);
CREATE INDEX idx_certificates_sha256 ON public.certificates(sha256);

-- 4. 鉄壁の Row Level Security (RLS)
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- 👁️ SELECT (読み取り): 自分がオーナーのもの、またはPublic/Shareableなものだけ閲覧可能
CREATE POLICY "Users can view their own or public certificates" ON public.certificates
    FOR SELECT USING (
        auth.uid() = user_id 
        OR visibility IN ('public', 'unlisted') 
        OR proof_mode = 'shareable'
    );

-- 🚫 INSERT / UPDATE / DELETE (書き込み): クライアントからは【絶対禁止】
CREATE POLICY "No direct inserts from client" ON public.certificates FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct updates from client" ON public.certificates FOR UPDATE USING (false);
CREATE POLICY "No direct deletes from client" ON public.certificates FOR DELETE USING (false);

-- 5. Updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION public.moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_certificates_updated_at
    BEFORE UPDATE ON public.certificates
    FOR EACH ROW
    EXECUTE FUNCTION public.moddatetime();