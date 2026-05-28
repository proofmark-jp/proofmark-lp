/**
 * TakedownNoticeModal.tsx
 * ─────────────────────────────────────────────────────────────────────────
 *  侵害申告 PDF 生成モーダル — Legal Lethality × Ritual UX
 *
 *  3 段階の儀式感 (EvidencePackDownloader.tsx と完全同期):
 *    1. IDLE       — 侵害先 URL を受け取り、言語と署名名義を選ぶ「法廷の入口」
 *    2. GENERATING — "Drafting → Sealing → Notarizing" の 3 ステップ進捗
 *    3. SUCCESS    — Teal パルス + ✅ スプリングで完成を宣告
 *
 *  デザイン言語:
 *    - 背景 #0D0B24 / Identity Purple #6C3EF4 / Teal #00D4AA / Notice Red
 *    - 法的文書である威圧感を「LEGAL NOTICE / DMCA / § 512(c)(3)」の
 *      タイポグラフィで担い、UI 自体は静謐に保つ。
 *
 *  Zero-Server:
 *    - PDF 生成は完全クライアントサイド (jsPDF)
 *    - ProofMark のサーバーへ申告内容は一切送信しない
 *    - ダウンロードは Blob → URL.createObjectURL → <a download>
 * ─────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  Globe2,
  Languages,
  Link as LinkIcon,
  Loader2,
  Mail,
  ScrollText,
  Scale,
  ShieldAlert,
  Sparkles,
  UserCircle,
  X,
} from 'lucide-react';

import {
  buildTakedownFilename,
  type TakedownNoticeInput,
} from '@/lib/takedownPdfGenerator';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Svg,
  Path,
  Rect,
  Polygon,
  Defs,
  LinearGradient,
  Stop,
  pdf,
  Link,
  Circle,
} from '@react-pdf/renderer';

Font.register({
  family: 'Noto Sans JP',
  fonts: [
    { src: '/fonts/NotoSansJP-Regular.ttf' },
    { src: '/fonts/NotoSansJP-Bold.ttf', fontWeight: 'bold' }
  ]
});

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* ─────────────────────────────────────────────
 *  Public Props
 * ───────────────────────────────────────────── */

export interface TakedownNoticeModalProps {
  /** モーダル表示制御 */
  open: boolean;
  /** モーダルを閉じる */
  onClose: () => void;
  /** ProofMark の証明書情報 — 申告書の証拠としてそのまま埋め込まれる */
  certificate: {
    certificateId: string;
    timestampJst: string;
    verificationUrl: string;
    originalFileName: string;
  };
  /** 署名名義の選択肢 — 既存 EvidencePackDownloader と同じ Persona パターン */
  claimant: {
    /** 公開名義 (例: アーティスト名) */
    creatorDisplayName: string;
    /** 法的名義 (任意) */
    legalName?: string | null;
    /** 申告者の連絡先メール (DMCA 法定要件) */
    email: string;
    /** デフォルトの名義 (なければ 'creator') */
    defaultPersona?: 'creator' | 'legal';
  };
  /** 任意: 初期言語 (デフォルト: 'ja') */
  defaultLanguage?: 'en' | 'ja';
  /** 任意: SUCCESS / ERROR を親に通知 */
  onComplete?: (status: 'success' | 'error') => void;
}

/* ─────────────────────────────────────────────
 *  Internal State
 * ───────────────────────────────────────────── */

type Phase = 'idle' | 'generating' | 'success' | 'error';

interface GenerationProgress {
  step: 1 | 2 | 3;
  percent: number;
  label: string;
}

const PROGRESS_STEPS: ReadonlyArray<GenerationProgress> = [
  { step: 1, percent: 25, label: 'Drafting legal language…' },
  { step: 2, percent: 65, label: 'Sealing with RFC 3161 evidence…' },
  { step: 3, percent: 95, label: 'Notarizing electronic signature…' },
] as const;

/* ─────────────────────────────────────────────
 *  Component
 * ───────────────────────────────────────────── */

export default function TakedownNoticeModal({
  open,
  onClose,
  certificate,
  claimant,
  defaultLanguage = 'ja',
  onComplete,
}: TakedownNoticeModalProps): JSX.Element | null {
  const reduce = useReducedMotion() ?? false;

  /* ── Inputs ── */
  const [infringingUrl, setInfringingUrl] = useState<string>('');
  const [signature, setSignature] = useState<string>(
    claimant.legalName || claimant.creatorDisplayName || ''
  );
  const [language, setLanguage] = useState<'en' | 'ja'>(defaultLanguage);

  /* ── State machine ── */
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<GenerationProgress>(
    PROGRESS_STEPS[0],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const lastObjectUrlRef = useRef<string | null>(null);

  /* ── Reset on close ── */
  useEffect(() => {
    if (!open) {
      // 数 ms 後にリセット (閉じるアニメ中はリセットしない)
      const id = window.setTimeout(() => {
        setPhase('idle');
        setProgress(PROGRESS_STEPS[0]);
        setErrorMessage(null);
        setGeneratedBlob(null);
        if (lastObjectUrlRef.current) {
          URL.revokeObjectURL(lastObjectUrlRef.current);
          lastObjectUrlRef.current = null;
        }
      }, 240);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  /* ── ESC で閉じる (生成中は閉じない) ── */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'generating') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, phase, onClose]);

  /* ── Derived values ── */
  const claimantName = useMemo<string>(() => {
    return signature.trim() || '氏名未設定 (Unspecified)';
  }, [signature]);

  const isValidSignature = useMemo<boolean>(() => signature.trim().length > 0, [signature]);

  const isValidUrl = useMemo<boolean>(() => {
    const v = infringingUrl.trim();
    if (v.length === 0) return false;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, [infringingUrl]);

  /* ── Generation pipeline ── */
  const runGeneration = useCallback(async () => {
    if (!isValidUrl || !isValidSignature) return;
    setPhase('generating');
    setErrorMessage(null);

    try {
      // ステップ 1: Drafting
      setProgress(PROGRESS_STEPS[0]);
      await wait(reduce ? 80 : 520);

      // ステップ 2: Sealing
      setProgress(PROGRESS_STEPS[1]);
      await wait(reduce ? 80 : 460);

      // ステップ 3: Notarizing — 実際の PDF 生成 (この間に jsPDF が走る)
      setProgress(PROGRESS_STEPS[2]);

      const input: TakedownNoticeInput = {
        certificateId: certificate.certificateId,
        timestampJst: certificate.timestampJst,
        verificationUrl: certificate.verificationUrl,
        originalFileName: certificate.originalFileName,
        infringingUrl: infringingUrl.trim(),
        claimantName,
        claimantEmail: claimant.email,
        language,
      };

      const blob = await pdf(<TakedownNoticeDocument data={input} />).toBlob();
      await wait(reduce ? 60 : 320); // 進捗の余韻

      // ダウンロード起動
      const url = URL.createObjectURL(blob);
      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
      }
      lastObjectUrlRef.current = url;

      const a = document.createElement('a');
      a.href = url;
      a.download = buildTakedownFilename(language, certificate.certificateId);
      document.body.appendChild(a);
      a.click();
      a.remove();

      setGeneratedBlob(blob);
      setPhase('success');
      onComplete?.('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMessage(msg);
      setPhase('error');
      onComplete?.('error');
    }
  }, [
    isValidUrl,
    isValidSignature,
    reduce,
    certificate.certificateId,
    certificate.timestampJst,
    certificate.verificationUrl,
    certificate.originalFileName,
    infringingUrl,
    claimantName,
    claimant.email,
    language,
    onComplete,
  ]);

  /* ── Re-download (Success 画面から) ── */
  const handleRedownload = useCallback(() => {
    if (!generatedBlob) return;
    const url = URL.createObjectURL(generatedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildTakedownFilename(language, certificate.certificateId);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [generatedBlob, language, certificate.certificateId]);

  /* ── Reset (Error 画面から) ── */
  const handleReset = useCallback(() => {
    setPhase('idle');
    setErrorMessage(null);
  }, []);

  if (!open) return null;

  /* ───────────────────────────────────────────── */
  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: PM_EASE }}
        className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
        style={{
          background: 'rgba(7,6,26,0.74)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && phase !== 'generating') onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="takedown-modal-title"
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.34, ease: PM_EASE }}
          className="relative w-full max-w-xl overflow-hidden rounded-[28px] border"
          style={{
            background: '#0D0B24',
            borderColor:
              phase === 'error' ? 'rgba(255,69,58,0.34)' : '#1C1A38',
            boxShadow:
              phase === 'success'
                ? '0 0 0 1px rgba(0,212,170,0.32) inset, 0 30px 70px rgba(0,212,170,0.18)'
                : phase === 'error'
                  ? '0 0 0 1px rgba(255,69,58,0.18) inset, 0 30px 60px rgba(255,69,58,0.12)'
                  : '0 0 0 1px rgba(255,255,255,0.04) inset, 0 30px 70px rgba(0,0,0,0.5)',
          }}
        >
          {/* 装飾グロー */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-10 blur-[80px]"
              style={{ background: '#6C3EF4' }}
            />
            <div
              className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-10 blur-[80px]"
              style={{
                background: phase === 'error' ? '#FF453A' : '#00D4AA',
              }}
            />
          </div>

          {/* ── 上部 LEGAL NOTICE バー ── */}
          <div
            className="relative flex items-center justify-between px-6 pt-5 pb-3"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                style={{
                  background: 'rgba(200,30,30,0.14)',
                  border: '1px solid rgba(200,30,30,0.42)',
                }}
              >
                <Gavel
                  className="h-3.5 w-3.5"
                  style={{ color: '#FF8B8B' }}
                />
              </span>
              <div className="flex flex-col leading-tight">
                <span
                  id="takedown-modal-title"
                  className="text-[10.5px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: '#FF8B8B' }}
                >
                  Legal Notice
                </span>
                <span className="text-[12px] font-bold text-white">
                  Takedown Notice Generator
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={phase === 'generating'}
              aria-label="閉じる"
              className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.62)',
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Body — Phase ごとに切替 ── */}
          <div className="relative z-10 p-6 sm:p-7">
            <AnimatePresence mode="wait" initial={false}>
              {phase === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: PM_EASE }}
                >
                  <IdleBody
                    infringingUrl={infringingUrl}
                    onInfringingUrlChange={setInfringingUrl}
                    isValidUrl={isValidUrl}
                    language={language}
                    onLanguageChange={setLanguage}
                    signature={signature}
                    onSignatureChange={setSignature}
                    isValidSignature={isValidSignature}
                    claimantEmail={claimant.email}
                    onSubmit={runGeneration}
                  />
                </motion.div>
              )}

              {phase === 'generating' && (
                <motion.div
                  key="gen"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: PM_EASE }}
                >
                  <GeneratingBody progress={progress} reduce={reduce} />
                </motion.div>
              )}

              {phase === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: PM_EASE }}
                >
                  <SuccessBody
                    language={language}
                    claimantName={claimantName}
                    infringingUrl={infringingUrl}
                    onRedownload={handleRedownload}
                    onClose={onClose}
                    reduce={reduce}
                  />
                </motion.div>
              )}

              {phase === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: PM_EASE }}
                >
                  <ErrorBody
                    message={errorMessage}
                    onRetry={handleReset}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*   Sub-components                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

interface IdleBodyProps {
  infringingUrl: string;
  onInfringingUrlChange: (v: string) => void;
  isValidUrl: boolean;
  language: 'en' | 'ja';
  onLanguageChange: (v: 'en' | 'ja') => void;
  signature: string;
  onSignatureChange: (v: string) => void;
  isValidSignature: boolean;
  claimantEmail: string;
  onSubmit: () => void;
}

function IdleBody({
  infringingUrl,
  onInfringingUrlChange,
  isValidUrl,
  language,
  onLanguageChange,
  signature,
  onSignatureChange,
  isValidSignature,
  claimantEmail,
  onSubmit,
}: IdleBodyProps): JSX.Element {
  return (
    <>
      {/* タイトル */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(108,62,244,0.10)',
            border: '1px solid rgba(108,62,244,0.30)',
          }}
        >
          <ScrollText className="h-6 w-6" style={{ color: '#BC78FF' }} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.28em]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Takedown Notice
          </p>
          <p className="text-[16px] font-bold leading-tight text-white">
            法的削除要請書を生成
          </p>
          <p
            className="mt-1 text-[12px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {language === 'ja'
              ? '情報流通プラットフォーム対処法に基づく送信防止措置依頼書を作成します。'
              : 'Generates a formal DMCA notice under 17 U.S.C. § 512(c)(3).'}
          </p>
        </div>
      </div>

      {/* 侵害先 URL */}
      <div className="mt-6">
        <label
          htmlFor="infringing-url"
          className="block text-[10.5px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'rgba(255,255,255,0.62)' }}
        >
          侵害先 URL
          <span style={{ color: '#FF8B8B' }}> *</span>
        </label>
        <div
          className="relative mt-2 flex items-center overflow-hidden rounded-xl border transition-colors"
          style={{
            background: '#07061A',
            borderColor:
              infringingUrl.length === 0
                ? 'rgba(255,255,255,0.10)'
                : isValidUrl
                  ? 'rgba(0,212,170,0.38)'
                  : 'rgba(255,69,58,0.40)',
          }}
        >
          <LinkIcon
            className="ml-3 h-4 w-4 shrink-0"
            style={{
              color:
                infringingUrl.length === 0
                  ? 'rgba(255,255,255,0.35)'
                  : isValidUrl
                    ? '#00D4AA'
                    : '#FF8B8B',
            }}
          />
          <input
            id="infringing-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://example.com/infringing-post/12345"
            value={infringingUrl}
            onChange={(e) => onInfringingUrlChange(e.target.value)}
            className="flex-1 bg-transparent px-3 py-3 text-[13px] text-white placeholder:text-white/30 focus:outline-none"
          />
          {infringingUrl.length > 0 && (
            <a
              href={isValidUrl ? infringingUrl : '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => !isValidUrl && e.preventDefault()}
              aria-label="侵害先を開く"
              className="mr-2 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-white/[0.06]"
              style={{
                color: isValidUrl
                  ? 'rgba(255,255,255,0.65)'
                  : 'rgba(255,255,255,0.25)',
                pointerEvents: isValidUrl ? 'auto' : 'none',
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {infringingUrl.length > 0 && !isValidUrl && (
          <p
            className="mt-1.5 flex items-center gap-1 text-[11px]"
            style={{ color: '#FF8B8B' }}
          >
            <AlertTriangle className="h-3 w-3" />
            http(s) で始まる完全な URL を入力してください
          </p>
        )}
      </div>

      {/* Signature */}
      <div className="mt-5">
        <label
          htmlFor="legal-signature"
          className="block text-[10.5px] font-bold uppercase tracking-[0.22em]"
          style={{ color: 'rgba(255,255,255,0.62)' }}
        >
          電子署名 (Legal Name / Signature)
          <span style={{ color: '#FF8B8B' }}> *</span>
        </label>
        <div
          className="relative mt-2 flex items-center overflow-hidden rounded-xl border transition-colors"
          style={{
            background: '#07061A',
            borderColor:
              signature.length === 0
                ? 'rgba(255,255,255,0.10)'
                : isValidSignature
                  ? 'rgba(0,212,170,0.38)'
                  : 'rgba(255,69,58,0.40)',
          }}
        >
          <div className="ml-3 shrink-0 flex items-center justify-center text-[12px] font-bold" style={{ color: isValidSignature ? '#00D4AA' : 'rgba(255,255,255,0.35)' }}>
            /s/
          </div>
          <input
            id="legal-signature"
            type="text"
            autoComplete="off"
            placeholder="John Doe"
            value={signature}
            onChange={(e) => onSignatureChange(e.target.value)}
            className="flex-1 bg-transparent px-2 py-3 text-[13px] text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        {signature.length === 0 && (
          <p
            className="mt-1.5 flex items-center gap-1 text-[11px]"
            style={{ color: '#FF8B8B' }}
          >
            <AlertTriangle className="h-3 w-3" />
            電子署名は法的要件として必須です
          </p>
        )}
      </div>

      {/* Language toggle */}
      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span
            className="text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: 'rgba(255,255,255,0.62)' }}
          >
            <Languages className="mr-1 inline h-3 w-3" />
            送付先プラットフォームの言語
          </span>
        </div>
        <div
          className="mt-2 flex w-full rounded-xl border p-1"
          style={{
            background: '#07061A',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <ToggleButton
            active={language === 'ja'}
            onClick={() => onLanguageChange('ja')}
            icon={<ScrollText className="h-3.5 w-3.5" />}
            label="日本語 / JA"
            sub="プロバイダ責任制限法・情プラ法"
            tone="purple"
          />
          <ToggleButton
            active={language === 'en'}
            onClick={() => onLanguageChange('en')}
            icon={<Globe2 className="h-3.5 w-3.5" />}
            label="English / EN"
            sub="DMCA · 17 U.S.C. § 512(c)(3)"
            tone="purple"
          />
        </div>
      </div>

      {/* Compliance hint */}
      <div
        className="mt-5 rounded-xl border p-3.5"
        style={{
          background: 'rgba(108,62,244,0.06)',
          borderColor: 'rgba(108,62,244,0.22)',
        }}
      >
        <div className="flex items-start gap-2.5">
          <Scale
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            style={{ color: '#BC78FF' }}
          />
          <p
            className="text-[11.5px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.70)' }}
          >
            生成された PDF は{' '}
            <strong className="text-white">偽証罪の罰則下での宣誓</strong>
            を含む完全な法的要件を満たします。
            RFC 3161 タイムスタンプ証拠が自動で添付されます。
          </p>
        </div>
      </div>

      {/* 連絡先メールの確認 */}
      <div
        className="mt-3 flex items-center gap-2 px-1"
        style={{ color: 'rgba(255,255,255,0.45)' }}
      >
        <Mail className="h-3 w-3" />
        <span className="text-[11px]">
          申告者の連絡先：
          <span className="font-mono text-white/70">{claimantEmail}</span>
        </span>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!isValidUrl || !isValidSignature}
        onClick={onSubmit}
        className="group mt-6 inline-flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
          boxShadow:
            '0 14px 32px rgba(108,62,244,0.40), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}
      >
        <span className="flex flex-col text-left leading-tight">
          <span className="flex items-center gap-2 text-[15px]">
            <ShieldAlert className="h-4 w-4" />
            法的削除要請書 (PDF) を生成
          </span>
          <span className="text-[11px] font-medium text-white/72">
            {language === 'ja'
              ? '送信防止措置依頼書 · 印字名義: '
              : 'DMCA Notice · Signed as: '}
            <span className="font-bold text-[#FFF]">
              {signature.trim() || '氏名未入力'}
            </span>
          </span>
        </span>
        <Sparkles className="h-5 w-5" />
      </button>
    </>
  );
}

/* ─────────────────────────────────────────────
 *  Generating
 * ───────────────────────────────────────────── */

interface GeneratingBodyProps {
  progress: GenerationProgress;
  reduce: boolean;
}

function GeneratingBody({
  progress,
  reduce,
}: GeneratingBodyProps): JSX.Element {
  return (
    <>
      <div className="flex items-center gap-4">
        <motion.div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(108,62,244,0.14)',
            border: '1px solid rgba(108,62,244,0.40)',
          }}
          animate={reduce ? {} : { rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <Gavel className="h-6 w-6" style={{ color: '#BC78FF' }} />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.28em]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Drafting Legal Notice
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={progress.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: PM_EASE }}
              className="text-[16px] font-bold text-white"
            >
              {progress.label}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #6C3EF4 0%, #00D4AA 100%)',
              boxShadow: '0 0 16px rgba(0,212,170,0.55)',
            }}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: 0.55, ease: PM_EASE }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span
            className="text-[11.5px] font-semibold"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            ステップ {progress.step} / 3
          </span>
          <span
            className="font-mono text-[11.5px]"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            {progress.percent}%
          </span>
        </div>
      </div>

      {/* Step rail */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <StepDot
          active={progress.step >= 1}
          done={progress.step > 1}
          label="Drafting"
        />
        <StepDot
          active={progress.step >= 2}
          done={progress.step > 2}
          label="Sealing"
        />
        <StepDot
          active={progress.step >= 3}
          done={false}
          label="Notarizing"
        />
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
 *  Success
 * ───────────────────────────────────────────── */

interface SuccessBodyProps {
  language: 'en' | 'ja';
  claimantName: string;
  infringingUrl: string;
  onRedownload: () => void;
  onClose: () => void;
  reduce: boolean;
}

function SuccessBody({
  language,
  claimantName,
  infringingUrl,
  onRedownload,
  onClose,
  reduce,
}: SuccessBodyProps): JSX.Element {
  return (
    <motion.div
      animate={
        reduce
          ? {}
          : {
              boxShadow: [
                '0 0 0 0 rgba(0,212,170,0)',
                '0 0 0 22px rgba(0,212,170,0.22)',
                '0 0 0 44px rgba(0,212,170,0)',
              ],
            }
      }
      transition={{
        boxShadow: { duration: 1.1, ease: PM_EASE, delay: 0.12 },
      }}
      className="rounded-2xl"
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 22,
          delay: 0.06,
        }}
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,212,170,0.18), rgba(0,212,170,0.06))',
          boxShadow:
            '0 0 0 1px rgba(0,212,170,0.42), 0 18px 38px rgba(0,212,170,0.24)',
        }}
      >
        <CheckCircle2
          className="h-8 w-8"
          style={{ color: '#00D4AA' }}
          strokeWidth={2.6}
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18, ease: PM_EASE }}
        className="mt-5 text-center text-[10.5px] font-bold uppercase tracking-[0.30em]"
        style={{ color: '#00D4AA' }}
      >
        Notice Sealed & Signed
      </motion.p>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.24, ease: PM_EASE }}
        className="mt-2 text-center text-[20px] font-extrabold text-white sm:text-[22px]"
        style={{ letterSpacing: '-0.01em' }}
      >
        {language === 'ja'
          ? '送信防止措置依頼書が生成されました'
          : 'DMCA Takedown Notice Generated'}
      </motion.h3>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.32, ease: PM_EASE }}
        className="mx-auto mt-5 max-w-md rounded-2xl border p-4"
        style={{
          borderColor: 'rgba(255,255,255,0.10)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <p
          className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.26em]"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          法的要件
        </p>
        <ul className="space-y-2">
          <ManifestRow
            icon={<Scale className="h-3.5 w-3.5" style={{ color: '#BC78FF' }} />}
            title={
              language === 'ja'
                ? '情報流通プラットフォーム対処法 + 著作権法 21・23 条'
                : '17 U.S.C. § 512(c)(3) — DMCA Safe Harbor'
            }
            note={
              language === 'ja'
                ? '送信防止措置 (削除) を求める法的根拠'
                : 'Required by the Digital Millennium Copyright Act'
            }
          />
          <ManifestRow
            icon={
              <ShieldAlert
                className="h-3.5 w-3.5"
                style={{ color: '#FF8B8B' }}
              />
            }
            title={
              language === 'ja'
                ? '誠実な信念 + 虚偽申告責任の誓約'
                : 'Good faith belief + penalty of perjury'
            }
            note={
              language === 'ja'
                ? '法務部が即対応せざるを得ない宣誓条項'
                : 'Forces the legal team to act immediately'
            }
          />
          <ManifestRow
            icon={
              <FileText
                className="h-3.5 w-3.5"
                style={{ color: '#00D4AA' }}
              />
            }
            title="RFC 3161 タイムスタンプ証拠"
            note="OpenSSL で第三者再検証が可能 (ProofMark に依存しない)"
          />
        </ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.5, ease: PM_EASE }}
        className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row"
      >
        <button
          type="button"
          onClick={onRedownload}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-[#0D0B24] transition-transform hover:scale-[1.02] sm:w-auto"
          style={{
            background: '#00D4AA',
            boxShadow: '0 8px 24px rgba(0,212,170,0.32)',
          }}
        >
          <Download className="h-4 w-4" />
          PDF を再ダウンロード
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.04] sm:w-auto"
          style={{
            borderColor: 'rgba(255,255,255,0.16)',
            background: 'transparent',
          }}
        >
          閉じる
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.55 }}
        className="mt-5 text-center text-[11.5px] leading-relaxed"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <p className="mb-2">
          署名名義: <span className="text-white">{claimantName}</span> <br />
          侵害先 URL: <span className="text-white">{infringingUrl}</span>
        </p>
        <div className="mx-auto max-w-[280px] rounded-lg border border-[#00D4AA]/20 bg-[#00D4AA]/5 p-2 text-[10.5px] text-[#00D4AA]">
          <p className="font-bold mb-1">【次のステップ】</p>
          <p>
            対象プラットフォーム（X, Google, サーバー管理会社等）が指定する「著作権侵害の通報窓口（DMCA Agent）」に対し、このPDFを提出・添付してください。
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
 *  Error
 * ───────────────────────────────────────────── */

interface ErrorBodyProps {
  message: string | null;
  onRetry: () => void;
}

function ErrorBody({ message, onRetry }: ErrorBodyProps): JSX.Element {
  return (
    <>
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(255,69,58,0.12)' }}
        >
          <AlertTriangle className="h-6 w-6" style={{ color: '#FF453A' }} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.28em]"
            style={{ color: '#FF453A' }}
          >
            Generation Failed
          </p>
          <p className="text-[16px] font-bold text-white">
            Takedown Notice を生成できませんでした
          </p>
          {message && (
            <p
              className="mt-1 text-[12px]"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              {message}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white"
        style={{
          background: 'linear-gradient(135deg, #6C3EF4 0%, #8B61FF 100%)',
        }}
      >
        <Loader2 className="h-4 w-4" />
        入力に戻って再試行
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*   Tiny pieces                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  sub,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
  tone: 'default' | 'purple' | 'teal';
}): JSX.Element {
  const activeColor =
    tone === 'teal' ? '#00D4AA' : tone === 'purple' ? '#BC78FF' : '#FFFFFF';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-2.5 text-[12px] font-bold transition-all ${
        active
          ? 'bg-[#2A2A4E] shadow-sm'
          : 'text-white/40 hover:text-white/70'
      }`}
      style={active ? { color: activeColor } : undefined}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        className={`max-w-[180px] truncate text-[10px] font-medium ${
          active ? 'opacity-80' : 'opacity-0'
        }`}
      >
        {sub}
      </span>
    </button>
  );
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}): JSX.Element {
  const color = done
    ? '#00D4AA'
    : active
      ? '#BC78FF'
      : 'rgba(255,255,255,0.22)';
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div
        className="h-1.5 w-full rounded-full"
        style={{
          background: color,
          boxShadow:
            active && !done ? '0 0 14px rgba(108,62,244,0.55)' : 'none',
          transition: 'background 240ms, box-shadow 240ms',
        }}
      />
      <span
        className="text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{
          color:
            done || active
              ? 'rgba(255,255,255,0.78)'
              : 'rgba(255,255,255,0.32)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ManifestRow({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
}): JSX.Element {
  return (
    <li
      className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <span
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-bold leading-tight text-white">
          {title}
        </p>
        <p
          className="mt-0.5 text-[10.5px] leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {note}
        </p>
      </div>
    </li>
  );
}

/* ─────────────────────────────────────────────
 *  Utility
 * ───────────────────────────────────────────── */

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/* ─────────────────────────────────────────────
 *  PDF Document Component
 * ───────────────────────────────────────────── */

const pdfStyles = StyleSheet.create({
  page: {
    padding: 56,
    fontFamily: 'Noto Sans JP',
    backgroundColor: '#FFFFFF',
    color: '#1A1A2E',
  },
  headerTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#6C3EF4',
  },
  headerRedLine: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#C81E1E',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#6C3EF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  logoCheck: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  logoText: {
    color: '#6C3EF4',
    fontSize: 13,
    fontWeight: 'bold',
  },
  logoDomain: {
    color: '#78788C',
    fontSize: 8,
    marginTop: 2,
    marginLeft: 20, // margin-left to align with logoText
  },
  dateText: {
    color: '#3C3C50',
    fontSize: 10,
    marginTop: 2,
  },
  legalBanner: {
    backgroundColor: '#F5DCDC',
    flexDirection: 'row',
    height: 28,
    marginBottom: 22,
    alignItems: 'center',
  },
  legalBannerBorder: {
    width: 3,
    height: '100%',
    backgroundColor: '#C81E1E',
  },
  legalBannerContent: {
    paddingLeft: 7,
    justifyContent: 'center',
  },
  legalBannerTitle: {
    color: '#C81E1E',
    fontSize: 11,
    fontWeight: 'bold',
  },
  legalBannerSub: {
    color: '#3C3C50',
    fontSize: 8.5,
    marginTop: 1,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  bold: {
    fontWeight: 'bold',
  },
  heading: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: '#6C3EF4',
    marginTop: 8,
    marginBottom: 2,
  },
  h1: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  link: {
    color: '#6C3EF4',
    textDecoration: 'none',
  },
  indent: {
    paddingLeft: 12,
    marginBottom: 8,
  },
  signatureLine: {
    borderTopWidth: 0.5,
    borderColor: '#DCDCE6',
    marginTop: 20,
    paddingTop: 8,
  },
  signatureLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#78788C',
    marginBottom: 12,
  },
  signatureName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 9.5,
    color: '#3C3C50',
    marginBottom: 4,
  },
  metaCert: {
    fontSize: 8.5,
    color: '#78788C',
    marginTop: 12,
    marginBottom: 2,
  },
  metaProof: {
    fontSize: 8.5,
    color: '#00D4AA',
  },
  badgeContainer: {
    position: 'absolute',
    right: 56,
    bottom: 80,
    alignItems: 'center',
  },
  badgeSvg: {
    width: 60,
    height: 60,
  },
  badgeText1: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#6C3EF4',
    marginTop: 6,
  },
  badgeText2: {
    fontSize: 6,
    color: '#78788C',
    marginTop: 2,
  },
  footerLine: {
    position: 'absolute',
    bottom: 40,
    left: 56,
    right: 56,
    borderTopWidth: 0.3,
    borderColor: '#DCDCE6',
  },
  footerText: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 6.5,
    color: '#78788C',
    textAlign: 'center',
  },
});

function TrustBadge() {
  return (
    <View style={[pdfStyles.badgeContainer, { width: 90, height: 90, justifyContent: 'center', alignItems: 'center' }]} wrap={false}>
      <Svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', position: 'absolute' }}>
        <Circle cx="50" cy="50" r="48" stroke="#6C3EF4" strokeWidth="1.5" fill="none" opacity="0.3" />
        <Circle cx="50" cy="50" r="44" stroke="#6C3EF4" strokeWidth="0.5" fill="none" opacity="0.5" />
        <Circle cx="50" cy="50" r="28" stroke="#00D4AA" strokeWidth="0.5" fill="none" opacity="0.3" />
      </Svg>
      
      <View style={{ width: 44, height: 44, position: 'absolute', top: 23, left: 23 }}>
        <Svg viewBox="0 0 100 100" width="100%" height="100%">
          <Defs>
            <LinearGradient id="official-grad" x1="15%" y1="0%" x2="85%" y2="100%">
              <Stop offset="0%" stopColor="#5830CC" />
              <Stop offset="100%" stopColor="#00B896" />
            </LinearGradient>
          </Defs>
          <Path 
            d="M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 88,26 L 84,28 L 78,20 Z" 
            fill="none" 
            stroke="url(#official-grad)" 
            strokeWidth="4" 
            strokeLinejoin="round" 
            strokeLinecap="round" 
            opacity="0.85" 
          />
          <Polygon 
            points="18,46 28,46 40,60 78,22 82,27 37,69 24,57" 
            fill="#00D4AA" 
          />
        </Svg>
      </View>

      <Text style={{ position: 'absolute', top: 8, fontSize: 6, fontWeight: 'bold', color: '#6C3EF4', letterSpacing: 1 }}>PROOFMARK</Text>
      <Text style={{ position: 'absolute', bottom: 14, fontSize: 4.5, color: '#78788C', letterSpacing: 0.5 }}>CRYPTOGRAPHIC SEAL</Text>
      <Text style={{ position: 'absolute', bottom: 7, fontSize: 4.5, color: '#78788C' }}>RFC 3161 / SHA-256</Text>
    </View>
  );
}

function TakedownNoticeDocument({ data }: { data: TakedownNoticeInput }) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const bannerTitle = data.language === 'en'
    ? 'LEGAL NOTICE — DMCA TAKEDOWN UNDER 17 U.S.C. § 512(c)(3)'
    : 'LEGAL NOTICE — 送信防止措置依頼書 (情報流通プラットフォーム対処法)';
  const bannerSub = data.language === 'en'
    ? 'This is a formal legal notification. Failure to act may result in loss of safe harbor.'
    : '本書面は法的拘束力を伴う通知です。受領後の不作為は安全港 (免責) 喪失リスクとなる場合があります。';

  const footerEn = 'Generated by ProofMark. ProofMark provides neutral cryptographic timestamping infrastructure and does not adjudicate initial authorship. The claimant assumes all legal liability under penalty of perjury for the claims made herein. Independent verification: openssl ts -verify -in TIMESTAMP.tsr -data <file>';
  const footerJa = 'ProofMarkにより生成。ProofMarkは中立的な暗号タイムスタンプインフラであり、著作権の初期正当性を認定するものではありません。本申告に関する一切の法的責任は申告者に帰属します。独立検証: openssl ts -verify -in TIMESTAMP.tsr -data <file>';

  return (
    <Document
      title={data.language === 'en' ? 'DMCA Takedown Notice — ProofMark' : '送信防止措置依頼書 — ProofMark'}
      author={data.claimantName}
      creator="ProofMark.jp"
    >
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.headerTopLine} fixed />
        <View style={pdfStyles.headerRedLine} fixed />

        <View style={pdfStyles.headerContainer} fixed>
          <View>
            <View style={pdfStyles.logoGroup}>
              <View style={{ width: 18, height: 18, marginRight: 6 }}>
                {/* ▽▽ ここから公式ロゴ ▽▽ */}
                <Svg viewBox="0 0 100 100" width="100%" height="100%">
                  <Defs>
                    <LinearGradient id="header-grad" x1="15%" y1="0%" x2="85%" y2="100%">
                      <Stop offset="0%" stopColor="#5830CC" />
                      <Stop offset="100%" stopColor="#00B896" />
                    </LinearGradient>
                  </Defs>
                  <Path d="M 50,4 L 10,27 L 10,73 L 50,96 L 90,73 L 90,27 L 88,26 L 84,28 L 78,20 Z" fill="none" stroke="url(#header-grad)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
                  <Polygon points="18,46 28,46 40,60 78,22 82,27 37,69 24,57" fill="#00D4AA" />
                </Svg>
                {/* △△ ここまで △△ */}
              </View>
              <Text style={pdfStyles.logoText}>PROOFMARK</Text>
            </View>
            <Text style={pdfStyles.logoDomain}>proofmark.jp</Text>
          </View>
          <View>
            <Text style={pdfStyles.dateText}>Date: {dateStr}</Text>
          </View>
        </View>

        <View style={pdfStyles.legalBanner} fixed>
          <View style={pdfStyles.legalBannerBorder} />
          <View style={pdfStyles.legalBannerContent}>
            <Text style={pdfStyles.legalBannerTitle}>{bannerTitle}</Text>
            <Text style={pdfStyles.legalBannerSub}>{bannerSub}</Text>
          </View>
        </View>

        {data.language === 'en' ? (
          <>
            <Text style={pdfStyles.h1}>Re: NOTIFICATION OF CLAIMED INFRINGEMENT UNDER 17 U.S.C. § 512(c)(3)</Text>
            
            <Text style={pdfStyles.bodyText}>To Whom It May Concern at the Service Provider:</Text>
            
            <Text style={pdfStyles.bodyText}>
              I am the copyright owner, or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed. I hereby submit this notice under the Digital Millennium Copyright Act (17 U.S.C. § 512) and demand the prompt removal or disabling of access to the material identified below.
            </Text>

            <Text style={pdfStyles.heading}>1. Identification of the copyrighted work claimed to have been infringed.</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>File name (original work): {data.originalFileName}</Text>
              <Text style={pdfStyles.bodyText}>ProofMark Certificate ID: {data.certificateId}</Text>
            </View>

            <Text style={pdfStyles.heading}>2. Identification of the material that is claimed to be infringing and information reasonably sufficient to permit the service provider to locate the material.</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>Infringing URL: <Link src={data.infringingUrl} style={pdfStyles.link}>{data.infringingUrl}</Link></Text>
            </View>

            <Text style={pdfStyles.heading}>3. Information reasonably sufficient to permit the service provider to contact the complaining party.</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>Email: {data.claimantEmail}</Text>
            </View>

            <Text style={pdfStyles.heading}>4. Cryptographic evidence of prior existence (independent third-party timestamp under IETF RFC 3161).</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>The original work was cryptographically time-stamped at {data.timestampJst} by an RFC 3161 compliant Time Stamp Authority. The integrity and existence of the work at that moment can be independently verified by any third party using OpenSSL, without relying on ProofMark's infrastructure.</Text>
              <Text style={pdfStyles.bodyText}>Independent Verification URL: <Link src={data.verificationUrl} style={pdfStyles.link}>{data.verificationUrl}</Link></Text>
            </View>

            <Text style={pdfStyles.heading}>5. Statement of good faith belief.</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>I have a good faith belief that use of the copyrighted materials described above as allegedly infringing is not authorized by the copyright owner, its agent, or the law.</Text>
            </View>

            <Text style={pdfStyles.heading}>6. Statement under penalty of perjury.</Text>
            <View style={pdfStyles.indent}>
              <Text style={[pdfStyles.bodyText, pdfStyles.bold]}>I swear, under penalty of perjury, that the information in this notification is accurate and that I am the copyright owner, or am authorized to act on behalf of the owner, of an exclusive right that is allegedly infringed.</Text>
            </View>

            <Text style={pdfStyles.bodyText}>
              Pursuant to 17 U.S.C. § 512(c)(1)(C), failure to expeditiously remove or disable access to the infringing material upon receipt of this notice may result in the loss of safe harbor protection for your service.
            </Text>
            <Text style={pdfStyles.bodyText}>Respectfully submitted,</Text>
          </>
        ) : (
          <>
            <Text style={pdfStyles.h1}>件名：著作権侵害コンテンツに対する送信防止措置依頼書</Text>
            
            <Text style={pdfStyles.bodyText}>[サービス事業者] 御中</Text>
            
            <Text style={pdfStyles.bodyText}>
              私は、下記に特定する著作物の著作権者、または著作権者から正当に権限を委任された代理人です。貴サービス上で当該著作物が無断で複製・公衆送信されていることを確認したため、特定電気通信役務提供者の損害賠償責任の制限等及び発信者情報の開示に関する法律（情報流通プラットフォーム対処法）および著作権法第21条（複製権）ならびに第23条（公衆送信権）に基づき、対象コンテンツへの送信防止措置（削除）を速やかに実施するよう要請いたします。
            </Text>

            <Text style={pdfStyles.heading}>1. 侵害されたとする著作物の特定</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>原本ファイル名：{data.originalFileName}</Text>
              <Text style={pdfStyles.bodyText}>ProofMark 証明書 ID：{data.certificateId}</Text>
            </View>

            <Text style={pdfStyles.heading}>2. 侵害行為の特定（送信防止措置の対象）</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>侵害先 URL：<Link src={data.infringingUrl} style={pdfStyles.link}>{data.infringingUrl}</Link></Text>
            </View>

            <Text style={pdfStyles.heading}>3. 申告者の連絡先</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>Email：{data.claimantEmail}</Text>
            </View>

            <Text style={pdfStyles.heading}>4. 暗号学的存在証明（IETF 標準 RFC 3161 タイムスタンプ）</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>私は、上記 URL のコンテンツが私の著作権を侵害していると確信しています。証拠として、当該作品が {data.timestampJst} の時点で確実に存在したことを、IETF 標準である RFC 3161 に準拠した第三者タイムスタンプ機関の電子署名により暗号学的に証明します。</Text>
              <Text style={pdfStyles.bodyText}>本タイムスタンプおよび作品の SHA-256 ハッシュは、ProofMark のインフラに依存することなく、OpenSSL 等の標準的暗号ツールにより何人でも独立して再検証することが可能です。</Text>
              <Text style={pdfStyles.bodyText}>独立検証 URL：<Link src={data.verificationUrl} style={pdfStyles.link}>{data.verificationUrl}</Link></Text>
            </View>

            <Text style={pdfStyles.heading}>5. 誠実な信念に基づく宣言</Text>
            <View style={pdfStyles.indent}>
              <Text style={pdfStyles.bodyText}>私は、上記 URL に掲載されている対象コンテンツの利用が、著作権者、その代理人、または法律によって許諾されたものではないと、誠実な信念をもって申告いたします。</Text>
            </View>

            <Text style={pdfStyles.heading}>6. 申告内容の真実性に関する誓約</Text>
            <View style={pdfStyles.indent}>
              <Text style={[pdfStyles.bodyText, pdfStyles.bold]}>私は、本依頼書に記載した事項が真実であること、および私が当該著作物の著作権者または正当な代理人であることを、虚偽申告に伴う民事上の責任を承知の上で誓約いたします。</Text>
            </View>

            <Text style={pdfStyles.bodyText}>
              貴サービスにおいて、本依頼書の受領後、速やかに送信防止措置が実施されない場合、情報流通プラットフォーム対処法および民法に基づく損害賠償責任を含む法的措置を検討する場合がございます。
            </Text>
            <Text style={pdfStyles.bodyText}>以上、ご対応のほどよろしくお願いいたします。</Text>
          </>
        )}

        <View style={pdfStyles.signatureLine} wrap={false}>
          <Text style={pdfStyles.signatureLabel}>
            {data.language === 'en' ? 'ELECTRONIC SIGNATURE' : '電子署名 (Electronic Signature)'}
          </Text>
          <Text style={pdfStyles.signatureName}>/s/  {data.claimantName}</Text>
          <Text style={pdfStyles.metaText}>
            {data.language === 'en' ? `Signed by: ${data.claimantName}` : `署名者氏名：${data.claimantName}`}
          </Text>
          <Text style={pdfStyles.metaText}>
            {data.language === 'en' ? `Date: ${dateStr}` : `署名日：${dateStr}`}
          </Text>
          <Text style={pdfStyles.metaText}>
            {data.language === 'en' ? `Contact: ${data.claimantEmail}` : `連絡先：${data.claimantEmail}`}
          </Text>
          <Text style={pdfStyles.metaCert}>Certificate ID: {data.certificateId}</Text>
          <Text style={pdfStyles.metaProof}>RFC 3161 Timestamp · SHA-256 Cryptographic Proof</Text>
        </View>

        <TrustBadge />

        <View style={pdfStyles.footerLine} fixed />
        <Text style={pdfStyles.footerText} fixed>{data.language === 'en' ? footerEn : footerJa}</Text>
      </Page>
    </Document>
  );
}
