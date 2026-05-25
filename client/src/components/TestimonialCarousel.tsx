import { useCallback, useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Quote,
  ShieldCheck,
} from 'lucide-react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Testimonial {
  body: string;
  role: string;
  tools: string;
  initial: string;
}

const TESTIMONIALS: ReadonlyArray<Testimonial> = [
  {
    body:
      'Xに投稿した作品が別アカウントで商用利用されていた。ProofMarkの証明書を添えて申告したら、即座に対処できた。',
    role: 'AIイラストレーター',
    tools: 'Midjourney + Stable Diffusion',
    initial: 'A',
  },
  {
    body:
      '納品物に検証URLを添付するようにしてから、クライアントからの著作権問題に関する問い合わせがゼロになった。',
    role: 'デザイナー・写真家',
    tools: 'Photoshop / Lightroom',
    initial: 'D',
  },
  {
    body:
      'プロットを共同制作する際、自分のアイデアをタイムスタンプで保護。その後の著者交渉がスムーズになった。',
    role: '小説家・脚本家',
    tools: 'Scrivener / Final Draft',
    initial: 'S',
  },
  {
    body:
      'ゲームのリリース前にProofMarkで証明。リリース後に類似アセットの盗用があったが、タイムスタンプの日付で即反論できた。',
    role: '開発者',
    tools: 'Unity / Blender',
    initial: 'G',
  },
];

const AUTO_MS = 5000;

export default function TestimonialCarousel(): JSX.Element {
  const reduce = useReducedMotion() ?? false;
  const [index, setIndex] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    if (reduce || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused]);

  const go = useCallback((dir: 1 | -1) => {
    setIndex((i) => (i + dir + TESTIMONIALS.length) % TESTIMONIALS.length);
  }, []);

  const active = TESTIMONIALS[index];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-[28px] border p-7 sm:p-10"
        style={{
          background: '#0D0B24',
          borderColor: '#1C1A38',
          minHeight: 360,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* ambient orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-[0.10] blur-[80px]"
          style={{ background: '#6C3EF4' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-[0.10] blur-[80px]"
          style={{ background: '#00D4AA' }}
        />

        <Quote
          className="absolute left-6 top-6"
          style={{
            color: '#FFFFFF',
            opacity: 0.08,
            width: 96,
            height: 96,
          }}
          aria-hidden
        />

        <div className="relative z-10 flex h-full flex-col">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={index}
              initial={{ opacity: 0, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -12 }}
              transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
              className="mt-12 text-[18px] font-medium leading-[1.7] text-white sm:text-[20px]"
              style={{ letterSpacing: '-0.005em' }}
            >
              {active.body}
            </motion.blockquote>
          </AnimatePresence>

          <div
            className="mt-8 border-t pt-5"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          />

          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-extrabold text-white"
              style={{
                background:
                  'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
                boxShadow: '0 8px 18px rgba(108,62,244,0.40)',
              }}
            >
              {active.initial}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white">{active.role}</p>
              <p
                className="text-[11.5px]"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                {active.tools}
              </p>
            </div>
            <span
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]"
              style={{
                background: 'rgba(0,212,170,0.10)',
                borderColor: 'rgba(0,212,170,0.40)',
                color: '#00D4AA',
              }}
            >
              <ShieldCheck className="h-3 w-3" />
              Verified User
            </span>
          </div>
        </div>
      </div>

      {/* controls + dots */}
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="前の証言へ"
            className="flex h-9 w-9 items-center justify-center rounded-full border text-white"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="次の証言へ"
            className="flex h-9 w-9 items-center justify-center rounded-full border text-white"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="証言の選択">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`証言 ${i + 1}`}
              onClick={() => setIndex(i)}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 22 : 8,
                background: i === index ? '#00D4AA' : 'rgba(255,255,255,0.20)',
                boxShadow: i === index ? '0 0 12px rgba(0,212,170,0.55)' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
