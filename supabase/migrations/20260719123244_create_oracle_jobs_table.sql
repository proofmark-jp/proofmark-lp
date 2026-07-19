-- 1. oracle_jobs テーブルの作成
CREATE TABLE IF NOT EXISTS public.oracle_jobs (
  id UUID DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- 2. RLS (Row Level Security) の有効化
ALTER TABLE public.oracle_jobs ENABLE ROW LEVEL SECURITY;

-- 3. フロントエンドの WebSocket (Realtime) 用の SELECT 権限を付与
-- 紐づく証明書の所有者 (user_id) とアクセス元の auth.uid() が一致する場合のみ購読を許可
CREATE POLICY "Users can view their own oracle jobs via certificates"
  ON public.oracle_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.certificates
      WHERE certificates.id = oracle_jobs.certificate_id
      AND certificates.user_id = auth.uid()
    )
  );

-- 4. Supabase Realtime パブリケーションへテーブルを強制追加
ALTER PUBLICATION supabase_realtime ADD TABLE public.oracle_jobs;