---
tags: [tooling, workflow, zero-marginal-cost, mac-mini, oss]
aliases: [Founder Tooling, 限界費用ゼロの自動化]
date: 2026-06-14
---
# Founder Tooling & Zero-Cost Workflows

ProofMark開発における、ファウンダー（Sinn）の運用プロトコル。高額なSaaSツールへの依存を排除し、固定資産である「Mac mini」と「オープンソース（OSS）」を極限まで搾取することで、限界費用ゼロの自動化パイプラインを構築する。

## 1. The Core AI Stack (投資対象の選択と集中)
- **Claude Code (Paid):** ターミナルネイティブな「実行部隊」。コードの変更、Git操作、ローカルスクリプトの実行を担う。
- **Gemini Pro (Paid):** Web UIおよびAPIを通じた「壁打ち相手・設計者」。広大なコンテキストウィンドウを活かし、Obsidianの全記憶を保持させる。
- **Cursor / AI Editors (Free Tier):** エディタは補助と割り切り、無償プランで運用。主要なコード生成はターミナルの Claude Code へオフロードする。

## 2. Mac Mini Local Automation (脱・クラウドCI/CD)
クラウドの従量課金を避けるため、定期実行やWebhook処理はすべて Mac mini 内部で完結させる。
- **ローカル Git Hook Sync:** GitHub Actionsは使用しない。Mac mini 上で cron または軽量なローカルWebhookレシーバーを稼働させ、`main` ブランチへの Push を検知。Claude Code をバックグラウンドで起動し、Obsidian の `01_STATE` を自律更新させる。
- **OSS Transcription (Whisper):** 音声メモのテキスト化に外部SaaSは使わない。Mac mini に OSS の `Whisper.cpp` などをローカルデプロイし、iPhone から Drop された音声ファイルを無料で文字起こし、`03_LAB/Inbox.md` へ自動出力する。

## 3. The Context Injector (Instant Load)
Geminiへのコンテキスト注入パイプラインは維持する。
- **Zsh Hook (`pm-gemini`):** コマンド一発でObsidianの全ルールをクリップボードへロードする。
- **iOS Shortcut (`🧠 PM Context`):** モバイル環境からiCloud経由でルールを結合し、Geminiアプリへワンタップで展開する。