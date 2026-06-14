---
tags: [component, react, state-machine, timeline]
aliases: [ProcessBundleComposer, Timeline UI]
date: 2026-06-14
---
# ProcessBundleComposer.tsx

ProofMarkのタイムラインUIコンポーネント。画像配列とメタデータの状態遷移を2つの独立したシグネチャで監視・制御する仕様（The Dual-State Engine）。

## 1. 状態監視機構 (The Dual-State Engine)
UIの状態は、以下の2つのシグネチャ変数によって決定論的に評価される。

### A. 画像・構造の変更監視 (`stepsSignature`)
- **型定義:** `string` (`id` と `sha256` のみを連結・ハッシュ化した文字列)
- **状態遷移:** 封印済み（Sealed）状態から画像配列の追加・削除・並び替えが発生した際、スナップショットとの差異を検知し `isForkedDraft = true` とする。
- **UI挙動:** `VerifiedBadge` を非表示とし、「Slide to Seal」スライダー（新リヴィジョン作成UI）を表示する。再封印処理にはTSAトランザクションを伴う（DBへのINSERT）。

### B. テキスト・メタデータの変更監視 (`currentMetaSignature`)
- **型定義:** `string` (`title` と `note` を連結・ハッシュ化した文字列)
- **状態遷移:** 画像構造を維持したままテキストのみを修正した場合、`hasUnsavedMeta = true` とする。
- **UI挙動:** `VerifiedBadge` を維持し、「変更を保存」ツールバーを表示する。保存処理はTSAを消費せず、`metadata_json` の超軽量な PATCH (`UPDATE`) 処理のみを実行する。

## 2. メモリ保護と並行処理 (OOM Defense)
コンポーネント内の関数を実装・修正する際は以下の制約を守ること。

- **Shallow Copy の強制:** 状態を復元する `handleRevertToSealed` 等を実装する際、`JSON.parse(JSON.stringify())` によるディープコピーは絶対に使用禁止（`File` や `Blob` オブジェクトの参照が破壊されるため）。必ず `steps.map(step => ({ ...step }))` などの浅いコピーを使用すること。
- **Anti-Jank Yield:** 150枚規模の画像をDropされた際、UIスレッドのホワイトアウトを防ぐため、`Promise.all` の全件一括並行実行を避ける。チャンク分割処理と `await new Promise(r => setTimeout(r, 0))` による処理の Yield（ブラウザへの制御返却）を挟むこと。

## 3. 差分更新制御 (Delta Uploads)
新リヴィジョン（v2等）の作成時、ネットワーク帯域の無駄を省くための制御。
- **アップロードのフィルタリング:** `runHybridCompression` および API送信時、対象ファイルを `uploadState !== 'uploaded'` の条件でフィルタし、既知のファイルは再アップロードしない。
- **ステートのリセット:** 画像の差し替え（`onReplace` イベント）が発生した場合は、対象ステップの `uploadState` を明示的に `'idle'` へリセットし、アップロードスキップの偽陽性を防ぐこと。