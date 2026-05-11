import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { PM } from '@/components/dashboard/obsidian-tokens';
import {
    PM_Z,
    useKeyboardOpen,
    usePMRoute,
    useScrollPast,
} from '../lib/usePMRoute';

/**
 * ScrollToTopFab
 * フローティング「トップへ戻る」ボタン。
 *
 * - 300px スクロール後、AnimatePresence でフェード+スライドイン。
 * - モバイル時は MobileActionBar の真上に積み、被らないよう offset を切替。
 * - prefers-reduced-motion を尊重 (framer-motion 標準動作で吸収)。
 */
export default function ScrollToTopFab(): JSX.Element | null {
    const { allowStickyCta } = usePMRoute();
    const scrolled = useScrollPast(300);
    const keyboardOpen = useKeyboardOpen();

    // /embed 配下では出さない（埋め込み先で UI を侵食しないため）
    if (!allowStickyCta) return null;

    const handleClick = (): void => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const visible = scrolled && !keyboardOpen;

    return (
        <AnimatePresence>
            {visible ? (
                <motion.button
                    key="scroll-to-top-fab"
                    type="button"
                    onClick={handleClick}
                    aria-label="ページトップへ戻る"
                    className={[
                        'fixed right-4 md:right-6',
                        // モバイル: Sticky CTA(76px) の上、デスクトップ: 通常 24px
                        'bottom-[calc(96px+env(safe-area-inset-bottom))] md:bottom-6',
                        'flex h-11 w-11 md:h-12 md:w-12 items-center justify-center rounded-full',
                        'border focus:outline-none focus-visible:ring-2',
                    ].join(' ')}
                    style={{
                        zIndex: PM_Z.fab,
                        background: 'rgba(13,11,36,0.82)',
                        backdropFilter: 'blur(14px)',
                        WebkitBackdropFilter: 'blur(14px)',
                        borderColor: PM.borderStrong,
                        color: '#FFFFFF',
                        boxShadow:
                            '0 12px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.9 }}
                    transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                >
                    <ArrowUp className="h-5 w-5" aria-hidden />
                </motion.button>
            ) : null}
        </AnimatePresence>
    );
}
