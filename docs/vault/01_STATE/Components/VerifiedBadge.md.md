---
tags: [component, ui, framer-motion, performance]
aliases: [VerifiedBadge, Badge UI]
date: 2026-06-14
---
# VerifiedBadge.tsx

ProofMarkの証明バッジUIコンポーネント。ホバー時の幅展開アニメーションにおいて、DOMツリーの再計算（Layout Thrashing）を防ぎ、常に60fpsを維持するための実装仕様。

## 1. テーマ仕様 (Dual Theme)
`isMasked` (boolean) の値に応じて以下の2つのスタイル状態を切り替える。

- **Public Mode (`isMasked === false`):**
  - ベースカラー: Teal (`#00D4AA`)
  - テキスト: "3 STEPS VERIFIED"
  - アイコン: `ShieldCheck`
- **NDA Mode (`isMasked === true`):**
  - ベースカラー: Purple (`#6C3EF4`) / Gold (`#F0BB38`)
  - テキスト: "NDA PROTECTED"
  - アイコン: `Lock`

## 2. パフォーマンスとレンダリング最適化 (GPU Isolation)
Framer Motionを用いたアニメーション実装時、以下の制約を厳守すること。

- **DOMの分離:** 親ツリーへのレイアウト伝播を防ぐため、CSSに `contain: layout paint` および `will-change: width, transform` を指定し、コンポーネントを独立したGPUレイヤーへ昇格させる。
- **Layout Thrashingの防止:** `framer-motion` のレイアウト計算を明示的にオフ（`layout={false}`）にする。
- **Flexbox反転による固定:** `width` の展開アニメーションによる内部要素のガタつきを防ぐため、コンテナに `flex-row-reverse` を適用。アイコンを右側にピン留めし、テキスト領域のみを左方向へ展開させる。
- **Hover-Spam制御:** `onHoverStart` イベント発火時、100msの `setTimeout` による遅延（Intent-Delay）を実装し、マウスの不要な通過による連続した再レンダリングをブロックする。

## 3. 親コンポーネントへの組み込み制約 (Global Directives)
本コンポーネントを他のUI（Bento Grid等）にインポートして配置する際、以下のルールを遵守すること。

- **A11y (視差効果低減) の尊重:**
  - 内部で `import { useReducedMotion } from 'framer-motion'` を評価する。
  - OS設定で視差効果を減らしているユーザーに対しては、Pulse（呼吸）アニメーションを停止し、展開を `duration: 0` で即時完了させること。
- **Clipping (見切れ) トラップの完全回避:**
  - バッジはホバー時に横幅が **134px** まで展開する。
  - 親要素や画像ラッパーに `overflow-hidden` が適用されていると展開時にUIが切断されるため、バッジをその内側に配置してはならない。
  - 必ず `overflow-hidden` コンテナの「外側（兄弟要素）」として配置し、共通の親コンテナ（`relative` を指定）に対して `absolute` かつ `z-index: 50` クラスを指定してマウントすること。