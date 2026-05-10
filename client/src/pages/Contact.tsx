/**
 * Contact.tsx — Phase Contact Final
 *
 * 設計責任 (Stripe / Vercel グレード):
 *   Tier 0: FAQ アコーディオン (左) — `?err=PM-xxx` でハイライト, 検索付き
 *   Tier 1: 文脈自動収集フォーム (右) — useAuth + plan + UA + URL を hidden field
 *
 * 罠の修正:
 *   ❌ `bg-[${C.input}]` のような **Tailwind 動的 arbitrary value** は JIT に
 *      パージされて本番で透明になる。本ファイルでは **完全に廃止**。
 *      代わりに `Dashboard.studio.tsx` と同じく **inline `style={{}}`** で
 *      静的に色を流し込み、Tailwind 側にはレイアウト/フォント/spacing のみを担わせる。
 *   ❌ 旧 `inputCls` のテンプレ文字列で Tailwind class を生成するパターンも除去。
 *
 * 型安全:
 *   - `any` 一切なし。useAuth の profile は `unknown` 経由で plan_tier のみ抽出。
 *   - `update` ハンドラは `keyof FormState` でフィールド名を制約。
 *
 * UX 改善 (世界基準):
 *   - 5000 chars の message に live counter & 残量警告。
 *   - email を blur 時に正規化 (lowercase + trim)。
 *   - submit 中は重複送信ガード (button disabled + 自前ロック)。
 *   - エラーは aria-live + 視覚で同時通知。
 *   - prefers-reduced-motion を尊重した framer-motion 設定。
 *   - 送信完了後の "受付しました" カードで Ticket ID を mono 表示 + コピーボタン。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link, useSearch } from 'wouter';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  HelpCircle,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  Zap,
} from 'lucide-react';

import Navbar from '../components/Navbar';
import SEO from '../components/SEO';
import { useAuth } from '../hooks/useAuth';

/* ─── Design Tokens (Dashboard.studio.tsx と完全互換) ─── */
const PM = {
  bg: '#07061A',
  card: '#0D0B24',
  border: '#1C1A38',
  input: '#0F0E26',
  inputBorder: '#2A2A4E',
  primary: '#6C3EF4',
  primaryLight: '#8B61FF',
  success: '#00D4AA',
  accent: '#BC78FF',
  muted: '#A8A0D8',
  dim: '#48456A',
  text: '#F0EFF8',
  error: '#FF4D4D',
  errorRing: 'rgba(255,77,77,0.40)',
} as const;

/* ─── Categories ─── */
const CATEGORIES = [
  { id: 'account', label: 'アカウント・ログイン' },
  { id: 'certificate', label: '証明書・発行' },
  { id: 'billing', label: '料金・プラン' },
  { id: 'evidence-pack', label: 'Evidence Pack' },
  { id: 'bug', label: 'バグ報告' },
  { id: 'feature', label: '機能リクエスト' },
  { id: 'other', label: 'その他' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

/* ─── FAQ Data ─── */
interface FaqItem {
  id: string;
  q: string;
  a: string;
  errCodes?: string[];
  links?: { label: string; href: string }[];
}

const FAQ_DATA: FaqItem[] = [
  {
    id: 'login',
    q: 'ログインできません',
    a: 'パスワードリセットをお試しください。認証メールが迷惑メールフォルダに振り分けられている場合があります。',
    errCodes: ['PM-401', 'PM-403'],
    links: [{ label: 'パスワードリセット', href: '/auth' }],
  },
  {
    id: 'hash',
    q: 'ハッシュ値が一致しません',
    a: 'ファイルを再ダウンロードした場合、メタデータの変更によりハッシュが変わることがあります。オリジナルファイルで再度お試しください。',
    errCodes: ['PM-HASH', 'PM-MISMATCH'],
  },
  {
    id: 'upload',
    q: 'ファイルのアップロードに失敗します',
    a: 'ファイルサイズの上限は 4MB (Shareableモード) です。Privateモードでは 500MB まで対応していますが、ブラウザのメモリ状況によっては処理に時間がかかる場合があります。',
    errCodes: ['PM-413', 'PM-UPLOAD'],
  },
  {
    id: 'tsa',
    q: 'TSAタイムスタンプが「Pending」のままです',
    a: 'TSA サーバーの応答に通常数秒かかります。5 分以上経っても変わらない場合は、ページを再読み込みしてください。Beta TSA は SLA なしのため、一時的な遅延が発生することがあります。',
    errCodes: ['PM-TSA', 'PM-PENDING'],
    links: [{ label: 'Trust Center', href: '/trust-center' }],
  },
  {
    id: 'evidence',
    q: 'Evidence Pack がダウンロードできません',
    a: 'Evidence Pack の生成には最大 60 秒かかる場合があります。ポップアップブロッカーが有効な場合、ダウンロードが阻止されることがあります。',
    errCodes: ['PM-EVIDENCE', 'PM-429'],
  },
  {
    id: 'plan',
    q: 'プランの変更・解約方法',
    a: '設定ページからプランの変更が可能です。解約は即時反映され、残りの期間も引き続きご利用いただけます。',
    links: [
      { label: '料金プラン', href: '/pricing' },
      { label: '設定', href: '/settings' },
    ],
  },
  {
    id: 'c2pa',
    q: 'C2PA Content Credentials とは？',
    a: 'C2PA は Adobe 主導のメタデータ規格です。ProofMark は C2PA 検出機能を備えていますが、ProofMark 独自の RFC-3161 タイムスタンプとは別の仕組みです。',
    links: [{ label: 'C2PA 比較ページ', href: '/compare-c2pa' }],
  },
  {
    id: 'delete',
    q: 'アカウントやデータを完全に削除したい',
    a: '設定ページから「アカウント削除」を実行できます。証明書データとストレージが完全に消去されます。この操作は取り消せません。',
    links: [{ label: '設定', href: '/settings' }],
  },
];

/* ─── Form State ─── */
interface FormState {
  category: '' | CategoryId;
  subject: string;
  message: string;
  email: string;
  errorCode: string;
  /** Honeypot — 通常の人間には見えない */
  website: string;
}

/* ─── Hard limits (server と一致させる) ─── */
const LIMIT = {
  subject: 200,
  message: 5000,
  errorCode: 20,
} as const;

/* ─── Style helpers (Tailwind パージ問題の根本対策) ───
 *
 * Tailwind の `bg-[${...}]` 構文は **JIT がビルド時に文字列を読まない**ため
 * 本番でクラス名が消える。回避策として、色は inline `style={{}}` で渡し、
 * Tailwind には font / spacing / layout / state クラスのみを書く。
 */

const inputBaseStyle: CSSProperties = {
  background: PM.input,
  border: `1px solid ${PM.inputBorder}`,
  color: PM.text,
};
const inputBaseClass =
  'w-full px-4 py-3 rounded-xl text-[14px] focus:outline-none transition-colors placeholder:text-[#48456A] focus:border-[#6C3EF4]';

/* ─────────────────────────────────────────────────────────── */

export default function Contact() {
  const search = useSearch();
  const { user, profile, signOut } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const reduceMotion = useReducedMotion();
  const submitLockRef = useRef(false);

  /* ── URL params ── */
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const errParam = params.get('err')?.trim().toUpperCase() || null;
  const topicParam = params.get('topic')?.trim() || null;

  /* ── plan_tier を unknown 経由で安全に抽出 (any 不使用) ── */
  const planTier = useMemo<string>(() => {
    if (!profile || typeof profile !== 'object') return 'free';
    const rec = profile as Record<string, unknown>;
    const v = rec.plan_tier;
    return typeof v === 'string' && v.length > 0 ? v : 'free';
  }, [profile]);

  /* ── FAQ state ── */
  const [faqSearch, setFaqSearch] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  // ?err= があれば該当 FAQ を初期展開
  useEffect(() => {
    if (!errParam) return;
    const match = FAQ_DATA.find((f) => f.errCodes?.includes(errParam));
    if (match) setOpenFaqId(match.id);
  }, [errParam]);

  const filteredFaq = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    if (!q) return FAQ_DATA;
    return FAQ_DATA.filter(
      (f) =>
        f.q.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q) ||
        f.errCodes?.some((c) => c.toLowerCase().includes(q)),
    );
  }, [faqSearch]);

  /* ── Form ── */
  const initialCategory: '' | CategoryId =
    CATEGORIES.find((c) => c.id === topicParam)?.id ?? '';

  const [form, setForm] = useState<FormState>({
    category: initialCategory,
    subject: errParam ? `エラー ${errParam} について` : '',
    message: '',
    email: user?.email ?? '',
    errorCode: errParam ?? '',
    website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  // ログイン後に email が遅延ロードされた場合のみ自動補完
  useEffect(() => {
    if (user?.email && form.email.length === 0) {
      setForm((prev) => ({ ...prev, email: user.email ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  /* ── 型安全な change handler ── */
  const update = useCallback(
    <K extends keyof FormState>(key: K) =>
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.value;
        setForm((prev) => ({ ...prev, [key]: value } as FormState));
      },
    [],
  );

  /* ── client-side validation (server と同じルール) ── */
  const validation = useMemo(() => {
    if (!form.category) return '送信前にカテゴリを選択してください。';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return '有効なメールアドレスを入力してください。';
    if (!form.subject.trim()) return '件名を入力してください。';
    if (form.subject.length > LIMIT.subject)
      return `件名は ${LIMIT.subject} 文字以内で入力してください。`;
    if (!form.message.trim()) return 'お問い合わせ内容を入力してください。';
    if (form.message.length > LIMIT.message)
      return `内容は ${LIMIT.message} 文字以内で入力してください。`;
    return null;
  }, [form]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitLockRef.current) return;
      if (validation) {
        setError(validation);
        return;
      }
      submitLockRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        const r = await fetch('/api/send-contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: form.category,
            subject: form.subject,
            message: form.message,
            email: form.email.trim().toLowerCase(),
            errorCode: form.errorCode || undefined,
            website: form.website, // honeypot
            plan: planTier,
            metadata: {
              planTier,
              userAgent:
                typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
              currentUrl:
                typeof window !== 'undefined' ? window.location.href : undefined,
              referrer:
                typeof document !== 'undefined' ? document.referrer || undefined : undefined,
              isAuthenticated: Boolean(user),
            },
          }),
        });
        const data = (await r.json().catch(() => ({}))) as {
          error?: string;
          ticketId?: string;
        };
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
        setDone(true);
        setTicketId(data.ticketId ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : '送信に失敗しました');
      } finally {
        submitLockRef.current = false;
        setSubmitting(false);
      }
    },
    [form, planTier, user, validation],
  );

  const scrollToForm = useCallback(() => {
    formRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [reduceMotion]);

  const copyTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      await navigator.clipboard.writeText(ticketId);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1600);
    } catch {
      /* noop */
    }
  }, [ticketId]);

  /* ── motion presets ── */
  const fadeUp = reduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 } }
    : {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
    };

  const messageRemaining = LIMIT.message - form.message.length;
  const messageNearLimit = messageRemaining <= 200;

  return (
    <div
      className="min-h-screen text-white font-sans"
      style={{ background: PM.bg, color: PM.text }}
    >
      <SEO
        title="お問い合わせ | ProofMark"
        description="ProofMark へのお問い合わせ。よくある質問の自己解決やサポートチケットの送信が可能です。"
        url="https://proofmark.jp/contact"
      />
      <Navbar user={user} signOut={signOut} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-32">
        {/* Header */}
        <motion.div {...fadeUp} className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-4"
            style={{
              background: 'rgba(108,62,244,0.10)',
              border: `1px solid ${PM.primary}50`,
              color: PM.accent,
            }}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Support Center
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            お困りですか？
          </h1>
          <p
            className="mt-4 text-[15px] max-w-2xl mx-auto leading-relaxed"
            style={{ color: PM.muted }}
          >
            まずは下の FAQ をご確認ください。解決しない場合はフォームからお問い合わせいただけます。
          </p>
        </motion.div>

        {/* Two-pane layout */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-8 items-start">
          {/* ═══ Tier 0: FAQ ═══ */}
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: PM.success }} />
                よくある質問
              </h2>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(0,212,170,0.10)',
                  color: PM.success,
                  border: `1px solid ${PM.success}40`,
                }}
              >
                {filteredFaq.length} 件
              </span>
            </div>

            {/* FAQ Search */}
            <div className="relative mb-4">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'rgba(168,160,216,0.6)' }}
              />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="FAQ を検索…"
                aria-label="FAQ を検索"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] focus:outline-none transition-colors placeholder:text-[#48456A]"
                style={{
                  background: PM.card,
                  border: `1px solid ${PM.border}`,
                  color: PM.text,
                }}
              />
            </div>

            {/* Error param banner */}
            {errParam && (
              <div
                className="mb-4 px-4 py-3 rounded-xl text-[13px] flex items-center gap-2"
                style={{
                  background: 'rgba(108,62,244,0.10)',
                  border: `1px solid ${PM.primary}40`,
                  color: PM.accent,
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  エラーコード <code className="font-mono font-bold">{errParam}</code>{' '}
                  に関連する回答をハイライトしています
                </span>
              </div>
            )}

            {/* Accordion */}
            <div className="space-y-2">
              {filteredFaq.length === 0 ? (
                <div
                  className="rounded-2xl px-5 py-8 text-center text-[13px]"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px dashed ${PM.border}`,
                    color: PM.muted,
                  }}
                >
                  該当する FAQ が見つかりませんでした。フォームから直接お問い合わせください。
                </div>
              ) : (
                filteredFaq.map((faq) => {
                  const isOpen = openFaqId === faq.id;
                  const isHighlighted = errParam
                    ? faq.errCodes?.includes(errParam) ?? false
                    : false;
                  return (
                    <FaqAccordionItem
                      key={faq.id}
                      faq={faq}
                      isOpen={isOpen}
                      isHighlighted={isHighlighted}
                      onToggle={() => setOpenFaqId(isOpen ? null : faq.id)}
                    />
                  );
                })
              )}
            </div>

            {/* CTA: scroll to form */}
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-6 w-full py-3 rounded-xl text-[13px] font-bold transition-colors hover:bg-white/[0.03]"
              style={{
                border: `1px solid ${PM.border}`,
                color: PM.muted,
                background: 'transparent',
              }}
            >
              解決しない場合はフォームへ ↓
            </button>
          </motion.section>

          {/* ═══ Tier 1: Form ═══ */}
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {done ? (
              <SuccessCard
                ticketId={ticketId}
                copyOk={copyOk}
                onCopy={copyTicket}
              />
            ) : (
              <form
                ref={formRef}
                onSubmit={submit}
                noValidate
                className="rounded-3xl backdrop-blur-md p-6 sm:p-8 space-y-5"
                style={{
                  border: `1px solid ${PM.border}`,
                  background: 'rgba(13,11,36,0.80)',
                }}
              >
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Send className="w-4 h-4" style={{ color: PM.primary }} />
                    お問い合わせフォーム
                  </h2>
                  <p className="text-[12px] mt-1" style={{ color: PM.dim }}>
                    {user
                      ? `${user.email} としてログイン中 · ${planTier.toUpperCase()} プラン`
                      : '未ログイン — メールアドレスを入力してください'}
                  </p>
                </div>

                {/* Category */}
                <Field label="カテゴリ" required htmlFor="contact-category">
                  <select
                    id="contact-category"
                    value={form.category}
                    onChange={update('category')}
                    required
                    className={inputBaseClass}
                    style={inputBaseStyle}
                  >
                    <option value="">選択してください</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Email */}
                <Field label="メールアドレス" required htmlFor="contact-email">
                  <input
                    id="contact-email"
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={update('email')}
                    onBlur={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value.trim() }))
                    }
                    placeholder="you@example.com"
                    className={inputBaseClass}
                    style={inputBaseStyle}
                  />
                </Field>

                {/* Subject */}
                <Field label="件名" required htmlFor="contact-subject">
                  <input
                    id="contact-subject"
                    required
                    maxLength={LIMIT.subject}
                    value={form.subject}
                    onChange={update('subject')}
                    placeholder="例: 証明書の発行ができない"
                    className={inputBaseClass}
                    style={inputBaseStyle}
                  />
                </Field>

                {/* Message */}
                <Field
                  label="お問い合わせ内容"
                  required
                  htmlFor="contact-message"
                  hint={
                    <span style={{ color: messageNearLimit ? PM.error : PM.dim }}>
                      {form.message.length} / {LIMIT.message}
                    </span>
                  }
                >
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    maxLength={LIMIT.message}
                    value={form.message}
                    onChange={update('message')}
                    placeholder="できるだけ詳しくお書きください。スクリーンショットの URL があれば添えてください。"
                    className={`${inputBaseClass} resize-y`}
                    style={inputBaseStyle}
                  />
                </Field>

                {/* Error code (optional) */}
                <Field label="エラーコード（任意）" htmlFor="contact-error" muted>
                  <input
                    id="contact-error"
                    value={form.errorCode}
                    onChange={update('errorCode')}
                    maxLength={LIMIT.errorCode}
                    placeholder="例: PM-401"
                    className={`${inputBaseClass} font-mono`}
                    style={inputBaseStyle}
                  />
                </Field>

                {/* Honeypot — bots only。視覚 / 支援技術 / Tab 操作のいずれからも除外 */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-10000px',
                    top: 'auto',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                  }}
                >
                  <label htmlFor="website-url-bot-trap">
                    Website (please leave blank)
                  </label>
                  <input
                    id="website-url-bot-trap"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={update('website')}
                  />
                </div>

                {/* Validation hint (live) */}
                {!error && validation && (
                  <p
                    className="text-[11.5px]"
                    style={{ color: PM.dim }}
                    aria-live="polite"
                  >
                    {validation}
                  </p>
                )}

                {/* Error display */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      role="alert"
                      aria-live="assertive"
                      className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                      style={{
                        background: 'rgba(255,77,77,0.10)',
                        border: `1px solid ${PM.errorRing}`,
                        color: '#FFB8B8',
                      }}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || Boolean(validation)}
                  className="w-full py-4 rounded-full text-white font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  style={{
                    background: `linear-gradient(135deg, ${PM.primary}, ${PM.primaryLight})`,
                    boxShadow: `0 0 24px rgba(108,62,244,0.35)`,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      送信中…
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      送信する
                    </>
                  )}
                </button>

                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: PM.dim }}
                >
                  送信時に、プラン情報・利用環境 (User-Agent) をサポート品質向上の目的で自動収集します。詳細は
                  <Link
                    href="/privacy"
                    className="underline mx-1"
                    style={{ color: PM.success }}
                  >
                    プライバシーポリシー
                  </Link>
                  をご参照ください。
                </p>
              </form>
            )}
          </motion.section>
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*   Subcomponents                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

function Field({
  label,
  required,
  muted,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  muted?: boolean;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label
          htmlFor={htmlFor}
          className="block text-[10px] font-bold tracking-widest uppercase"
          style={{ color: muted ? PM.dim : PM.muted }}
        >
          {label}
          {required && <span style={{ color: PM.error }}> *</span>}
        </label>
        {hint && <span className="text-[10.5px] tabular-nums">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function FaqAccordionItem({
  faq,
  isOpen,
  isHighlighted,
  onToggle,
}: {
  faq: FaqItem;
  isOpen: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${isHighlighted ? `${PM.success}60` : PM.border}`,
        background: isHighlighted ? 'rgba(0,212,170,0.05)' : 'rgba(13,11,36,0.80)',
        boxShadow: isHighlighted ? '0 0 20px rgba(0,212,170,0.10)' : 'none',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${faq.id}`}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-[14px] font-semibold transition-colors hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2.5">
          {isHighlighted && (
            <ShieldCheck
              className="w-4 h-4 shrink-0"
              style={{ color: PM.success }}
            />
          )}
          {faq.q}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''
            }`}
          style={{ color: PM.muted }}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-panel-${faq.id}`}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-4 text-[13px] leading-relaxed"
              style={{ color: PM.muted }}
            >
              <p>{faq.a}</p>
              {faq.errCodes && (
                <p
                  className="mt-2 text-[11px] font-mono"
                  style={{ color: PM.dim }}
                >
                  関連コード: {faq.errCodes.join(', ')}
                </p>
              )}
              {faq.links && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {faq.links.map((l) => (
                    <Link key={l.href} href={l.href}>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                        style={{
                          background: 'rgba(108,62,244,0.10)',
                          border: `1px solid ${PM.primary}35`,
                          color: PM.accent,
                        }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        {l.label}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SuccessCard({
  ticketId,
  copyOk,
  onCopy,
}: {
  ticketId: string | null;
  copyOk: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className="rounded-3xl p-8 text-center"
      style={{
        border: `1px solid ${PM.success}40`,
        background: 'rgba(0,212,170,0.05)',
      }}
    >
      <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: PM.success }} />
      <h2 className="mt-4 text-xl font-bold">お問い合わせを受け付けました</h2>
      {ticketId && (
        <div className="mt-3 inline-flex items-center gap-2">
          <code
            className="text-[13px] font-mono font-bold px-3 py-1.5 rounded-lg"
            style={{
              color: PM.primary,
              background: 'rgba(108,62,244,0.10)',
              border: `1px solid ${PM.primary}35`,
            }}
          >
            {ticketId}
          </code>
          <button
            type="button"
            onClick={onCopy}
            aria-label="チケット ID をコピー"
            className="p-1.5 rounded-lg transition-colors hover:bg-white/[0.05]"
            style={{ color: copyOk ? PM.success : PM.muted }}
          >
            {copyOk ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
      <p className="mt-4 text-sm" style={{ color: PM.muted }}>
        登録メールアドレス宛に確認メールをお送りしました。
        <br />
        いただいた内容はすべて開発チームが確認しております。
        <br />
        返信が必要な内容につきましては、順次ご連絡いたします。
        <br />
        <span className="text-xs opacity-80">※ご意見・機能要望などには個別のご返信を差し上げられない場合がございます。</span>
      </p>
      <div className="mt-6 flex justify-center gap-4 text-sm">
        <Link href="/" className="underline" style={{ color: PM.success }}>
          トップ
        </Link>
        <Link href="/dashboard" className="underline" style={{ color: PM.muted }}>
          ダッシュボード
        </Link>
      </div>
    </div>
  );
}
