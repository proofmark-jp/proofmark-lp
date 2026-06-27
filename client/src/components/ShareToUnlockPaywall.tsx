/**
 * ShareToUnlockPaywall.tsx — The Velvet Trap
 * ─────────────────────────────────────────────────────────────────────────────
 * クリエイターの承認欲求をハックし、X (Twitter) でのバイラルシェアを「報酬」と
 * 引き換えに引き出す、サイバーパンク・フォレンジック様式の Share-to-Unlock モーダル。
 *
 *   初期: 🔒 LOCAL SEALED — 自分の傑作がデバイス内に幽閉されている欠乏感
 *   遷移: X の投稿ポップアップ → focus 復帰 / popup.closed を契機に Supabase 更新
 *   覚醒: 🌐 GLOBALLY VERIFIED — 世界へ証明されたカタルシス
 *
 * Architecture
 *  - 親が initialVisibility === 'public' を渡した場合は早期 return null
 *  - OAuth の摩擦をゼロ化するため、popup.closed と window 'focus' をデュアル監視
 *  - useEffect クリーンアップで listener / interval を必ず解除しメモリリークを撲滅
 *  - 連続クリック禁止: isUnlocking フラグで送信窓口を一意化
 *  - Supabase 失敗時は焦燥感を煽る赤系メッセージを inline 表示し、再試行可能
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Lock,
  ShieldCheck,
  Twitter,
  Globe2,
  Loader2,
  Sparkles,
  AlertTriangle,
  X as XClose,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

export interface ShareToUnlockProps {
  certificateId: string;
  certificateUrl: string;
  initialVisibility: 'private' | 'public';
  onUnlockSuccess: () => void;
  /** 任意: 閉じる×ボタン (未指定なら非表示) */
  onDismiss?: () => void;
  /** 任意: 投稿コピー文を上書き */
  shareText?: string;
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */

const NEON = '#00FFB2';
const PURPLE = '#6C3EF4';
const DANGER = '#FF5577';

const DEFAULT_SHARE_TEXT =
  '私はこの作品が「100%人間の手によるもの」であることを、暗号学的に証明しました。\n#ProofMark #HumanProof';

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function ShareToUnlockPaywall({
  certificateId,
  certificateUrl,
  initialVisibility,
  onUnlockSuccess,
  onDismiss,
  shareText,
}: ShareToUnlockProps) {
  /* ─── 既に public なら何もレンダリングしない ─── */
  if (initialVisibility === 'public') return null;

  /* ─── state ─── */
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ─── refs ─── */
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  /** 多重発火を防ぐためのガード */
  const unlockTriggeredRef = useRef<boolean>(false);
  /** 「自前で開いたポップアップから戻った時だけ反応する」ためのフラグ */
  const watchingRef = useRef<boolean>(false);
  const latestCheckUnlockRef = useRef<() => void>(() => {});

  /* ─── X intent URL ─── */
  const intentUrl = buildIntentUrl(shareText ?? DEFAULT_SHARE_TEXT, certificateUrl);

  /* ───────────────────────────────────────────────
     Supabase Update — visibility: 'public'
     ─────────────────────────────────────────────── */
  const performUnlock = useCallback(async () => {
    if (unlockTriggeredRef.current) return;
    unlockTriggeredRef.current = true;

    setIsUnlocking(true);
    setError(null);

    try {
      const { error: supaErr } = await supabase
        .from('certificates')
        .update({ visibility: 'public' })
        .eq('id', certificateId);

      if (supaErr) throw supaErr;

      setUnlocked(true);
      // カタルシス演出のため少しだけ待ってから親へ通知
      timeoutRef.current = window.setTimeout(() => {
        onUnlockSuccess();
      }, 900);
    } catch (e) {
      // 失敗時は再試行可能にするためフラグを戻す
      unlockTriggeredRef.current = false;
      setError(
        e instanceof Error
          ? e.message
          : '公開処理に失敗しました。ネットワーク状況を確認してもう一度お試しください。',
      );
    } finally {
      setIsUnlocking(false);
    }
  }, [certificateId, onUnlockSuccess]);

  /* ───────────────────────────────────────────────
     The Flip — focus / visibilitychange / popup.closed の統合監視
     ─────────────────────────────────────────────── */
  const checkUnlock = useCallback(() => {
    // ウォッチ中でない、または既に解錠処理が走っていれば無視
    if (!watchingRef.current || unlockTriggeredRef.current) return;

    // 1. デスクトップ環境: ポップアップが開かれており、かつ閉じられていれば解錠
    if (popupRef.current) {
        if (popupRef.current.closed) {
            watchingRef.current = false;
            performUnlock();
            return;
        }
    }

    // 2. モバイル環境 (ネイティブアプリ遷移からの復帰検知)
    //    document.visibilityState が 'visible' (画面に戻ってきた) または
    //    document.hasFocus() が true (デスクトップのタブ切り替え復帰) であれば解錠を試みる
    if (document.visibilityState === 'visible' || document.hasFocus()) {
        watchingRef.current = false;
        performUnlock();
    }
  }, [performUnlock]);

  /* ───────────────────────────────────────────────
     Share Button onClick
     ─────────────────────────────────────────────── */
  const handleShare = useCallback(() => {
    if (isUnlocking || unlocked) return;
    setError(null);

    // 🛡️ 修正: ブラウザの厳格なポップアップブロックを回避するため、
    // onClickの同期スレッドの「直下」で確実に window.open を呼ぶ。
    const popup = window.open(
      intentUrl,
      '_blank',
      'width=600,height=600,noopener=no,noreferrer=no',
    );

    watchingRef.current = true;

    // ポップアップがブロックされた場合（またはiOSネイティブ遷移で null が返った場合）のフォールバック
    if (!popup) {
        // null が返っても、モバイル遷移の可能性があるため監視は継続する
        // ただし、明示的なリンククリックも促す
        console.warn('[ShareToUnlock] window.open returned null. Assuming popup blocker or mobile deep link.');
    } else {
        popupRef.current = popup;
    }

    // popup.closed を polling (主にデスクトップのポップアップ監視用)
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }
    intervalRef.current = window.setInterval(() => {
        // checkUnlock 内で条件を判定させる
        latestCheckUnlockRef.current(); 
    }, 500);

  }, [intentUrl, isUnlocking, unlocked]);

  /* ───────────────────────────────────────────────
     Mount: focus & visibility listener / Unmount: 完全クリーンアップ
     ─────────────────────────────────────────────── */
  useEffect(() => {
    latestCheckUnlockRef.current = checkUnlock;
  }, [checkUnlock]);

  useEffect(() => {
    const onReturn = () => latestCheckUnlockRef.current(); 
    
    // 👑 修正: モバイルのネイティブアプリ復帰を検知する最強のフックを追加
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    
    return () => {
        document.removeEventListener('visibilitychange', onReturn);
        window.removeEventListener('focus', onReturn);
        if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        popupRef.current = null;
    };
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share to Unlock"
      className="
        fixed inset-0 z-[100]
        flex items-center justify-center
        px-4 sm:px-6
        bg-[#050308]/85 backdrop-blur-xl
        animate-[fadeIn_0.35s_ease-out]
      "
    >
      {/* ─── 背後を流れるサイバー・グリッド (極薄) ─── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,178,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,178,0.5) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse at center, black 40%, transparent 80%)',
        }}
      />

      {/* ═════════════════════════════════════════════════════
         The Modal — Forensic Report Frame
         ═════════════════════════════════════════════════════ */}
      <div
        className="
          relative w-full max-w-[480px]
          rounded-[20px]
          border border-white/10
          bg-[#0A0716]/95
          backdrop-blur-2xl
          shadow-[0_0_40px_rgba(0,255,178,0.10),0_30px_80px_-20px_rgba(0,0,0,0.85)]
          overflow-hidden
        "
        style={{ willChange: 'transform, opacity' }}
      >
        {/* ── 四隅のクロスヘア (サイバー鑑識ターゲット) ── */}
        <Crosshair position="top-left" />
        <Crosshair position="top-right" />
        <Crosshair position="bottom-left" />
        <Crosshair position="bottom-right" />

        {/* ── 上端の極薄ネオンライン ── */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent 0%, ${NEON} 50%, transparent 100%)`,
            opacity: 0.5,
          }}
        />

        {/* ── 右上の閉じる × (任意) ── */}
        {onDismiss && !unlocked && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="閉じる"
            className="
              absolute top-3 right-3 z-10
              w-7 h-7 rounded-md
              flex items-center justify-center
              text-white/40 hover:text-white/85
              hover:bg-white/5
              transition-colors
            "
          >
            <XClose size={14} />
          </button>
        )}

        {/* ── Forensic Header Eyebrow ── */}
        <div className="px-7 pt-6">
          <div className="flex items-center justify-between">
            <span
              className="
                text-[9.5px] font-mono font-bold uppercase
                tracking-[0.28em]
                text-white/40
              "
            >
              ProofMark · Forensic Console
            </span>
            <span
              className="
                inline-flex items-center gap-1.5
                px-2 py-0.5 rounded-full
                text-[9px] font-mono font-bold uppercase
                tracking-[0.18em]
                border
              "
              style={{
                color: unlocked ? NEON : '#FFB35C',
                borderColor: unlocked
                  ? 'rgba(0,255,178,0.45)'
                  : 'rgba(255,179,92,0.45)',
                backgroundColor: unlocked
                  ? 'rgba(0,255,178,0.08)'
                  : 'rgba(255,179,92,0.06)',
              }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{
                  backgroundColor: unlocked ? NEON : '#FFB35C',
                  boxShadow: `0 0 6px ${unlocked ? NEON : '#FFB35C'}`,
                }}
              />
              {unlocked ? 'BROADCASTING' : 'AWAITING SIGNAL'}
            </span>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════
           Status Block — Lock / Unlock の二相
           ═════════════════════════════════════════════════ */}
        <div className="px-7 pt-5">
          {!unlocked ? (
            <LockedStatusBlock />
          ) : (
            <UnlockedStatusBlock />
          )}
        </div>

        {/* ═════════════════════════════════════════════════
           Title & Description
           ═════════════════════════════════════════════════ */}
        <div className="px-7 pt-5">
          <h2
            className="
              text-white font-mono font-bold
              text-[18px] sm:text-[20px]
              tracking-[0.18em] uppercase
              leading-[1.25]
            "
            style={{
              textShadow: unlocked
                ? `0 0 14px rgba(0,255,178,0.55)`
                : 'none',
              color: unlocked ? NEON : '#FFFFFF',
              transition: 'color 0.5s ease, text-shadow 0.5s ease',
            }}
          >
            {unlocked
              ? '世界へ、証明された。'
              : '世界へ、証明を放つ。'}
          </h2>
          <p className="mt-3 text-[13px] leading-[1.7] text-white/55 font-medium">
            {unlocked ? (
              <>
                あなたの作品は <span className="text-white/85">人類の側</span> に
                記録されました。URL は永続化され、第三者検証が可能です。
              </>
            ) : (
              <>
                X (Twitter) でこの証明を共有すると、ロックが解除され
                <span className="text-white/85"> 公開 URL </span>
                が生成されます。摩擦ゼロ・追加サインイン不要。
              </>
            )}
          </p>
        </div>

        {/* ═════════════════════════════════════════════════
           Cert ID Forensic Strip
           ═════════════════════════════════════════════════ */}
        <div className="px-7 pt-5">
          <div
            className="
              flex items-center justify-between gap-3
              rounded-lg
              border border-white/[0.06]
              bg-black/40
              px-3 py-2.5
            "
          >
            <span
              className="
                text-[9px] font-mono font-bold uppercase
                tracking-[0.22em]
                text-white/35
                shrink-0
              "
            >
              CERT-ID
            </span>
            <code
              className="
                text-[11px] font-mono
                text-white/70
                truncate
              "
              style={{ letterSpacing: '0.04em' }}
              title={certificateId}
            >
              {certificateId}
            </code>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════
           Error
           ═════════════════════════════════════════════════ */}
        {error && (
          <div className="px-7 pt-4">
            <div
              role="alert"
              className="
                flex items-start gap-2.5
                rounded-lg
                px-3 py-2.5
                text-[11.5px] leading-[1.55]
              "
              style={{
                backgroundColor: 'rgba(255,85,119,0.08)',
                border: `1px solid ${DANGER}55`,
                color: '#FFC0CC',
              }}
            >
              <AlertTriangle size={13} className="mt-[1px] shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════
           The Share Button — The Velvet Trap
           ═════════════════════════════════════════════════ */}
        <div className="px-7 pt-6 pb-6">
          <ShareButton
            isUnlocking={isUnlocking}
            unlocked={unlocked}
            onClick={handleShare}
          />

          {/* 行動を後押しする極小フットノート */}
          <p
            className="
              mt-3 text-center
              text-[9.5px] font-mono uppercase
              tracking-[0.24em]
              text-white/30
            "
          >
            {unlocked
              ? 'CHAIN PUBLISHED · IMMUTABLE'
              : 'FRICTIONLESS VERIFICATION · NO LOGIN REQUIRED'}
          </p>
        </div>

        {/* 下端の極薄ネオンライン */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent 0%, ${PURPLE} 50%, transparent 100%)`,
            opacity: 0.4,
          }}
        />
      </div>

      {/* keyframes (Tailwind に依存しない自前 fadeIn) */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes neonPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,178,0); }
          50% { box-shadow: 0 0 22px 4px rgba(0,255,178,0.45); }
        }
        @keyframes sweep {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(110%); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: LockedStatusBlock — 🔒 LOCAL SEALED
   ═══════════════════════════════════════════════════════════════ */

function LockedStatusBlock() {
  return (
    <div
      className="
        relative
        rounded-xl
        border border-white/[0.08]
        bg-gradient-to-br from-white/[0.03] to-black/30
        px-4 py-4
        flex items-center gap-3.5
      "
      style={{ filter: 'grayscale(0.15)' }}
    >
      <div
        className="
          relative
          w-12 h-12 rounded-xl
          flex items-center justify-center
          shrink-0
        "
        style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <Lock size={20} className="text-white/80" />
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl"
          style={{
            boxShadow: 'inset 0 0 14px rgba(0,0,0,0.55)',
          }}
        />
      </div>
      <div className="min-w-0">
        <div
          className="
            text-[10px] font-mono font-bold uppercase
            tracking-[0.24em]
            text-white/40
          "
        >
          CURRENT STATE
        </div>
        <div
          className="
            mt-1 text-[14px] font-mono font-bold
            tracking-[0.18em]
            text-white/90
          "
        >
          🔒 LOCAL SEALED
        </div>
        <div className="mt-1 text-[11px] text-white/45 leading-[1.5]">
          この証明はデバイス内に幽閉されています。
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: UnlockedStatusBlock — 🌐 GLOBALLY VERIFIED
   ═══════════════════════════════════════════════════════════════ */

function UnlockedStatusBlock() {
  return (
    <div
      className="
        relative overflow-hidden
        rounded-xl
        px-4 py-4
        flex items-center gap-3.5
      "
      style={{
        border: `1px solid ${NEON}55`,
        backgroundImage: `linear-gradient(135deg, rgba(0,255,178,0.10) 0%, rgba(108,62,244,0.10) 100%)`,
        animation: 'neonPulse 2.4s ease-in-out infinite',
      }}
    >
      <div
        className="
          relative
          w-12 h-12 rounded-xl
          flex items-center justify-center
          shrink-0
        "
        style={{
          backgroundColor: 'rgba(0,255,178,0.18)',
          border: `1px solid ${NEON}88`,
          boxShadow: `0 0 18px rgba(0,255,178,0.55)`,
        }}
      >
        <Globe2 size={20} color={NEON} strokeWidth={2.4} />
      </div>
      <div className="min-w-0">
        <div
          className="
            text-[10px] font-mono font-bold uppercase
            tracking-[0.24em]
          "
          style={{ color: NEON }}
        >
          STATE TRANSITIONED
        </div>
        <div
          className="
            mt-1 text-[14px] font-mono font-bold
            tracking-[0.18em]
            text-white
          "
          style={{ textShadow: `0 0 12px rgba(0,255,178,0.65)` }}
        >
          🌐 GLOBALLY VERIFIED
        </div>
        <div className="mt-1 text-[11px] text-white/65 leading-[1.5]">
          公開 URL が永続化され、第三者検証可能になりました。
        </div>
      </div>

      {/* 上端を走る一回限りのスイープ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
          mixBlendMode: 'overlay',
          animation: 'sweep 1.6s ease-out 1',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: ShareButton — The Velvet Trap CTA
   ═══════════════════════════════════════════════════════════════ */

interface ShareButtonProps {
  isUnlocking: boolean;
  unlocked: boolean;
  onClick: () => void;
}

function ShareButton({ isUnlocking, unlocked, onClick }: ShareButtonProps) {
  const baseLabel = unlocked
    ? 'UNLOCKED'
    : isUnlocking
      ? 'VERIFYING…'
      : 'XでシェアしてUNLOCK';

  const isDisabled = isUnlocking || unlocked;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`
        group relative w-full
        inline-flex items-center justify-center gap-3
        px-5 py-3.5 rounded-xl
        font-mono font-bold uppercase
        text-[13px] tracking-[0.22em]
        text-white
        overflow-hidden
        transition-all duration-300 ease-out
        ${isDisabled ? 'cursor-not-allowed opacity-90' : 'hover:scale-[1.025] active:scale-[0.985]'}
        ${isUnlocking ? 'animate-pulse' : ''}
      `}
      style={{
        backgroundColor: unlocked ? 'rgba(0,255,178,0.12)' : '#0F0F14',
        backgroundImage: unlocked
          ? `linear-gradient(135deg, rgba(0,255,178,0.18) 0%, rgba(108,62,244,0.18) 100%)`
          : `linear-gradient(180deg, #15131F 0%, #0B0915 100%)`,
        border: unlocked
          ? `1px solid ${NEON}88`
          : '1px solid rgba(255,255,255,0.12)',
        boxShadow: unlocked
          ? `0 0 30px rgba(0,255,178,0.55), inset 0 0 12px rgba(0,255,178,0.25)`
          : isUnlocking
            ? `0 0 18px rgba(0,255,178,0.35)`
            : `0 8px 26px -8px rgba(0,0,0,0.7)`,
        willChange: 'transform, box-shadow',
      }}
    >
      {/* Hover glow ring (X brand neon) */}
      {!isDisabled && (
        <span
          aria-hidden
          className="
            pointer-events-none absolute inset-0 rounded-xl
            opacity-0 group-hover:opacity-100
            transition-opacity duration-300
          "
          style={{
            boxShadow: `0 0 22px 2px rgba(0,255,178,0.55), 0 0 40px rgba(108,62,244,0.35)`,
          }}
        />
      )}

      {/* Sweep highlight */}
      {!isDisabled && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
          style={{
            backgroundImage:
              'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.20) 50%, transparent 70%)',
            mixBlendMode: 'overlay',
            transform: 'translateX(-110%)',
            animation: 'sweep 2.8s ease-in-out infinite',
            animationDelay: '0.4s',
          }}
        />
      )}

      {/* Icon */}
      <span
        className="relative inline-flex items-center justify-center"
        aria-hidden
      >
        {unlocked ? (
          <ShieldCheck size={16} color={NEON} strokeWidth={2.6} />
        ) : isUnlocking ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Twitter size={16} />
        )}
      </span>

      {/* Label */}
      <span className="relative z-10">{baseLabel}</span>

      {/* Trailing sparkle when unlocked */}
      {unlocked && (
        <Sparkles size={14} color={NEON} className="relative z-10" />
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub: Crosshair — 四隅のサイバー鑑識ターゲット
   ═══════════════════════════════════════════════════════════════ */

interface CrosshairProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

function Crosshair({ position }: CrosshairProps) {
  const pos: Record<CrosshairProps['position'], string> = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${pos[position]} w-3 h-3`}
      style={{ opacity: 0.55 }}
    >
      <span
        className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-3"
        style={{ backgroundColor: NEON }}
      />
      <span
        className="absolute top-1/2 left-0 -translate-y-1/2 w-3 h-px"
        style={{ backgroundColor: NEON }}
      />
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Utility: X intent URL builder
   ═══════════════════════════════════════════════════════════════ */

function buildIntentUrl(text: string, url: string): string {
  const params = new URLSearchParams({
    text,
    url,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}
