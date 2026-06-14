---
tags: [architecture, mcp, tailscale, topology, network]
aliases: [Mac Mini Topology, ネットワーク構成]
date: 2026-06-14
---
# Mac Mini & MCP Server Topology

ProofMarkのローカル処理ノード（The Agentic Command Center）に関するネットワーク、ポート、およびシステム連携仕様。AIエージェントによる自動化および外部スクリプトは以下のトポロジーに従う。

## 1. Network & Node Configuration
- **Host Device:** Mac Mini (Local Environment)
- **VPN Interface:** Tailscale
- **Tailscale IP:** `[TODO: Insert Tailscale IPv4, e.g., 100.x.y.z]`
- **Firewall Rules:** Tailscaleネットワーク（`100.64.0.0/10`）外からのインバウンド通信はすべてDROPする。パブリックインターネットへのポート開放は厳禁。

## 2. MCP (Model Context Protocol) Services
ローカルで稼働するAIエージェントおよびワーカーのポート割り当て定義。
- **MCP Core Server:** `[TODO: Insert Port, e.g., localhost:3000]`
- **TSA Bulk Processing Worker:** `[TODO: Insert Port, e.g., localhost:3001]`
- **C2PA Local Signing Worker:** `[TODO: Insert Port, e.g., localhost:3002]`
- **SecOps Monitor Agent:** `[TODO: Insert Port, e.g., localhost:3003]`

## 3. Cloud-to-Local Integration (非同期処理オフロード)
Vercel/Supabase（クラウド側）の重い処理をローカルへ委譲する際の通信アーキテクチャ。
- **Pull-based Architecture:** クラウド側から Mac Mini への直接の HTTP/Webhook Push は禁止。必ず Mac Mini 側のワーカーが Upstash Redis のキュー（または Supabase）をポーリング（Pull）する設計とする。
- **TSA Bulk Sync:** ワーカーは一定間隔で未処理のハッシュリストを取得し、ローカル環境で Merkle Tree を構築する。代表ハッシュに対してのみ商用TSAでスタンプを取得し、結果を Supabase へ書き戻す。

## 4. Security & Hardware Key (KMS)
- **C2PA Private Key:** クラウド環境（Vercel等の環境変数）への秘密鍵の配置・アップロードは絶対禁止。
- **HSM Integration:** Mac Mini に物理接続された `YubiKey 5 FIPS` をローカルの KMS として利用する。C2PAマニフェストの署名処理はローカルワーカー内で完結させ、生成されたマニフェスト（JSON）のみをクラウドへ送信する。