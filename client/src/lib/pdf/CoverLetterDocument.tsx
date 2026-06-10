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
  Defs,
  LinearGradient,
  Stop,
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

/* =============================================================================
 * モジュラースケール (黄金比 φ = 1.618) — Certificate と完全共通
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
interface ProofMarkLogoProps {
  size?: number;
  instanceId: string; // 例: "clheader", "clsig" — ハイフン不可
}
const ProofMarkLogo: React.FC<ProofMarkLogoProps> = ({
  size = 20,
  instanceId,
}) => {
  // ハイフン等の記号を除去して純英数字 ID に変換
  const gradId = `G${instanceId.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gradId} x1="15%" y1="0%" x2="85%" y2="100%">
          <Stop offset="0%" stopColor="#5830CC" />
          <Stop offset="100%" stopColor="#00B896" />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} rx={22} ry={22} fill="#0D0B24" />
      <Path
        d={PM_HEX_PATH}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={3.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
      <Polygon points={PM_CHECK_POINTS} fill="#00D4AA" />
    </Svg>
  );
};

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
    marginBottom: SCALE.s3,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.subheading - 1, // 12
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.6,
    marginLeft: SCALE.s2,
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
    marginBottom: SCALE.s4 + SCALE.s1, // 24
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
    fontSize: SCALE.body,        // 10.5
    lineHeight: 1.65,            // PDF 日本語の適正行間（旧 1.78 は過剰に緩い）
    color: PDF_COLORS.ink,
    marginBottom: SCALE.s4,
    textAlign: 'left',
  },
  bodyEmphasis: {
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
  },

  /* ── Section heading ─────────────────────────────────────────────────── */
  sectionH: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.purple,
    marginTop: SCALE.s1,
    marginBottom: SCALE.s3,
  },

  /* ── Three Pillars ───────────────────────────────────────────────────── */
  pillarRow: {
    flexDirection: 'row',
    gap: SCALE.s2,
    marginBottom: SCALE.s4 + SCALE.s1,
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

  /* ── File tree ───────────────────────────────────────────────────────── */
  treeWrap: {
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.inkDeep,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.inkDeep,
    marginBottom: SCALE.s4 + SCALE.s1,
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

  /* ── Verify card ─────────────────────────────────────────────────────── */
  verifyCard: {
    borderWidth: 1,
    borderColor: PDF_COLORS.inkDeep,
    borderStyle: 'solid',
    padding: SCALE.s4 - 2, // 18
    borderRadius: 4,
    marginBottom: SCALE.s4 + SCALE.s1,
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
        {/*
          推敲ポイント:
          × 旧「暗号学的に証明するものです」→ 機械的な直訳調
          × 旧「数学的に保証し」→ 理系論文調で法務文書に不適
          × 旧「最新のゼロ知識証明アプローチを用いて」→ 製品カタログ調
          ○ 新: 法務担当が自然に読める平易な文体へ
        */}
        <Text style={styles.body}>
          本パッケージ（Evidence Pack）は、クリエイターから納品されたデジタルデータの存在事実と制作プロセスの完全性を、暗号技術によって証明するものです。タイムスタンプ発行後、データに<Text style={styles.bodyEmphasis}>一切の改ざんが加えられていないこと</Text>を客観的に担保し、第三者への立証においても有効な証拠能力を持ちます。
          {'\n'}
          クリエイターの権利保護と、貴社における安全なコンテンツ利用の両立を目的として設計されています。同梱のスクリプトまたは下記URLから検証が可能であり、その際に原本ファイルが外部へ送信されることは一切ありません。
        </Text>

        {/* ─── THREE PILLARS ─── */}
        <Text style={styles.sectionH}>
          THE THREE PILLARS  /  本証拠を支える 3 つの担保
        </Text>
        <View style={styles.pillarRow}>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>① CRYPTOGRAPHIC</Text>
            <Text style={styles.pillarTitle}>SHA-256 指紋</Text>
            {/*
              推敲: 「1ビットの改変で完全に異なる値となる」は直訳的。
              クライアントが知りたいのは「なぜ安全か」であり「どう機能するか」ではない。
            */}
            <Text style={styles.pillarText}>
              納品ファイルから算出された256ビットの固有値。内容が少しでも変更されると値が完全に変わるため、改ざんの有無を即座に検出できる。
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>② NOTARIZED</Text>
            <Text style={styles.pillarTitle}>RFC 3161 タイムスタンプ</Text>
            {/*
              推敲: 「指紋と日時を暗号署名で強固に連結している」→ 機械的。
              「強固に」は不要な副詞。動作を端的に説明する文体へ。
            */}
            <Text style={styles.pillarText}>
              国際標準規格に準拠した第三者認証局が、ファイルの指紋と発行日時を暗号署名で結合。時刻の正確性と不変性を公式に保証する。
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>③ PROCESS PROVEN</Text>
            <Text style={styles.pillarTitle}>制作過程の連鎖証明</Text>
            {/*
              推敲: 「ハッシュチェーンにより数学的に連結・証明されている」→ 技術説明に終始。
              「第三者に示せる」という実用上の価値を前面に出す。
            */}
            <Text style={styles.pillarText}>
              完成品だけでなく、構想から納品までの各制作段階が連鎖証明されており、制作過程の真正性を第三者に対して客観的に示すことができる。
            </Text>
          </View>
        </View>

        {/* ─── Package Contents ─── */}
        <Text style={styles.sectionH}>
          PACKAGE CONTENTS  /  同梱ファイル
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
                {/*
                  推敲: 「貴社内のみで完結する形で」→ 冗長。
                  「ファイルと TSA 署名の整合を検証する」→ 名詞過多で読みにくい。
                */}
                <Text style={styles.verifyText}>
                  同梱の <Text style={styles.verifyMono}>verify.sh</Text> または{' '}
                  <Text style={styles.verifyMono}>verify.py</Text>{' '}
                  を実行することで、外部への通信を一切行わずにファイルとタイムスタンプ署名の整合性を確認できます。オンラインでの検証は、下記URLまたはQRコードからもご利用いただけます。
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
              <Text style={[styles.footerMono, { marginTop: 1 }]}>
                EVIDENCE PACK
              </Text>
            </View>
            <View style={[styles.footerCol, { alignItems: 'center' }]}>
              <Text style={styles.footerLabel}>VERIFY</Text>
              <Link
                src={verifyHref}
                style={[styles.footerMono, { marginTop: 1 }]}
              >
                proofmark.jp
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