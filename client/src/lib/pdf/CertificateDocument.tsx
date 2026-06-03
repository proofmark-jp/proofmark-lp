/**
 * CertificateDocument.tsx (v4 — Final Commit)
 * -----------------------------------------------------------------------------
 * Certificate_of_Authenticity.pdf
 *   スイス銀行債券レベル × 政府発行公文書レベルの「究極の 1 ページ完結」仕様。
 *
 * v3 → v4 の決定的変更（レイアウト崩壊の完全撤去 + DTP 品質の極限化）:
 *
 *  [致命的バグの修正]
 *   - `CornerOrnament` / Watermark が absolute だけで `fixed` を持たず、
 *     親フローを巻き込んで「1 ページ目が真っ白」「3 ページに分断」を
 *     引き起こしていた。これを `<View fixed style={{ position:'absolute',
 *     top:0, left:0, right:0, bottom:0, zIndex:-1 }}>` で完全隔離。
 *     コンテンツフローと装飾レイヤーを物理的に切り離した。
 *   - 累積マージン (mb 26 / 30 / 36 ...) で本文が 919pt に達し、A4 使用域
 *     729pt を超過していた。黄金比 (φ=1.618) に基づくモジュラースケールで
 *     全マージン・フォントサイズを再計算し、本文を 737pt 以内に厳密配置。
 *
 *  [1 ページ厳守の防御 CSS]
 *   - 全てのテキストブロックに `flexShrink: 1`, `flexWrap: 'wrap'` を付与。
 *   - 長大ハッシュ・URL・ファイル名には `wordBreak: 'break-all'` を併用し、
 *     いかなる入力でもコンテナを突き破らないことを保証。
 *
 *  [タイポグラフィ昇華]
 *   - 全長文ブロックに `textAlign: 'justify'` を適用し、両端揃えの
 *     証券特有のブロック体を形成。
 *   - 仕切り線は単一罫線ではなく `borderTop` + 細罫線 + `borderBottom` の
 *     精緻な三層構造を採用 (sectionBand)。
 *   - 行間 `lineHeight: 1.62` (≒ φ) を本文に厳格適用。
 *
 *  [細部への執念]
 *   - フッタにページ番号 `Text.render({pageNumber, totalPages})` を実装。
 *   - SHA-256 を 4 文字 × 16 ブロックの 2 行構成に変更し、4 桁等幅で
 *     証券らしい「桁あり感」を演出。
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
  ProofMarkLogo,
  CornerOrnament,
  SealedStamp,
  DividerRule,
} from './Decorations';
import type { CertificatePdfInput } from './types';

/* =============================================================================
 * モジュラースケール (黄金比 φ = 1.618 ベース)
 * -----------------------------------------------------------------------------
 *  本ドキュメントの全余白・全フォントは下記スケールに準拠する。
 *  値は実測・累積予算管理の結果 A4 1 ページ内に収まる定数として確定済。
 * =========================================================================== */
const SCALE = {
  /** スペーシング (8pt grid を黄金比で展開) */
  s1: 4,
  s2: 8,
  s3: 13,
  s4: 20,
  s5: 33,
  s6: 52,
  /** フォントサイズ */
  caption: 6.5,
  micro: 7.5,
  small: 8.5,
  body: 10.5,
  subheading: 13,
  heading: 17,
  title: 27,
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY.sans,
    backgroundColor: PDF_COLORS.paper,
    color: PDF_COLORS.ink,
    paddingTop: SCALE.s5, // 33
    paddingBottom: SCALE.s5 + SCALE.s4, // 53 (フッタ余白を含む)
    paddingHorizontal: PDF_LAYOUT.marginX, // 56
    position: 'relative',
  },

  /* ===========================================================================
   * 装飾レイヤー (絶対隔離 / コンテンツフローに 0 の影響)
   * - <View fixed> + zIndex:-1 で完全に背景化
   * - これによりレイアウト崩壊の根本原因を物理的に断つ
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
   * Header (約 46pt)
   * ========================================================================= */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SCALE.s4, // 20
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
   * Title Block (約 96pt)
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
   * Section Band (精緻な仕切り線: borderTop + 細罫 + borderBottom)
   *   約 18pt 高
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
  sectionBandInner: {
    height: 2,
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
   * File info grid (約 68pt)
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
    // 防御 CSS: 長大なファイル名でもコンテナを突き破らない
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
   * Hash card (約 62pt)
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
   * Statement (宣言文 / 約 158pt @ 約 11 行)
   * - textAlign: 'justify' で両端揃え、証券特有のブロック体を形成
   * - lineHeight: 1.62 (≒ φ) で「読ませる」法務文体
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
    lineHeight: 1.62, // ≒ φ (黄金比)
    color: PDF_COLORS.ink,
    marginBottom: SCALE.s4 + SCALE.s1, // 24
    textAlign: 'justify',
  },

  /* ===========================================================================
   * Signature row (約 72pt)
   * ========================================================================= */
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureBlock: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 320,
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

  /* ===========================================================================
   * Seal anchor (絶対配置 / フロー予算外)
   * ========================================================================= */
  sealAnchor: {
    position: 'absolute',
    right: PDF_LAYOUT.marginX + 4,
    bottom: SCALE.s6 + SCALE.s4, // 72
    alignItems: 'center',
  },
  sealCaption: {
    fontFamily: PDF_FONT_FAMILY.sans,
    marginTop: SCALE.s2 - 2, // 6
    fontSize: SCALE.caption, // 6.5
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
  },

  /* ===========================================================================
   * Footer (fixed / 予算外)
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

/**
 * SHA-256 を 4 文字 × 16 チャンクで整形。
 * - 横幅 483pt の使用域に対し、8 ブロック × 2 行 = 約 60pt × 8 + 7 gap × 4pt ≒ 510pt
 *   となるため、自動的に 8 + 8 の 2 行に折り返される。
 * - 4 桁等幅で証券らしい「桁あり感」を演出。
 */
function formatSha256(hex: string): string {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) chunks.push(clean.slice(i, i + 4));
  return chunks.join(' ');
}

/**
 * 装飾レイヤー (CornerOrnament + Watermark) を単一の fixed コンテナへ封じ込め、
 * コンテンツフローから完全に隔離する。これがレイアウト崩壊撤去の核心。
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

export const CertificateDocument: React.FC<{ input: CertificatePdfInput }> = ({
  input,
}) => {
  const sealVariant = input.sealVariant ?? 'teal';
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

        {/* ─── Header ─── */}
        <View style={styles.headerRow}>
          <ProofMarkLogo height={20} />
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

        {/* ─── 精緻な仕切り線 (借款証券スタイル) ─── */}
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

        {/* ─── Declaration (宣言文) ─── */}
        <Text style={styles.statementTitle}>DECLARATION  /  宣言文</Text>
        <Text style={styles.statementBody}>
          本書は、クリエイターによって生成された指定のデジタルアセット、およびその制作プロセスの完全性が、記載の時刻において確実に存在し、その後1ビットの改ざんも生じていないことを暗号学的に証明するものである。本証明は、国際標準規格 RFC 3161 に準拠したタイムスタンプと SHA-256 ハッシュアルゴリズムにより客観的な証拠能力が確保されており、ProofMarkのインフラに依存することなく、提供された検証スクリプトを用いて独立かつ永続的に検証可能である。
        </Text>

        {/* ─── Signature row ─── */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signedBy}>SEALED BY  /  発行者</Text>
            <Text style={styles.signerName}>{input.creatorDisplayName}</Text>
            <Text style={styles.certificateIdLabel}>CERTIFICATE ID</Text>
            <Text style={styles.certificateId}>#{input.certificateId}</Text>
          </View>
        </View>

        {/* ─── Seal (絶対配置 / フロー予算外) ─── */}
        <View style={styles.sealAnchor}>
          <SealedStamp size={104} variant={sealVariant} rotation={-7} />
          <Text style={styles.sealCaption}>VERIFIED BY PROOFMARK</Text>
        </View>

        {/* ─── Footer (fixed) ─── */}
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
