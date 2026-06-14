---
tags: [architecture, c2pa, worker, database]
aliases: [C2PA Integration, C2PA仕様]
date: 2026-06-14
---
# C2PA Ecosystem Integration

ProofMarkにおけるC2PA (Content Credentials) データの処理、データベース制約、およびフロントエンドのエッジワーカー管理仕様。

## 1. データベース層の制約 (PostgreSQL)
- **不変性制約 (WORM):** `certificates` テーブルの `c2pa_manifest` カラムに対し、インサート後の更新（上書き）を禁止するDBトリガーを適用する。
- **ペイロード上限:** ストレージコスト保護のため、DB層で `CHECK (octet_length(c2pa_manifest::text) <= 10240)` を強制し、10KB以上のJSONペイロードを拒否する。
- **Egress最適化:** ポートフォリオ等の公開APIレスポンスには、マニフェスト本体（巨大JSON）を含めず、`c2pa_present` (boolean) フラグ等を利用してレスポンスサイズを軽量化する。

## 2. Client-Side Worker 制約 (useC2pa.ts)
C2PA解析の重いWASM処理はメインスレッドで行わず、必ずWeb Workerへオフロードする。ブラウザのフリーズを防ぐため以下の保護機構を実装すること。

- **強制終了 (Timeout Kill):** ワーカー実行開始時に12秒のタイマーを設定する。応答がない場合は `worker.terminate()` を実行し、ワーカープロセスを物理的に破棄する。
- **メモリリーク防止:** コンポーネントのアンマウント時、または関数の連続実行時には、必ず `clearTimeout` によるクリーンアップ処理を行う。
- **TDZ (Temporal Dead Zone) の回避:** Reactフック内での変数・関数の宣言順序を厳格に管理し、クリーンアップ関数（`dispose`等）の初期化前参照エラーによるホワイトアウトを防ぐ。

## 3. ビジネスロジックとUI状態遷移
- **Silent Drop (Freeプラン制御):** FreeプランのユーザーリクエストにC2PAデータが含まれていた場合、400エラー等で中断させず、バックエンドでサイレントに `null` に置換してメインフロー（証明書発行）を完了させる。
- **表示ロジック (加点方式):** C2PAデータが存在しない場合、UI上に「未検証」等のネガティブな警告を出してはならない。データが存在する場合のみ、The Vault UIを発光させる。
- **Submit物理ロック:** 画像ドロップ直後のC2PA解析実行中（約1〜3秒）は、Submit（発行）ボタンの `disabled` 属性を強制的に `true` に設定し、解析完了前の不完全な状態でのAPIリクエスト送信を防ぐ。