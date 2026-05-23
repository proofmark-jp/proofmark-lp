-- 対象のバケットの public フラグを false (Private) に更新
UPDATE storage.buckets
SET public = false
WHERE id IN ('certificates', 'proofmark-public', 'originals', 'proof_images', 'avatars');