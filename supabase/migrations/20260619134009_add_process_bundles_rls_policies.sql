-- 1. INSERT（新規作成）の許可：自分のID（auth.uid）のバンドルのみ作成可能
CREATE POLICY "Allow INSERT for own bundles" ON public.process_bundles
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 2. UPDATE（更新）の許可：自分のID（auth.uid）のバンドルのみ更新可能
CREATE POLICY "Allow UPDATE for own bundles" ON public.process_bundles
FOR UPDATE TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);