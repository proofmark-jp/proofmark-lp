---
tags: [workflow, upload, zero-copy, quarantine, api]
aliases: [Upload Flow, ダイレクトアップロード]
date: 2026-06-14
---
# Zero-Copy Upload Flow (ダイレクトアップロード・フロー)

ProofMarkにおけるファイルアップロードおよび証明書発行のシーケンス定義。巨大ファイルによるVercelのメモリ枯渇（OOM）を防ぐため、以下の順序とデータ構造を厳守すること。

## 1. 処理シーケンス
フロントエンド（`CertificateUpload`）での `handleIssueCertificate` 発火時のフロー。

1. **Pre-processing (並行処理):**
   - `hashWorker.ts` を用いたファイルの SHA-256 計算。
   - `requestUploadUrl` による署名付きURLの取得（`api/upload-url.ts` への POST）。
   - 上記2つを `Promise.all` で並行実行する。
2. **Direct Upload (Vercel迂回):**
   - 取得した `signedUrl` に対し、`XMLHttpRequest` 等を用いてファイルを Supabase Storage の `quarantine`（検疫バケット）へ直接 `PUT` する。
3. **Zero-Copy Promote (本登録):**
   - `api/certificates/create.ts` へ、ファイル実体を除く「JSONメタデータのみ」を `POST` する。
   - バックエンドはDBレコードを作成し、Storage APIを用いてファイルを `quarantine` から正規バケットへ「移動（Promote）」させる。

## 2. APIインターフェース契約
`requestUploadUrl` 実行時、以下のペイロード構造を厳守すること（キー名の不一致は400エラーとなる）。

```typescript
// api/upload-url.ts への送信ペイロード
body: JSON.stringify({
  filename: file.name,
  contentType: file.type || 'application/octet-stream',
  size: file.size,
})

## 3. Private Proof (Zero-Knowledge Mode) の例外処理

`proofMode === 'private'` の場合、シーケンスは以下のように分岐する。

- **ファイル送信の禁止:** 手順1の `requestUploadUrl` および手順2の `PUT` 処理を完全にスキップする。
    
- **メタデータ送信:** 手順3において、計算済みのハッシュ値、ファイル名、サイズ情報のみを `create.ts` へ送信する。
    
- **MIMEタイプ:** ペイロードの `mime_type` には `file.type` を設定し、強制的に `null` 化しないこと。