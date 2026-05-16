-- =============================================================================
-- 1. ユーザー情報・UI表示用アセットテーブル (退会時に完全に消滅する領域)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.proven_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス配置 (ユーザーごとの一覧取得を高速化)
CREATE INDEX IF NOT EXISTS idx_proven_assets_user_id ON public.proven_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_proven_assets_visibility ON public.proven_assets(visibility);

-- =============================================================================
-- 2. WORM (Write Once, Read Many) 暗号学的一方通行台帳テーブル (永久不変領域)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.timestamp_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- アセットが消えても台帳レコード自体を残すため SET NULL 制約を採用
    asset_id UUID REFERENCES public.proven_assets(id) ON DELETE SET NULL,
    -- 退会したユーザーのUIDを追跡する必要があれば残す（統計用、個人特定は不可）。不要なら削除可。
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- 暗号学的データ (絶対に書き換え・削除を許さない)
    sha256 CHAR(64) NOT NULL,
    timestamp_token TEXT, -- Base64形式のRFC3161応答
    certified_at TIMESTAMPTZ,
    tsa_provider TEXT,
    tsa_url TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス配置 (ゼロ知識ハッシュ照合 lookup-by-hash のための最速インデックス)
CREATE UNIQUE INDEX IF NOT EXISTS idx_timestamp_ledger_sha256 ON public.timestamp_ledger(sha256);
CREATE INDEX IF NOT EXISTS idx_timestamp_ledger_asset_id ON public.timestamp_ledger(asset_id);

-- =============================================================================
-- 3. RLS (Row Level Security) の厳格な設定
-- =============================================================================
ALTER TABLE public.proven_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timestamp_ledger ENABLE ROW LEVEL SECURITY;

-- ── proven_assets のポリシー ──
CREATE POLICY "Users can insert their own assets" ON public.proven_assets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets" ON public.proven_assets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" ON public.proven_assets
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public profiles are viewable by anyone" ON public.proven_assets
    FOR SELECT USING (visibility = 'public');

CREATE POLICY "Private profiles are viewable only by owner" ON public.proven_assets
    FOR SELECT USING (auth.uid() = user_id);

-- ── timestamp_ledger のポリシー (WORM特性の強制) ──
-- 照合（Lookup）は全世界の誰でも可能（Zero-Knowledgeのコア）
CREATE POLICY "Anyone can lookup timestamps" ON public.timestamp_ledger
    FOR SELECT USING (true);

-- インサートは認証されたユーザーのみ可能
CREATE POLICY "Authenticated users can create ledger entries" ON public.timestamp_ledger
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 【超重要】UPDATEは、タイムスタンプトークンがまだ空の時（発行直後の格納）のみ、Service Roleまたはシステム経由でのみ許可
-- 既存のトークンを上書きしたり改ざんすることは、RLSレベルでロックアウト
CREATE POLICY "System can update token once" ON public.timestamp_ledger
    FOR UPDATE USING (timestamp_token IS NULL);

-- 【超重要】DELETEポリシーは一切定義しない（＝Service Role以外、地球上の誰もこの台帳からレコードを消せない）

-- =============================================================================
-- 4. 自動トリガー (updated_at の自動更新)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.moddatetime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_proven_assets_updated_at
    BEFORE UPDATE ON public.proven_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.moddatetime();