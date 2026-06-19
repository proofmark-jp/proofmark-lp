-- デッドロック（鶏と卵）を回避するため、NOT NULL制約を外す
ALTER TABLE public.process_bundles ALTER COLUMN chain_head_step_id DROP NOT NULL;
ALTER TABLE public.process_bundles ALTER COLUMN chain_head_sha256 DROP NOT NULL;