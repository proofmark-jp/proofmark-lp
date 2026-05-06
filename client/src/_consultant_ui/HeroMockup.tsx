/**
 * src/components/HeroMockup.tsx — Phase 1 (Task D)
 *
 * Hero デモコンテナの「制御レイヤー」。
 * アニメーション本体 (背景透過) は別チームから後日納品される (Lottie JSON
 * または Framer Motion コンポーネント)。本ファイルは:
 *
 *   1. 指定サイズ・背景色のコンテナを保持し、待機時の「回転するグラデー
 *      ションボーダー」を CSS ::before で描画する。
 *   2. 1100ms タイミングで `is-resolved` を付与し、コンテナ背景を
 *      Purple → Teal に滑らかにシフトさせる (感情の遷移)。
 *   3. Intersection Observer でビューポート進入時のみ再生開始。画面外で
 *      停止 + リソース解放 (スマホでの電池消費防止)。
 *   4. prefers-reduced-motion: reduce のユーザーには **アニメーションを
 *      スキップし即時 resolved 状態の静止 UI** を表示。
 *
 * ▼ 連携プロトコル (アセット納品後)
 *
 *   - Lottie の場合 (推奨):
 *       import lottie from 'lottie-web';
 *       lottie.loadAnimation({ container, animationData, autoplay: false, loop: true });
 *       isInView && !reducedMotion ? lottie.play() : lottie.stop();
 *
 *   - Framer Motion コンポーネントの場合:
 *       import HeroDemoMotion from './lp/HeroDemoMotion';
 *       <HeroDemoMotion playing={isInView && !reducedMotion} onResolved={() => setResolved(true)} />
 *
 *   いずれの場合も「親コンテナの背景色」「ボーダー」「Resolved への遷移」は
 *   この React 側で制御する。アニメーション本体は背景透過のまま中央に重ねる。
 */

import { useEffect, useRef, useState } from 'react';

interface HeroMockupProps {
  /** Lottie / Motion アセットが納品されたら、ここに children として差し込む。 */
  children?: React.ReactNode;
  /** Resolved 状態に遷移するまでの時間 (ms). 仕様書 Task D: 1100ms */
  resolveDelayMs?: number;
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
  children,
  resolveDelayMs = 1100,
  fallbackImageSrc,
}: HeroMockupProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [isInView, setIsInView] = useState(false);
  const [resolved, setResolved] = useState(false);

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

  /* Resolve タイミング制御
   *  - reducedMotion=true: 即座に resolved
   *  - そうでなければ in-view で 1100ms 後に resolved
   *  - in-view を抜けたら resolved を維持 (一度感情が解決したら戻さない)
   */
  useEffect(() => {
    if (reducedMotion) {
      setResolved(true);
      return;
    }
    if (resolved) return;
    if (!isInView) return;
    const id = window.setTimeout(() => setResolved(true), resolveDelayMs);
    return () => window.clearTimeout(id);
  }, [isInView, reducedMotion, resolveDelayMs, resolved]);

  /* アセット側に再生制御を渡すための data 属性
   *  - data-pm-playing: "true" / "false"
   *  - data-pm-reduced: "true" / "false"
   * 子コンポーネント (Lottie / Motion) はこれを読み取って再生制御する。 */
  const playing = isInView && !reducedMotion;

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
          children ?? <Placeholder />
        )}
      </div>
    </div>
  );
}

/**
 * 受け入れ準備用のプレースホルダ。
 * アセット未納品の現時点では、コンテナ背景・回転ボーダー・1100ms 遷移だけが
 * 動作する。これは確認用の最小マーカで、本番では children に置き換わる。
 */
function Placeholder() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center"
      style={{ color: 'rgba(255,255,255,0.32)' }}
    >
      <div
        className="flex flex-col items-center gap-3 px-6 text-center"
        style={{ letterSpacing: '0.12em', textTransform: 'uppercase' }}
      >
        <div
          className="h-12 w-12 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #6C3EF4 0%, #00D4AA 100%)',
            opacity: 0.85,
            filter: 'blur(0.5px)',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 600 }}>
          Awaiting Motion Asset
        </span>
      </div>
    </div>
  );
}
