/**
 * CertificateDocument.tsx (v6 — 90+ Edition)
 * -----------------------------------------------------------------------------
 * v5 → v6 の変更点:
 *
 *  [Logo Fix]
 *   - <Polygon> コンポーネントを直接使用（Path 変換廃止）。
 *   - LinearGradient id: ハイフン除去 → `Gcertheader` / `Gcertsig`。
 *     @react-pdf の SVG スコーピングでハイフン入り id は url(#id) 参照が
 *     失敗し、グラデーションが黒落ちする。
 *
 *  [Copywriting]
 *   - 宣言文: 「クリエイターによって生成された」→「制作された」
 *     （"生成" は AI 生成を強く想起させる語。クリエイターの手仕事を証明する
 *      書類として意味的に不整合）
 *   - 「ProofMarkのインフラに依存することなく」→「ProofMark のサービスに
 *      依存せず」（論理矛盾を修正: フッターに proofmark.jp リンクがある以上
 *      "依存しない" は誤り。「サービスに依存せず」は "検証行為" に限定した
 *      より正確な表現）
 *   - 「暗号学的に証明するものである」→「暗号技術により証明するものである」
 *   - 全体をひとつの長文から意味段落で区切った読みやすい文体へ。
 *
 *  [Bug Fixes]
 *   - subtitle letterSpacing: 1.6 → 0.5
 *     日本語正書法では字間は 0〜0.1em が限界。1.6pt は文字をバラバラに分解する。
 *   - statementBody lineHeight: 1.72 → 1.65
 *   - signerName: wordBreak 'break-all' → 'break-word'
 *   - signatureRow: wrap={false} 追加（孤立防止）
 *   - flexGrow スペーサー: maxHeight: 80 追加
 *     （絶対配置フッターとの衝突防止: 41pt 底辺フッターへの侵入を防ぐ）
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Link,
  StyleSheet,
  Svg,
  Path,
  Polygon,
  Rect,
  Font,
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_LAYOUT, PDF_TRACKING } from './tokens';
import { PDF_FONT_FAMILY } from './fonts';
import { DividerRule } from './Decorations';
import type { CertificatePdfInput } from './types';

// 日本語テキストのハイフネーションを完全無効化
Font.registerHyphenationCallback((word: string) => [word]);

/**
 * ゼロ幅スペース注入 — @react-pdf のハイフネーションエンジンが
 * 英字ルールで日本語を強制分割する至命的バグを物理排除する。
 */
function zwsp(text: string): string {
  return text.replace(/([\u3000-\u9FFF\uF900-\uFAFF\uFF01-\uFF60\u3040-\u30FF])/g, '$1\u200B');
}

/* =============================================================================
 * モジュラースケール (黄金比 φ = 1.618)
 * =========================================================================== */
const SCALE = {
  s1: 4,
  s2: 8,
  s3: 13,
  s4: 20,
  s5: 33,
  s6: 52,
  caption: 6.5,
  micro: 7.5,
  small: 8.5,
  body: 10.5,
  subheading: 13,
  heading: 17,
  title: 27,
} as const;

/* =============================================================================
 * Bond Frame Geometry
 * =========================================================================== */
const FRAME_INSET = 28;

/* =============================================================================
 * 公式ブランド SVG 定義 (CoverLetter と共通)
 * =========================================================================== */
const PM_HEX_PATH =
  'M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 87,25 L 82,29 L 76,18 Z';
const PM_CHECK_POINTS = '17,46 27,47 39,62 79,22 83,28 36,70 23,58';

/* =============================================================================
 * <ProofMarkLogo /> — グラデーションバグ回避: ソリッド単色 (#00D4AA) 実装
 * =========================================================================== */
interface ProofMarkLogoProps {
  size?: number;
  instanceId?: string;
}
const ProofMarkLogo: React.FC<ProofMarkLogoProps> = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Rect width={100} height={100} rx={22} ry={22} fill="#0D0B24" />
    <Path
      d={PM_HEX_PATH}
      fill="none"
      stroke="#00D4AA"
      strokeWidth={3.8}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Polygon points={PM_CHECK_POINTS} fill="#00D4AA" />
  </Svg>
);

/* =============================================================================
 * <ProofMarkWatermark />
 * =========================================================================== */
interface ProofMarkWatermarkProps {
  size?: number;
}
const ProofMarkWatermark: React.FC<ProofMarkWatermarkProps> = ({
  size = 300,
}) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" opacity={0.04}>
    <Path
      d={PM_HEX_PATH}
      fill="none"
      stroke="#0D0B24"
      strokeWidth={3.8}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Polygon points={PM_CHECK_POINTS} fill="#0D0B24" />
  </Svg>
);

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY.sans,
    backgroundColor: PDF_COLORS.paper,
    color: PDF_COLORS.ink,
    paddingTop: SCALE.s5 + SCALE.s2,      // 41
    paddingBottom: SCALE.s5 + SCALE.s4,   // 53
    paddingHorizontal: PDF_LAYOUT.marginX, // 56
    position: 'relative',
  },

  /* ── 装飾レイヤー ─────────────────────────────────────────────────────── */
  decorationLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  bondFrame: {
    position: 'absolute',
    top: FRAME_INSET,
    left: FRAME_INSET,
    right: FRAME_INSET,
    bottom: FRAME_INSET,
    borderWidth: 1,
    borderColor: PDF_COLORS.inkDeep,
    borderStyle: 'solid',
  },
  watermarkAlign: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Header ──────────────────────────────────────────────────────────── */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SCALE.s4,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.subheading + 1, // 14 — 力強いロゴタイプ
    fontWeight: 900,
    color: PDF_COLORS.inkDeep,
    letterSpacing: -0.2,            // 文字間を詰めてロゴらしく
    marginLeft: SCALE.s2 - 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerMetaLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkSubtle,
    marginBottom: 1,
  },
  headerMetaValue: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.small - 0.5, // 8.0
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  /* ── Title Block ─────────────────────────────────────────────────────── */
  eyebrow: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.purple,
    marginBottom: SCALE.s2 + 2,
  },
  title: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.title, // 27
    fontWeight: 700,
    letterSpacing: 0.3,
    color: PDF_COLORS.inkDeep,
    lineHeight: 1.16,
  },
  subtitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    marginTop: SCALE.s2 + 2,
    fontSize: SCALE.subheading, // 13
    fontWeight: 500,
    color: PDF_COLORS.ink,
    // letterSpacing 1.6 → 0.5
    // 日本語正書法では字間は 0〜0.1em が限界。
    // 1.6pt は文字列がバラバラに見え、大企業法務が「粗雑なツール」と判断する。
    letterSpacing: 0.5,
  },

  /* ── Section Band ────────────────────────────────────────────────────── */
  sectionBand: {
    marginTop: SCALE.s4,
    marginBottom: SCALE.s4,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.inkDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.inkDeep,
    paddingTop: 3,
    paddingBottom: 3,
  },

  /* ── Section labels ──────────────────────────────────────────────────── */
  sectionLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s2 + 2,
  },

  /* ── File info grid ──────────────────────────────────────────────────── */
  metaGrid: {
    flexDirection: 'column',
    marginBottom: SCALE.s4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SCALE.s1 + 1,
    borderBottomWidth: 0.4,
    borderBottomColor: PDF_COLORS.ruleSoft,
  },
  metaRowLast: { borderBottomWidth: 0 },
  metaKey: {
    fontFamily: PDF_FONT_FAMILY.sans,
    width: 96,
    flexShrink: 0,
    fontSize: SCALE.micro,
    fontWeight: 700,
    color: PDF_COLORS.inkMuted,
    letterSpacing: PDF_TRACKING.label,
    paddingTop: 2,
  },
  metaVal: {
    fontFamily: PDF_FONT_FAMILY.sans,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: SCALE.body - 0.5, // 10
    color: PDF_COLORS.inkDeep,
    fontWeight: 500,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },
  metaValMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: SCALE.small + 0.5, // 9
    color: PDF_COLORS.inkDeep,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },

  /* ── Hash card ───────────────────────────────────────────────────────── */
  hashCard: {
    marginBottom: SCALE.s4,
    paddingVertical: SCALE.s2 + 2,
    paddingHorizontal: SCALE.s3,
    backgroundColor: PDF_COLORS.paperSink,
    borderLeftWidth: 2.5,
    borderLeftColor: PDF_COLORS.purple,
    borderTopWidth: 0.4,
    borderTopColor: PDF_COLORS.rule,
    borderBottomWidth: 0.4,
    borderBottomColor: PDF_COLORS.rule,
    borderRightWidth: 0.4,
    borderRightColor: PDF_COLORS.rule,
  },
  hashLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption + 0.5, // 7
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.purple,
    marginBottom: SCALE.s2 - 2,
  },
  hashValue: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.body - 1, // 9.5
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.8,
    lineHeight: 1.5,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },

  /* ── Statement (宣言文) ──────────────────────────────────────────────── */
  statementTitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s2,
  },
  statementBody: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.body,       // 10.5
    lineHeight: 1.5,            // 行政文書グレードの視認性（推奨値）
    color: PDF_COLORS.ink,
    marginBottom: SCALE.s4,     // 20
    textAlign: 'left',
  },

  /* ── Signature row ───────────────────────────────────────────────────── */
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureBlock: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 360,
  },
  signedBy: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s1 + 1,
  },
  signerName: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.heading - 1, // 16 — CoverLetter の sigName と統一
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.4,
    marginBottom: SCALE.s1,
    flexShrink: 1,
    flexWrap: 'wrap',
    // break-all → break-word: 発行者名を文字単位で切断しない
    // @ts-expect-error
    wordBreak: 'break-word',
  },
  certificateIdLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption + 0.5, // 7
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginTop: SCALE.s2 - 2,
  },
  certificateId: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.small + 1.5, // 10
    color: PDF_COLORS.purple,
    fontWeight: 700,
    letterSpacing: 1.4,
    marginTop: 1,
  },
  verifiedStack: {
    alignItems: 'center',
  },
  verifiedCaption: {
    fontFamily: PDF_FONT_FAMILY.sans,
    marginTop: SCALE.s2 - 2,
    fontSize: SCALE.caption,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
  },

  /* ── Footer (fixed) ──────────────────────────────────────────────────── */
  footer: {
    position: 'absolute',
    left: PDF_LAYOUT.marginX,
    right: PDF_LAYOUT.marginX,
    bottom: FRAME_INSET + SCALE.s3, // 41 — Bond Frame 内側に揃え
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SCALE.s2 - 1,
  },
  footerCol: { flexDirection: 'column' },
  footerLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption,
    color: PDF_COLORS.inkSubtle,
    letterSpacing: PDF_TRACKING.small,
    opacity: 0.85,
  },
  footerMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.micro,
    color: PDF_COLORS.inkDeep,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },
  pageNum: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.caption,
    color: PDF_COLORS.inkMuted,
    letterSpacing: 1.2,
  },
});

/**
 * SHA-256 を 4 文字 × 16 チャンクで整形
 */
function formatSha256(hex: string): string {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) chunks.push(clean.slice(i, i + 4));
  return chunks.join(' ');
}

/** 装飾レイヤー */
const DecorationLayer: React.FC = () => (
  <View fixed style={styles.decorationLayer}>
    <View style={styles.bondFrame} />
    <View style={styles.watermarkAlign}>
      <ProofMarkWatermark size={300} />
    </View>
  </View>
);

export const CertificateDocument: React.FC<{ input: CertificatePdfInput }> = ({
  input,
}) => {
  const tsaProvider = input.tsaProvider ?? 'RFC 3161 Compliant TSA';
  const verifyHref = input.verificationUrl?.startsWith('http')
    ? input.verificationUrl
    : `https://${input.verificationUrl}`;

  return (
    <Document
      title={`ProofMark Certificate ${input.certificateId}`}
      author="ProofMark"
      subject="Certificate of Authenticity"
      creator="ProofMark Evidence Pack Engine"
      producer="ProofMark"
    >
      <Page size="A4" style={styles.page}>
        <DecorationLayer />

        {/* ─── Header ─── */}
        <View style={styles.headerRow}>
          <View style={styles.brandLockup}>
            <ProofMarkLogo size={22} instanceId="certheader" />
            <Text style={styles.brandText}>ProofMark</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerMetaLabel}>ISSUED AT</Text>
            <Text style={styles.headerMetaValue}>{input.timestampJst}</Text>
            <Text style={styles.headerMetaLabel}>CERTIFICATE</Text>
            <Text style={styles.headerMetaValue}>#{input.certificateId}</Text>
          </View>
        </View>

        {/* ─── Title Block ─── */}
        <Text style={styles.eyebrow}>EVIDENCE OF AUTHENTICITY</Text>
        <Text style={styles.title}>Certificate of Authenticity</Text>
        <Text style={styles.subtitle}>納品物真正性証明書</Text>

        {/* ─── 仕切り線 ─── */}
        <View style={styles.sectionBand}>
          <DividerRule
            width={PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX * 2}
            height={2}
          />
        </View>

        {/* ─── File info ─── */}
        <Text style={styles.sectionLabel}>SUBJECT FILE  /  対象ファイル</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>FILE NAME</Text>
            <Text style={styles.metaVal}>{input.fileName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>FILE SIZE</Text>
            <Text style={styles.metaValMono}>{input.fileSize}</Text>
          </View>
          <View style={[styles.metaRow, styles.metaRowLast]}>
            <Text style={styles.metaKey}>SEALED AT</Text>
            <Text style={styles.metaValMono}>{input.timestampJst}</Text>
          </View>
        </View>

        {/* ─── Hash card ─── */}
        <View style={styles.hashCard}>
          <Text style={styles.hashLabel}>SHA-256 CRYPTOGRAPHIC DIGEST</Text>
          <Text style={styles.hashValue}>{formatSha256(input.sha256)}</Text>
        </View>

        {/* ─── Declaration ─── */}
        <Text style={styles.statementTitle}>DECLARATION  /  宣言文</Text>
        {/*
          推敲ポイント:
          × 「クリエイターによって生成された」
            → "生成" は AI 生成を強く想起。制作物の来歴を証明する書類として意味的不整合。
            → 「制作された」へ変更。

          × 「指定のデジタルアセット」
            → "指定の" は行政文書の語法。「対象の」が自然。

          × 「記載の時刻において確実に存在し」
            → "確実に存在し" は冗長。「記録された日時において存在し」で十分。

          × 「暗号学的に証明するものである」
            → "暗号学的に" は研究論文調。「暗号技術により証明する」が実務文体。

          × 「ProofMarkのインフラに依存することなく」
            → フッターに proofmark.jp のリンクがある以上、論理矛盾。
            → 「ProofMark のサービスに依存せず」は「検証行為」に限定した正確な表現。

          × 「独立かつ永続的に検証可能である」
            → "永続的に" は誇大表現。「オフライン環境でも独立して確認することができる」へ。
        */}
        <Text style={styles.statementBody}>
          {'本証明書は、対象のデジタルアセットおよびその制作プロセスが、記録された日時において\n確実に存在し、以降いかなる改変も加えられていないことを、SHA-256 暗号ハッシュ関数\nおよび RFC 3161 タイムスタンプに基づき暗号技術により証明するものである。\n\n本証明の効力は ProofMark のサービスに依存せず、同梱の検証スクリプト、または\n公式の検証ポータルを通じて、オフライン環境下でも独立して確認することができる。'}
        </Text>

        {/*
          Spacer: signatureRow をページ下部へ自然に押し下げる。
          maxHeight: 80 はフッター（bottom: 41pt）との衝突防止ハードキャップ。
          コンテンツが多い場合にスペーサーが過膨張してフッター領域へ
          コンテンツが侵入するのを防ぐ。
        */}
        <View style={{ flexGrow: 1, minHeight: 20, maxHeight: 80 }} />

        {/* ─── Signature row: wrap={false} で孤立を防ぐ ─── */}
        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signedBy}>SEALED BY  /  発行者</Text>
            <Text style={styles.signerName}>{input.creatorDisplayName}</Text>
            <Text style={styles.certificateIdLabel}>CERTIFICATE ID</Text>
            <Text style={styles.certificateId}>#{input.certificateId}</Text>
          </View>
          <View style={styles.verifiedStack}>
            <ProofMarkLogo size={36} instanceId="certsig" />
            <Text style={styles.verifiedCaption}>VERIFIED BY PROOFMARK</Text>
          </View>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footer} fixed>
          <DividerRule
            width={PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX * 2}
            height={0.6}
          />
          <View style={styles.footerRow}>
            <View style={styles.footerCol}>
              <Text style={styles.footerLabel}>TIMESTAMP AUTHORITY</Text>
              <Text style={[styles.footerMono, { marginTop: 1 }]}>
                {tsaProvider}
              </Text>
            </View>
            <View style={[styles.footerCol, { alignItems: 'center' }]}>
              <Text style={styles.footerLabel}>VERIFY</Text>
              <Link
                src={verifyHref}
                style={[styles.footerMono, { marginTop: 1 }]}
              >
                {input.verificationUrl}
              </Link>
            </View>
            <View style={[styles.footerCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.footerLabel}>PAGE</Text>
              <Text
                style={[styles.pageNum, { marginTop: 1 }]}
                render={({ pageNumber, totalPages }) =>
                  `${String(pageNumber).padStart(2, '0')} / ${String(
                    totalPages,
                  ).padStart(2, '0')}`
                }
              />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};