# Supabase Storage Topology (ストレージ構成と防衛線)

このドキュメントは、ProofMarkのファイルアップロード、Zero-Copy Promotion、およびSaaSのインフラコストを最小化するための「ストレージ・バケット構成」を定義する。

## 🏛️ Storage Architecture (Zero-Copy Pipeline)
フロントエンドからのファイルアップロードは、Vercel APIを通過させず（Egressコストゼロ）、必ずSupabaseの署名付きURL（Signed URL）を用いて直接アップロードする。

### The Ephemeral Switch (無料枠と有料枠の分岐)
1. 全ユーザーの初期アップロードは `proofmark-quarantine`（隔離庫）へ向かう。
2. The Merkle RollupのDB記録完了後、バックエンドAPIがプランを判定する。
   - **Creator(有料) / Spot(単発):** `proofmark-quarantine` から `proofmark-originals` または `spot-evidence` へ **移動（`move`）** させる。※`copy`はコスト倍増のため絶対禁止。
   - **Free(無料):** 即座に隔離庫から **物理削除（`remove`）** し、DBにはハッシュ値のみを残す（Zero-Liability）。

---

## 📦 Bucket Definitions (バケット定義)

> ⚠️ **Global Constraint (全バケット共通)**
> 現在のSupabaseインフラはFreeプランであるため、すべてのバケットにおいて「1ファイルあたりの最大サイズは 50MB」というハードリミットが強制適用されている。

### 1. `proofmark-quarantine` (The Titanium Gate)
* **役割:** アップロード用の一時隔離バケット。未検証のファイルが最初に着弾する場所。
* **公開設定:** `Private` (PublicアクセスOFF)
* **MIME制限:** なし (ZIPやPDFなどあらゆる形式を許容)
* **ライフサイクル:** APIによって数秒で昇格（Promote）または削除（Purge）される。残存したゾンビファイルは24時間経過後に自動クリーンアップされる。

### 2. `proofmark-originals` (The WORM Vault)
* **役割:** 有料プランのユーザーがアップロードした原本（Evidence）を永続保管する本番バケット。
* **公開設定:** `Private` (PublicアクセスOFF)
* **MIME制限:** なし
* **アクセス制御:** RLSにより、自分自身の `auth.uid()` と一致するフォルダパスのみ読み書き可能。公開（Shareable）証明書へのアクセスは、API経由で一時的なSigned URLを発行して制御する。

### 3. `spot-evidence` (The Guest Vault)
* **役割:** Spot決済（非ログイン状態での単発利用）のユーザーがアップロードした原本を保管するバケット。
* **公開設定:** `Private` (PublicアクセスOFF)
* **MIME制限:** なし
* **ライフサイクル:** Spot決済の利用規約に基づき、アップロードから24時間後にファイルを自動パージする。

### 4. `proofmark-public` (The Open Gallery)
* **役割:** 一般公開用のポートフォリオや、検証ページに表示するための圧縮・最適化済み画像を配置するバケット。
* **公開設定:** **`PUBLIC`** (認証なしでアクセス可能)
* **MIME制限:** なし（基本的には画像のみを配置）

### 5. `certificates` (The Output Document)
* **役割:** ProofMarkが発行した「PDF証明書」を保管するバケット。
* **公開設定:** **`PUBLIC`**
* **ファイルサイズ制限:** 10MB
* **MIME制限:** `application/pdf` 専用

### 6. `avatars` / `proofmark-assets` / `proof_images`
* **役割:** クリエイターのプロフィール画像（avatars）や、システムが使用する静的アセットを保管する。
* **公開設定:** `avatars` は **`PUBLIC`**、他は `Private`。