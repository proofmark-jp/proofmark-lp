/**
 * CoverLetterDocument.tsx (v2)
 * -----------------------------------------------------------------------------
 * Cover_Letter.pdf — 非技術者クライアントへ「強固な証拠」を一目で納得させる添え状。
 *
 * v1 からの変更点:
 *  - BrandMark → ProofMarkLogo (シンボル + ワードマーク) に差替。
 *  - 純白基色 (#FFFFFF) へ最適化、各シェードを再キャリブレーション。
 *  - 「3 つの担保」を視覚的にカード化 (SHA-256 / RFC 3161 / Independent Verify).
 *  - 本文 lineHeight を 1.85 → 1.8 (PDF_LEADING.airy) に統一。
 *  - verifyCard を上品なダーク (#0E1024 + Teal アクセント) に再設計し、
 *    複数の検証手段 (URL / verify.sh / verify.py) を等価に並列表示。
 *  - 署名行に「SEAL」キャプション付き SealedStamp を組合せて余白美を演出。
 *  - TSA 提供者をフッタに明示。
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

        {/* Greeting */}
        <Text style={styles.body}>
          このたびは制作物をお受け取りいただき、誠にありがとうございます。{'\n'}
          本パッケージには、納品物が{' '}
          <Text style={styles.bodyEmphasis}>{input.timestampJst}</Text>{' '}
          時点で確かに存在し、その後 1 ビットも改ざんされていないことを示す、
          独立に検証可能な暗号学的証拠が同梱されている。
          本添え状は、その仕組みと検証方法を非技術者の方にも一目で理解いただくため
          に作成された。
        </Text>

        {/* 3 つの担保 (Trust Pillars) */}
        <Text style={styles.sectionH}>THE THREE PILLARS  /  本証拠を支える 3 つの担保</Text>
        <View style={styles.pillarRow}>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>① CRYPTOGRAPHIC</Text>
            <Text style={styles.pillarTitle}>SHA-256 指紋</Text>
            <Text style={styles.pillarText}>
              納品ファイルから計算した 256 ビットの「指紋」。
              1 ビット改変するだけで指紋が完全に変化する。
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>② NOTARIZED</Text>
            <Text style={styles.pillarTitle}>RFC 3161 タイムスタンプ</Text>
            <Text style={styles.pillarText}>
              国際標準に準拠した第三者機関 (TSA) が、
              上記の指紋と日時を暗号署名で連結し担保している。
            </Text>
          </View>
          <View style={styles.pillar}>
            <Text style={styles.pillarBadge}>③ INDEPENDENT</Text>
            <Text style={styles.pillarTitle}>独立検証可能</Text>
            <Text style={styles.pillarText}>
              ProofMark のサーバーに依存せず、貴社内のみで完結する
              検証スクリプトとオンライン検証ページを提供している。
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
            <Link src={input.verificationUrl?.startsWith('http') ? input.verificationUrl : `https://${input.verificationUrl}`} style={styles.verifyUrl}>{input.verificationUrl}</Link>
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
