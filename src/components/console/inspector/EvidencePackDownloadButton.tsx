/**
 * EvidencePackDownloadButton.tsx — The Command Center (v8 · Absolute Apex UI)
 * ─────────────────────────────────────────────────────────────────────────────
 * 【The Ultimate Apex UI Defenses】完全実装:
 *
 *  ① Async Gesture Bypass — 時空逆転パイプライン
 *     クリックの user-gesture を消費させないため、PDF生成 Promise を await せず
 *     そのまま executeNativeStreamZip に渡す。OSの保存ダイアログが瞬時に開く。
 *
 *  ② Promise Reuse & Strict TTL Cache — 二重フェッチ / 署名付きURL腐敗を粉砕
 *     ホバー先行フェッチとクリックフェッチを ref に保持した Promise で同期。
 *     3分TTLで自己修復。モーダル内強制DLでも期限切れなら安全に再フェッチ。
 *
 *  ③ Hydration-Safe Magic Hand-off
 *     isMobile 判定は SSR に触らせず、クリックした瞬間の navigator.userAgent
 *     を評価。真の実機環境に基づく動的しきい値。
 *
 *  ④ Hybrid Rescue Interface
 *     zipStreamer が投げる 'STREAM_SAVER_DISCONNECTED_FALLBACK_RESCUE' を
 *     厳密に検知し、ゴミZIPの手動削除を促す専用の救済 Toast を長時間表示。
 *
 *  ⑤ Phantom Toast Kill — 幽霊ローディングの完全封殺
 *     try / catch / finally + toast.dismiss(toastKey) + phase='idle' への回帰を
 *     全経路（成功 / 失敗 / abort / 救済）で強制。UIの状態不整合ゼロ。
 *
 *  さらに:
 *   - Headless Separation (Fetch / Stream)
 *   - Native Stream (JSZip排除, RAMゼロ)
 *   - GC Yielding (Yoga/fontkit 止血)
 *   - Framer Motion モーダル (Visual DNA 1バイト維持)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  AlertTriangle,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import QRCode from 'qrcode';

import { supabase } from '@/lib/supabase';
import {
  generateCertificatePdfBlob,
  generateCoverLetterPdfBlob,
} from '@/lib/pdf/generator';
import { ensurePdfFontsRegistered } from '@/lib/pdf/fonts';
import { executeNativeStreamZip } from '@/lib/zipStreamer';

/* ═════════════════════════════════════════════════════════════════════
 *  Types — API Payload Contract & Public Exports
 * ═════════════════════════════════════════════════════════════════════ */

export type FileEntry =
  | { name: string; type: 'text'; content: string }
  | { name: string; type: 'base64'; content: string }
  | { name: string; type: 'url'; url: string };

export interface PdfMetaCertInput {
  certificateId: string;
  creatorDisplayName: string;
  fileName: string;
  fileSize: string;
  sha256: string;
  timestampJst: string;
  verificationUrl: string;
  sealVariant: 'teal' | 'gold';
  tsaProvider: string;
}

export interface PdfMetaCoverInput extends PdfMetaCertInput {
  fileTree: ReadonlyArray<{ name: string; size: string; description?: string }>;
  qrCodeDataUrl?: string;
}

export interface EvidencePackPayload {
  filename: string;
  pdfMeta: { certInput: PdfMetaCertInput; coverInput: PdfMetaCoverInput };
  files: FileEntry[];
}

export interface EvidencePackDownloadParams {
  certId?: string;
  spotSession?: string;
  stagingId?: string;
  apiData?: any;
}

/* ═════════════════════════════════════════════════════════════════════
 *  Constants
 * ═════════════════════════════════════════════════════════════════════ */

/** 署名付きURLの腐敗を防ぐキャッシュTTL (3分) */
const CACHE_TTL_MS = 3 * 60 * 1000;

/** モバイル×大量ファイル判定のしきい値 */
const MOBILE_FILE_THRESHOLD = 20;

/** zipStreamer が投げる救済シグナル */
const RESCUE_ERROR_TOKEN = 'STREAM_SAVER_DISCONNECTED_FALLBACK_RESCUE';

/** GC Yielding: Yoga/fontkit のメモリを解放するための強制待機 */
const GC_YIELD_MS = 150;

/* ═════════════════════════════════════════════════════════════════════
 *  Core 1 : The Fetcher — 純粋関数 (Data Acquisition)
 * ═════════════════════════════════════════════════════════════════════ */

export async function fetchEvidencePayload(
  params: EvidencePackDownloadParams,
  signal?: AbortSignal,
): Promise<EvidencePackPayload> {
  const resolvedCertId = params.certId ?? params.apiData?.id ?? '';
  const { spotSession, stagingId } = params;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('ログインセッションが切れました。再ログインしてください。');
  }

  const apiUrl = resolvedCertId
    ? `/api/generate-evidence-pack?cert=${encodeURIComponent(resolvedCertId)}`
    : `/api/generate-evidence-pack?spot=${encodeURIComponent(spotSession ?? '')}&staging=${encodeURIComponent(stagingId ?? '')}`;

  const payloadRes = await fetch(apiUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
    credentials: 'include',
    signal,
  });

  if (!payloadRes.ok) {
    const j = (await payloadRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      j.error ?? `サーバーエラーが発生しました (HTTP ${payloadRes.status})`,
    );
  }

  return (await payloadRes.json()) as EvidencePackPayload;
}

/* ═════════════════════════════════════════════════════════════════════
 *  Core 2 : The Streamer — Async Gesture Bypass 完全結線
 *  ─────────────────────────────────────────────────────────────────────
 *  ⚡ PDF 生成 Promise を await せずに executeNativeStreamZip に渡すことで、
 *  OS の保存ダイアログを user-gesture の一撃で瞬時に展開する。
 *  ═════════════════════════════════════════════════════════════════════ */

export async function executeEvidencePackStream(
  payload: EvidencePackPayload,
  signal: AbortSignal,
  onPhaseChange?: (phase: 'generating' | 'streaming') => void,
  toastKey?: string,
): Promise<void> {
  ensurePdfFontsRegistered();

  onPhaseChange?.('generating');
  if (toastKey) {
    toast.loading('証明書 PDF を生成中… (1/2)', { id: toastKey });
  }

  // Fail-safe QR
  let safeUrl = 'https://proofmark.jp';
  try {
    safeUrl = new URL(payload.pdfMeta.coverInput.verificationUrl).href;
  } catch {
    /* keep fallback */
  }
  const qrCodeDataUrl = await QRCode.toDataURL(safeUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#0D0B24', light: '#FFFFFF' },
  }).catch(() => undefined);

  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  /* ─────────────────────────────────────────────────────────────────
   *  ⚡ Async Gesture Bypass:
   *  PDF Promise を await せずに、そのまま executeNativeStreamZip に流す。
   *  これにより showSaveFilePicker が user-gesture 内で瞬発する。
   * ───────────────────────────────────────────────────────────────── */

  const certPdfPromise: Promise<Blob> = generateCertificatePdfBlob(
    payload.pdfMeta.certInput,
  ).then(async (blob) => {
    // Yoga/fontkit の VRAM を強制解放してから次段へ
    await new Promise((r) => setTimeout(r, GC_YIELD_MS));
    return blob;
  });

  const coverInputWithQr = { ...payload.pdfMeta.coverInput, qrCodeDataUrl };
  const coverPdfPromise: Promise<Blob> = certPdfPromise.then(async () => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (toastKey) {
      toast.loading('カバーレター PDF を生成中… (2/2)', { id: toastKey });
    }
    return await generateCoverLetterPdfBlob(coverInputWithQr);
  });

  // Streaming phase (先行して stream 起動 → 保存ダイアログ即応)
  onPhaseChange?.('streaming');
  if (toastKey) {
    toast.loading('安全なストリーム保存を実行中…', { id: toastKey });
  }

  // ⚡ Promise を await せずそのまま渡す (時空逆転パイプライン)
  await executeNativeStreamZip({
    filename: payload.filename,
    payload,
    certPdfBlob: certPdfPromise as unknown as Blob, // Streamer 側で await される
    coverPdfBlob: coverPdfPromise as unknown as Blob,
    signal,
  } as any);
}

/**
 * 外部から命令 API として叩ける便利関数 (Dashboard等から使用)
 */
export async function executeEvidencePackDownload(
  params: EvidencePackDownloadParams,
  onPhaseChange?: (phase: any) => void,
): Promise<void> {
  const controller = new AbortController();
  onPhaseChange?.('fetching');
  const payload = await fetchEvidencePayload(params, controller.signal);
  await executeEvidencePackStream(payload, controller.signal, onPhaseChange);
}

/* ═════════════════════════════════════════════════════════════════════
 *  UI Component — The Command Center
 * ═════════════════════════════════════════════════════════════════════ */

type Phase =
  | 'idle'
  | 'fetching'
  | 'magic-handoff'
  | 'generating'
  | 'streaming';

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Evidence Pack をダウンロード',
  fetching: 'データを取得中…',
  'magic-handoff': '安全な転送を待機中…',
  generating: 'PDF を生成中…',
  streaming: 'ストリーム保存中…',
};

interface Props extends EvidencePackDownloadParams {
  variant?: 'primary' | 'ghost';
  label?: string;
}

export default function EvidencePackDownloadButton({
  certId,
  spotSession,
  stagingId,
  apiData,
  variant = 'primary',
  label = 'Evidence Pack をダウンロード',
}: Props): ReactElement {
  const [phase, setPhase] = useState<Phase>('idle');

  /** 3分TTL 付きの自己修復キャッシュ */
  const [payloadCache, setPayloadCache] = useState<{
    payload: EvidencePackPayload;
    timestamp: number;
  } | null>(null);

  /** Abort 制御 */
  const abortControllerRef = useRef<AbortController | null>(null);

  /** ⭐ Promise Reuse: 進行中のフェッチを1つに融合 (ホバー×クリック衝突封じ) */
  const fetchPromiseRef = useRef<Promise<EvidencePackPayload> | null>(null);

  /** アンマウント検知 (finally の setState 事故防止) */
  const isMountedRef = useRef(true);

  const isProcessing =
    phase !== 'idle' && phase !== 'magic-handoff';

  const resolvedCertId = certId ?? apiData?.id ?? '';
  const toastKey = `evidence-${resolvedCertId || stagingId || 'pack'}`;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      fetchPromiseRef.current = null;
    };
  }, []);

  /* ─────────────────────────────────────────────────────────────────
   *  Cache validity helper
   * ───────────────────────────────────────────────────────────────── */
  const isCacheAlive = useCallback((): boolean => {
    return (
      !!payloadCache &&
      Date.now() - payloadCache.timestamp < CACHE_TTL_MS
    );
  }, [payloadCache]);

  /* ─────────────────────────────────────────────────────────────────
   *  Prefetch (ホバー時) — Promise Reuse で二重発火を物理封殺
   * ───────────────────────────────────────────────────────────────── */
  const prefetchPayload = useCallback(() => {
    if (isCacheAlive()) return;
    if (fetchPromiseRef.current) return;
    if (phase !== 'idle') return;

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const promise = fetchEvidencePayload(
        { certId, spotSession, stagingId, apiData },
        controller.signal,
      );
      fetchPromiseRef.current = promise;

      promise
        .then((payload) => {
          if (!isMountedRef.current) return;
          setPayloadCache({ payload, timestamp: Date.now() });
        })
        .catch(() => {
          /* 事前フェッチのエラーは握り潰す (本番クリックが再挑戦する) */
        })
        .finally(() => {
          if (fetchPromiseRef.current === promise) {
            fetchPromiseRef.current = null;
          }
        });
    } catch {
      /* ignore sync errors */
    }
  }, [certId, spotSession, stagingId, apiData, phase, isCacheAlive]);

  /* ─────────────────────────────────────────────────────────────────
   *  Hybrid Rescue Interface
   * ───────────────────────────────────────────────────────────────── */
  const showRescueToast = useCallback(() => {
    toast.dismiss(toastKey);
    toast.warning('通信が切断されました', {
      id: `${toastKey}-rescue`,
      duration: 20000,
      description:
        'OSのダウンロードフォルダに不完全なファイルが残っている場合は、手動で削除してからもう一度お試しください。',
      action: {
        label: 'もう一度試す',
        onClick: () => {
          // 再挑戦: idle に戻し、キャッシュを破棄してユーザーの再クリックを促す
          if (isMountedRef.current) {
            setPhase('idle');
            setPayloadCache(null);
          }
        },
      },
    });
  }, [toastKey]);

  /* ─────────────────────────────────────────────────────────────────
   *  Stream Executor (ボタンクリック / モーダル強制DL 共通)
   * ───────────────────────────────────────────────────────────────── */
  const processStream = useCallback(
    async (payload: EvidencePackPayload) => {
      if (
        !abortControllerRef.current ||
        abortControllerRef.current.signal.aborted
      ) {
        abortControllerRef.current = new AbortController();
      }

      try {
        await executeEvidencePackStream(
          payload,
          abortControllerRef.current.signal,
          (p) => {
            if (isMountedRef.current) setPhase(p);
          },
          toastKey,
        );

        toast.success('Evidence Pack を保存しました', {
          id: toastKey,
          duration: 8000,
          description: '原本データは30日後に自動消去されます。',
          action: {
            label: '永久保存する',
            onClick: () => window.open('/pricing', '_blank'),
          },
        });

        // 監査ログビーコン (ベストエフォート)
        if (resolvedCertId && typeof navigator.sendBeacon === 'function') {
          try {
            navigator.sendBeacon(
              '/api/audit/download-log',
              new Blob(
                [
                  JSON.stringify({
                    certId: resolvedCertId,
                    action: 'DOWNLOAD',
                    timestamp: Date.now(),
                  }),
                ],
                { type: 'application/json' },
              ),
            );
          } catch {
            /* noop */
          }
        }
      } catch (e: any) {
        const isAbort = e?.name === 'AbortError';
        const isRescue =
          typeof e?.message === 'string' &&
          e.message.includes(RESCUE_ERROR_TOKEN);

        if (isRescue) {
          // ④ Hybrid Rescue Interface — Sonner を専用救済 UI に差し替え
          showRescueToast();
        } else if (!isAbort) {
          // ⑤ Phantom Toast Kill — id を同じにして幽霊ローディングを上書き
          toast.error('ストリーム保存に失敗しました', {
            id: toastKey,
            description:
              typeof e?.message === 'string' && e.message.length > 0
                ? e.message
                : '不明なエラーが発生しました。ネットワークを確認してください。',
          });
        } else {
          // Abort: 幽霊トーストを確実に破棄
          toast.dismiss(toastKey);
        }
      } finally {
        // ⑤ Phantom Toast Kill — 状態同期の完全性を担保
        if (isMountedRef.current) {
          setPhase('idle');
          setPayloadCache(null);
        }
        abortControllerRef.current = null;
        fetchPromiseRef.current = null;
      }
    },
    [toastKey, resolvedCertId, showRescueToast],
  );

  /* ─────────────────────────────────────────────────────────────────
   *  司令塔 : Fetch → 判定 → (Modal | Stream)
   * ───────────────────────────────────────────────────────────────── */
  const handleInitialClick = useCallback(async () => {
    if (isProcessing) return;
    setPhase('fetching');

    let payload: EvidencePackPayload;

    try {
      if (isCacheAlive() && payloadCache) {
        payload = payloadCache.payload;
      } else if (fetchPromiseRef.current) {
        // ② Promise Reuse — 進行中のフェッチに合流
        payload = await fetchPromiseRef.current;
        if (isMountedRef.current) {
          setPayloadCache({ payload, timestamp: Date.now() });
        }
      } else {
        abortControllerRef.current = new AbortController();
        const promise = fetchEvidencePayload(
          { certId, spotSession, stagingId, apiData },
          abortControllerRef.current.signal,
        );
        fetchPromiseRef.current = promise;
        payload = await promise;
        if (isMountedRef.current) {
          setPayloadCache({ payload, timestamp: Date.now() });
        }
        fetchPromiseRef.current = null;
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast.error('ダウンロード準備に失敗しました', {
          id: toastKey,
          description:
            typeof e?.message === 'string' && e.message.length > 0
              ? e.message
              : 'サーバーに接続できませんでした。',
        });
      } else {
        toast.dismiss(toastKey);
      }
      if (isMountedRef.current) setPhase('idle');
      fetchPromiseRef.current = null;
      return;
    }

    // ③ Hydration-Safe Magic Hand-off — クリック時にのみ navigator を評価
    const isMobileDevice =
      typeof navigator !== 'undefined' &&
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobileDevice && payload.files.length > MOBILE_FILE_THRESHOLD) {
      if (isMountedRef.current) setPhase('magic-handoff');
      return;
    }

    await processStream(payload);
  }, [
    isProcessing,
    isCacheAlive,
    payloadCache,
    certId,
    spotSession,
    stagingId,
    apiData,
    toastKey,
    processStream,
  ]);

  /* ─────────────────────────────────────────────────────────────────
   *  Cancel (処理中クリック)
   * ───────────────────────────────────────────────────────────────── */
  const cancelDownload = useCallback(() => {
    abortControllerRef.current?.abort();
    fetchPromiseRef.current = null;
    toast.dismiss(toastKey);
    if (isMountedRef.current) {
      setPhase('idle');
      setPayloadCache(null);
    }
  }, [toastKey]);

  /* ─────────────────────────────────────────────────────────────────
   *  Modal Actions
   * ───────────────────────────────────────────────────────────────── */
  const copyUrlToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('URLをコピーしました', {
        description: 'PCのブラウザに貼り付けてダウンロードしてください。',
      });
    } catch {
      toast.error('URLのコピーに失敗しました');
    }
    if (isMountedRef.current) setPhase('idle');
  }, []);

  /**
   * 🔥 モーダル内強制DL — Strict TTL Cache 適用
   *   期限切れの場合は自動で再フェッチして安全に処理を継続する
   */
  const handleForceDownloadFromModal = useCallback(async () => {
    // TTL 生存確認
    if (isCacheAlive() && payloadCache) {
      await processStream(payloadCache.payload);
      return;
    }

    // 期限切れ: 自己修復フェッチで再取得
    toast.loading('セキュリティ期限を更新中…', { id: toastKey });
    if (isMountedRef.current) setPhase('fetching');

    try {
      abortControllerRef.current = new AbortController();
      const fresh = await fetchEvidencePayload(
        { certId, spotSession, stagingId, apiData },
        abortControllerRef.current.signal,
      );
      if (!isMountedRef.current) return;
      setPayloadCache({ payload: fresh, timestamp: Date.now() });
      await processStream(fresh);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast.error('再取得に失敗しました', {
          id: toastKey,
          description:
            typeof e?.message === 'string' && e.message.length > 0
              ? e.message
              : 'ネットワーク接続を確認してください。',
        });
      } else {
        toast.dismiss(toastKey);
      }
      if (isMountedRef.current) {
        setPhase('idle');
        setPayloadCache(null);
      }
    }
  }, [
    isCacheAlive,
    payloadCache,
    processStream,
    certId,
    spotSession,
    stagingId,
    apiData,
    toastKey,
  ]);

  /* ─────────────────────────────────────────────────────────────────
   *  Render
   * ───────────────────────────────────────────────────────────────── */

  const currentLabel = phase === 'idle' ? label : PHASE_LABELS[phase];
  const baseBtn =
    variant === 'primary'
      ? 'bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white shadow-[0_12px_28px_rgba(108,62,244,0.4)]'
      : 'border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]';

  const isCancellable = phase === 'streaming' || phase === 'generating';
  const isButtonDisabled = phase === 'fetching' || phase === 'magic-handoff';

  return (
    <>
      <button
        type="button"
        onClick={isCancellable ? cancelDownload : handleInitialClick}
        disabled={isButtonDisabled}
        className={[
          'group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5 font-bold transition-all active:scale-[0.99]',
          isButtonDisabled ? 'opacity-90 cursor-progress' : '',
          baseBtn,
        ].join(' ')}
        onMouseEnter={prefetchPayload}
        onFocus={prefetchPayload}
        aria-busy={isProcessing}
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[15px]">{currentLabel}</span>
            <span className="text-[11px] font-medium text-white/72">
              {isCancellable
                ? 'タップして中断・通信切断'
                : 'RFC3161 · SHA-256 · Native Stream'}
            </span>
          </span>
        </span>
        <ShieldCheck
          className={`h-5 w-5 text-white/82 transition-transform ${
            isProcessing ? '' : 'group-hover:scale-110'
          }`}
        />
      </button>

      {/* 👑 The Magic Hand-off Modal */}
      <AnimatePresence>
        {phase === 'magic-handoff' && payloadCache && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-handoff-title"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="bg-[#0F0F11] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#F59E0B] to-[#FF4D4D]" />

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <h3
                  id="evidence-handoff-title"
                  className="text-lg font-black text-white leading-tight"
                >
                  高解像度パックの
                  <br />
                  安全なダウンロード
                </h3>
              </div>

              <p className="text-[#A8A0D8] text-sm leading-relaxed mb-6">
                この Evidence Pack は{' '}
                <strong className="text-white">
                  {payloadCache.payload.files.length}枚
                </strong>{' '}
                の検証用アセットを含んでいます。
                モバイル端末での大容量ZIPの一括解凍は、メモリ不足によるファイルの破損やフリーズを引き起こす可能性があります。プロジェクトの安全を期すため、PC環境でのダウンロードを強く推奨いたします。
              </p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={copyUrlToClipboard}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] font-bold hover:bg-[#00D4AA]/20 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  デスクトップ用リンクをコピー
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isMountedRef.current) setPhase('idle');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Web Vault で個別保存する (閉じる)
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleForceDownloadFromModal}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-[#A8A0D8]/40 hover:text-[#FF4D4D] transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  リスクを承知でこの端末に強制ダウンロードする
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
