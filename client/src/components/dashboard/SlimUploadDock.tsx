/**
 * SlimUploadDock.tsx — Stripe / Vercel-like Compact Upload Dock
 *
 * Mission:
 *   - 既存の `CertificateUpload.c2pa-patch.tsx` を**1文字も改変せず**に、
 *     管理画面の Hero に薄く乗せるための Dock 型ラッパー。
 *   - Vercel "New Project" バー / Stripe "Quick Action" のような
 *     横長・低高さ・ドラッグでハイライトする静かな帯。
 *   - クリックまたはドロップで滑らかに展開し、CertificateUpload を
 *     そのまま (props なしで) マウントする。
 *
 * 設計原則:
 *   1. 内部に独自のドロップ処理を抱えない。展開後は CertificateUpload に
 *      ファイル選択をフルに委譲する (handleIssueCertificate / supabase 呼び出しは温存)。
 *   2. 入口の「Drag-to-expand」だけは Dock 自身で検知する。これは UX のみで
 *      副作用を持たない (ファイル本体は CertificateUpload 側 dropzone に渡す)。
 *   3. デザイントークン (`#6C3EF4` / `#00D4AA` / `rgba(255,255,255,*)`) のみを
 *      使い、新色や Tailwind の素朴 palette (bg-blue-500 等) は導入しない。
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Lock, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react';
import CertificateUpload from '../CertificateUpload.c2pa-patch';

interface SlimUploadDockProps {
  /** 上段に出す KPI 行 (任意)。Dock 内では表示しない。コール側で配置する */
  /** Studio plan でない場合に Shareable バッジを隠したい等の用途に使う任意フラグ */
  isPaidPlan?: boolean;
}

export function SlimUploadDock(_props: SlimUploadDockProps = {}) {
  const [expanded, setExpanded] = useState(false);
  const [windowDrag, setWindowDrag] = useState(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  /* ── Window 全体のドラッグ検知。Dock を緩やかにハイライトするだけ ── */
  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;

    const onEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) setWindowDrag(true);
    };
    const onLeave = (e: DragEvent) => {
      if (
        e.clientY <= 0 ||
        e.clientX <= 0 ||
        e.clientX >= window.innerWidth ||
        e.clientY >= window.innerHeight
      ) {
        setWindowDrag(false);
      }
    };
    const onDrop = () => {
      setWindowDrag(false);
      // ファイルがドロップされたら Dock を展開して CertificateUpload に渡す
      setExpanded(true);
    };
    const onOver = (e: DragEvent) => e.preventDefault();

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onOver);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragover', onOver);
    };
  }, []);

  /* ── 展開時は Dock 内へスクロール ── */
  useEffect(() => {
    if (!expanded) return;
    const id = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => window.clearTimeout(id);
  }, [expanded]);

  return (
    <section
      ref={sectionRef}
      aria-label="証明書を発行"
      className="relative rounded-2xl border bg-white/[0.02] backdrop-blur-md overflow-hidden transition-colors"
      style={{
        borderColor: windowDrag ? 'rgba(108,62,244,0.55)' : 'rgba(255,255,255,0.06)',
        boxShadow: windowDrag
          ? '0 0 0 1px rgba(108,62,244,0.45), 0 16px 48px -28px rgba(108,62,244,0.55)'
          : 'none',
      }}
    >
      {/* ─────────── 折りたたみ時: Vercel 風の細い帯 ─────────── */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="group relative w-full flex items-center gap-4 px-4 sm:px-5 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]/60"
          aria-expanded={false}
          aria-controls="slim-upload-panel"
        >
          {/* アイコン */}
          <span
            aria-hidden="true"
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition-colors"
            style={{
              background: 'rgba(108,62,244,0.10)',
              borderColor: 'rgba(108,62,244,0.35)',
              color: '#A8A0D8',
            }}
          >
            <UploadCloud className="w-4 h-4" />
          </span>

          {/* 主文 + サブ文 */}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white tracking-tight truncate">
              新しい証明を発行
              <span className="hidden sm:inline ml-2 font-normal text-white/40">
                — ファイルをドロップ、またはクリックで開く
              </span>
            </p>
            <p
              className="text-[10.5px] tracking-[0.18em] uppercase mt-1 truncate"
              style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
            >
              SHA-256 · RFC-3161 · Zero-Knowledge / Shareable
            </p>
          </div>

          {/* 右端のミニチップ群 */}
          <div className="hidden md:flex items-center gap-2 shrink-0 mr-1">
            <Chip icon={<Lock className="w-3 h-3" />} label="Private" tone="success" />
            <Chip icon={<Sparkles className="w-3 h-3" />} label="C2PA" tone="primary" />
            <Chip icon={<ShieldCheck className="w-3 h-3" />} label="Trusted TSA" tone="trusted" />
          </div>

          {/* 展開矢印 */}
          <span
            aria-hidden="true"
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border text-white/55 group-hover:text-white transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </span>

          {/* ドラッグ時の柔らかい光彩 */}
          {windowDrag && (
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(800px 80px at 50% 50%, rgba(108,62,244,0.18), transparent 70%)',
              }}
            />
          )}
        </button>
      )}

      {/* ─────────── 展開時: 既存 CertificateUpload をそのまま乗せる ─────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="slim-upload-panel"
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* 上部バー (折りたたみボタン付き) */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3.5 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: 'rgba(108,62,244,0.12)',
                    border: '1px solid rgba(108,62,244,0.35)',
                    color: '#A8A0D8',
                  }}
                >
                  <UploadCloud className="w-3 h-3" />
                  新規発行
                </span>
                <span className="text-[11px] text-white/45">
                  ドロップしたファイルは Web Worker でハッシュ計算されます。
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-white/55 hover:text-white border border-white/10 hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4AA]/60"
                aria-label="アップロードパネルを閉じる"
              >
                <X className="w-3 h-3" /> 閉じる
              </button>
            </div>

            {/* 既存 CertificateUpload を**そのまま**マウント (props なし・ロジック保護) */}
            <div className="px-3 sm:px-4 pb-4">
              <CertificateUpload />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Chip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'primary' | 'success' | 'trusted';
}) {
  const palette =
    tone === 'success'
      ? { color: '#00D4AA', border: 'rgba(0,212,170,0.35)', bg: 'rgba(0,212,170,0.08)' }
      : tone === 'primary'
      ? { color: '#A8A0D8', border: 'rgba(108,62,244,0.35)', bg: 'rgba(108,62,244,0.10)' }
      : { color: '#00D4AA', border: 'rgba(0,212,170,0.35)', bg: 'rgba(0,212,170,0.08)' };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ color: palette.color, border: `1px solid ${palette.border}`, background: palette.bg }}
    >
      {icon}
      {label}
    </span>
  );
}

export default SlimUploadDock;
