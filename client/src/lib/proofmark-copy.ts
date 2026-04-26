/**
 * ProofMark Copy SSOT (Single Source of Truth)
 * ─────────────────────────────────────────────
 * すべての主要コピー・ヒーロー文言・カテゴリ定義をここに集約する。
 * Home / Pricing / FAQ / TrustCenter / Footer / SEO の全ページが
 * このファイルだけを参照することで、ページ間のメッセージ齟齬を構造的に防ぐ。
 *
 * 設計思想：
 *  1. 「証明書を売る」ではなく「信用を納品できる状態を売る」。
 *  2. 「権利を守る」ではなく「納品の説明責任を軽くする」。
 *  3. 「法的証拠力を保証」ではなく「証拠利用可能性を提供（採否は事案依存）」。
 *  4. 過剰な断定（先取権 / 必ず勝てる / 完全保護）は廃止し、
 *     Trust Center の誠実な開示と完全に整合させる。
 */

export const PROOFMARK_COPY = {
  /* ────────────────────────────────────────────
   * Brand
   * ──────────────────────────────────────────── */
  brandShort: "ProofMark",
  brandFull: "ProofMark — AI時代の納品信頼インフラ",
  category: "AI Delivery Trust Infrastructure",

  /* SEO description（≦160字） */
  metaDescription:
    "ProofMarkは、AIクリエイターと小規模スタジオのための「納品信頼インフラ」。原画を預けずに、検証URL・PDF証明・案件証跡（Evidence Pack）をワンクリックで発行。クライアントへの説明責任を軽くします。",

  /* ────────────────────────────────────────────
   * Hero
   * ──────────────────────────────────────────── */
  hero: {
    eyebrow: "AI Delivery Trust Infrastructure",
    /** 改行を活かす2分割。title2はグラデーション側に流す。 */
    title1: "AI時代の納品信頼を、",
    title2: "ワンクリックで添付する。",
    subtitle:
      "ProofMarkは、原画を預けずに、検証URL・提出用PDF・案件証跡をまとめて発行。AIクリエイターと小規模スタジオの「納品時の説明コスト」を、構造的に軽くします。",
    primaryCta: { authed: "管理画面へ進む", guest: "無料で試す" },
    secondaryCta: { label: "Evidence Pack を見る", href: "/what-it-proves#evidence-pack" },
    badges: [
      "原画アップロード不要",
      "検証URL発行",
      "提出用PDF",
      "NDA案件にも対応",
    ],
  },

  /* ────────────────────────────────────────────
   * Trust Signal Row（ヒーロー直下の3カード）
   * 「証明する / 証明しない / 現在のTSA運用」を即座に提示。
   * 信頼商品としてのページ間整合性を担保する最重要セクション。
   * ──────────────────────────────────────────── */
  trustSignals: {
    proves: {
      label: "✓ 証明すること",
      title: "存在の事実",
      points: [
        "あるSHA-256ハッシュを持つファイルが、特定日時に存在していたこと",
        "発行後、そのファイルが1ビットも改変されていないこと",
        "ProofMarkに依存せず、OpenSSL等で独立検証できること",
      ],
    },
    notProves: {
      label: "✗ 証明しないこと",
      title: "判断・帰属の最終確定",
      points: [
        "著作権の帰属、作品の独自性、合法性",
        "世界で最初にその作品を作ったという事実",
        "特定の裁判・行政手続での証拠採用（採否は事案・法域による）",
      ],
    },
    operation: {
      label: "▲ 現在の運用",
      title: "TSA & Trust Status",
      points: [
        "RFC3161準拠のタイムスタンプを発行",
        "暗号学的Nonce混入によりリプレイ攻撃を遮断",
        "商用TSA（GlobalSign/DigiCert級）への切替計画は Trust Center §4 で随時公開",
      ],
      ctaLabel: "Trust Center を開く",
      ctaHref: "/trust-center#s4",
    },
  },

  /* ────────────────────────────────────────────
   * Evidence Pack
   * 「証明書」ではなく「納品で使える証拠パック」を売る。
   * これがProofMarkの差別化の核。
   * ──────────────────────────────────────────── */
  evidencePack: {
    label: "Evidence Pack",
    title: "証明書ではなく、納品できる“証拠パック”を出す。",
    description:
      "ProofMarkは、検証URL・提出用PDF・案件サマリー・独立検証手順までを1案件単位でまとめて発行します。クライアントは原画なしで「いつ・誰の・どの納品物か」を確認でき、NDA案件も“存在した実績”として可視化できます。",
    items: [
      "提出用PDF証明書（クライアント送付対応）",
      "公開検証URL + QRコード",
      "SHA-256ハッシュ & RFC3161タイムスタンプ",
      "Chain of Evidence（制作工程の連鎖）",
      "クライアント提出用カバーレター（日/英）",
      "独立検証スクリプト同梱（OpenSSL/Python）",
    ],
    cta: "Evidence Pack の詳細",
  },

  /* ────────────────────────────────────────────
   * Two Modes
   * 「Private Proof」「Shareable Proof」の差を、UXレベルで明示。
   * Home / How it Works / Trust Center の説明を完全一致させる。
   * ──────────────────────────────────────────── */
  modes: {
    heading: "案件に合わせて、見せ方を選べます。",
    subheading:
      "デフォルトは Private Proof。原本をサーバーに送らない設計を、UXレベルで実現しています。",
    private: {
      name: "Private Proof",
      tagline: "推奨 / NDA・機密案件向け",
      description:
        "原画はサーバーに送信されません。ブラウザ内で SHA-256 を計算し、ハッシュとメタデータだけを ProofMark が受け取ります。運営側も原画を視認できません。",
      points: [
        "原画はブラウザ外に出ない",
        "独立検証可能なRFC3161トークン",
        "NDA案件でも“存在した実績”として可視化",
      ],
    },
    shareable: {
      name: "Shareable Proof",
      tagline: "ポートフォリオ / 提出公開向け",
      description:
        "SNSシェア・ポートフォリオ掲載・納品提出に使う表示用画像のみ、セキュアストレージに保存します。クリエイターがコントロールした状態で公開検証ページを共有できます。",
      points: [
        "公開検証ページ + OGカード自動生成",
        "ポートフォリオ埋め込みウィジェット",
        "クライアントが原画なしで真正性を確認可能",
      ],
    },
  },

  /* ────────────────────────────────────────────
   * Pain Points（"防衛"より"営業加速"の文脈）
   * ──────────────────────────────────────────── */
  pains: {
    heading: "いい作品なのに、納品の説明で損していませんか。",
    subheading: "AIクリエイターと小規模スタジオが、毎案件で消耗している3つの場面。",
    items: [
      {
        emoji: "🗣️",
        tag: "納品信頼",
        title: "クライアントに“いつ作ったか”を毎回説明している",
        desc: "口頭やスクショでは弱い。検証URLとPDFを添えて出せば、説明は1分で終わる。",
      },
      {
        emoji: "🤐",
        tag: "NDA実績化",
        title: "NDA案件は実績にしづらく、営業で損している",
        desc: "原画を出せなくても、ハッシュと工程の存在は示せる。“黒い石板”として営業に使える。",
      },
      {
        emoji: "🧯",
        tag: "トラブル予防",
        title: "万一のとき、証跡をまとめ直すのに時間がかかる",
        desc: "案件単位でEvidence Packが残れば、初動の負荷が大きく下がる。揉める前の予防が一番安い。",
      },
    ],
  },

  /* ────────────────────────────────────────────
   * Engineering Pillars
   * Phase 4 で獲得した「絶対防衛機能群」をユーザーに見える形で提示。
   * ──────────────────────────────────────────── */
  pillars: {
    heading: "信用を売るために、内部から作り直しました。",
    subheading: "ProofMarkは、ゼロトラストとWORM原則の上に立っています。",
    items: [
      {
        title: "Zero-Trust Architecture",
        desc: "クライアントのリクエストを一切信用せず、サーバー側でユーザーIDと所有権を毎回再検証。任意URL送信や鍵の流用を構造的に遮断。",
      },
      {
        title: "Cryptographic Nonce (RFC3161)",
        desc: "タイムスタンプ要求ごとに16バイトの暗号乱数を混入。リプレイ攻撃を理論上不可能にし、証拠としての一意性を担保。",
      },
      {
        title: "Idempotency & Rate Limiting",
        desc: "二重発行と多重請求を防ぐ冪等処理、エッジでのレートリミットにより、悪意のリクエストはSupabaseに到達する前に弾く。",
      },
      {
        title: "WORM (Write-Once, Read-Many)",
        desc: "発行済みのハッシュ・トークン・タイムスタンプはデータベース層で書換え禁止。運営者本人にも改ざんできない設計。",
      },
      {
        title: "PII-Scrubbed Audit Logs",
        desc: "Sentry等の監査ログに送る情報から、Authorization・Cookieなど個人を特定し得る情報を自動で削除（PIIスクラブ）。",
      },
      {
        title: "Trustless Independent Verification",
        desc: "ProofMarkが消滅しても、OpenSSL/Pythonの標準ツールだけで証拠を検証可能。proofmark-jp/verify を公開リポジトリで配布。",
      },
    ],
    note:
      "詳細仕様はTrust Centerで完全公開しています。",
    ctaLabel: "Trust Center で完全仕様を読む",
    ctaHref: "/trust-center",
  },

  /* ────────────────────────────────────────────
   * Use Cases
   * ──────────────────────────────────────────── */
  useCases: {
    heading: "こんな現場で、納品信頼が変わります。",
    items: [
      { emoji: "🎨", title: "AIイラストの受託納品に", desc: "1クリックで提出用PDF＋検証URLを添付。説明工数が下がる。" },
      { emoji: "🎬", title: "動画・ショート制作の提出管理に", desc: "案件ごとにEvidence Pack。差し戻し時の証跡管理が楽になる。" },
      { emoji: "🏢", title: "小規模スタジオの案件台帳に", desc: "席を分けてチーム運用。誰が・いつ・何を出したかを可視化。" },
      { emoji: "🤐", title: "NDA案件の営業実績づくりに", desc: "原画を出さずに“存在した実績”を提示。受注率の底上げに。" },
      { emoji: "🏆", title: "コンテスト提出時の証跡整理に", desc: "提出時刻と工程をハッシュ単位で記録。応募の信頼を補強。" },
      { emoji: "🛡️", title: "無断転載時の初動対応に", desc: "削除依頼テンプレ（日/英）と証拠を一式で提示できる。" },
    ],
  },

  /* ────────────────────────────────────────────
   * Final CTA
   * ──────────────────────────────────────────── */
  finalCta: {
    title: "次の納品から、“説明で消耗しない”状態を作りませんか。",
    subtitle:
      "登録不要のSpot発行から、本格運用のCreator/Studioまで。先着100名はCreator 3ヶ月無料 + 創設者バッジ付き。",
    primary: { label: "無料で試す", href: "/auth?mode=signup" },
    secondary: { label: "料金プランを見る", href: "/pricing" },
  },

  /* ────────────────────────────────────────────
   * 公的禁則ワード（誤用防止メモ：本ファイルでは使わない）
   *  - 「先取権」「必ず勝てる」「裁判で勝てる」「絶対に守る」
   *  - 「改ざん不可能」「定期監査済み」（裏取りなしの断定）
   *  - 「企業レベル完全準拠」（実装前の断定）
   * これらはコード検索で grep をかけ、Lintで除去対象にすること。
   * ──────────────────────────────────────────── */
} as const;

export type ProofmarkCopy = typeof PROOFMARK_COPY;
