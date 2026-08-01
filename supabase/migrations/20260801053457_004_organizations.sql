-- =============================================================================
-- 👑 THE SOVEREIGN ARCHITECT: sql/schema/004_organizations.sql
-- Phase 1.4: Organizational Identity Layer (The B2B Neutral Zone)
-- 目的: Blueprint §X.3 に基づき、SAML/Passkeyの衝突を回避する組織ID基盤を冪等に錬成
-- =============================================================================

-- 1. organizations テーブル錬成 (The Corporate Entity)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT UNIQUE NOT NULL,
    dns_txt_verified_at TIMESTAMPTZ,
    org_signing_pubkey TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'enterprise',
    saml_provider TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. organization_members テーブル錬成 (The Delegation Chain)
CREATE TABLE IF NOT EXISTS public.organization_members (
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- 🚨 注意: public.profiles が存在することを前提とする
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','signer','viewer')),
    can_sign_on_behalf BOOLEAN DEFAULT false,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (organization_id, user_id)
);

-- 3. 冪等なインデックス生成 (SSO & Query Optimization)
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON public.organizations(domain);
-- revoked_at IS NULL (アクティブなメンバー) のみを高速検索する部分インデックス
CREATE INDEX IF NOT EXISTS idx_org_members_active_user 
    ON public.organization_members(user_id) 
    WHERE revoked_at IS NULL;

-- 4. 自動更新トリガー
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_organizations_updated_at') THEN
        CREATE TRIGGER handle_organizations_updated_at
            BEFORE UPDATE ON public.organizations
            FOR EACH ROW
            EXECUTE FUNCTION public.moddatetime();
    END IF;
END
$$;

-- 5. Zero-Trust RLS (Row Level Security) の絶対封鎖と境界定義
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- 組織の参照: 自身が所属しており、かつSAML連携等で revoked されていない(IS NULL)場合のみ参照可能
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'Members can view their active organizations') THEN
        CREATE POLICY "Members can view their active organizations" ON public.organizations
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.organization_members
                    WHERE organization_id = public.organizations.id
                      AND user_id = auth.uid()
                      AND revoked_at IS NULL
                )
            );
    END IF;

    -- メンバーの参照: 同じ組織に所属するアクティブなメンバー同士のみ参照可能
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'Members can view peers in active organizations') THEN
        CREATE POLICY "Members can view peers in active organizations" ON public.organization_members
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.organization_members AS my_membership
                    WHERE my_membership.organization_id = public.organization_members.organization_id
                      AND my_membership.user_id = auth.uid()
                      AND my_membership.revoked_at IS NULL
                )
            );
    END IF;

    -- INSERT / UPDATE / DELETE: クライアントからの直接ミューテーションを完全遮断 (Service Role / Edge 経由のみ)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizations' AND policyname = 'No direct inserts on organizations') THEN
        CREATE POLICY "No direct inserts on organizations" ON public.organizations FOR INSERT WITH CHECK (false);
        CREATE POLICY "No direct updates on organizations" ON public.organizations FOR UPDATE USING (false);
        CREATE POLICY "No direct deletes on organizations" ON public.organizations FOR DELETE USING (false);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'No direct inserts on organization_members') THEN
        CREATE POLICY "No direct inserts on organization_members" ON public.organization_members FOR INSERT WITH CHECK (false);
        CREATE POLICY "No direct updates on organization_members" ON public.organization_members FOR UPDATE USING (false);
        CREATE POLICY "No direct deletes on organization_members" ON public.organization_members FOR DELETE USING (false);
    END IF;
END
$$;