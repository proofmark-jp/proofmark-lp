---
tags: [architecture, core-philosophy, zero-trust, c2pa]
aliases: [設計思想, Core Philosophy]
date: 2026-06-14
---
# ProofMark Core Philosophy (絶対的設計思想)

ProofMarkのすべてのコード、インフラ設計、UI/UXは、以下の絶対的な哲学に基づいて構築されなければならない。AIエージェント（Claude Code / Antigravity等）がコードを改修する際、この原則に反する提案はすべて棄却される。

## 1. Zero-Knowledge Proof (完全なるゼロ知識証明)
**「サーバーを信じるな。暗号学的な真実だけを信じよ」**
- クライアントの機密データ（原本ファイル）をVercelやSupabaseのサーバーに一切送信しない。
- ハッシュ計算（SHA-256）はすべてユーザーのブラウザのメモリ内（Web Worker / `hashWorker.ts`）で完結させる。
- サーバーには「ハッシュ値」と「メタデータ」のみを送信し、WORM台帳へ記録する。
- 関連実装: `useHashFile.ts`, `ZeroKnowledgeDropzone.tsx`

## 2. The Merkle Rollup (プロセス証明の極小化)
**「150枚の工程を1つのハッシュに圧縮し、インフラコストをゼロに近づける」**
- 制作過程（ラフ〜完成）のすべての画像データを個別のレコードとして保存しない。
- 完成品（HEAD）をルートとし、過去の全工程のハッシュ履歴を `metadata_json` 内の `chain_history` に JSONB として封入する（The Ultimate Lean Payload）。
- これにより、たった1つのデータベースレコードで、複雑な「過程の証明」を数学的に成立させる。

## 3. WORM (Write-Once Read-Many) の絶対防衛
**「一度刻まれた証拠は、管理者（ファウンダー）であっても絶対に書き換えられない」**
- `certificates` テーブルのタイムスタンプや C2PA マニフェストに対して、DBトリガーによる不変性制約（WORM）を課す。
- フロントエンドに物理削除（DELETE）のAPIを持たせない。すべては「アーカイブ（非表示化）」として扱う。
- これにより、ProofMarkが「法廷で戦えるレベルの客観的証拠」としてのSLAを担保する。

## 4. Single Source of Truth (SSOT / 単一情報源の法則)
**「矛盾はSaaSを殺す」**
- プラン価格や説明文はLPにハードコードせず、必ず `pricingPlans.ts` や `proofmark-copy.ts` から動的に流し込む。
- UIのアニメーションや状態遷移（Sliderのロック等）は、タイマー依存（`setTimeout`）を廃止し、必ず「DBのステータス」や「ハッシュシグネチャの完全一致」に基づく **Derived State（派生状態）** によって駆動させる。

## 5. The Hybrid Trust (C2PA × Merkle Rollup)
**「世界規格の来歴と、独自のプロセス証明を統合する」**
- C2PA (Content Credentials) は「競合」ではなく「内包すべき来歴レイヤー（シェル）」として扱う。
- ユーザーから送信された C2PA データを破壊せず、`Evidence Pack` 内に `c2pa.json` として安全に同梱する（パススルー型）。
- ※ 将来的なMCP/Mac mini環境での署名者昇格（Issuer）を見据え、C2PA解析ロジックは常にクライアントサイド（Web Worker）にオフロードし、サーバーのCPUを保護する。


## 🔗 Connected Nodes
- [[01_The-Solo-Sniper-Roadmap]]
- [[01_Infrastructure-Defenses]]
- [[01_Terms-and-Policies]]