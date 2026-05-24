/**
 * coverLetterPdfGenerator.ts
 * ─────────────────────────────────────────────────────────────
 *  クライアント向けカバーレター PDF。
 *
 *  「弁護士が作成した書簡」のトーン。日本語本文を Helvetica + 改行幅で
 *  読みやすく置き、宛先・差出人を明確に分離する。
 *  クライアントが最初に開いて 10 秒で安心するための文書。
 * ─────────────────────────────────────────────────────────────
 */

import { jsPDF } from 'jspdf';

export interface CoverLetterInput {
  certificateId: string;
  timestampJst: string;
  verificationUrl: string;
  creatorDisplayName: string;
}

const COLOR = {
  purple: [108, 62, 244] as const,
  teal: [0, 212, 170] as const,
  ink: [26, 26, 46] as const,
  inkSoft: [60, 60, 80] as const,
  inkMuted: [120, 120, 140] as const,
  rule: [220, 220, 230] as const,
} as const;

const BODY_TEMPLATE = `件名：制作物の存在証明書（Evidence Pack）について


このたびは制作物をお受け取りいただき、誠にありがとうございます。

本ZIPファイルには、納品物の「存在と完全性の証明」を目的とした
ProofMark Evidence Pack が同梱されています。

※ご注意：本ZIPファイル内に「納品物（作品データ）本体」は含まれておりません。
クリエイターから別途お送りしている納品物ファイルと併せて保管・検証をお願いいたします。

■ 証明書（Certificate_of_Authenticity.pdf）について

同梱の証明書に記載された SHA-256 ハッシュ値およびタイムスタンプは、
納品物が「[TIMESTAMP_JST] の時点で確実に存在し、
それ以降いかなる改変も受けていないこと」を暗号学的に証明するものです。

本証明はIETF標準（RFC3161）に準拠しており、ProofMarkのサービスが
存在しない状況においても、OpenSSL等の標準ツールのみで
第三者による独立した再検証が可能です。

■ 検証方法

同梱の verify.sh（Mac/Linux）または verify.py（Python）を実行することで、
いつでも改ざんがないことをご自身で確認いただけます。
また、以下の検証URLからブラウザ上での確認も可能です。

検証URL:
[VERIFICATION_URL]

本納品物についてご不明な点がございましたら、お気軽にご連絡ください。

敬具`;

export async function generateCoverLetterPDF(
  data: CoverLetterInput,
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  doc.setProperties({
    title: 'ProofMark — Cover Letter',
    subject: `Cover letter for certificate ${data.certificateId}`,
    creator: 'ProofMark.jp',
    author: data.creatorDisplayName,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;

  /* ── 上部カラーバー ── */
  doc.setFillColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.rect(0, 0, pageW, 3, 'F');

  /* ── ヘッダー: ロゴ + 日付 ── */
  // logo
  doc.setFillColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.roundedRect(margin, margin, 14, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('✓', margin + 7, margin + 10, { align: 'center' });

  doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ProofMark', margin + 20, margin + 11);

  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('proofmark.jp', margin + 20, margin + 22);

  // date (right)
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(COLOR.inkSoft[0], COLOR.inkSoft[1], COLOR.inkSoft[2]);
  doc.text(`Date: ${dateStr}`, pageW - margin, margin + 11, { align: 'right' });

  // hairline under header
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, margin + 34, pageW - margin, margin + 34);

  /* ── 本文 ── */
  const filled = BODY_TEMPLATE
    .replace('[TIMESTAMP_JST]', data.timestampJst)
    .replace('[VERIFICATION_URL]', data.verificationUrl);

  const bodyTopY = margin + 60;
  const bodyW = pageW - margin * 2;

  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);

  const lineHeight = 16;
  const lines = doc.splitTextToSize(filled, bodyW);
  let cy = bodyTopY;

  for (const raw of lines as string[]) {
    const line = raw as string;

    // 件名強調
    if (line.startsWith('件名：')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
      doc.text(line, margin, cy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      cy += lineHeight + 6;
      continue;
    }

    // 見出し（■）
    if (line.startsWith('■')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
      doc.text(line, margin, cy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
      cy += lineHeight + 2;
      continue;
    }

    // 検証 URL 行
    if (/^https?:\/\//.test(line.trim())) {
      doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
      doc.textWithLink(line, margin, cy, { url: data.verificationUrl });
      doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
      cy += lineHeight;
      continue;
    }

    doc.text(line, margin, cy);
    cy += lineHeight;
  }

  /* ── 差出人ブロック ── */
  cy += 24;
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, cy - 18, pageW - margin, cy - 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.text(data.creatorDisplayName, margin, cy);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR.inkSoft[0], COLOR.inkSoft[1], COLOR.inkSoft[2]);
  doc.text('Secured via ProofMark.jp', margin, cy + 14);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text(`Certificate ID: ${data.certificateId}`, margin, cy + 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.text('RFC3161 Timestamp · SHA-256 Cryptographic Proof', margin, cy + 42);

  /* ── 認証印章（右下、雰囲気作り） ── */
  drawAuthSeal(doc, pageW - margin - 110, cy - 4);

  /* ── footer hairline ── */
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - margin - 10, pageW - margin, pageH - margin - 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text(
    'This document is auto-generated by ProofMark. Independent verification: openssl ts -verify -in TIMESTAMP.tsr -data <file>',
    pageW / 2,
    pageH - margin,
    { align: 'center' },
  );

  return doc.output('blob');
}

function drawAuthSeal(doc: jsPDF, x: number, y: number): void {
  // 二重円章
  doc.setDrawColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.setLineWidth(1.2);
  doc.circle(x + 36, y + 14, 36, 'S');
  doc.setLineWidth(0.4);
  doc.circle(x + 36, y + 14, 30, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.text('PROOFMARK', x + 36, y + 8, { align: 'center' });

  doc.setFontSize(14);
  doc.text('✓', x + 36, y + 22, { align: 'center', baseline: 'middle' });

  doc.setFontSize(6);
  doc.text('AUTHENTICATED', x + 36, y + 36, { align: 'center' });
}
