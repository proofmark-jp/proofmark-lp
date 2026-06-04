/**
 * CertificateDocument.tsx (v5 — Final Commit)
 * -----------------------------------------------------------------------------
 * Certificate_of_Authenticity.pdf
 *   スイス銀行の債券レベル × 政府発行公文書レベルの「究極の 1 ページ完結」仕様。
 *
 * v4 → v5 の決定的変更:
 *
 *  [要件 1] 公式ブランド SVG への完全準拠
 *   - 公式 SVG（角丸ダークネイビー + 六角形リング + チェック）を
 *     @react-pdf プリミティブ (<Svg>/<Defs>/<LinearGradient>/<Stop>/<Path>/<Rect>)
 *     へ厳格に翻訳した `<ProofMarkLogo />` をローカル定義。全属性キャメルケース。
 *   - ヘッダ左上に `ProofMarkLogo` + 太字テキスト「ProofMark」のロックアップ。
 *   - 旧テキスト透かし "PROOFMARK SECURE DOCUMENT" を完全削除。
 *     代わりに公式 SVG の <Path> と <Polygon→Path> のみを抽出した
 *     幅 300pt の `<ProofMarkWatermark />` を opacity={0.03} で中央に配置。
 *
 *  [要件 2] ダサい装飾の完全破壊と Bond Frame 導入
 *   - `SealedStamp`（右下シール）を完全削除。import からも撤去。
 *   - `CornerOrnament`（4 隅 L 字）を完全削除。import からも撤去。
 *   - 代わりに、ページ端から内側 28pt の位置に途切れない 1 本の証券枠
 *     `Bond Frame` (border 1px solid PDF_COLORS.inkDeep) を敷設。
 *   - 全テキストはこの枠の内側に美しく収まる。
 *
 *  [要件 4] justify バグの完全撤去
 *   - 旧 `textAlign: 'justify'` を全て `textAlign: 'left'` に変更。
 *   - 長文ブロックの lineHeight を 1.65 以上に引き上げ、余裕ある左揃え。
 *
 *  [維持された v4 の長所]
 *   - 装飾レイヤーは `<View fixed>` + zIndex:-1 でフロー完全隔離。
 *   - 黄金比モジュラースケール (SCALE 定数) で全余白統制。
 *   - 防御 CSS (flexShrink/flexWrap/wordBreak)。
 *   - ページ番号 (Text.render の動的レンダリング)。
 *   - @electron-fonts への安定版固定。
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
  Defs,
  LinearGradient,
  Stop,
  Path,
  Rect,
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_LAYOUT, PDF_TRACKING } from './tokens';
import { PDF_FONT_FAMILY } from './fonts';
import { DividerRule } from './Decorations';
import type { CertificatePdfInput } from './types';

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
 *  ページ端から 28pt 内側に 1px の証券枠を敷設し、全コンテンツはその内側に配置。
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
 *  公式ブランド SVG を @react-pdf へ厳格翻訳したロゴ。
 *  - 全属性キャメルケース
 *  - LinearGradient id はインスタンス毎にユニーク化して衝突回避
 * =========================================================================== */
interface ProofMarkLogoProps {
  size?: number;
  instanceId: string;
}
const ProofMarkLogo: React.FC<ProofMarkLogoProps> = ({ size = 22, instanceId }) => {
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
 * <ProofMarkWatermark />
 *  公式 SVG から外枠 rect を除き、六角形リングとチェックのみを抽出。
 *  幅 300pt、opacity 0.03 でページ中央に絶対配置。
 * =========================================================================== */
interface ProofMarkWatermarkProps {
  size?: number;
}
const ProofMarkWatermark: React.FC<ProofMarkWatermarkProps> = ({
  size = 300,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={0.06}>
      {/* 外枠 rect は意図的に省略 (要件: path と polygon のみ抽出) */}
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
   * 装飾レイヤー (絶対隔離 / コンテンツフローに 0 の影響)
   * ========================================================================= */
  decorationLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  /* Bond Frame — ページ端から 28pt 内側に 1 本の証券枠 */
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
  /* Watermark 中央配置コンテナ */
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
   * Header — ProofMarkLogo + "ProofMark" ロックアップ
   * ========================================================================= */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SCALE.s4, // 20
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
  headerRight: {
    alignItems: 'flex-end',
  },
  headerMetaLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption, // 6.5
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

  /* ===========================================================================
   * Title Block
   * ========================================================================= */
  eyebrow: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.small, // 8.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.purple,
    marginBottom: SCALE.s2 + 2, // 10
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
    marginTop: SCALE.s2 + 2, // 10
    fontSize: SCALE.subheading, // 13
    fontWeight: 500,
    color: PDF_COLORS.ink,
    letterSpacing: 1.6,
  },

  /* ===========================================================================
   * Section Band (精緻な仕切り線 / 二層構造)
   * ========================================================================= */
  sectionBand: {
    marginTop: SCALE.s4, // 20
    marginBottom: SCALE.s4, // 20
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.inkDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.inkDeep,
    paddingTop: 3,
    paddingBottom: 3,
  },

  /* ===========================================================================
   * Section labels
   * ========================================================================= */
  sectionLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro, // 7.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s2 + 2, // 10
  },

  /* ===========================================================================
   * File info grid
   * ========================================================================= */
  metaGrid: {
    flexDirection: 'column',
    marginBottom: SCALE.s4, // 20
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SCALE.s1 + 1, // 5
    borderBottomWidth: 0.4,
    borderBottomColor: PDF_COLORS.ruleSoft,
  },
  metaRowLast: { borderBottomWidth: 0 },
  metaKey: {
    fontFamily: PDF_FONT_FAMILY.sans,
    width: 96,
    flexShrink: 0,
    fontSize: SCALE.micro, // 7.5
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
    // @ts-expect-error wordBreak は @react-pdf にて実装されているが型未公開
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

  /* ===========================================================================
   * Hash card
   * ========================================================================= */
  hashCard: {
    marginBottom: SCALE.s4, // 20
    paddingVertical: SCALE.s2 + 2, // 10
    paddingHorizontal: SCALE.s3, // 13
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
    marginBottom: SCALE.s2 - 2, // 6
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

  /* ===========================================================================
   * Statement (宣言文)
   *  justify バグ撤去: textAlign = 'left'、lineHeight = 1.72 で余裕の左揃え
   * ========================================================================= */
  statementTitle: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.micro, // 7.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s2, // 8
  },
  statementBody: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.body, // 10.5
    lineHeight: 1.72,
    color: PDF_COLORS.ink,
    marginBottom: SCALE.s4 + SCALE.s1, // 24
    textAlign: 'left',
  },

  /* ===========================================================================
   * Signature row (SealedStamp 削除版)
   *  - 左: SEALED BY + 署名者 + Certificate ID
   *  - 右: Verified mark (BrandLockup の小型版 + キャプション)
   * ========================================================================= */
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
    fontSize: SCALE.micro, // 7.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: SCALE.s1 + 1, // 5
  },
  signerName: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.heading - 1, // 16
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.4,
    marginBottom: SCALE.s1, // 4
    flexShrink: 1,
    flexWrap: 'wrap',
    // @ts-expect-error
    wordBreak: 'break-all',
  },
  certificateIdLabel: {
    fontFamily: PDF_FONT_FAMILY.sans,
    fontSize: SCALE.caption + 0.5, // 7
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginTop: SCALE.s2 - 2, // 6
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
    marginTop: SCALE.s2 - 2, // 6
    fontSize: SCALE.caption, // 6.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
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

/**
 * SHA-256 を 4 文字 × 16 チャンクで整形。
 * 自動的に 8 + 8 の 2 行に折り返される設計。
 */
function formatSha256(hex: string): string {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) chunks.push(clean.slice(i, i + 4));
  return chunks.join(' ');
}

/**
 * 装飾レイヤー (Bond Frame + ProofMarkWatermark) を単一の fixed コンテナへ
 * 封じ込め、コンテンツフローから完全に隔離する。
 */
const DecorationLayer: React.FC = () => (
  <View fixed style={styles.decorationLayer}>
    {/* Bond Frame — 1px 証券枠 */}
    <View style={styles.bondFrame} />
    {/* 中央 Watermark */}
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
        {/* 装飾レイヤー (絶対隔離) */}
        <DecorationLayer />

        {/* ─── Header: 公式ロゴ + ProofMark ワードマーク ─── */}
        <View style={styles.headerRow}>
          <View style={styles.brandLockup}>
            <ProofMarkLogo size={22} instanceId="cert-header" />
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

        {/* ─── 精緻な仕切り線 ─── */}
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

        {/* ─── Declaration (宣言文 / left-aligned) ─── */}
        <Text style={styles.statementTitle}>DECLARATION  /  宣言文</Text>
        <Text style={styles.statementBody}>
          本書は、クリエイターによって生成された指定のデジタルアセット、およびその制作プロセスの完全性が、記載の時刻において確実に存在し、その後1ビットの改ざんも生じていないことを暗号学的に証明するものである。本証明は、国際標準規格 RFC 3161 に準拠したタイムスタンプと SHA-256 ハッシュアルゴリズムにより客観的な証拠能力が確保されており、ProofMarkのインフラに依存することなく、提供された検証スクリプトを用いて独立かつ永続的に検証可能である。
        </Text>

        {/* ─── Signature row (SealedStamp 削除版) ─── */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signedBy}>SEALED BY  /  発行者</Text>
            <Text style={styles.signerName}>{input.creatorDisplayName}</Text>
            <Text style={styles.certificateIdLabel}>CERTIFICATE ID</Text>
            <Text style={styles.certificateId}>#{input.certificateId}</Text>
          </View>
          <View style={styles.verifiedStack}>
            <ProofMarkLogo size={36} instanceId="cert-sig" />
            <Text style={styles.verifiedCaption}>VERIFIED BY PROOFMARK</Text>
          </View>
        </View>

        {/* ─── Footer (fixed / ページ番号付き) ─── */}
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
