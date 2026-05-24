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
  generateTakedownNoticePDF,
  type TakedownNoticeInput,
} from '@/lib/takedownPdfGenerator';

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
  const [persona, setPersona] = useState<'creator' | 'legal'>(
    claimant.defaultPersona ?? 'creator',
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
    if (persona === 'legal' && claimant.legalName) return claimant.legalName;
    return claimant.creatorDisplayName;
  }, [persona, claimant]);

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
    if (!isValidUrl) return;
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

      const blob = await generateTakedownNoticePDF(input);
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
                    persona={persona}
                    onPersonaChange={setPersona}
                    creatorDisplayName={claimant.creatorDisplayName}
                    legalName={claimant.legalName ?? null}
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
  persona: 'creator' | 'legal';
  onPersonaChange: (v: 'creator' | 'legal') => void;
  creatorDisplayName: string;
  legalName: string | null;
  claimantEmail: string;
  onSubmit: () => void;
}

function IdleBody({
  infringingUrl,
  onInfringingUrlChange,
  isValidUrl,
  language,
  onLanguageChange,
  persona,
  onPersonaChange,
  creatorDisplayName,
  legalName,
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

      {/* Persona toggle (legalName がある場合のみ) */}
      {legalName && (
        <div className="mt-5">
          <span
            className="text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ color: 'rgba(255,255,255,0.62)' }}
          >
            電子署名に印字する氏名
          </span>
          <div
            className="mt-2 flex w-full rounded-xl border p-1"
            style={{
              background: '#07061A',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <ToggleButton
              active={persona === 'creator'}
              onClick={() => onPersonaChange('creator')}
              icon={<UserCircle className="h-3.5 w-3.5" />}
              label="公開名義"
              sub={creatorDisplayName}
              tone="default"
            />
            <ToggleButton
              active={persona === 'legal'}
              onClick={() => onPersonaChange('legal')}
              icon={<Briefcase className="h-3.5 w-3.5" />}
              label="契約名義 (法的氏名)"
              sub={legalName}
              tone="teal"
            />
          </div>
        </div>
      )}

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
        disabled={!isValidUrl}
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
              {persona === 'legal' && legalName
                ? legalName
                : creatorDisplayName}
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
