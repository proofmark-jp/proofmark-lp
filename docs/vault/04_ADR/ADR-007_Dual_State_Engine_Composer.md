# ADR-007: The Dual-State Engine (ProcessBundleComposer Decoupling)

## 1. Context & Executive Summary (背景と目的)
現在、`ProcessBundleComposer.tsx` は「The Merkle Rollup」のハブとして機能しているが、状態管理（State Management）において重大なUX/コストのボトルネックを抱えている。
ユーザーが「画像（暗号的真実）」を追加した時だけでなく、単に「タイトルやメモ（メタデータ）」を修正しただけでも、システム全体が「未保存状態（Unsealed）」と判定し、商用TSA（タイムスタンプ）を再消費する重い更新処理（Seal）を要求してしまう。

**【アーキテクチャの決定（Decision）】**
コンポーザー内の状態監視を、**「The Cryptographic State（画像/ハッシュ）」**と**「The Meta State（テキスト/装飾）」**の2つの独立したエンジン（The Dual-State Engine）へ完全に分離する。
メタデータのみの変更はTSAを消費しない軽量な `PATCH` APIで処理し、UIには `VerifiedBadge.tsx` の世界観を継承した「Smart Meta Toolbar」を展開する。

---

## 2. Implementation Constraints (AIへの絶対遵守事項)

あなたは世界最高峰のReactアーキテクト兼UXエンジニア（Opus / Claude 3.5 Sonnet）である。
提供された `ProcessBundleComposer.tsx` に対し、既存の堅牢な `stepsSignature`（画像監視）ロジックを1ミリも壊すことなく、以下の5つの【God-Tier Upgrades】を完璧に適用せよ。

### 🛠️ Upgrade 1: Hydration（初期ロード）時の Sealed 状態の完全復元
既存の証明書データを開いた際、初期状態から「封印（Sealed）スナップショット」が正しくハイドレーションされるようにせよ。
* **要件:** `useEffect` (certificate ベース・ハイドレーション) の末尾、`loadExistingChain()` が完了し `setSteps` を行った直後に、以下を同期的に実行せよ。
  1. `const sig = stepsSignature(loadedSteps);`
  2. `setSealedSignatureSnapshot(sig);`
  3. `setSealedStepsSnapshot(loadedSteps.map(step => ({ ...step })));`
  4. `setSealedMetaSnapshot(generateMetaSignature(loadedSteps, certificate.title, certificate.description));`

### 🛠️ Upgrade 2: Meta Signature（テキスト差分）の分離監視
「画像」の変更とは完全に独立して、「テキスト（タイトル・メモ）」の変更のみを検知する派生状態（Derived State）を構築せよ。
* **要件:**
  * コンポーネント上部に純関数として追加: `const generateMetaSignature = (steps, bundleTitle, bundleDesc) => steps.map(s => \`\${s.title}:\${s.note}\`).join('|') + \`|\${bundleTitle}|\${bundleDesc}\`;`
  * Stateの追加: `const [sealedMetaSnapshot, setSealedMetaSnapshot] = useState<string | null>(null);`
  * 派生状態の計算: `const currentMetaSignature = useMemo(() => generateMetaSignature(steps, title, description), [steps, title, description]);`
  * 判定ロジック: `const hasUnsavedMeta = sealed && sealedMetaSnapshot !== null && sealedMetaSnapshot !== currentMetaSignature;`
  * **絶対条件:** 既存の `submit` / `submitMagic` の成功時（完全Seal時）にも、必ず `setSealedMetaSnapshot(currentMetaSignature)` を発火させ、両方のスナップショットを同期させよ。

### 🛠️ Upgrade 3: 超軽量 PATCH API の実装 (`handleSaveMetadata`)
テキストの変更のみをDBへ保存し、TSAを消費しない（限界費用ゼロの）更新ロジックを実装せよ。
* **要件:**
  * Stateの追加: `const [savingMeta, setSavingMeta] = useState(false);`
  * 関数 `handleSaveMetadata` の実装:
    * 実行条件: `certificate` または `result?.certificateId` が存在すること。
    * 処理: `setSavingMeta(true)` とし、Supabase SDKを用いて `certificates` テーブルの当該レコードを更新。`title`, `description` に加え、`metadata_json` 内の `chain_history` も最新の `steps` のタイトル・メモで上書き（マージ）せよ。
    * 成功時: `toast.success` を発火し、`setSealedMetaSnapshot(currentMetaSignature)` でメタデータ状態を再ロックする。

### 🛠️ Upgrade 4: 新コンポーネント `VerifiedBadge.tsx` の降臨
コンポーザーの絶対的権威を示す「Prestige Signal」をマウントせよ。
* **要件:**
  * 既存の巨大なインライン `VerifiedBadge`（緑の枠など）の役割は維持しつつ、コンポーザー全体の右上（例: `top-3 right-3` の絶対座標）に、新開発の `<VerifiedBadge isMasked={!isPublic} reduce={false} />` をインポートして配置せよ。
  * `AnimatePresence` を用い、`sealed === true` の時だけ滑らかに出現・退場させること。

### 🛠️ Upgrade 5: The Smart Meta Toolbar (神UIの実装)
メタデータのみが変更された（`hasUnsavedMeta === true`）時にのみ出現する、官能的なフローティングツールバーを実装せよ。
* **デザイン・UX要件 (Stripe / Linear Quality):**
  * 配置: 画面下部（既存のVerifiedBadgeブロックの直下など、最適なレイヤー）。
  * マテリアル: `backdrop-blur-xl`, `border border-[#00D4AA]/40` を用いた、`VerifiedBadge` のDNAを継承する美しいグラスモーフィズム。
  * コピー: 「📝 メタデータの未保存の変更があります」という洗練されたラベル。
  * アクション (Save): 「変更を保存」ボタンには、`Pulse` (box-shadowの呼吸アニメーション) を纏わせ、「押したくなる」アフォーダンスを付与。ボタンの付近に「※TSAは消費しません」という微細なマイクロコピーを添える。
  * アクション (Undo): 「取り消す」ボタンを押すと、`title`, `description`, `steps` のテキストを `sealedStepsSnapshot` 等から瞬時に（0msで）復元させる。
  * モーション: `Framer Motion` の `spring` (stiffness: 400, damping: 28) で下から滑らかに浮上（y: 20 -> 0）。CPUリフローを防ぐため `will-change: transform, opacity` を必ず付与すること。

---
**[END OF SPECIFICATION]**
AI Agent: Read this ADR, strictly maintain the Cryptographic Signature logic, and implement the Dual-State Engine with absolute pixel-perfect UI. Output the full modified `ProcessBundleComposer.tsx`.