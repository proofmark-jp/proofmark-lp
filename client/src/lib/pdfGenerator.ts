/**
 * pdfGenerator.ts — Certificate of Authenticity (A4 縦, jsPDF)
 * ─────────────────────────────────────────────────────────────
 *  ProofMark のブランド言語を 1 枚の白紙の証明書として再構築する。
 *
 *  参照: client/src/pages/CertificatePage.tsx の VERIFIED バッジ・
 *        Teal アクセント・Hash パネル・Gold タイムスタンプ・QR を
 *        印刷向けに翻訳。
 *
 *  クライアントがこの PDF を開いた瞬間、「美術品の真正証明書」と同水準の
 *  重厚感を直感的に感じる構造になっている。
 *
 *  Dependencies:
 *    npm i jspdf qrcode
 *    npm i -D @types/qrcode
 * ─────────────────────────────────────────────────────────────
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

/* ─────────────────────────────────────────────
 *  Public types
 * ───────────────────────────────────────────── */

export interface PdfGeneratorInput {
  certificateId: string;
  originalFileName: string;
  originalFileSize: number; // bytes
  sha256Hash: string;
  timestampJst: string;
  timestampIso: string;
  verificationUrl: string;
  proofMode: 'shareable' | 'private';
  thumbnailDataUrl?: string;
  creatorDisplayName?: string;
}

/* ─────────────────────────────────────────────
 *  Brand tokens (PDF rendering)
 * ───────────────────────────────────────────── */

const COLOR = {
  purple: [108, 62, 244] as const, // Identity
  teal: [0, 212, 170] as const,    // Proof
  gold: [240, 187, 56] as const,   // Founder
  ink: [26, 26, 46] as const,      // body text
  inkSoft: [60, 60, 80] as const,
  inkMuted: [120, 120, 140] as const,
  inkSubtle: [165, 165, 185] as const,
  rule: [220, 220, 230] as const,
  watermark: [235, 235, 240] as const,
  cardFill: [250, 250, 252] as const,
} as const;

/* ─────────────────────────────────────────────
 *  Public API
 * ───────────────────────────────────────────── */

export async function generateCertificatePDF(
  data: PdfGeneratorInput,
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  // PDF メタデータ
  doc.setProperties({
    title: 'Certificate of Authenticity — ProofMark',
    subject: `ProofMark Digital Existence Certificate · ${data.certificateId}`,
    author: data.creatorDisplayName || 'ProofMark Verified Creator',
    creator: 'ProofMark.jp',
    keywords: 'ProofMark, RFC3161, SHA-256, Certificate of Authenticity',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;

  /* ── 透かし ── */
  drawWatermark(doc, pageWidth, pageHeight);

  /* ── 上部カラーバー ── */
  doc.setFillColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  /* ── 左上ロゴ ── */
  drawLogo(doc, margin, margin + 20);

  /* ── 右上 ヘッダーメタ (Issued at) ── */
  drawIssuedMeta(doc, pageWidth, margin, data);

  /* ── タイトル ── */
  const titleBaseY = margin + 78;
  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  centerText(doc, 'CERTIFICATE OF AUTHENTICITY', pageWidth, titleBaseY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  centerText(
    doc,
    'PROOFMARK · DIGITAL EXISTENCE CERTIFICATE',
    pageWidth,
    titleBaseY + 18,
    { letterSpacingPt: 3.4 },
  );

  /* ── VERIFIED / FOUNDER バッジ (CertificatePage.tsx と同じ言語) ── */
  drawBadges(doc, pageWidth, titleBaseY + 38);

  /* ── アセット + データグリッド ── */
  const cardTopY = titleBaseY + 70;
  const cardBottomY = await drawAssetBlock(doc, data, margin, cardTopY, pageWidth);

  /* ── 上部区切り線 ── */
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.6);
  doc.line(margin, cardBottomY + 18, pageWidth - margin, cardBottomY + 18);

  /* ── SHA-256 パネル ── */
  let cursorY = cardBottomY + 38;
  cursorY = drawHashPanel(doc, data, margin, cursorY, pageWidth);

  /* ── タイムスタンプ ── */
  cursorY += 22;
  cursorY = drawTimestampPanel(doc, data, margin, cursorY, pageWidth);

  /* ── 区切り線 ── */
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY + 12, pageWidth - margin, cursorY + 12);

  /* ── QR + 署名ブロック ── */
  await drawQrAndSignature(doc, data, margin, cursorY + 28, pageWidth, pageHeight);

  /* ── 法的フッター ── */
  drawLegalFooter(doc, pageWidth, pageHeight, margin);

  return doc.output('blob');
}

/* ─────────────────────────────────────────────
 *  Components
 * ───────────────────────────────────────────── */

function drawWatermark(doc: jsPDF, pageW: number, pageH: number): void {
  doc.saveGraphicsState();
  // GState 経由で global alpha を下げる
  // @ts-expect-error jspdf GState 型
  doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: 0.04 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(120);
  doc.setTextColor(COLOR.watermark[0], COLOR.watermark[1], COLOR.watermark[2]);
  doc.text('PROOFMARK', pageW / 2, pageH / 2 + 36, {
    align: 'center',
    angle: -28,
  });
  doc.restoreGraphicsState();
}

function drawLogo(doc: jsPDF, x: number, y: number): void {
  // ✓ チェックマーク + ProofMark
  doc.setFillColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.roundedRect(x, y - 12, 16, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('✓', x + 8, y, { align: 'center', baseline: 'middle' });

  doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ProofMark', x + 22, y - 1.5, { baseline: 'middle' });

  // tagline
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('DIGITAL EXISTENCE INFRASTRUCTURE', x + 22, y + 9);
}

function drawIssuedMeta(
  doc: jsPDF,
  pageW: number,
  margin: number,
  data: PdfGeneratorInput,
): void {
  const rightX = pageW - margin;
  const y = margin + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text('ISSUED AT (JST)', rightX, y, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.text(data.timestampJst, rightX, y + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.inkSubtle[0], COLOR.inkSubtle[1], COLOR.inkSubtle[2]);
  doc.text(data.timestampIso, rightX, y + 23, { align: 'right' });
}

function drawBadges(doc: jsPDF, pageW: number, y: number): void {
  // VERIFIED + FOUNDER の 2 バッジを横並び中央
  const labelV = 'VERIFIED';
  const labelF = 'PROOFMARK PROTOCOL';
  const gap = 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const wV = doc.getTextWidth(labelV) + 26;
  const wF = doc.getTextWidth(labelF) + 26;
  const totalW = wV + wF + gap;
  let cx = (pageW - totalW) / 2;

  // VERIFIED (Teal)
  drawPillBadge(doc, cx, y, wV, {
    label: labelV,
    fill: [0, 212, 170, 0.10],
    border: COLOR.teal,
    text: COLOR.teal,
    dot: true,
  });
  cx += wV + gap;

  // PROOFMARK PROTOCOL (Purple)
  drawPillBadge(doc, cx, y, wF, {
    label: labelF,
    fill: [108, 62, 244, 0.08],
    border: COLOR.purple,
    text: COLOR.purple,
    dot: false,
  });
}

function drawPillBadge(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  opts: {
    label: string;
    fill: readonly [number, number, number, number];
    border: readonly [number, number, number];
    text: readonly [number, number, number];
    dot: boolean;
  },
): void {
  const h = 18;
  doc.saveGraphicsState();
  // @ts-expect-error jspdf GState
  doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: opts.fill[3] }));
  doc.setFillColor(opts.fill[0], opts.fill[1], opts.fill[2]);
  doc.roundedRect(x, y - 13, w, h, 9, 9, 'F');
  doc.restoreGraphicsState();
  doc.setDrawColor(opts.border[0], opts.border[1], opts.border[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y - 13, w, h, 9, 9, 'S');

  let textX = x + 12;
  if (opts.dot) {
    doc.setFillColor(opts.border[0], opts.border[1], opts.border[2]);
    doc.circle(x + 9, y - 4, 1.7, 'F');
    textX = x + 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(opts.text[0], opts.text[1], opts.text[2]);
  doc.text(opts.label, textX, y - 1);
}

async function drawAssetBlock(
  doc: jsPDF,
  data: PdfGeneratorInput,
  margin: number,
  topY: number,
  pageW: number,
): Promise<number> {
  const cardX = margin;
  const cardY = topY;
  const cardW = pageW - margin * 2;
  const cardH = 138;

  // base card
  doc.setFillColor(COLOR.cardFill[0], COLOR.cardFill[1], COLOR.cardFill[2]);
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(cardX, cardY, cardW, cardH, 10, 10, 'FD');

  // thumbnail or icon
  const thumbX = cardX + 14;
  const thumbY = cardY + 14;
  const thumbW = 110;
  const thumbH = 110;
  let dataX = thumbX + thumbW + 18;

  if (data.proofMode === 'shareable' && data.thumbnailDataUrl) {
    try {
      const format =
        data.thumbnailDataUrl.includes('image/png') ? 'PNG' :
        data.thumbnailDataUrl.includes('image/webp') ? 'WEBP' : 'JPEG';
      doc.addImage(data.thumbnailDataUrl, format, thumbX, thumbY, thumbW, thumbH, undefined, 'FAST');
    } catch {
      drawFileBadge(doc, data, thumbX, thumbY, thumbW, thumbH);
    }
    doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(thumbX, thumbY, thumbW, thumbH, 6, 6, 'S');
  } else {
    drawFileBadge(doc, data, thumbX, thumbY, thumbW, thumbH);
  }

  // small "Sealed" tag on top-right of thumb
  doc.saveGraphicsState();
  // @ts-expect-error jspdf GState
  doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: 0.18 }));
  doc.setFillColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.roundedRect(thumbX + thumbW - 50, thumbY + 6, 44, 14, 7, 7, 'F');
  doc.restoreGraphicsState();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.text('SEALED', thumbX + thumbW - 28, thumbY + 15, { align: 'center' });

  // data grid (right)
  const dataInnerY = cardY + 22;
  const lineGap = 24;

  drawKv(doc, dataX, dataInnerY, 'CERTIFICATE ID', data.certificateId, { mono: true });
  drawKv(doc, dataX, dataInnerY + lineGap, 'PROTECTED ASSET', truncate(data.originalFileName, 56));
  drawKv(doc, dataX, dataInnerY + lineGap * 2, 'FILE SIZE', formatBytes(data.originalFileSize));
  drawKv(
    doc,
    dataX,
    dataInnerY + lineGap * 3,
    'PROOF MODE',
    data.proofMode === 'shareable' ? 'Shareable Proof (Public)' : 'Private Proof (Zero-Knowledge)',
  );

  return cardY + cardH;
}

function drawFileBadge(
  doc: jsPDF,
  data: PdfGeneratorInput,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // 内側を深い夜空グラデーション風のフラットダーク
  doc.setFillColor(13, 11, 36); // #0D0B24
  doc.roundedRect(x, y, w, h, 6, 6, 'F');
  doc.setDrawColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, h, 6, 6, 'S');

  const ext = (() => {
    const dot = data.originalFileName.lastIndexOf('.');
    return dot > -1
      ? data.originalFileName.slice(dot + 1).slice(0, 6).toUpperCase()
      : 'FILE';
  })();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text(ext, x + w / 2, y + h / 2 + 4, { align: 'center', baseline: 'middle' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(168, 160, 216);
  doc.text('ZERO-KNOWLEDGE', x + w / 2, y + h - 12, { align: 'center' });
}

function drawKv(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  opts?: { mono?: boolean },
): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text(label, x, y);

  doc.setFont(opts?.mono ? 'courier' : 'helvetica', opts?.mono ? 'normal' : 'bold');
  doc.setFontSize(opts?.mono ? 9 : 10.5);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.text(value, x, y + 12);
}

function drawHashPanel(
  doc: jsPDF,
  data: PdfGeneratorInput,
  margin: number,
  topY: number,
  pageW: number,
): number {
  const x = margin;
  const y = topY;
  const w = pageW - margin * 2;
  const h = 64;

  // panel
  doc.saveGraphicsState();
  // @ts-expect-error jspdf GState
  doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: 0.07 }));
  doc.setFillColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.roundedRect(x, y, w, h, 8, 8, 'F');
  doc.restoreGraphicsState();
  doc.setDrawColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.setLineWidth(0.7);
  doc.roundedRect(x, y, w, h, 8, 8, 'S');

  // label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.text('SHA-256 CRYPTOGRAPHIC SIGNATURE', x + 14, y + 16);

  // checkmark dot
  doc.setFillColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.circle(x + w - 18, y + 14, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('✓', x + w - 18, y + 16, { align: 'center', baseline: 'middle' });

  // hash (2 行分割で印字性を上げる)
  const head = data.sha256Hash.slice(0, 32);
  const tail = data.sha256Hash.slice(32);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.text(head, x + 14, y + 36);
  doc.text(tail, x + 14, y + 50);

  return y + h;
}

function drawTimestampPanel(
  doc: jsPDF,
  data: PdfGeneratorInput,
  margin: number,
  topY: number,
  pageW: number,
): number {
  const x = margin;
  const y = topY;
  const w = pageW - margin * 2;
  const h = 64;

  doc.saveGraphicsState();
  // @ts-expect-error jspdf GState
  doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: 0.06 }));
  doc.setFillColor(COLOR.gold[0], COLOR.gold[1], COLOR.gold[2]);
  doc.roundedRect(x, y, w, h, 8, 8, 'F');
  doc.restoreGraphicsState();
  doc.setDrawColor(COLOR.gold[0], COLOR.gold[1], COLOR.gold[2]);
  doc.setLineWidth(0.7);
  doc.roundedRect(x, y, w, h, 8, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(COLOR.gold[0], COLOR.gold[1], COLOR.gold[2]);
  doc.text('DIGITAL TIMESTAMP (JST)', x + 14, y + 16);

  // RFC3161 chip
  drawRfcChip(doc, x + w - 96, y + 9);

  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.text(data.timestampJst, x + 14, y + 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text('改ざん不能な技術で真正性が担保されています', x + 14, y + 54);

  return y + h;
}

function drawRfcChip(doc: jsPDF, x: number, y: number): void {
  const w = 82;
  const h = 16;
  doc.saveGraphicsState();
  // @ts-expect-error jspdf GState
  doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: 0.12 }));
  doc.setFillColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.roundedRect(x, y, w, h, 8, 8, 'F');
  doc.restoreGraphicsState();
  doc.setDrawColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 8, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.text('✓  RFC3161  VERIFIED', x + w / 2, y + 11, { align: 'center' });
}

async function drawQrAndSignature(
  doc: jsPDF,
  data: PdfGeneratorInput,
  margin: number,
  topY: number,
  pageW: number,
  pageH: number,
): Promise<void> {
  // ── QR ──
  const qrSize = 88;
  const qrX = margin;
  const qrY = topY;

  const qrDataUrl = await QRCode.toDataURL(data.verificationUrl, {
    margin: 0,
    width: 256,
    errorCorrectionLevel: 'M',
    color: { dark: '#1A1A2E', light: '#FFFFFF' },
  });
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST');

  // border around QR
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text('SCAN TO VERIFY', qrX + qrSize / 2, qrY + qrSize + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.textWithLink(
    truncate(data.verificationUrl.replace(/^https?:\/\//, ''), 30),
    qrX + qrSize / 2,
    qrY + qrSize + 24,
    { url: data.verificationUrl, align: 'center' },
  );

  // ── Signature block (right) ──
  const sigX = pageW - margin - 240;
  const sigY = topY;

  doc.setFont('times', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(COLOR.inkSoft[0], COLOR.inkSoft[1], COLOR.inkSoft[2]);
  doc.text('Issued & Sealed by', sigX, sigY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.text('ProofMark Protocol', sigX, sigY + 38);

  // signature line
  doc.setDrawColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.setLineWidth(0.9);
  doc.line(sigX, sigY + 46, pageW - margin, sigY + 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text('Cryptographically Sealed & Timestamped', sigX, sigY + 60);
  doc.text('SHA-256 (NIST FIPS 180-4) · RFC3161 · IETF Standard', sigX, sigY + 72);
  doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.textWithLink('proofmark.jp/trust-center', sigX, sigY + 84, {
    url: 'https://proofmark.jp/trust-center',
  });

  // creator line
  const creator = data.creatorDisplayName?.trim() || 'ProofMark Verified Creator';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.text(`Issuer · ${creator}`, sigX, sigY + 100);
}

function drawLegalFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  margin: number,
): void {
  const text =
    'This certificate is cryptographically secured by SHA-256 (NIST FIPS 180-4) and the RFC3161 timestamping standard. ' +
    'The original asset was processed exclusively in the creator\'s browser and was never transmitted to any server. ' +
    'Independent verification: openssl ts -verify -in TIMESTAMP.tsr -data <original_file>';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(COLOR.inkSubtle[0], COLOR.inkSubtle[1], COLOR.inkSubtle[2]);

  const lines = doc.splitTextToSize(text, pageW - margin * 2);
  const y0 = pageH - margin - lines.length * 9 - 4;
  doc.text(lines, pageW / 2, y0, { align: 'center' });

  // bottom hairline
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - margin - 6, pageW - margin, pageH - margin - 6);
}

/* ─────────────────────────────────────────────
 *  Utilities
 * ───────────────────────────────────────────── */

function centerText(
  doc: jsPDF,
  text: string,
  pageW: number,
  y: number,
  opts?: { letterSpacingPt?: number },
): void {
  if (!opts?.letterSpacingPt) {
    doc.text(text, pageW / 2, y, { align: 'center' });
    return;
  }
  // 文字間隔を伸ばす (kerning 表現)
  doc.setCharSpace(opts.letterSpacingPt);
  doc.text(text, pageW / 2, y, { align: 'center' });
  doc.setCharSpace(0);
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
