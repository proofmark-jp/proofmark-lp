[SECURITY AXIOMS] Supabase RLS の絶対原則

Zero-Trust Client Writes:
フロントエンド（ブラウザの anon / authenticated ユーザー）からの INSERT, UPDATE, DELETE は、全テーブルにおいて**「原則禁止（DENY）」**とする。

API Gatekeeper Pattern:
DBへの書き込み（Mutation）は、必ず Vercel API (バックエンド) を経由させ、IP制限とレートリミット（Upstash）による**「The Ironclad Fortress（鉄壁の要塞）」**の防衛線を通過したリクエストのみ、Service Role Key を用いて実行する。

The Exceptions (例外):
上記ルールから除外され、クライアントからの直接書き込みが許可されるのは以下のテーブルのみである。

(現時点ではなし。将来的にユーザー自身のプロフィール編集などがあれば追記)

Read-Only Frontends:
クライアント側には、UI表示に必要な最低限の SELECT ポリシーのみを許可する。