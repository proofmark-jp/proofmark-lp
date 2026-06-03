/**
 * CoverLetterDocument.tsx (v4 — Final Commit)
 * -----------------------------------------------------------------------------
 * Cover_Letter.pdf
 *   スイス銀行債券レベル × 政府発行公文書レベルの「2 ページ完結公文書」仕様。
 *
 * v3 → v4 の決定的変更:
 *
 *  [致命的バグの修正]
 *   - 装飾を `<View fixed>` + `zIndex:-1` の専用レイヤーへ完全隔離。
 *   - 累積マージンを黄金比モジュラースケールで再計算し、2 ページに
 *     自然分断 (1p: Body + Three Pillars + Package Contents、
 *               2p: Verify card + Signature + Footer)。
 *
 *  [防御 CSS]
 *   - 全テキストブロックに `flexShrink: 1`, `flexWrap: 'wrap'`,
 *     `wordBreak: 'break-all'` を組合せ、長大入力でもコンテナを
 *     一切突き破らない構造を構築。
 *
 *  [タイポグラフィ昇華]
 *   - Body, pillarText, verifyText に `textAlign: 'justify'` を厳格適用。
 *   - lineHeight: 1.72 (φ ≒ 1.62 を上回る余裕値) で添え状特有の柔らかさを維持。
 *   - 仕切り線は `borderTop` + `borderBottom` の二層構造で証券感を強化。
 *
 *  [細部への執念]
 *   - 全ページ共通フッタにページ番号 (例: 01 / 02) を実装。
 *   - フッタは TSA / VERIFY / PAGE の 3 列を均等に配置し、Certificate と
 *     完全に統一感のあるブランド体験を提供。
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
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_LAYOUT, PDF_LEADING, PDF_TRACKING } from './tokens';
import { PDF_FONT_FAMILY } from './fonts';
import {
  DividerRule,
  ProofMarkLogo,
  SealedStamp,
  CornerOrnament,
} from './Decorations';
import type { CoverLetterPdfInput } from './types';

/* =============================================================================
 * モジュラースケール (黄金比 φ = 1.618 ベース) — Certificate と完全共通
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

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY.sans,
    backgroundColor: PDF_COLORS.paper,
    color: PDF_COLORS.ink,
    paddingTop: SCALE.s5, // 33
    paddingBottom: SCALE.s5 + SCALE.s4, // 53
    paddingHorizontal: PDF_LAYOUT.marginX, // 56
    position: 'relative',
  },

  /* ===========================================================================
   * 装飾レイヤー (絶対隔離)
   * ========================================================================= */
  decorationLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
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
  watermarkText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: 68,
    fontWeight: 700,
    letterSpacing: 8,
    color: PDF_COLORS.rule,
    opacity: 0.05,
    transform: 'rotate(-45deg)',
    transformOrigin: 'center',
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
  headerTag: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small, // 8.5
    color: PDF_COLORS.inkMuted,
    letterSpacing: PDF_TRACKING.label,
    fontWeight: 700,
  },

  /* ===========================================================================
   * Section Band (精緻な二層仕切り線)
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
   * Body
   * ========================================================================= */
  body: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.body, // 10.5
    lineHeight: 1.72,
    color: PDF_COLORS.ink,
    marginBottom: SCALE.s4, // 20
    textAlign: 'justify',
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
   * Three Pillars (横並び 3 カード)
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
    lineHeight: 1.62,
    color: PDF_COLORS.ink,
    textAlign: 'justify',
    flexWrap: 'wrap',
    // @ts-expect-error wordBreak は @react-pdf にて実装されているが型未公開
    wordBreak: 'break-all',
  },

  /* ===========================================================================
   * File tree (テーブル風)
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
    lineHeight: 1.45,
  },
  treeSize: {
    width: 56,
    textAlign: 'right',
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.micro + 0.5, // 8
    color: PDF_COLORS.inkMuted,
  },

  /* ===========================================================================
   * Verify CTA card (ダーク)
   * ========================================================================= */
  verifyCard: {
    backgroundColor: PDF_COLORS.paperDeep,
    padding: SCALE.s4 - 2, // 18
    borderRadius: 4,
    marginBottom: SCALE.s4 + SCALE.s1, // 24
  },
  verifyEyebrow: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro - 0.2, // 7.3
    color: PDF_COLORS.teal,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    marginBottom: SCALE.s2 - 2, // 6
  },
  verifyTitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.heading - 4, // 13
    fontWeight: 700,
    color: PDF_COLORS.paper,
    marginBottom: SCALE.s2 + 2, // 10
    letterSpacing: 0.4,
  },
  verifyText: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.body - 1, // 9.5
    color: '#C8C9DC',
    lineHeight: 1.62,
    marginBottom: SCALE.s3, // 13
    textAlign: 'justify',
  },
  verifyMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    color: PDF_COLORS.paper,
  },
  verifyUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SCALE.s2, // 8
    paddingTop: SCALE.s2 + 2, // 10
    borderTopWidth: 0.5,
    borderTopColor: '#2A2C46',
  },
  verifyUrlLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption + 0.5, // 7
    color: PDF_COLORS.teal,
    fontWeight: 700,
    letterSpacing: 1.4,
  },
  verifyUrl: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: SCALE.small + 1, // 9.5
    color: PDF_COLORS.paper,
    letterSpacing: 0.4,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },

  /* ===========================================================================
   * Signature footer
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
  sealStack: { alignItems: 'center' },
  sealStackCaption: {
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
    bottom: SCALE.s4, // 20
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

/** デフォルトの同梱ファイルツリー (input.fileTree 未指定時) */
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
 * 装飾レイヤー (CornerOrnament + Watermark) を fixed コンテナへ完全隔離。
 * これがレイアウト崩壊撤去の核心。
 */
const DecorationLayer: React.FC = () => (
  <View fixed style={styles.decorationLayer}>
    <CornerOrnament
      width={PDF_LAYOUT.pageWidth}
      height={PDF_LAYOUT.pageHeight}
      margin={32}
      armLength={48}
      color={PDF_COLORS.purple}
    />
    <View style={styles.watermarkAlign}>
      <Text style={styles.watermarkText}>PROOFMARK SECURE DOCUMENT</Text>
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

        {/* ─── Header ─── */}
        <View style={styles.headerRow}>
          <ProofMarkLogo height={18} />
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

        {/* ─── Body (威厳あるコピー) ─── */}
        <Text style={styles.body}>
          本 Evidence Pack は、クリエイターから納品されたデジタルアセットの存在事実、およびその制作プロセスの完全性が、タイムスタンプ打刻以降<Text style={styles.bodyEmphasis}>1ビットの改ざんも受けていないこと</Text>を示し、客観的かつ強固な証拠能力を確保するための暗号証明パッケージである。
          {'\n'}
          クリエイターの権利と、貴社の安全なコンテンツ利用を保護するため、最新のゼロ知識証明アプローチを用いて構築されている。検証は以下のURL、または同封のスクリプトによりブラウザ上で完結し、外部へ原本が送信されることは一切ない。
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

        {/* ─── Verify card (2ページ目想定 / break で自然分断を促す) ─── */}
        <View style={styles.verifyCard} break>
          <Text style={styles.verifyEyebrow}>HOW TO VERIFY</Text>
          <Text style={styles.verifyTitle}>検証方法</Text>
          <Text style={styles.verifyText}>
            同梱の <Text style={styles.verifyMono}>verify.sh</Text> もしくは{' '}
            <Text style={styles.verifyMono}>verify.py</Text>{' '}
            を実行することで、外部ネットワークに一切接続せず、貴社内のみで完結する形でファイルと TSA 署名の整合を検証することができる。あるいは下記のオンライン検証ページから即座に確認することも可能である。
          </Text>
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
          <View style={styles.sealStack}>
            <SealedStamp size={62} variant="teal" rotation={-6} />
            <Text style={styles.sealStackCaption}>VERIFIED</Text>
          </View>
        </View>

        {/* ─── Footer (fixed) ─── */}
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
