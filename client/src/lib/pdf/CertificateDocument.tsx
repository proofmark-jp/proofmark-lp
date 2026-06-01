/**
 * CertificateDocument.tsx (v3)
 * -----------------------------------------------------------------------------
 * Certificate_of_Authenticity.pdf — スイス銀行債券レベルの重厚な公文書仕様。
 *
 * v2 → v3 の変更点:
 *  - 宣言文 (DECLARATION) を「客観的証拠能力」を中核とした厳格な法務文体に
 *    完全リライト (lineHeight 1.6 は維持)。
 *  - 証券ウォーターマーク (PROOFMARK SECURE DOCUMENT) を最背面に追加。
 *    View fixed + position:absolute 全面コンテナで、改ページバグを回避。
 *    transform: rotate(-45deg) + transformOrigin: 'center'、
 *    color: PDF_COLORS.rule、opacity 0.05 の上品な調整。
 *    英数字のみで日本語フォント不要 (文字化けリスクゼロ)。
 *  - 全 <Text> は既存の StyleSheet 経由でフォント (PDF_FONT_FAMILY.sans/mono)
 *    が適用されることを保証。独自フォント指定は一切なし。
 *
 * @react-pdf/renderer 制約遵守:
 *  - box-shadow / grid / z-index 等の未対応 CSS は不使用。
 *  - ウォーターマーク用 View には fixed を必ず付与し、空白ページ生成を防止。
 *  - 既存スタイル経由でフォントを当て、日本語の文字化けを死守。
 *
 * レイアウト (上から):
 *   0. ウォーターマーク (View fixed, 最背面)
 *   1. CornerOrnament  (ページ全体, 装飾枠)
 *   2. ヘッダ          : ProofMarkLogo + ヘッダメタ (右寄せ)
 *   3. アイブロウ      : "EVIDENCE OF AUTHENTICITY"
 *   4. タイトル        : "Certificate of Authenticity" (大型 Bold, 2 段)
 *   5. 副題            : "納品物真正性証明書"
 *   6. グラデ罫線
 *   7. SUBJECT FILE    : メタグリッド (label/value)
 *   8. SHA-256 カード  (パープルバー + モノスペース 8 文字区切り)
 *   9. DECLARATION     : 宣言文 (lineHeight 1.6, body)
 *  10. 署名行 + Certificate ID
 *  11. 右下: SealedStamp (絶対配置) + 上に "VERIFIED BY PROOFMARK"
 *  12. フッタ          : 罫線 + 検証 URL + TSA 提供者
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import { Document, Page, View, Text, Link, StyleSheet } from '@react-pdf/renderer';
import { PDF_COLORS, PDF_LAYOUT, PDF_LEADING, PDF_TRACKING } from './tokens';
import { PDF_FONT_FAMILY } from './fonts';
import {
  ProofMarkLogo,
  CornerOrnament,
  SealedStamp,
  DividerRule,
} from './Decorations';
import type { CertificatePdfInput } from './types';

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY.sans,
    backgroundColor: PDF_COLORS.paper,
    color: PDF_COLORS.ink,
    paddingTop: PDF_LAYOUT.marginTop,
    paddingBottom: PDF_LAYOUT.marginBottom,
    paddingHorizontal: PDF_LAYOUT.marginX,
    position: 'relative',
  },

  /* ===========================================================
   * Watermark (証券コピーガード透かし)
   * - View fixed + 絶対配置全面で改ページ副作用を回避
   * - Text は StyleSheet 経由でフォント (sans) を確実適用
   * - 英数字のみで日本語化け不可避な要素を含まない
   * - opacity 0.05 で前面の視認性を絶対阻害しない
   * =========================================================== */
  watermarkLayer: {
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
    fontSize: 72,
    fontWeight: 700,
    letterSpacing: 6,
    color: PDF_COLORS.rule,
    opacity: 0.05,
    transform: 'rotate(-45deg)',
    transformOrigin: 'center',
  },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerMetaLabel: {
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkSubtle,
    marginBottom: 2,
  },
  headerMetaValue: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 8.4,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.6,
    marginBottom: 6,
  },

  /* Title block */
  eyebrow: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.purple,
    marginTop: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: 0.2,
    color: PDF_COLORS.inkDeep,
    lineHeight: PDF_LEADING.tight,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: 500,
    color: PDF_COLORS.ink,
    letterSpacing: 1.6,
  },
  ruleWrap: { marginTop: 26, marginBottom: 30 },

  /* Section heading */
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: 12,
  },

  /* File info grid */
  metaGrid: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  metaKey: {
    width: 110,
    fontSize: 8.5,
    fontWeight: 700,
    color: PDF_COLORS.inkMuted,
    letterSpacing: PDF_TRACKING.label,
    paddingTop: 2,
  },
  metaVal: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 11,
    color: PDF_COLORS.inkDeep,
    fontWeight: 500,
  },
  metaValMono: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 10,
    color: PDF_COLORS.inkDeep,
  },

  /* Hash highlight */
  hashCard: {
    marginTop: 8,
    marginBottom: 26,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: PDF_COLORS.paperSink,
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.purple,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  hashLabel: {
    fontSize: 7.6,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.purple,
    marginBottom: 8,
  },
  hashValue: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 11,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 1.0,
    lineHeight: PDF_LEADING.normal,
  },

  /* Statement (宣言文) */
  statementTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: 10,
  },
  statementBody: {
    fontSize: 10.5,
    lineHeight: PDF_LEADING.body, // ★ 1.6 厳守
    color: PDF_COLORS.ink,
    marginBottom: 30,
  },

  /* Signature row */
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  signatureBlock: { flexGrow: 1, maxWidth: 340 },
  signedBy: {
    fontSize: 8,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: 6,
  },
  signerName: {
    fontSize: 16,
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  certificateIdLabel: {
    fontSize: 7.6,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginTop: 8,
  },
  certificateId: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 10.5,
    color: PDF_COLORS.purple,
    fontWeight: 700,
    letterSpacing: 1.4,
    marginTop: 2,
  },

  /* Seal positioning (右下) */
  sealAnchor: {
    position: 'absolute',
    right: PDF_LAYOUT.marginX + 4,
    bottom: PDF_LAYOUT.marginBottom + 70,
    alignItems: 'center',
  },
  sealCaption: {
    marginTop: 8,
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    left: PDF_LAYOUT.marginX,
    right: PDF_LAYOUT.marginX,
    bottom: PDF_LAYOUT.marginBottom - 32,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 7.6,
    color: PDF_COLORS.inkSubtle,
    letterSpacing: PDF_TRACKING.small,
  },
  footerMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 8.0,
    color: PDF_COLORS.inkDeep,
  },
});

/** SHA-256 を 8 文字ごとにスペース挿入 (視認性向上) */
function formatSha256(hex: string): string {
  const clean = hex.replace(/\s+/g, '').toLowerCase();
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 8) chunks.push(clean.slice(i, i + 8));
  return chunks.join(' ');
}

export const CertificateDocument: React.FC<{ input: CertificatePdfInput }> = ({
  input,
}) => {
  const sealVariant = input.sealVariant ?? 'teal';
  const tsaProvider = input.tsaProvider ?? 'RFC 3161 Compliant TSA';

  return (
    <Document
      title={`ProofMark Certificate ${input.certificateId}`}
      author="ProofMark"
      subject="Certificate of Authenticity"
      creator="ProofMark Evidence Pack Engine"
      producer="ProofMark"
    >
      <Page size="A4" style={styles.page}>
        {/*
         * Watermark Layer (最背面)
         * - fixed: ページ毎に同一描画され、改ページ副作用を起こさない
         * - 英数字のみのため日本語フォント関連の文字化けリスクなし
         * - opacity 0.05 で前面コンテンツの視認性を一切阻害しない
         */}
        <View fixed style={styles.watermarkLayer}>
          <Text style={styles.watermarkText}>PROOFMARK SECURE DOCUMENT</Text>
        </View>

        {/* 装飾レイヤー (絶対配置) */}
        <CornerOrnament
          width={PDF_LAYOUT.pageWidth}
          height={PDF_LAYOUT.pageHeight}
          margin={32}
          armLength={48}
          color={PDF_COLORS.purple}
        />

        {/* Header */}
        <View style={styles.headerRow}>
          <ProofMarkLogo height={22} />
          <View style={styles.headerRight}>
            <Text style={styles.headerMetaLabel}>ISSUED AT</Text>
            <Text style={styles.headerMetaValue}>{input.timestampJst}</Text>
            <Text style={styles.headerMetaLabel}>CERTIFICATE</Text>
            <Text style={styles.headerMetaValue}>#{input.certificateId}</Text>
          </View>
        </View>

        {/* Title block */}
        <Text style={styles.eyebrow}>EVIDENCE OF AUTHENTICITY</Text>
        <Text style={styles.title}>Certificate of{'\n'}Authenticity</Text>
        <Text style={styles.subtitle}>納品物真正性証明書</Text>

        <View style={styles.ruleWrap}>
          <DividerRule width={PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX * 2} />
        </View>

        {/* File info */}
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
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>SEALED AT</Text>
            <Text style={styles.metaValMono}>{input.timestampJst}</Text>
          </View>
        </View>

        {/* Hash card */}
        <View style={styles.hashCard}>
          <Text style={styles.hashLabel}>SHA-256 CRYPTOGRAPHIC DIGEST</Text>
          <Text style={styles.hashValue}>{formatSha256(input.sha256)}</Text>
        </View>

        {/*
         * Declaration (宣言文) ─ 極限化版
         *  「客観的証拠能力」を中核に据え、過剰断定を排除した法務文体。
         *  lineHeight: 1.6 (PDF_LEADING.body) は厳守。
         */}
        <Text style={styles.statementTitle}>DECLARATION  /  宣言文</Text>
        <Text style={styles.statementBody}>
          本書は、クリエイターによって生成された指定のデジタルアセット、およびその制作プロセスの完全性が、記載の時刻において確実に存在し、その後1ビットの改ざんも生じていないことを暗号学的に証明するものである。
          {'\n'}
          本証明は、国際標準規格 RFC 3161 に準拠したタイムスタンプと SHA-256 ハッシュアルゴリズムにより客観的な証拠能力が確保されており、ProofMarkのインフラに依存することなく、提供された検証スクリプトを用いて独立かつ永続的に検証可能である。
        </Text>

        {/* Signature row */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signedBy}>SEALED BY  /  発行者</Text>
            <Text style={styles.signerName}>{input.creatorDisplayName}</Text>
            <Text style={styles.certificateIdLabel}>CERTIFICATE ID</Text>
            <Text style={styles.certificateId}>#{input.certificateId}</Text>
          </View>
        </View>

        {/* Seal (右下, 絶対配置) + キャプション */}
        <View style={styles.sealAnchor}>
          <SealedStamp size={108} variant={sealVariant} rotation={-7} />
          <Text style={styles.sealCaption}>VERIFIED BY PROOFMARK</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <DividerRule
            width={PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX * 2}
            height={0.8}
          />
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              TSA · {tsaProvider}
            </Text>
            <Link
              src={
                input.verificationUrl?.startsWith('http')
                  ? input.verificationUrl
                  : `https://${input.verificationUrl}`
              }
              style={styles.footerMono}
            >
              {input.verificationUrl}
            </Link>
          </View>
        </View>
      </Page>
    </Document>
  );
};
