---
tags: [adr, architecture, decision, security, supabase, rls, zero-trust]
aliases: [ADR-005, RLS強制適用]
date: 2026-06-14
status: Accepted
---
# ADR-005: Mandate Supabase RLS and JWT-Bound Queries for Data Breach Prevention

## 1. Context & Problem (背景と直面した絶望)
- SaaSにおいて最も致命的なインシデントは「個人情報（PII）とプライベートなアセットの全件流出」である。
- VercelなどのバックエンドAPIにおいて、システム管理者のフル権限（`Service Role Key`）を用いてDBにアクセスする設計は、万が一APIのエンドポイントにSQLインジェクションやロジックの脆弱性があった場合、攻撃者が「全ユーザーのメールアドレス」や「未公開の作品ハッシュ」を一括でダンプ（抽出）できるという致命的なリスクを伴う。
- アプリケーション層（コード）の `if` 文による権限チェックだけでは、ヒューマンエラーによる漏洩を完全には防ぎきれない。

## 2. Decision (冷徹な決定事項)
- **RLS（Row Level Security）の絶対適用:** Supabase上のすべてのテーブル（`profiles`, `certificates`, `assets` 等）に対して、PostgreSQLコアレベルでの Row Level Security を有効化し、「自分のデータ以外はDBが物理的に返さない」構造を強制する。
- **Service Role の読み取り禁止:** バックエンドの Vercel API 内であっても、全権限を持つ Service Role Key を用いたデータの読み出し（`select`）を原則として禁止する。
- **JWT-Bound Queries（コンテキストのダウングレード）:** ユーザーデータにアクセスする際は、リクエストヘッダーの JWT を用いて `supabase.auth.setSession()` を実行し、APIのデータベース接続権限を「リクエスト元のユーザー権限」に強制的にダウングレードしてからクエリを発行する。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **被害の極小化（Blast Radius Containment）:** 万が一APIの脆弱性を突かれ「全件取得（`SELECT *`）」の不正コマンドが実行されても、DBは「そのJWTの持ち主の1件分」しかデータを返さないため、全件流出が数学的に不可能となる。
- **Zero-Liabilityの強化:** ファウンダー自身でさえも、ユーザーのPrivateモードのデータを簡単には一括閲覧できない構造となるため、内部犯行やコンプライアンス上の疑義をシステム的に払拭できる。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **開発難易度とテスト負荷の増大:** 複雑なRLSポリシー（例えば、ShareableフラグがONの時は第三者でも読めるが、OFFの時は本人のみ、等）を正確に記述し、管理する必要がある。
- **バックグラウンド処理の特例管理:** `Agent-SecOps` などの自動化エージェントが全体統計を取得する際には、厳密な制約下でのみ Service Role の使用を許可する「バイパス（例外）ルート」の設計が別途必要となる。

## 4. Next Actions (次なる防衛線)
- **RLSテスティングの自動化:** 開発環境において、Supabase CLI を用いたローカルテストを構築する。異なるユーザーのJWTを用いてAPIを叩き、「他人のデータが絶対に取得できないこと」を証明する自動テスト（CI/CD）をパイプラインに組み込む。