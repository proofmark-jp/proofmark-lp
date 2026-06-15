[FUTURE DRAFT] 根本的なインフラ刷新の要件
現状のSupabase pg_cron と Vercel API のハイブリッド運用は技術的負債（応急処置）である。
トリガー条件: 「Daily Active Users が 1,000 を超えた時」または「アップセルメールの送信数が1日500件を超えた時」。
解決策: Upstash Redis（QStash）等のメッセージキューを導入し、完全なPub/Subモデル（Event-Driven Architecture）へ移行する。

2. The Frankenstein File（野良パッチの残留）
標的ファイル: components/cert/CertificateUpload.c2pa-patch.tsx (45 KB)
冷徹な見解: 本番環境（mainブランチ）のコンポーネント群の中に、.c2pa-patch.tsx という「一時的なパッチ（絆創膏）」の名前を冠した巨大なファイルが残留しています。隣にある CertificateUpload.tsx (45 KB) と見事にサイズが被っています。
致命的リスク: これは開発プロセスにおける「Gitのコンフリクト逃れ」や「検証用の分岐」がそのまま本番にマージされている典型的な技術的負債（Technical Debt）です。将来、別のAIエディタがアップロードUIを改修する際、どちらのファイルを修正すべきか分からず、深刻なハルシネーション（幻覚）を起こします。
対処方針: 直ちにメインのファイルへロジックを統合するか、不要な方を物理削除（Purge）して、単一の真実（Single Source of Truth）を保つ必要があります。

### [追加] OGP画像の事前生成 (Compute on Write)
- 現状の `og-vault.ts` は、初回アクセス時にVercel Function内でSatori/Resvgを起動する「Compute on Read」であり、一時的な止血（404早期リターン＋Edge Cache）に留まっている。
- **根本解決策:** 証明書が発行された瞬間（DBへのInsert時）、バックグラウンドの非同期Worker（QStash等）がOGP画像を1回だけ生成し、Supabaseの `proofmark-public` バケットに静的PNGとしてアップロードする。
- **目標:** Vercel APIからの画像生成エンドポイントを完全撤廃し、CDNからの静的ファイル配信のみに依存する「Computeコスト完全ゼロ」のアーキテクチャを実現する。