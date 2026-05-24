/**
 * takedownPdfGenerator.ts
 * ─────────────────────────────────────────────────────────────────────────
 *  Takedown Notice PDF (DMCA / 送信防止措置依頼書) Generator
 *
 *  目的:
 *    プラットフォーマー (X, Meta, Google, pixiv, BOOTH 等) の法務部が
 *    「即座に対応せざるを得ない」レベルの法的要件を満たした文書を、
 *    100% クライアントサイドで生成する。
 *    Zero-Server Architecture — ProofMark のサーバーは一切経由しない。
 *
 *  法的根拠:
 *    [EN] 17 U.S.C. § 512(c)(3)(A)(i)〜(vi) — DMCA Safe Harbor Notification
 *    [JA] 特定電気通信役務提供者の損害賠償責任の制限等及び発信者情報の
 *         開示に関する法律 (情報流通プラットフォーム対処法) に基づく
 *         送信防止措置依頼書
 *
 *  デザイン言語:
 *    coverLetterPdfGenerator.ts と完全に統一 (白背景 / Identity Purple
 *    のカラーバー / 上部ロゴ / 認証印章)。さらに法的警告書としての
 *    威圧感を「LEGAL NOTICE」ヘッダーと赤系アクセントで上乗せ。
 *
 *  Tech:
 *    - jsPDF + 既存 loadJapaneseFont() を再利用 (日本語フォント埋込)
 *    - 全文 ProofMark / Identity Purple トーンを踏襲
 *    - 電子署名 (Electronic Signature) は claimantName を Italic で大書
 * ─────────────────────────────────────────────────────────────────────────
 */

import { jsPDF } from 'jspdf';
import { loadJapaneseFont } from './pdfUtils';

/* ─────────────────────────────────────────────
 *  Types
 * ───────────────────────────────────────────── */

export interface TakedownNoticeInput {
  /** ProofMark certificate UUID — verification 連動の根幹 */
  certificateId: string;
  /** JST に整形済みのタイムスタンプ文字列 (例: '2026-05-12 14:23 JST') */
  timestampJst: string;
  /** Public verify URL (例: 'https://proofmark.jp/cert/<token>') */
  verificationUrl: string;
  /** 申告者が証明する元作品のファイル名 */
  originalFileName: string;
  /** 侵害先 URL (相手プラットフォームの問題ページ) */
  infringingUrl: string;
  /** 申告者の表示名 / 法的氏名 (Electronic Signature に印字) */
  claimantName: string;
  /** 申告者の連絡先メール — DMCA 法定要件 17 USC 512(c)(3)(A)(iv) */
  claimantEmail: string;
  /** 言語 — 文面と法的根拠を切替える */
  language: 'en' | 'ja';
}

/* ─────────────────────────────────────────────
 *  Design Tokens — coverLetterPdfGenerator.ts と完全同期
 * ───────────────────────────────────────────── */

const COLOR = {
  purple: [108, 62, 244] as const,
  teal: [0, 212, 170] as const,
  // 法的警告書としての威圧感を担う赤 — アクセントは最小限
  noticeRed: [200, 30, 30] as const,
  ink: [26, 26, 46] as const,
  inkSoft: [60, 60, 80] as const,
  inkMuted: [120, 120, 140] as const,
  rule: [220, 220, 230] as const,
  noticeRuleSoft: [245, 220, 220] as const,
} as const;

/* ─────────────────────────────────────────────
 *  本文テンプレート
 *  ─ 法律家がそのまま提出できる完全な文面をハードコード
 *  ─ プレースホルダ: [TIMESTAMP_JST] [VERIFICATION_URL]
 *                    [INFRINGING_URL] [ORIGINAL_FILENAME]
 *                    [CERTIFICATE_ID] [CLAIMANT_EMAIL] [TODAY]
 * ───────────────────────────────────────────── */

const BODY_EN = `Re: NOTIFICATION OF CLAIMED INFRINGEMENT UNDER 17 U.S.C. § 512(c)(3)


To Whom It May Concern at the Service Provider:

I am the copyright owner, or am authorized to act on behalf of the
owner of an exclusive right that is allegedly infringed. I hereby
submit this notice under the Digital Millennium Copyright Act
(17 U.S.C. § 512) and demand the prompt removal or disabling of
access to the material identified below.


1. Identification of the copyrighted work claimed to have been
   infringed.

   File name (original work): [ORIGINAL_FILENAME]
   ProofMark Certificate ID:  [CERTIFICATE_ID]


2. Identification of the material that is claimed to be infringing
   and information reasonably sufficient to permit the service
   provider to locate the material.

   Infringing URL: [INFRINGING_URL]


3. Information reasonably sufficient to permit the service provider
   to contact the complaining party.

   Email: [CLAIMANT_EMAIL]


4. Cryptographic evidence of prior existence (independent third-party
   timestamp under IETF RFC 3161).

   The original work was cryptographically time-stamped at
   [TIMESTAMP_JST] by an RFC 3161 compliant Time Stamp Authority.
   The integrity and existence of the work at that moment can be
   independently verified by any third party using OpenSSL, without
   relying on ProofMark's infrastructure.

   Independent Verification URL:
   [VERIFICATION_URL]


5. Statement of good faith belief.

   I have a good faith belief that use of the copyrighted materials
   described above as allegedly infringing is not authorized by the
   copyright owner, its agent, or the law.


6. Statement under penalty of perjury.

   I swear, under penalty of perjury, that the information in this
   notification is accurate and that I am the copyright owner, or
   am authorized to act on behalf of the owner, of an exclusive
   right that is allegedly infringed.


Pursuant to 17 U.S.C. § 512(c)(1)(C), failure to expeditiously
remove or disable access to the infringing material upon receipt
of this notice may result in the loss of safe harbor protection
for your service.

Respectfully submitted,`;

const BODY_JA = `件名：著作権侵害コンテンツに対する送信防止措置依頼書


[サービス事業者] 御中

私は、下記に特定する著作物の著作権者、または著作権者から正当に
権限を委任された代理人です。貴サービス上で当該著作物が無断で
複製・公衆送信されていることを確認したため、特定電気通信役務
提供者の損害賠償責任の制限等及び発信者情報の開示に関する法律
（情報流通プラットフォーム対処法）および著作権法第21条（複製権）
ならびに第23条（公衆送信権）に基づき、対象コンテンツへの
送信防止措置（削除）を速やかに実施するよう要請いたします。


1. 侵害されたとする著作物の特定

   原本ファイル名：[ORIGINAL_FILENAME]
   ProofMark 証明書 ID：[CERTIFICATE_ID]


2. 侵害行為の特定（送信防止措置の対象）

   侵害先 URL：[INFRINGING_URL]


3. 申告者の連絡先

   Email：[CLAIMANT_EMAIL]


4. 暗号学的存在証明（IETF 標準 RFC 3161 タイムスタンプ）

   私は、上記 URL のコンテンツが私の著作権を侵害していると確信して
   います。証拠として、当該作品が [TIMESTAMP_JST] の時点で確実に
   存在したことを、IETF 標準である RFC 3161 に準拠した第三者
   タイムスタンプ機関の電子署名により暗号学的に証明します。

   本タイムスタンプおよび作品の SHA-256 ハッシュは、ProofMark の
   インフラに依存することなく、OpenSSL 等の標準的暗号ツールにより
   何人でも独立して再検証することが可能です。

   独立検証 URL：
   [VERIFICATION_URL]


5. 誠実な信念に基づく宣言

   私は、上記 URL に掲載されている対象コンテンツの利用が、著作権者、
   その代理人、または法律によって許諾されたものではないと、誠実な
   信念をもって申告いたします。


6. 申告内容の真実性に関する誓約

   私は、本依頼書に記載した事項が真実であること、および私が当該
   著作物の著作権者または正当な代理人であることを、虚偽申告に
   伴う民事上の責任を承知の上で誓約いたします。


貴サービスにおいて、本依頼書の受領後、速やかに送信防止措置が
実施されない場合、情報流通プラットフォーム対処法および民法に
基づく損害賠償責任を含む法的措置を検討する場合がございます。

以上、ご対応のほどよろしくお願いいたします。`;

/* ─────────────────────────────────────────────
 *  Public API
 * ───────────────────────────────────────────── */

/**
 * Takedown Notice PDF を生成して Blob で返す。
 * Zero-Server: API 呼び出しは一切行わない。
 */
export async function generateTakedownNoticePDF(
  data: TakedownNoticeInput,
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  /* ─── 日本語フォント埋込 (JA / EN ともに念のため読み込む) ─── */
  // EN 文面でも署名や宛先に日本語が混じり得る (claimantName が日本語等)。
  // 既存ユーティリティを必ず使用 (Zero-Server Architecture 統一)。
  await loadJapaneseFont(doc);

  doc.setProperties({
    title:
      data.language === 'en'
        ? 'DMCA Takedown Notice — ProofMark'
        : '送信防止措置依頼書 — ProofMark',
    subject: `Takedown notice for certificate ${data.certificateId}`,
    creator: 'ProofMark.jp',
    author: data.claimantName,
    keywords:
      data.language === 'en'
        ? 'DMCA, 17 USC 512, RFC3161, copyright, takedown, ProofMark'
        : '送信防止措置, プロバイダ責任制限法, 情報流通プラットフォーム対処法, RFC3161, 著作権, ProofMark',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;

  /* ─── 上部カラーバー (Identity Purple) ─── */
  doc.setFillColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
  doc.rect(0, 0, pageW, 3, 'F');

  /* ─── 法的警告書としての二本目バー (赤・極細) ─── */
  // 「これはただの問い合わせではなく法的通知である」という威圧感を 1px で。
  doc.setFillColor(
    COLOR.noticeRed[0],
    COLOR.noticeRed[1],
    COLOR.noticeRed[2],
  );
  doc.rect(0, 3, pageW, 1, 'F');

  /* ─── ヘッダー: ProofMark ロゴ + 日付 ─── */
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

  // 日付 (right) — ISO 8601 風 (YYYY-MM-DD)
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(today.getDate()).padStart(2, '0')}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(COLOR.inkSoft[0], COLOR.inkSoft[1], COLOR.inkSoft[2]);
  doc.text(`Date: ${dateStr}`, pageW - margin, margin + 11, { align: 'right' });

  /* ─── LEGAL NOTICE バナー — 法的文書である威圧感を作る ─── */
  const bannerY = margin + 38;
  const bannerH = 28;

  // 背景: ごく薄いレッドの帯
  doc.setFillColor(
    COLOR.noticeRuleSoft[0],
    COLOR.noticeRuleSoft[1],
    COLOR.noticeRuleSoft[2],
  );
  doc.rect(margin, bannerY, pageW - margin * 2, bannerH, 'F');

  // 左端アクセント (赤い太線)
  doc.setFillColor(
    COLOR.noticeRed[0],
    COLOR.noticeRed[1],
    COLOR.noticeRed[2],
  );
  doc.rect(margin, bannerY, 3, bannerH, 'F');

  // テキスト: "LEGAL NOTICE — ..."
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(
    COLOR.noticeRed[0],
    COLOR.noticeRed[1],
    COLOR.noticeRed[2],
  );
  const bannerTitle =
    data.language === 'en'
      ? 'LEGAL NOTICE — DMCA TAKEDOWN UNDER 17 U.S.C. § 512(c)(3)'
      : 'LEGAL NOTICE — 送信防止措置依頼書 (情報流通プラットフォーム対処法)';
  doc.text(bannerTitle, margin + 10, bannerY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR.inkSoft[0], COLOR.inkSoft[1], COLOR.inkSoft[2]);
  const bannerSub =
    data.language === 'en'
      ? 'This is a formal legal notification. Failure to act may result in loss of safe harbor.'
      : '本書面は法的拘束力を伴う通知です。受領後の不作為は安全港 (免責) 喪失リスクとなる場合があります。';
  doc.text(bannerSub, margin + 10, bannerY + 23);

  /* ─── 本文 ─── */
  const template = data.language === 'en' ? BODY_EN : BODY_JA;
  const filled = template
    .replace(/\[TIMESTAMP_JST\]/g, data.timestampJst)
    .replace(/\[VERIFICATION_URL\]/g, data.verificationUrl)
    .replace(/\[INFRINGING_URL\]/g, data.infringingUrl)
    .replace(/\[ORIGINAL_FILENAME\]/g, data.originalFileName)
    .replace(/\[CERTIFICATE_ID\]/g, data.certificateId)
    .replace(/\[CLAIMANT_EMAIL\]/g, data.claimantEmail);

  const bodyTopY = bannerY + bannerH + 22;
  const bodyW = pageW - margin * 2;

  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const lineHeight = data.language === 'ja' ? 15.5 : 14.5;
  const lines = doc.splitTextToSize(filled, bodyW) as string[];

  let cy = bodyTopY;
  const footerReserve = 150; // 署名 + 印章 + フッター用に確保
  const pageBottomLimit = pageH - margin - footerReserve;

  for (const raw of lines) {
    const line = raw;

    // 改ページ
    if (cy > pageBottomLimit) {
      doc.addPage();

      // 新ページにも上部カラーバーを描画 (一貫性)
      doc.setFillColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
      doc.rect(0, 0, pageW, 3, 'F');
      doc.setFillColor(
        COLOR.noticeRed[0],
        COLOR.noticeRed[1],
        COLOR.noticeRed[2],
      );
      doc.rect(0, 3, pageW, 1, 'F');

      cy = margin;
    }

    /* 件名 / Re: 行 */
    if (line.startsWith('Re:') || line.startsWith('件名：')) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
      doc.text(line, margin, cy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      cy += lineHeight + 8;
      continue;
    }

    /* 番号付き見出し (1. 2. 3. ...) — 強調 (Identity Purple) */
    if (/^\s*\d+\.\s/.test(line)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
      doc.text(line, margin, cy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
      cy += lineHeight + 2;
      continue;
    }

    /* URL 行 — 自動リンク化 + Purple */
    const trimmed = line.trim();
    if (/^https?:\/\//.test(trimmed)) {
      doc.setTextColor(COLOR.purple[0], COLOR.purple[1], COLOR.purple[2]);
      // インデント保持
      const leading = line.length - trimmed.length;
      const xOffset = margin + leading * 3.2;
      doc.textWithLink(trimmed, xOffset, cy, { url: trimmed });
      doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
      cy += lineHeight;
      continue;
    }

    /* 偽証罪条項 — Bold (法的最重要箇所) */
    if (
      line.includes('penalty of perjury') ||
      line.includes('虚偽申告に伴う') ||
      line.includes('誓約')
    ) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
      doc.text(line, margin, cy);
      doc.setFont('helvetica', 'normal');
      cy += lineHeight;
      continue;
    }

    doc.text(line, margin, cy);
    cy += lineHeight;
  }

  /* ─── 電子署名ブロック ─── */
  cy += 28;

  // 「これより下が署名」の hairline
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, cy - 20, pageW - margin, cy - 20);

  // セクションラベル
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text(
    data.language === 'en'
      ? 'ELECTRONIC SIGNATURE'
      : '電子署名 (Electronic Signature)',
    margin,
    cy - 8,
  );

  // 署名本体 — claimantName を大きく Italic で
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(20);
  doc.setTextColor(COLOR.ink[0], COLOR.ink[1], COLOR.ink[2]);
  doc.text(`/s/  ${data.claimantName}`, margin, cy + 12);

  // 署名下のメタ
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(COLOR.inkSoft[0], COLOR.inkSoft[1], COLOR.inkSoft[2]);
  doc.text(
    data.language === 'en'
      ? `Signed by: ${data.claimantName}`
      : `署名者氏名：${data.claimantName}`,
    margin,
    cy + 30,
  );
  doc.text(
    data.language === 'en' ? `Date: ${dateStr}` : `署名日：${dateStr}`,
    margin,
    cy + 44,
  );
  doc.text(
    data.language === 'en'
      ? `Contact: ${data.claimantEmail}`
      : `連絡先：${data.claimantEmail}`,
    margin,
    cy + 58,
  );

  // 証拠識別子
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  doc.text(`Certificate ID: ${data.certificateId}`, margin, cy + 78);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(COLOR.teal[0], COLOR.teal[1], COLOR.teal[2]);
  doc.text(
    'RFC 3161 Timestamp · SHA-256 Cryptographic Proof',
    margin,
    cy + 92,
  );

  /* ─── 認証印章 (右下) ─── */
  drawAuthSeal(doc, pageW - margin - 110, cy + 6);

  /* ─── フッター ─── */
  const footerY = pageH - margin - 10;
  doc.setDrawColor(COLOR.rule[0], COLOR.rule[1], COLOR.rule[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageW - margin, footerY);

  // Footer text (Neutrality & Liability Disclaimer)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(COLOR.inkMuted[0], COLOR.inkMuted[1], COLOR.inkMuted[2]);
  
  const footerEn = 'Generated by ProofMark. ProofMark provides neutral cryptographic timestamping infrastructure and does not adjudicate initial authorship. The claimant assumes all legal liability under penalty of perjury for the claims made herein. Independent verification: openssl ts -verify -in TIMESTAMP.tsr -data <file>';
  const footerJa = 'ProofMarkにより生成。ProofMarkは中立的な暗号タイムスタンプインフラであり、著作権の初期正当性を認定するものではありません。本申告に関する一切の法的責任は申告者に帰属します。独立検証: openssl ts -verify -in TIMESTAMP.tsr -data <file>';
  
  const footerLines = doc.splitTextToSize(data.language === 'en' ? footerEn : footerJa, pageW - margin * 2);
  const footerTextY = pageH - margin - (footerLines.length - 1) * 8;

  doc.text(footerLines, pageW / 2, footerTextY, { align: 'center' });

  return doc.output('blob');
}

/* ─────────────────────────────────────────────
 *  Auth Seal — 既存 coverLetterPdfGenerator と完全同一
 * ───────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────
 *  Convenience: filename builder
 * ───────────────────────────────────────────── */

export function buildTakedownFilename(
  language: 'en' | 'ja',
  certificateId: string,
): string {
  const safeId = certificateId.slice(0, 8);
  return language === 'en'
    ? `DMCA_Takedown_Notice_${safeId}.pdf`
    : `送信防止措置依頼書_${safeId}.pdf`;
}
