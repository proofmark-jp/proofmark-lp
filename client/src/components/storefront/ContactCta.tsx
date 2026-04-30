/**
 * ContactCta — 「外部委譲」されたコンタクト導線。
 *
 * Zero-Op の哲学:
 *   • ProofMark 内部にメッセージ機能を持たない。運用工数 0 を物理的に固定。
 *   • ユーザーが設定した contact_url (Typeform / Calendly / mailto:) へ
 *     `target="_blank" rel="noopener noreferrer ugc"` で遷移するだけ。
 *
 * 安全性:
 *   • URL は事前に検証 (https / http / mailto のみ許容)。
 *   • 不正な値の場合は描画自体を抑止し、何も表示しない。
 *
 * デザイン:
 *   • Manus DNA のグラデーションボタン (135deg, #6c3ef4 → #00d4aa)。
 *   • 「Verified Studio が裏付ける問い合わせ」を演出するため、上部に
 *     Verified バッジへの相互参照テキストを配置。
 */

import { motion } from 'framer-motion';
import { ArrowUpRight, Calendar, ExternalLink, Mail, MessageSquare } from 'lucide-react';

interface Props {
  url: string | null;
  label: string | null;
  studioName: string | null;
  verified: boolean;
}

const SAFE_PROTO = /^(https?:\/\/|mailto:)/i;

function categorise(url: string): { icon: React.ComponentType<{ className?: string }>; hint: string } {
  if (url.startsWith('mailto:')) return { icon: Mail, hint: 'Email' };
  if (/calendly\.com/i.test(url)) return { icon: Calendar, hint: 'Calendly' };
  if (/typeform\.com|tally\.so|forms\.gle|notion\.site/i.test(url)) {
    return { icon: MessageSquare, hint: 'Form' };
  }
  return { icon: ExternalLink, hint: 'External' };
}

export function ContactCta({ url, label, studioName, verified }: Props) {
  if (!url || !SAFE_PROTO.test(url)) return null;

  const safeLabel =
    (label && label.trim().length > 0 && label.trim().length <= 40 && label.trim()) ||
    'お問い合わせ';
  const meta = categorise(url);
  const Icon = meta.icon;
  const isMail = url.startsWith('mailto:');

  return (
    <aside
      className="relative overflow-hidden rounded-[calc(0.65rem+4px)] border border-[#2a2a4e] bg-[#151d2f] p-5 sm:p-6"
      aria-labelledby="contact-cta-title"
    >
      <div
        aria-hidden="true"
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, rgba(108,62,244,0.18), transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 sm:justify-between">
        <div className="min-w-0">
          <p
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{
              color: '#00D4AA',
              background: 'rgba(0,212,170,0.10)',
              border: '1px solid rgba(0,212,170,0.40)',
            }}
          >
            <Icon className="w-3 h-3" aria-hidden="true" />
            {meta.hint}
          </p>
          <h3
            id="contact-cta-title"
            className="font-display font-extrabold text-[18px] sm:text-[20px] text-[#f0f0fa] leading-tight"
          >
            {studioName ? `${studioName} に依頼する` : '依頼を相談する'}
          </h3>
          <p className="mt-1 text-[12px] text-[#a0a0c0] leading-relaxed max-w-prose">
            {verified
              ? '本プロフィールは ProofMark Verified Studio として認証済みです。下のリンクから直接ご連絡いただけます。'
              : '下のリンクからスタジオへ直接お問い合わせいただけます。ProofMark のメッセージ機能は経由しません。'}
          </p>
        </div>

        <motion.a
          href={url}
          target={isMail ? undefined : '_blank'}
          rel={isMail ? undefined : 'noopener noreferrer ugc'}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="shrink-0 inline-flex items-center gap-2 rounded-[calc(0.65rem-2px)] px-5 py-3 text-[14px] font-bold transition-shadow"
          style={{
            background: 'linear-gradient(135deg, #6c3ef4 0%, #00d4aa 100%)',
            color: '#0a0e27',
            boxShadow: '0 12px 28px -12px rgba(108,62,244,0.55)',
          }}
        >
          {safeLabel}
          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
        </motion.a>
      </div>
    </aside>
  );
}
