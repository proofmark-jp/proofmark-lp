/**
 * CoverLetterDocument.tsx (v6 — 90+ Edition)
 * -----------------------------------------------------------------------------
 * v5 → v6 の変更点:
 *
 *  [Logo Fix]
 *   - PM_CHECK_POINTS を Polygon コンポーネントで直接レンダリング。
 *     旧 Path 変換では @react-pdf の fill-rule 解釈差異でズレが生じていた。
 *   - LinearGradient id からハイフンを排除。
 *     `url(#pmLogoGrad-cl-header)` 形式は @react-pdf の SVG スコーピング上
 *     参照が失敗しストロークが黒落ちする既知バグを引き起こしていた。
 *     → `Gclheader` / `Gclsig` 等のシンプルな英数字IDへ変更。
 *
 *  [Copywriting]
 *   - body: AI翻訳調の「暗号学的に証明」「数学的に保証」等を自然な日本語法務文体へ。
 *   - 3 Pillars: 技術者向け説明文を、クライアント（法務・制作会社）が
 *     一読で理解できる平易な文章へ書き換え。
 *   - Verify card: 「貴社内のみで完結する形で」等の冗長表現を削除。
 *
 *  [Bug Fixes]
 *   - treeName / sigName: wordBreak 'break-all' → 'break-word'
 *   - sigName fontSize: 13 → 16 (Certificate の signerName と統一)
 *   - sigRow: wrap={false} 追加（孤立防止）
 *   - DEFAULT_FILE_TREE: 偽ファイルサイズを '—' に変更、"本書" 自己言及を修正
 *   - body lineHeight: 1.78 → 1.65 (PDF 日本語の適正行間)
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Link,
  Image,
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
import type { CoverLetterPdfInput } from './types';

// 日本語テキストのハイフネーションを完全無効化
Font.registerHyphenationCallback((word: string) => [word]);

/**
 * ゼロ幅スペース注入 — @react-pdf のハイフネーションエンジンが
 * 英字ルールで日本語を強制分割する致命的バグを物理排除する。
 * 日本語Unicode文字間に U+200B を挿入し、
 * レンダラーに対して任意の文字間での折り返しを許可させる。
 */
function zwsp(text: string): string {
  // ASCII文字・記号・スペース以外の文字（主に日本語）の間に U+200B を挿入
  return text.replace(/([\u3000-\u9FFF\uF900-\uFAFF\uFF01-\uFF60\u3040-\u30FF])/g, '$1\u200B');
}

/* =============================================================================
 * モジュラースケール (黄金比 φ = 1.618) — Certificate と完全共通
 * =========================================================================== */
const SCALE = {
  s1: 4,
  s2: 8,
  s3: 13,
  s4: 14,   // compressed: was 20
  s5: 22,   // compressed: was 33
  s6: 52,
  caption: 6.5,
  micro: 7.5,
  small: 8.5,
  body: 10.5,
  subheading: 13,
  heading: 17,
  title: 23,
} as const;

/* =============================================================================
 * Bond Frame Geometry
 * =========================================================================== */
const FRAME_INSET = 28;

/* =============================================================================
 * 公式ブランド SVG 定義
 * NOTE: LinearGradient の id にハイフンを含めると @react-pdf の
 *       SVG スコーピングで url(#id) 参照が失敗し、ストロークが黒落ちする。
 *       instanceId の英数字のみを抽出してプレフィックス "G" を付与すること。
 * =========================================================================== */
const PM_HEX_PATH =
  'M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 87,25 L 82,29 L 76,18 Z';
// Polygon 座標 — Path('M...Z') 変換より Polygon コンポーネントを直接使用する
const PM_CHECK_POINTS = '17,46 27,47 39,62 79,22 83,28 36,70 23,58';

/* =============================================================================
 * <ProofMarkLogo />
 *  公式 SVG を @react-pdf プリミティブへ完全準拠翻訳
 *  - <polygon> → <Polygon> (Path 変換不要)
 *  - LinearGradient id: ハイフンなし英数字のみ
 * =========================================================================== */
/* =============================================================================
 * <ProofMarkLogo /> — グラデーションバグ回避: ソリッド単色 (#00D4AA) 実装
 * @react-pdf の LinearGradient url(#id) 参照不具合を完全回避する安全実装。
 * =========================================================================== */
interface ProofMarkLogoProps {
  size?: number;
  instanceId?: string;
}
const ProofMarkLogo: React.FC<ProofMarkLogoProps> = ({ size = 20 }) => (
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
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: PDF_LAYOUT.marginX,
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
    marginBottom: SCALE.s3,
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
    letterSpacing: -0.2,            // 文字間を詳めてロゴらしく
    marginLeft: SCALE.s2 - 2,
  },
  headerTag: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small,
    color: PDF_COLORS.inkMuted,
    letterSpacing: PDF_TRACKING.label,
    fontWeight: 700,
  },

  /* ── Section Band ────────────────────────────────────────────────────── */
  sectionBand: {
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.inkDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.inkDeep,
    paddingTop: 3,
    paddingBottom: 3,
  },

  /* ── Title ───────────────────────────────────────────────────────────── */
  eyebrow: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.teal,
    marginBottom: SCALE.s2 + 2,
  },
  title: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.title, // 23
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.6,
    marginBottom: SCALE.s4,
    lineHeight: 1.16,
  },

  /* ── Body ────────────────────────────────────────────────────────────── */
  body: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: 10,                // compressed: was 10.5
    lineHeight: 1.5,
    color: PDF_COLORS.ink,
    marginBottom: 16,            // fixed
    textAlign: 'left',
  },
  bodyEmphasis: {
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
  },

  /* ── Section heading ───────────────────────────────────────────────────── */
  sectionH: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small,
    fontWeight: 700,
    color: PDF_COLORS.purple,
    marginTop: SCALE.s1,
    marginBottom: SCALE.s3,
  },
  /* letterSpacing を英字部のみに局限するため、日本語部は別 Text で包む */
  sectionHEn: {
    letterSpacing: PDF_TRACKING.eyebrow,
  },

  /* ── Three Pillars ───────────────────────────────────────────────────────── */
  pillarRow: {
    flexDirection: 'row',
    gap: SCALE.s2,
    marginBottom: 16,
  },
  pillar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    padding: SCALE.s3 - 1,
    backgroundColor: PDF_COLORS.paperSink,
    borderTopWidth: 2,
    borderTopColor: PDF_COLORS.purple,
    borderRightWidth: 0.4,
    borderRightColor: PDF_COLORS.rule,
    borderBottomWidth: 0.4,
    borderBottomColor: PDF_COLORS.rule,
    borderLeftWidth: 0.4,
    borderLeftColor: PDF_COLORS.rule,
    borderRadius: 2,
  },
  pillarBadge: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.caption - 0.3, // 6.2
    fontWeight: 700,
    color: PDF_COLORS.purple,
    letterSpacing: 1.2,
    marginBottom: SCALE.s1 + 1,
  },
  pillarTitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small + 1, // 9.5
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    marginBottom: SCALE.s1 + 1,
  },
  pillarText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro + 0.5, // 8
    lineHeight: 1.7,
    color: PDF_COLORS.ink,
    textAlign: 'left',
    flexWrap: 'wrap',
    // @ts-expect-error wordBreak は @react-pdf にて実装されているが型未公開
    wordBreak: 'break-word',
  },

  /* ── File tree ────────────────────────────────────────────────────────────── */
  treeWrap: {
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.inkDeep,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.inkDeep,
    marginBottom: 16,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SCALE.s2 - 1,
    borderBottomWidth: 0.4,
    borderBottomColor: PDF_COLORS.ruleSoft,
  },
  treeRowLast: { borderBottomWidth: 0 },
  treeName: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.small + 0.5, // 9
    color: PDF_COLORS.inkDeep,
    flexWrap: 'wrap',
    // break-all → break-word: ファイル名を文字単位で切断しない
    // @ts-expect-error
    wordBreak: 'break-word',
  },
  treeDesc: {
    flexBasis: 210,
    flexShrink: 1,
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro + 0.5, // 8
    color: PDF_COLORS.inkMuted,
    lineHeight: 1.5,
  },
  treeSize: {
    width: 56,
    textAlign: 'right',
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.micro + 0.5,
    color: PDF_COLORS.inkMuted,
  },

  /* ── Verify card ───────────────────────────────────────────────────────────── */
  verifyCard: {
    borderWidth: 1,
    borderColor: PDF_COLORS.inkDeep,
    borderStyle: 'solid',
    padding: SCALE.s4 - 2,
    borderRadius: 4,
    marginBottom: 16,
  },
  verifyEyebrow: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro - 0.2, // 7.3
    color: PDF_COLORS.purple,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    marginBottom: SCALE.s2 - 2,
  },
  verifyTitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.heading - 4, // 13
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    marginBottom: SCALE.s2 + 2,
    letterSpacing: 0.4,
  },
  verifyBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SCALE.s3,
  },
  verifyTextCol: {
    flexGrow: 1,
    flexShrink: 1,
  },
  verifyText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.body - 1, // 9.5
    color: PDF_COLORS.ink,
    lineHeight: 1.65,
    marginBottom: SCALE.s3,
    textAlign: 'left',
  },
  verifyMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    color: PDF_COLORS.inkDeep,
  },
  verifyUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SCALE.s2,
    paddingTop: SCALE.s2 + 2,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.ruleSoft,
  },
  verifyUrlLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption + 0.5, // 7
    color: PDF_COLORS.purple,
    fontWeight: 700,
    letterSpacing: 1.4,
  },
  verifyUrl: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.small + 1, // 9.5
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.4,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },
  qrFrame: {
    width: 72,
    height: 72,
    padding: 4,
    backgroundColor: PDF_COLORS.paper,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qrImage: {
    width: 60,
    height: 60,
  },
  qrCaption: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption - 0.5, // 6
    color: PDF_COLORS.inkMuted,
    letterSpacing: 1,
    marginTop: SCALE.s1 + 1,
    textAlign: 'center',
  },
  qrStack: {
    alignItems: 'center',
    flexShrink: 0,
  },

  /* ── Signature ───────────────────────────────────────────────────────── */
  sigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: SCALE.s1,
  },
  sigBlock: { flexGrow: 1, flexShrink: 1, maxWidth: 360 },
  sigLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s1 + 1,
    fontWeight: 700,
  },
  sigName: {
    fontFamily: PDF_FONT_FAMILY.sans,
    // Certificate の signerName (16pt) と統一 — 同一 Evidence Pack 内での一貫性
    fontSize: SCALE.heading - 1, // 16
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.3,
    flexShrink: 1,
    flexWrap: 'wrap',
    // break-all → break-word: 発行者名を文字単位で切断しない
    // @ts-expect-error
    wordBreak: 'break-word',
  },
  sigMeta: {
    fontFamily: PDF_FONT_FAMILY.mono,
    marginTop: SCALE.s1 + 1,
    fontSize: SCALE.small,
    color: PDF_COLORS.inkMuted,
  },
  verifiedStack: { alignItems: 'center' },
  verifiedStackCaption: {
    fontFamily: PDF_FONT_FAMILY.sans,
    marginTop: SCALE.s1 + 1,
    fontSize: SCALE.caption - 0.2, // 6.3
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.small,
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
 * 同梱ファイルツリー
 * NOTE: ファイルサイズは動的に渡すこと。ハードコードした数値は
 *       実際の ZIP と不一致になりクライアントの信頼を損なう。
 */
const DEFAULT_FILE_TREE: ReadonlyArray<{
  name: string;
  size: string;
  description?: string;
}> = [
  {
    name: 'Certificate_of_Authenticity.pdf',
    size: '—',
    description: '真正性証明書',
  },
  {
    name: 'Cover_Letter.pdf',
    size: '—',
    description: 'クライアント向け添え状（本書）',
  },
  {
    name: 'TIMESTAMP.tsr',
    size: '—',
    description: 'RFC 3161 タイムスタンプ応答',
  },
  { name: 'verify.sh',          size: '—', description: 'シェル検証スクリプト' },
  { name: 'verify.py',          size: '—', description: 'Python 検証スクリプト' },
  { name: 'HOW_TO_VERIFY.txt',  size: '—', description: '検証手順（人間可読）' },
];

/** 装飾レイヤー */
const DecorationLayer: React.FC = () => (
  <View fixed style={styles.decorationLayer}>
    <View style={styles.bondFrame} />
    <View style={styles.watermarkAlign}>
      <ProofMarkWatermark size={300} />
    </View>
  </View>
);

export const CoverLetterDocument: React.FC<{ input: CoverLetterPdfInput }> = ({
  input,
}) => {
  const tree =
    input.fileTree && input.fileTree.length > 0
      ? input.fileTree
      : DEFAULT_FILE_TREE;
  const tsaProvider = input.tsaProvider ?? 'RFC 3161 Compliant TSA';
  const verifyHref = input.verificationUrl?.startsWith('http')
    ? input.verificationUrl
    : `https://${input.verificationUrl}`;
  const hasQr = Boolean(input.qrCodeDataUrl);

  return (
    <Document
      title="ProofMark Cover Letter"
      author="ProofMark"
      subject="Evidence Pack Cover Letter"
      creator="ProofMark Evidence Pack Engine"
      producer="ProofMark"
    >
      <Page size="A4" style={styles.page}>
        <DecorationLayer />

        {/* ─── Header ─── */}
        <View style={styles.headerRow}>
          <View style={styles.brandLockup}>
            <ProofMarkLogo size={20} instanceId="clheader" />
            <Text style={styles.brandText}>ProofMark</Text>
          </View>
          <Text style={styles.headerTag}>COVER LETTER · 添え状</Text>
        </View>

        {/* ─── 仕切り線 ─── */}
        <View style={styles.sectionBand}>
          <DividerRule
            width={PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX * 2}
            height={2}
          />
        </View>

        {/* ─── Title ─── */}
        <Text style={styles.eyebrow}>FOR THE CLIENT  /  ご担当者様へ</Text>
        <Text style={styles.title}>納品物の真正性証明について</Text>

        {/* ─── Body ─── */}
        <Text style={styles.body}>
          {'\u672c\u30d1\u30c3\u30b1\u30fc\u30b8\uff08Evidence Pack\uff09\u306f\u3001\u30af\u30ea\u30a8\u30a4\u30bf\u30fc\u304c\u5236\u4f5c\u30fb\u7d0d\u54c1\u3057\u305f\u30c7\u30b8\u30bf\u30eb\u30c7\u30fc\u30bf\u306e\n\u5b58\u5728\u4e8b\u5b9f\u304a\u3088\u3073\u5236\u4f5c\u30d7\u30ed\u30bb\u30b9\u306e\u5b8c\u5168\u6027\u3092\u3001\u6697\u53f7\u6280\u8853\u306b\u3088\u3063\u3066\u5ba2\u89b3\u7684\u306b\u8a3c\u660e\u3059\u308b\u516c\u5f0f\u8a18\u9332\u6587\u66f8\u3067\u3059\u3002\n\nRFC 3161 \u898f\u683c\u306b\u6e96\u62e0\u3057\u305f\u30bf\u30a4\u30e0\u30b9\u30bf\u30f3\u30d7\u8a8d\u8a3c\u5c40\u304c\u767a\u884c\u3059\u308b\u7f72\u540d\u30c8\u30fc\u30af\u30f3\u306b\u3088\u308a\u3001\n\u5bfe\u8c61\u30c7\u30fc\u30bf\u306b\u4e00\u5207\u306e\u6539\u5909\u304c\u52a0\u3048\u3089\u308c\u3066\u3044\u306a\u3044\u3053\u3068\u304c\u3001\u7b2c\u4e09\u8005\u306b\u5bfe\u3057\u5ba2\u89b3\u7684\u306b\u7acb\u8a3c\u53ef\u80fd\u3067\u3059\u3002\n\n\u30af\u30ea\u30a8\u30a4\u30bf\u30fc\u306e\u8457\u4f5c\u6a29\u4fdd\u8b77\u3068\u3001\u8cb4\u793e\u306b\u304a\u3051\u308b\u9069\u6b63\u306a\u30b3\u30f3\u30c6\u30f3\u30c4\u5229\u7528\u306e\u4e21\u7acb\u3092\u76ee\u7684\u3068\u3057\u3066\u304a\u308a\u3001\n\u539f\u672c\u30d5\u30a1\u30a4\u30eb\u304c\u5916\u90e8\u3078\u9001\u4fe1\u3055\u308c\u308b\u3053\u3068\u306a\u304f\u3001\u5b89\u5168\u304b\u3064\u72ec\u7acb\u3057\u305f\u691c\u8a3c\u3092\u4fdd\u8a3c\u3057\u307e\u3059\u3002'}
        </Text>

        {/* ─── THREE PILLARS ─── */}
        <Text style={styles.sectionH}>
          <Text style={styles.sectionHEn}>THE THREE PILLARS</Text>
          <Text style={{ letterSpacing: 0 }}>{'  /  本証拠を支える 3 つの担保'}</Text>
        </Text>
        <View style={styles.pillarRow}>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>① CRYPTOGRAPHIC</Text>
            <Text style={styles.pillarTitle}>SHA-256 暗号指紋</Text>
            <Text style={styles.pillarText}>
              {zwsp('SHA-256 暗号ハッシュ関数により算出された256ビットの固有識別値。対象データの内容が1ビットでも変更された場合、値は完全に変化するため、改ざんの有無を即座かつ確定論的に検出できる。')}
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>② NOTARIZED</Text>
            <Text style={styles.pillarTitle}>RFC 3161 タイムスタンプ</Text>
            <Text style={styles.pillarText}>
              {zwsp('国際標準規格 RFC 3161 に準拠した第三者認証局が、ファイルの暗号指紋と発行日時を電子署名で結合し、時刻の真正性と不変性を公式に保証する。')}
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>③ PROCESS PROVEN</Text>
            <Text style={styles.pillarTitle}>制作過程の連鎖証明</Text>
            <Text style={styles.pillarText}>
              {zwsp('最終成果物のみならず、構想から納品に至る各制作段階を連鎖的に記録・証明することで、制作過程の真正性を第三者に対して客観的に提示できる。')}
            </Text>
          </View>
        </View>

        {/* ─── Package Contents ─── */}
        <Text style={styles.sectionH}>
          <Text style={styles.sectionHEn}>PACKAGE CONTENTS</Text>
          <Text style={{ letterSpacing: 0 }}>{'  /  同梱ファイル'}</Text>
        </Text>
        <View style={styles.treeWrap}>
          {tree.map((f, idx) => {
            const isLast = idx === tree.length - 1;
            return (
              <View
                key={f.name}
                style={[styles.treeRow, isLast ? styles.treeRowLast : {}]}
              >
                <Text style={styles.treeName}>{f.name}</Text>
                <Text style={styles.treeDesc}>{f.description ?? ''}</Text>
                <Text style={styles.treeSize}>{f.size}</Text>
              </View>
            );
          })}
        </View>

        {/* ─── Verify card + Signature: wrap={false} で一体管理し孤立を防ぐ ─── */}
        <View wrap={false}>
          <View style={styles.verifyCard}>
            <Text style={styles.verifyEyebrow}>HOW TO VERIFY</Text>
            <Text style={styles.verifyTitle}>検証方法</Text>
            <View style={styles.verifyBodyRow}>
              <View style={styles.verifyTextCol}>
                <Text style={styles.verifyText}>
                  {'対象データの完全性と発行日時は、下記URLまたはQRコードより、\nブラウザ上で即座に検証可能です（原本ファイルは外部へ送信されません）。'}
                </Text>
              </View>
              {hasQr && (
                <View style={styles.qrStack}>
                  <View style={styles.qrFrame}>
                    <Image src={input.qrCodeDataUrl} style={styles.qrImage} />
                  </View>
                  <Text style={styles.qrCaption}>SCAN TO VERIFY</Text>
                </View>
              )}
            </View>
            <View style={styles.verifyUrlRow}>
              <Text style={styles.verifyUrlLabel}>VERIFY URL</Text>
              <Link src={verifyHref} style={styles.verifyUrl}>
                {input.verificationUrl}
              </Link>
            </View>
          </View>

          {/* ─── Signature ─── */}
          <View style={styles.sigRow}>
            <View style={styles.sigBlock}>
              <Text style={styles.sigLabel}>SEALED BY  /  発行者</Text>
              <Text style={styles.sigName}>{input.creatorDisplayName}</Text>
              <Text style={styles.sigMeta}>
                Certificate #{input.certificateId}
              </Text>
              <Text style={styles.sigMeta}>TSA · {tsaProvider}</Text>
            </View>
            <View style={styles.verifiedStack}>
              <ProofMarkLogo size={32} instanceId="clsig" />
              <Text style={styles.verifiedStackCaption}>VERIFIED</Text>
            </View>
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
              <Text style={styles.footerLabel}>PROOFMARK</Text>
              <Text style={[styles.footerMono, { marginTop: 1 }]}>EVIDENCE PACK</Text>
            </View>
            <View style={[styles.footerCol, { alignItems: 'center' }]}>
              <Text style={styles.footerLabel}>VERIFY</Text>
              <Link src={verifyHref} style={[styles.footerMono, { marginTop: 1 }]}>
                proofmark.jp
              </Link>
            </View>
            <View style={[styles.footerCol, { alignItems: 'flex-end' }]}>
              <Text style={styles.footerLabel}>ISSUED BY</Text>
              <Text style={[styles.footerMono, { marginTop: 1 }]}>ProofMark</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};