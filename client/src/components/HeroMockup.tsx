import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileImage, ShieldCheck, Download, Fingerprint, Lock, UploadCloud } from 'lucide-react';

type Phase = 'idle' | 'dropping' | 'scanning' | 'verified' | 'packed';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const appleEase = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface HeroMockupProps {
  /** 静止画フォールバック URL (prefers-reduced-motion 用)。任意。 */
  fallbackImageSrc?: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    if ('addEventListener' in mq) {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    // legacy Safari
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  return reduced;
}

export default function HeroMockup({
  fallbackImageSrc,
}: HeroMockupProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [isInView, setIsInView] = useState(false);


  // Engine state
  const [phase, setPhase] = useState<Phase>('idle');
  const [hash, setHash] = useState('Awaiting Input...');

  /* Intersection Observer — 進入で再生開始、退出で停止 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      // SSR or 古い環境では即時 In-view とみなす
      setIsInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsInView(entry.isIntersecting);
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 感情のシフトの同期: 視差効果オフ、またはフェーズが verified 以降なら解決状態とする
  const resolved = reducedMotion || phase === 'verified' || phase === 'packed';
  const playing = isInView && !reducedMotion;

  /* Engine logic */
  const generateHash = () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase();

  const isPlayingRef = useRef(playing);
  useEffect(() => {
    isPlayingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    let active = true;

    const doCycle = async () => {
      while (active && isPlayingRef.current) {
        setPhase('idle');
        await wait(1800);
        if (!active || !isPlayingRef.current) break;

        setPhase('dropping');
        await wait(500);
        if (!active || !isPlayingRef.current) break;

        setPhase('scanning');
        let ticks = 0;
        const interval = setInterval(() => {
          setHash(generateHash());
          ticks++;
          if (ticks > 24) {
            clearInterval(interval);
            setHash('1F3A...4188');
          }
        }, 50);
        await wait(1500);
        clearInterval(interval);
        if (!active || !isPlayingRef.current) break;

        setPhase('verified');
        await wait(1500);
        if (!active || !isPlayingRef.current) break;

        setPhase('packed');
        await wait(3500);
      }
    };

    if (playing) {
      doCycle();
    }

    return () => {
      active = false;
    };
  }, [playing]);

  return (
    <div
      ref={containerRef}
      id="hero-demo-placeholder"
      data-pm-playing={playing ? 'true' : 'false'}
      data-pm-reduced={reducedMotion ? 'true' : 'false'}
      data-pm-resolved={resolved ? 'true' : 'false'}
      className={`pm-hero-demo ${resolved ? 'is-resolved' : ''}`}
      role="img"
      aria-label="作品をドロップしてタイムスタンプを発行する流れを示すデモアニメーション"
    >
      {/* アニメーション本体の挿入スロット (背景透過) */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{ pointerEvents: 'none' }}
      >
        {reducedMotion && fallbackImageSrc ? (
          <img
            src={fallbackImageSrc}
            alt=""
            aria-hidden="true"
            decoding="async"
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="relative w-full max-w-[540px] mx-auto h-[320px] flex flex-col items-center justify-center select-none font-sans mt-4 sm:mt-12">
            
            {/* ━━ 浮遊するファイル（ドラッグ＆ドロップの暗示） ━━ */}
            <div className="absolute top-0 w-full flex justify-center z-30 pointer-events-none h-[80px]">
              <AnimatePresence>
                {(phase === 'idle' || phase === 'dropping') && (
                  <motion.div
                    key="floating-file"
                    initial={{ opacity: 0, y: -20, scale: 0.8 }}
                    animate={{ 
                      opacity: phase === 'idle' ? 1 : 0, 
                      y: phase === 'idle' ? [0, -8, 0] : 60,
                      scale: phase === 'idle' ? 1 : 0.6 
                    }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ 
                      y: { repeat: phase === 'idle' ? Infinity : 0, duration: 3, ease: 'easeInOut' },
                      duration: 0.4,
                      ease: appleEase
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                    }}
                  >
                    <FileImage className="w-5 h-5 text-[#6c3ef4]" />
                    <span className="text-xs font-semibold text-[#f0f0fa] tracking-wide">artwork_final.png</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ━━ Dynamic Island モーフィングコンテナ ━━ */}
            <motion.div
              layout
              className="relative flex items-center justify-center overflow-hidden z-20"
              style={{
                background: phase === 'packed' ? 'linear-gradient(135deg, #151d2f 0%, #0a0e27 100%)' : 'rgba(21,29,47,0.7)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
              initial={false}
              animate={{
                width: phase === 'idle' || phase === 'dropping' ? 380 : phase === 'scanning' ? 320 : phase === 'verified' ? 200 : 340,
                height: phase === 'idle' || phase === 'dropping' ? 220 : phase === 'scanning' ? 72 : phase === 'verified' ? 64 : 96,
                borderRadius: phase === 'idle' || phase === 'dropping' ? 32 : phase === 'scanning' || phase === 'verified' ? 64 : 24,
                borderColor: phase === 'verified' ? 'rgba(0,212,170,0.5)' : phase === 'packed' ? 'rgba(108,62,244,0.4)' : 'rgba(108,62,244,0.2)',
                borderWidth: 1,
                boxShadow: phase === 'verified' 
                  ? '0 0 40px rgba(0,212,170,0.15), inset 0 0 20px rgba(0,212,170,0.05)' 
                  : phase === 'packed' 
                  ? '0 20px 40px rgba(0,0,0,0.4), 0 0 30px rgba(108,62,244,0.15)' 
                  : phase === 'scanning'
                  ? '0 0 30px rgba(108,62,244,0.1)'
                  : '0 24px 48px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30, mass: 0.8 }}
            >
              <AnimatePresence mode="wait" custom={phase}>
                
                {/* 1. IDLE / DROPPING: グラスモーフィズム・ドロップゾーン */}
                {(phase === 'idle' || phase === 'dropping') && (
                  <motion.div
                    key="zone"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
                    transition={{ duration: 0.25, ease: appleEase }}
                    className="flex flex-col items-center justify-center w-full h-full relative p-6"
                  >
                    {/* 波紋エフェクト (Dropping時) */}
                    <AnimatePresence>
                      {phase === 'dropping' && (
                        <motion.div
                          className="absolute inset-0 rounded-[32px] border-2 border-[#00d4aa]"
                          initial={{ opacity: 0.8, scale: 0.95 }}
                          animate={{ opacity: 0, scale: 1.1 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      )}
                    </AnimatePresence>

                    <div className="absolute inset-3 border-2 border-dashed border-[#6c3ef4]/30 rounded-[24px] bg-[#6c3ef4]/[0.02]" />
                    
                    <motion.div 
                      animate={{ scale: phase === 'dropping' ? 1.1 : 1 }}
                      className="w-14 h-14 rounded-full bg-[#151d2f] border border-[#2a2a4e] flex items-center justify-center mb-4 z-10 shadow-lg"
                    >
                      <UploadCloud className="w-6 h-6 text-[#a0a0c0]" />
                    </motion.div>
                    <p className="text-[#f0f0fa] text-[15px] font-bold z-10 tracking-tight">Drop to Encrypt</p>
                    <p className="text-[#a0a0c0] text-xs mt-1 z-10">SHA-256 + RFC 3161</p>
                  </motion.div>
                )}

                {/* 2. SCANNING: レーザースキャン・ピル */}
                {phase === 'scanning' && (
                  <motion.div
                    key="scan"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3, ease: appleEase }}
                    className="flex items-center w-full px-6 gap-5"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                    >
                      <Fingerprint className="w-7 h-7 text-[#00d4aa]" />
                    </motion.div>
                    <div className="flex-1 flex flex-col justify-center gap-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#00d4aa]">Certifying...</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#0a0e27] rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-[#00d4aa] to-[#6c3ef4]"
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.5, ease: appleEase }}
                        />
                      </div>
                      <p className="font-mono text-[10px] text-[#a0a0c0] tracking-widest truncate">{hash}</p>
                    </div>
                  </motion.div>
                )}

                {/* 3. VERIFIED: 認証完了（Apple Pay風） */}
                {phase === 'verified' && (
                  <motion.div
                    key="verify"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, filter: 'blur(8px)' }}
                    transition={{ duration: 0.3, ease: appleEase }}
                    className="flex items-center justify-center gap-3 w-full"
                  >
                    <motion.div 
                      initial={{ scale: 0, rotate: -45 }} 
                      animate={{ scale: 1, rotate: 0 }} 
                      transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                      className="bg-[#00d4aa] rounded-full p-1 shadow-[0_0_15px_rgba(0,212,170,0.4)]"
                    >
                      <ShieldCheck className="w-5 h-5 text-[#0a0e27]" />
                    </motion.div>
                    <span className="text-[#00d4aa] font-extrabold text-[15px] tracking-wide">Verified</span>
                  </motion.div>
                )}

                {/* 4. PACKED: 証拠パッケージ生成（重厚感のある通知） */}
                {phase === 'packed' && (
                  <motion.div
                    key="pack"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: appleEase }}
                    className="flex items-center justify-between w-full px-5 py-2"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-[#6c3ef4] blur-md opacity-30 rounded-full animate-pulse" />
                        <div className="relative p-3 bg-[#6c3ef4]/20 rounded-xl border border-[#6c3ef4]/40">
                          <Download className="w-6 h-6 text-[#bc78ff]" />
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[15px] font-bold text-[#f0f0fa] tracking-tight">Evidence_Pack.zip</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Lock className="w-3 h-3 text-[#00d4aa]" />
                          <span className="text-[10px] font-bold text-[#a0a0c0] uppercase tracking-wider">Immutable Record</span>
                        </div>
                      </div>
                    </div>
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="px-3 py-1 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/30"
                    >
                      <span className="text-[10px] font-bold text-[#00d4aa]">READY</span>
                    </motion.div>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
