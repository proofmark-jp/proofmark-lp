/**
 * CoverLetterDocument.tsx (v3)
 * -----------------------------------------------------------------------------
 * Cover_Letter.pdf — スイス銀行債券レベルの重厚な公文書仕様。
 *
 * v2 → v3 の変更点:
 *  - Body (挨拶) を「客観的証拠能力」を中核に据えた威圧感のあるコピーへ
 *    完全書き換え。過剰断定 (「法的に担保する」等) を排除。
 *  - THE THREE PILLARS の文言を「① CRYPTOGRAPHIC」「② NOTARIZED」
 *    「③ PROCESS PROVEN」に刷新。
 *    特に③で「制作過程の連鎖証明 (ハッシュチェーン)」を訴求し、
 *    完成品単体ではなく「プロセス全体の真正性」を打ち出す。
 *  - 証券ウォーターマーク (PROOFMARK SECURE DOCUMENT) を最背面に追加。
 *    View fixed + position:absolute 全面コンテナで改ページバグを回避。
 *    transform: rotate(-45deg) + transformOrigin: 'center'、
 *    color: PDF_COLORS.rule、opacity 0.05 の上品な調整。
 *    英数字のみで文字化けリスクゼロ。
 *  - 全 <Text> は StyleSheet 経由でフォント (PDF_FONT_FAMILY.sans/mono) が
 *    確実に適用されることを保証。独自フォント指定は一切なし。
 *
 * @react-pdf/renderer 制約遵守:
 *  - box-shadow / grid / z-index 等の未対応 CSS は不使用。
 *  - ウォーターマーク用 View には fixed を必ず付与し、空白ページを防止。
 *  - 既存スタイル経由でフォントを当て、日本語の文字化けを死守。
 * -----------------------------------------------------------------------------
 */

import React from 'react';
import { Document, Page, View, Text, Link, StyleSheet } from '@react-pdf/renderer';
import { PDF_COLORS, PDF_LAYOUT, PDF_LEADING, PDF_TRACKING } from './tokens';
import { PDF_FONT_FAMILY } from './fonts';
import {
  DividerRule,
  ProofMarkLogo,
  SealedStamp,
} from './Decorations';
import type { CoverLetterPdfInput } from './types';

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
   * - Text は StyleSheet 経由で sans フォントを確実適用
   * - 英数字のみで日本語化け要素なし
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
  },
  headerTag: {
    fontSize: 8.5,
    color: PDF_COLORS.inkMuted,
    letterSpacing: PDF_TRACKING.label,
    fontWeight: 700,
  },

  ruleWrap: { marginTop: 16, marginBottom: 30 },

  /* Title */
  eyebrow: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.teal,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.6,
    marginBottom: 24,
    lineHeight: PDF_LEADING.tight,
  },

  /* Body */
  body: {
    fontSize: 10.5,
    lineHeight: PDF_LEADING.airy, // 1.8
    color: PDF_COLORS.ink,
    marginBottom: 22,
  },
  bodyEmphasis: {
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
  },

  /* Section heading */
  sectionH: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    color: PDF_COLORS.purple,
    marginTop: 6,
    marginBottom: 14,
  },

  /* 3 つの担保 (Trust Pillars) — 横並びカード */
  pillarRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 26,
  },
  pillar: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    padding: 12,
    backgroundColor: PDF_COLORS.paperSink,
    borderTopWidth: 2,
    borderTopColor: PDF_COLORS.purple,
    borderRadius: 2,
  },
  pillarBadge: {
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 7.0,
    fontWeight: 700,
    color: PDF_COLORS.purple,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  pillarTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    marginBottom: 6,
  },
  pillarText: {
    fontSize: 8.5,
    lineHeight: PDF_LEADING.body, // 1.6
    color: PDF_COLORS.ink,
  },

  /* File tree */
  treeWrap: {
    borderTopWidth: 0.6,
    borderTopColor: PDF_COLORS.rule,
    borderBottomWidth: 0.6,
    borderBottomColor: PDF_COLORS.rule,
    marginBottom: 28,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.ruleSoft,
  },
  treeRowLast: { borderBottomWidth: 0 },
  treeName: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 9.5,
    color: PDF_COLORS.inkDeep,
  },
  treeDesc: {
    flexBasis: 230,
    fontSize: 8.5,
    color: PDF_COLORS.inkMuted,
    lineHeight: PDF_LEADING.normal,
  },
  treeSize: {
    width: 60,
    textAlign: 'right',
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 8.5,
    color: PDF_COLORS.inkMuted,
  },

  /* Verify CTA */
  verifyCard: {
    backgroundColor: PDF_COLORS.paperDeep, // ほぼ黒
    padding: 20,
    borderRadius: 6,
    marginBottom: 30,
  },
  verifyEyebrow: {
    fontSize: 7.6,
    color: PDF_COLORS.teal,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.eyebrow,
    marginBottom: 8,
  },
  verifyTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: PDF_COLORS.paper,
    marginBottom: 12,
    letterSpacing: 0.4,
  },
  verifyText: {
    fontSize: 9.5,
    color: '#C8C9DC',
    lineHeight: PDF_LEADING.body,
    marginBottom: 14,
  },
  verifyMono: {
    fontFamily: PDF_FONT_FAMILY.mono,
    color: PDF_COLORS.paper,
  },
  verifyUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#2A2C46',
  },
  verifyUrlLabel: {
    fontSize: 7.0,
    color: PDF_COLORS.teal,
    fontWeight: 700,
    letterSpacing: 1.4,
  },
  verifyUrl: {
    flexGrow: 1,
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 10,
    color: PDF_COLORS.paper,
    letterSpacing: 0.4,
  },

  /* Signature footer */
  sigRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sigBlock: { flexGrow: 1, maxWidth: 360 },
  sigLabel: {
    fontSize: 7.6,
    letterSpacing: PDF_TRACKING.label,
    color: PDF_COLORS.inkMuted,
    marginBottom: 6,
    fontWeight: 700,
  },
  sigName: {
    fontSize: 14,
    fontWeight: 700,
    color: PDF_COLORS.inkDeep,
    letterSpacing: 0.3,
  },
  sigMeta: {
    marginTop: 6,
    fontFamily: PDF_FONT_FAMILY.mono,
    fontSize: 8.5,
    color: PDF_COLORS.inkMuted,
  },
  sealStack: { alignItems: 'center' },
  sealStackCaption: {
    marginTop: 6,
    fontSize: 6.4,
    fontWeight: 700,
    letterSpacing: PDF_TRACKING.small,
    color: PDF_COLORS.inkMuted,
  },

  footer: {
    position: 'absolute',
    bottom: 24,
    left: PDF_LAYOUT.marginX,
    right: PDF_LAYOUT.marginX,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 7.6,
    color: PDF_COLORS.inkSubtle,
    letterSpacing: PDF_TRACKING.small,
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

export const CoverLetterDocument: React.FC<{ input: CoverLetterPdfInput }> = ({
  input,
}) => {
  const tree =
    input.fileTree && input.fileTree.length > 0
      ? input.fileTree
      : DEFAULT_FILE_TREE;
  const tsaProvider = input.tsaProvider ?? 'RFC 3161 Compliant TSA';

  return (
    <Document
      title="ProofMark Cover Letter"
      author="ProofMark"
      subject="Evidence Pack Cover Letter"
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

        {/* Header */}
        <View style={styles.headerRow}>
          <ProofMarkLogo height={20} />
          <Text style={styles.headerTag}>COVER LETTER · 添え状</Text>
        </View>

        <View style={styles.ruleWrap}>
          <DividerRule width={PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX * 2} />
        </View>

        {/* Title */}
        <Text style={styles.eyebrow}>FOR THE CLIENT  /  ご担当者様へ</Text>
        <Text style={styles.title}>納品物の真正性証明について</Text>

        {/*
         * Body ─ 威厳あるコピーへ完全書き換え。
         *  挨拶文を廃止し、「客観的証拠能力」を中核に据えた告示文体。
         *  過剰断定 (法的に担保する等) は使用しない。
         */}
        <Text style={styles.body}>
          本 Evidence Pack は、クリエイターから納品されたデジタルアセットの存在事実、およびその制作プロセスの完全性が、タイムスタンプ打刻以降<Text style={styles.bodyEmphasis}>1ビットの改ざんも受けていないこと</Text>を示し、客観的かつ強固な証拠能力を確保するための暗号証明パッケージである。
          {'\n'}
          クリエイターの権利と、貴社の安全なコンテンツ利用を保護するため、最新のゼロ知識証明アプローチを用いて構築されている。検証は以下のURL、または同封のスクリプトによりブラウザ上で完結し、外部へ原本が送信されることは一切ない。
        </Text>

        {/*
         * THE THREE PILLARS ─ 文言刷新版
         *  ① CRYPTOGRAPHIC: SHA-256 指紋
         *  ② NOTARIZED:     RFC 3161 タイムスタンプ
         *  ③ PROCESS PROVEN: 制作過程の連鎖証明 (ハッシュチェーン)
         */}
        <Text style={styles.sectionH}>THE THREE PILLARS  /  本証拠を支える 3 つの担保</Text>
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

        {/* File tree */}
        <Text style={styles.sectionH}>PACKAGE CONTENTS  /  同梱ファイル</Text>
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

        {/* Verify card */}
        <View style={styles.verifyCard}>
          <Text style={styles.verifyEyebrow}>HOW TO VERIFY</Text>
          <Text style={styles.verifyTitle}>検証方法</Text>
          <Text style={styles.verifyText}>
            同梱の <Text style={styles.verifyMono}>verify.sh</Text> もしくは{' '}
            <Text style={styles.verifyMono}>verify.py</Text>{' '}
            を実行することで、外部ネットワークに一切接続せず、貴社内のみで完結する
            形でファイルと TSA 署名の整合を検証することができる。
            あるいは下記のオンライン検証ページから即座に確認することも可能である。
          </Text>
          <View style={styles.verifyUrlRow}>
            <Text style={styles.verifyUrlLabel}>VERIFY URL</Text>
            <Link
              src={
                input.verificationUrl?.startsWith('http')
                  ? input.verificationUrl
                  : `https://${input.verificationUrl}`
              }
              style={styles.verifyUrl}
            >
              {input.verificationUrl}
            </Link>
          </View>
        </View>

        {/* Signature */}
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
            <SealedStamp size={68} variant="teal" rotation={-6} />
            <Text style={styles.sealStackCaption}>VERIFIED</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLabel}>PROOFMARK · EVIDENCE PACK</Text>
          <Text style={styles.footerLabel}>proofmark.jp</Text>
        </View>
      </Page>
    </Document>
  );
};
