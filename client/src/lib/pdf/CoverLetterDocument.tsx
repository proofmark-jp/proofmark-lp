/**
 * CoverLetterDocument.tsx (v5 — Final Commit)
 * -----------------------------------------------------------------------------
 * Cover_Letter.pdf
 *   スイス銀行債券レベル × 政府発行公文書レベルの「2 ページ完結公文書」仕様。
 *
 * v4 → v5 の決定的変更:
 *
 *  [要件 1] 公式ブランド SVG への完全準拠
 *   - 公式 SVG を @react-pdf プリミティブへ厳格翻訳した `<ProofMarkLogo />` を
 *     ローカル定義。ヘッダ左上に Logo + 太字「ProofMark」のロックアップ。
 *   - 旧テキスト透かしを完全削除し、外枠を除いた path / polygon のみで構成した
 *     `<ProofMarkWatermark />` を opacity={0.03}・幅 300pt でページ中央に配置。
 *
 *  [要件 2] ダサい装飾の完全破壊と Bond Frame 導入
 *   - 署名欄の `SealedStamp`、絶対配置の `CornerOrnament` を完全削除。
 *   - 代わりにページ端から 28pt 内側に 1px の証券枠 Bond Frame を敷設。
 *
 *  [要件 3] QR コード実装
 *   - 入力契約 `CoverLetterPdfInput` に `qrCodeDataUrl?: string` を追加。
 *   - HOW TO VERIFY セクションで URL と並べて `<Image>` でレンダリング。
 *   - undefined 時は QR 枠を非表示にし、URL のみ表示する設計。
 *
 *  [要件 4] justify バグの完全撤去
 *   - 旧 `textAlign: 'justify'` 全箇所を `textAlign: 'left'` に変更。
 *   - 長文の lineHeight を 1.7 以上に引き上げ、余裕ある左揃え。
 *
 *  [要件 5] コピーライティングの差替
 *   - Body を提供された洗練された法務文体に完全差替。
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
  Rect,
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_LAYOUT, PDF_TRACKING } from './tokens';
import { PDF_FONT_FAMILY } from './fonts';
import { DividerRule } from './Decorations';
import type { CoverLetterPdfInput } from './types';

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
 * 公式ブランド SVG の path / polygon 定義 (両コンポーネントで共有)
 * =========================================================================== */
const PM_HEX_PATH =
  'M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 87,25 L 82,29 L 76,18 Z';
const PM_CHECK_PATH =
  'M 17,46 L 27,47 L 39,62 L 79,22 L 83,28 L 36,70 L 23,58 Z';

/* =============================================================================
 * <ProofMarkLogo />
 * =========================================================================== */
interface ProofMarkLogoProps {
  size?: number;
  instanceId: string;
}
const ProofMarkLogo: React.FC<ProofMarkLogoProps> = ({ size = 20, instanceId }) => {
  const gradId = `pmLogoGrad-${instanceId}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={gradId} x1="15%" y1="0%" x2="85%" y2="100%">
          <Stop offset="0%" stopColor="#5830CC" />
          <Stop offset="100%" stopColor="#00B896" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} rx={22} ry={22} fill="#0D0B24" />
      <Path
        d={PM_HEX_PATH}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={3.8}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
      <Path d={PM_CHECK_PATH} fill="#00D4AA" />
    </Svg>
  );
};

/* =============================================================================
 * <ProofMarkWatermark /> (外枠 rect を除いた path + polygon のみ)
 * =========================================================================== */
interface ProofMarkWatermarkProps {
  size?: number;
}
const ProofMarkWatermark: React.FC<ProofMarkWatermarkProps> = ({
  size = 300,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={0.06}>
      {/* 透かしはグラデ不要 — コントラスト確保のため #0D0B24 単色で統一 */}
      <Path
        d={PM_HEX_PATH}
        fill="none"
        stroke="#0D0B24"
        strokeWidth={3.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path d={PM_CHECK_PATH} fill="#0D0B24" />
    </Svg>
  );
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY.sans,
    backgroundColor: PDF_COLORS.paper,
    color: PDF_COLORS.ink,
    paddingTop: SCALE.s5 + SCALE.s2, // 41
    paddingBottom: SCALE.s5 + SCALE.s4, // 53
    paddingHorizontal: PDF_LAYOUT.marginX, // 56
    position: 'relative',
  },

  /* ===========================================================================
   * 装飾レイヤー
   * ========================================================================= */
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

  /* ===========================================================================
   * Header
   * ========================================================================= */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SCALE.s3, // 13
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
    marginLeft: SCALE.s2, // 8
  },
  headerTag: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small, // 8.5
    color: PDF_COLORS.inkMuted,
    letterSpacing: PDF_TRACKING.label,
    fontWeight: 700,
  },

  /* ===========================================================================
   * Section Band (精緻な仕切り線)
   * ========================================================================= */
  sectionBand: {
    marginBottom: SCALE.s4 + SCALE.s1, // 24
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.inkDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.inkDeep,
    paddingTop: 3,
    paddingBottom: 3,
  },

  /* ===========================================================================
   * Title
   * ========================================================================= */
  eyebrow: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small, // 8.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.teal,
    marginBottom: SCALE.s2 + 2, // 10
  },
  title: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.title, // 23
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.6,
    marginBottom: SCALE.s4, // 20
    lineHeight: 1.16,
  },

  /* ===========================================================================
   * Body (justify 撤去 / 左揃え + 余裕の lineHeight 1.78)
   * ========================================================================= */
  body: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.body, // 10.5
    lineHeight: 1.78,
    color: PDF_COLORS.ink,
    marginBottom: SCALE.s4, // 20
    textAlign: 'left',
  },
  bodyEmphasis: {
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
  },

  /* ===========================================================================
   * Section heading
   * ========================================================================= */
  sectionH: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small, // 8.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.purple,
    marginTop: SCALE.s1, // 4
    marginBottom: SCALE.s3, // 13
  },

  /* ===========================================================================
   * Three Pillars
   * ========================================================================= */
  pillarRow: {
    flexDirection: 'row',
    gap: SCALE.s2, // 8
    marginBottom: SCALE.s4 + SCALE.s1, // 24
  },
  pillar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    padding: SCALE.s3 - 1, // 12
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
    marginBottom: SCALE.s1 + 1, // 5
  },
  pillarTitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small + 1, // 9.5
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    marginBottom: SCALE.s1 + 1, // 5
  },
  pillarText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro + 0.5, // 8
    lineHeight: 1.7,
    color: PDF_COLORS.ink,
    textAlign: 'left',
    flexWrap: 'wrap',
    // @ts-expect-error wordBreak は @react-pdf にて実装されているが型未公開
    wordBreak: 'break-all',
  },

  /* ===========================================================================
   * File tree
   * ========================================================================= */
  treeWrap: {
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.inkDeep,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.inkDeep,
    marginBottom: SCALE.s4 + SCALE.s1, // 24
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SCALE.s2 - 1, // 7
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
    // @ts-expect-error
    wordBreak: 'break-all',
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
    fontSize: SCALE.micro + 0.5, // 8
    color: PDF_COLORS.inkMuted,
  },

  /* ===========================================================================
   * Verify CTA card (ダーク / QR 内包)
   * ========================================================================= */
  verifyCard: {
    borderWidth: 1,
    borderColor: PDF_COLORS.inkDeep,
    borderStyle: 'solid',
    padding: SCALE.s4 - 2, // 18
    borderRadius: 4,
    marginBottom: SCALE.s4 + SCALE.s1, // 24
  },
  verifyEyebrow: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro - 0.2, // 7.3
    color: PDF_COLORS.purple,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    marginBottom: SCALE.s2 - 2, // 6
  },
  verifyTitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.heading - 4, // 13
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    marginBottom: SCALE.s2 + 2, // 10
    letterSpacing: 0.4,
  },
  verifyBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SCALE.s3, // 13
  },
  verifyTextCol: {
    flexGrow: 1,
    flexShrink: 1,
  },
  verifyText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.body - 1, // 9.5
    color: PDF_COLORS.ink,
    lineHeight: 1.7,
    marginBottom: SCALE.s3, // 13
    textAlign: 'left',
  },
  verifyMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    color: PDF_COLORS.inkDeep,
  },
  verifyUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SCALE.s2, // 8
    paddingTop: SCALE.s2 + 2, // 10
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
  /* QR code containers — 白背景は維持（QR読取りのため）、padding を整理 */
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
    marginTop: SCALE.s1 + 1, // 5
    textAlign: 'center',
  },
  qrStack: {
    alignItems: 'center',
    flexShrink: 0,
  },

  /* ===========================================================================
   * Signature (SealedStamp 削除版)
   *  - 左: 発行者情報
   *  - 右: ProofMarkLogo + VERIFIED キャプション
   * ========================================================================= */
  sigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: SCALE.s1, // 4
  },
  sigBlock: { flexGrow: 1, flexShrink: 1, maxWidth: 360 },
  sigLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro, // 7.5
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s1 + 1, // 5
    fontWeight: 700,
  },
  sigName: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.heading - 4, // 13
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.3,
    flexShrink: 1,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },
  sigMeta: {
    fontFamily: PDF_FONT_FAMILY.mono,
    marginTop: SCALE.s1 + 1, // 5
    fontSize: SCALE.small, // 8.5
    color: PDF_COLORS.inkMuted,
  },
  verifiedStack: { alignItems: 'center' },
  verifiedStackCaption: {
    fontFamily: PDF_FONT_FAMILY.sans,
    marginTop: SCALE.s1 + 1, // 5
    fontSize: SCALE.caption - 0.2, // 6.3
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.small,
    color: PDF_COLORS.inkMuted,
  },

  /* ===========================================================================
   * Footer (fixed)
   * ========================================================================= */
  footer: {
    position: 'absolute',
    left: PDF_LAYOUT.marginX,
    right: PDF_LAYOUT.marginX,
    bottom: FRAME_INSET + SCALE.s3, // 28 + 13 = 41pt — Bond Frame 内側に揃え
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SCALE.s2 - 1, // 7
  },
  footerCol: { flexDirection: 'column' },
  footerLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption, // 6.5
    color: PDF_COLORS.inkSubtle,
    letterSpacing: PDF_TRACKING.small,
    opacity: 0.85,
  },
  footerMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.micro, // 7.5
    color: PDF_COLORS.inkDeep,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },
  pageNum: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.caption, // 6.5
    color: PDF_COLORS.inkMuted,
    letterSpacing: 1.2,
  },
});

/** デフォルトの同梱ファイルツリー */
const DEFAULT_FILE_TREE: ReadonlyArray<{
  name: string;
  size: string;
  description?: string;
}> = [
  {
    name: 'Certificate_of_Authenticity.pdf',
    size: '104 KB',
    description: '真正性証明書 (本書とセット)',
  },
  { name: 'Cover_Letter.pdf', size: '92 KB', description: '本書' },
  {
    name: 'TIMESTAMP.tsr',
    size: '3.2 KB',
    description: 'RFC 3161 タイムスタンプ応答',
  },
  { name: 'verify.sh', size: '1.4 KB', description: 'シェル検証スクリプト' },
  { name: 'verify.py', size: '2.6 KB', description: 'Python 検証スクリプト' },
  {
    name: 'HOW_TO_VERIFY.txt',
    size: '1.1 KB',
    description: '検証手順 (人間可読)',
  },
];

/**
 * 装飾レイヤー: Bond Frame + ProofMarkWatermark (path/polygon のみ)
 * すべて <View fixed> + zIndex:-1 でフロー完全隔離。
 */
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
        {/* 装飾レイヤー (絶対隔離) */}
        <DecorationLayer />

        {/* ─── Header: 公式ロゴ + ProofMark ワードマーク ─── */}
        <View style={styles.headerRow}>
          <View style={styles.brandLockup}>
            <ProofMarkLogo size={20} instanceId="cl-header" />
            <Text style={styles.brandText}>ProofMark</Text>
          </View>
          <Text style={styles.headerTag}>COVER LETTER · 添え状</Text>
        </View>

        {/* ─── 精緻な仕切り線 ─── */}
        <View style={styles.sectionBand}>
          <DividerRule
            width={PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX * 2}
            height={2}
          />
        </View>

        {/* ─── Title ─── */}
        <Text style={styles.eyebrow}>FOR THE CLIENT  /  ご担当者様へ</Text>
        <Text style={styles.title}>納品物の真正性証明について</Text>

        {/* ─── Body (新コピーへ完全差替 / left-aligned) ─── */}
        <Text style={styles.body}>
          本パッケージ（Evidence Pack）は、クリエイターから納品されたデジタルデータの「存在事実」および「制作プロセスの完全性」を暗号学的に証明するものです。タイムスタンプ打刻以降、データが<Text style={styles.bodyEmphasis}>1ビットたりとも改ざんされていないこと</Text>を数学的に保証し、第三者に対する客観的な証拠能力を提供します。
          {'\n'}
          クリエイターの権利と、貴社の安全なコンテンツ利用を保護するため、最新のゼロ知識証明アプローチを用いて構築されています。検証は以下のURLおよびQRコード、または同封のスクリプトによりブラウザ・ローカル環境で完結し、外部へ原本が送信されることは一切ありません。
        </Text>

        {/* ─── THE THREE PILLARS ─── */}
        <Text style={styles.sectionH}>
          THE THREE PILLARS  /  本証拠を支える 3 つの担保
        </Text>
        <View style={styles.pillarRow}>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>① CRYPTOGRAPHIC</Text>
            <Text style={styles.pillarTitle}>SHA-256 指紋</Text>
            <Text style={styles.pillarText}>
              納品ファイルから計算された256ビットの暗号ハッシュ。1ビットの改変で完全に異なる値となる。
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>② NOTARIZED</Text>
            <Text style={styles.pillarTitle}>RFC 3161 タイムスタンプ</Text>
            <Text style={styles.pillarText}>
              国際標準規格に準拠した第三者機関(TSA)が、指紋と日時を暗号署名で強固に連結している。
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>③ PROCESS PROVEN</Text>
            <Text style={styles.pillarTitle}>制作過程の連鎖証明</Text>
            <Text style={styles.pillarText}>
              完成品のみならず、構想から完成に至る制作ステップの連鎖が、ハッシュチェーンにより数学的に連結・証明されている。
            </Text>
          </View>
        </View>

        {/* ─── Package Contents (1ページ目末尾) ─── */}
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

        {/* ─── Verify card (2ページ目 / QR コード内包) ─── */}
        <View style={styles.verifyCard} break>
          <Text style={styles.verifyEyebrow}>HOW TO VERIFY</Text>
          <Text style={styles.verifyTitle}>検証方法</Text>
          <View style={styles.verifyBodyRow}>
            <View style={styles.verifyTextCol}>
              <Text style={styles.verifyText}>
                同梱の <Text style={styles.verifyMono}>verify.sh</Text> もしくは{' '}
                <Text style={styles.verifyMono}>verify.py</Text>{' '}
                を実行することで、外部ネットワークに一切接続せず、貴社内のみで完結する形でファイルと TSA 署名の整合を検証することができる。あるいは下記のオンライン検証ページから即座に確認することも可能である。
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

        {/* ─── Signature (SealedStamp 削除版) ─── */}
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
            <ProofMarkLogo size={32} instanceId="cl-sig" />
            <Text style={styles.verifiedStackCaption}>VERIFIED</Text>
          </View>
        </View>

        {/* ─── Footer (fixed / ページ番号) ─── */}
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
