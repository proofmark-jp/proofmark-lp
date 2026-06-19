-- process_bundles テーブルに HEAD を指定するためのカラムを追加
ALTER TABLE public.process_bundles
  ADD COLUMN IF NOT EXISTS chain_head_step_id uuid REFERENCES public.process_bundle_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chain_head_sha256 text;

-- ※注意：外部キー(REFERENCES)を設定していますが、NOT NULLではないため、
-- 親(bundle)を先に作り、後から子(step)を作り、最後にこのカラムを更新することが可能です。