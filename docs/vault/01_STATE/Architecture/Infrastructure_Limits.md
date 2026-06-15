# Infrastructure Limits (インフラの物理制約)

このドキュメントは、SaaSの課金プランやプラットフォームの仕様に起因する「越えられない物理法則」を定義する。AIエディタは実装提案を行う際、この制限を絶対に逸脱してはならない。

## 1. Supabase (Database & Storage)
* **Current Plan:** Free Tier (無料プラン)
* **Storage Max File Size:** 50MB / 1ファイル（ハードリミット）
* **Database Size Limit:** 500MB
* **Compute / Memory:** 共有リソースのため過剰なRPC同時実行は禁止。

## 2. Vercel (Compute & Edge)
* **Current Plan:** Pro Tier
* **Serverless Function Timeout:** 最大60秒
  * ※時間のかかる処理は待機せず、非同期キューへ逃がし Optimistic UI を採用すること。
* **Payload Size Limit:** 4.5MB
  * ※バイナリデータはAPIを直接通過させず、必ず `Zero-Copy Promotion`（署名付きURL）を使用すること。