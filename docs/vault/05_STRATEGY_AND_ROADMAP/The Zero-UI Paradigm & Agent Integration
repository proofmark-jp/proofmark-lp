title: "ProofMark Architecture: The Zero-UI Paradigm & Agent Integration"
date: 2026-06-19
tags: ["#ProofMark", "#Architecture", "#UX", "#MCP", "#AutonomousAgent"]
status: "Concept / Next Phase"
---

# ProofMark Architecture: The "Zero-UI" Paradigm

## Executive Summary
「究極のUXとは、UIが存在しないことである」
ProofMarkの次なる進化は、クリエイターから「証明しなければならない」「納品しなければならない」という認知負荷を完全に排除することにある。Webベースの美しいダッシュボード（Obsidian Slab / Inspector）は検証と管理のための「金庫の内装」として機能させ、日常的な存在証明と納品プロセスは、ローカル計算資源（Mac mini）と自律型エージェント、およびMCP（Model Context Protocol）を通じてバックグラウンドで完全自動化する。ProofMarkはSaaSから「クリエイターのインフラ」へと昇華する。

---

## Core Pillars（3つの究極アーキテクチャ）

### 1. The Watchdog Agent (Auto Proof on Save)
OSのファイルシステムレベルで動作する、常駐型・自律証明エージェント。

*   **Concept:** クリエイターの「保存（Save）」という日常動作を、意識させることなく「存在証明（Proof）」に変換する。
*   **Architecture:**
    *   Mac mini等のローカル環境で稼働する軽量なデーモンプロセス（Rust/Go推奨）。
    *   指定された作業ディレクトリ（例: `~/ProofMark_Sync`）のファイル変更イベント（I/O）を常時監視。
    *   Photoshop, Clip Studio等で上書き保存（v1 → v2）が発生した瞬間にローカルでSHA-256ハッシュを計算し、ProofMark APIへ非同期送信。タイムスタンプを自動取得。
*   **Value:** 人間の「意図」を介在させずに、制作プロセスの完全なスナップショット（Chain of Evidence）が自動生成される。AI生成ではないことの「反証不可能な最強の証拠」となる。

### 2. ProofMark as MCP Server (LLM Integration)
LLM（Claude 4.6 Opus, Manus等）を介してシステムを操作するためのプロトコル統合。

*   **Concept:** ProofMarkを「人間がアクセスするWebサイト」から「AIがアクセスするAPI（MCPサーバー）」へと再定義する。
*   **Architecture:**
    *   ProofMarkのコア機能（ハッシュ計算、RFC3161取得、Delivery Kit生成）をMCP（Model Context Protocol）のツールとして外部公開。
    *   ユーザーはチャットインターフェース上でエージェントに自然言語で指示を出すのみ。
*   **Use Case:**
    *   *User:* 「このフォルダの画像をACME社案件としてPrivate Proof化して」
    *   *Agent:* 「（裏側でAPIを叩き）完了しました。証明書ID: XXXX」
    *   *User:* 「ACME社向けの納品用Delivery Kitを作成して、メールのドラフトを書いて」
    *   *Agent:* 「（AES-256-GCM暗号化とZIP生成を実行し、パスワードを含むカバーレターを作成）」

### 3. Autonomous Defense Agent (自律型防衛・権利行使システム)
ローカルの計算資源を活用した、能動的な権利保護エンジン。

*   **Concept:** 盗用・無断転載を「被害者が探す」のではなく「システムが検知し、迎撃準備を完了させる」状態の構築。
*   **Architecture:**
    *   Mac mini上の定時実行エージェントが、ProofMark登録済みの画像特徴量・ハッシュを元にWebスクレイピング、またはリバースイメージサーチAPIを定点観測。
    *   類似画像の不正利用を検知した場合、ProofMarkのAPIから該当の「RFC3161タイムスタンプ付き存在証明書」を自動取得。
    *   エージェントが「DMCA（デジタルミレニアム著作権法）侵害申し立てフォーム」のドラフトまで自律的に作成。
*   **Value:** クリエイターは通知を受け取り、「送信」を承認するだけ。防衛行動における心理的・時間的コストを極限まで下げる。

---

## Strategic Prerequisites（前提条件となる現在の課題）
この「Zero-UI」パラダイムを安全に稼働させるためには、堅牢でバグのないバックエンドAPIが必須である。以下の改修が完了していることが絶対条件となる。

1.  **DBスキーマの完全性:** `process_bundle_steps` への `mime_type` 等の必須カラム追加による、API保存の確実な完走。
2.  **UXと暗号化の分離:** Delivery Kit（E2EE納品プロセス）を日常のアップロードフローから切り離し、専用のアクションとしてAPI化できる状態にすること。
3.  **パフォーマンスの最適化:** N+1リクエスト等のフロントエンドのボトルネックを排除し、APIが高速に応答する状態を維持すること。

**[Conclusion]**
UIの極限は「Zero」である。美しい金庫はすでに完成しつつある。次は「金庫を開ける作業」そのものを自動化し、クリエイターの時間を完全に「創作」へと回帰させる。
