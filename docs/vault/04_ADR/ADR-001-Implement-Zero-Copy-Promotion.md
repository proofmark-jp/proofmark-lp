---
tags: [adr, architecture, decision, vercel, supabase, zero-copy, egress]
aliases: [ADR-001]
date: 2026-06-14
status: Accepted
---
# ADR-001: Implement Zero-Copy Promotion Architecture for File Uploads

## 1. Context & Problem (背景と直面した絶望)
- ProofMarkのコアバリューは「150枚の画像プロセスをWORM台帳に刻むこと」である。しかし、初期設計のようにクライアント（フロントエンド）から Vercel の API Routes を経由して Supabase Storage へバイナリデータを送信する構成は、致命的な欠陥を抱えていた。
- クリエイターが数十MB〜数百MBのPSD/ZIPファイルをアップロードした際、Vercel Edge Functions のメモリ制限に抵触し、Out of Memory (OOM) クラッシュが頻発する。
- さらに、Vercelサーバーを「土管」としてバイナリが通過するだけで、莫大なインバウンド／アウトバウンド（Ingress/Egress）の帯域課金が発生する。無料ユーザーの増加が「クラウド破産」に直結する脆弱なコスト構造であった。

## 2. Decision (冷徹な決定事項)
- **サーバーの完全迂回:** ファイルの実体（バイナリ）を Vercel サーバーに一切通過させない「Zero-Copy Promotion」アーキテクチャを採用する。
- **署名付きURLの活用:** サーバーの役割は、Supabase Storage の一時領域（`quarantine` バケット）への書き込み権限を持つ「署名付きURL」を発行することのみとする。
- **クライアントサイド主導:** フロントエンドが直接 Supabase に対してファイルを `PUT` する。アップロード完了後、フロントエンドは「SHA-256ハッシュ値」と「ファイル名」のみを Vercel API に送信する。
- **サーバー内での高速移動:** Vercel API はハッシュを受け取り DB にレコードを作成した後、Supabase の Storage API を叩き、`quarantine` バケットから本番の `vault` バケットへファイルをサーバー内で移動（Promote）させる。

## 3. Consequences (不可逆な影響と代償)

### 🟢 Positive (得られた圧倒的優位性)
- **インフラ課金の無効化:** Vercel を通過するデータが「数十バイトのハッシュ文字列」のみとなったため、ファイルサイズに依存する Egress コストが物理的にゼロに圧縮された。
- **絶対的な安定性:** Vercel 側でのメモリ枯渇（OOM）リスクが 0% となり、数ギガバイトのファイルであっても安定した処理が可能となった。
- **UXの極大化:** 中継サーバーによるボトルネックが消滅し、ユーザーのネットワーク帯域の限界速度で S3 互換ストレージへのダイレクトアップロードが実現した。

### 🔴 Negative / Risks (受け入れた負債とリスク)
- **ゾンビファイルの発生:** ユーザーがフロントエンドでのアップロード中にブラウザを閉じた場合や、ネットワーク切断が発生した場合、本登録処理が呼ばれず `quarantine` バケットに「誰にも紐付かない不要なファイル実体」が残留する。
- **クライアント依存の増加:** ハッシュ計算をフロントエンド（Web Worker）に依存するため、著しくスペックの低いデバイスではブラウザのメインスレッドを圧迫する可能性がある。

## 4. Next Actions (次なる防衛線)
- **Garbage Collection Bot:** The Agentic Command Center（Mac mini）上に、毎日午前3時に稼働するクリーンアップスクリプトを配備する。作成から24時間が経過し、かつ DB に紐付いていない `quarantine` バケット内のファイルを自動でバルク削除し、ストレージコストの膨張を物理的に遮断する。