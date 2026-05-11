import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PM } from '@/components/dashboard/obsidian-tokens';
import {
    PM_Z,
    useKeyboardOpen,
    usePMRoute,
    useScrollPast,
} from '../lib/usePMRoute';

/**
 * MobileActionBar
 * モバイルだけに常駐する Sticky CTA。
 *
 * 仕様:
 *   - md 未満で表示、md 以上は完全非表示（PC レイアウトを 1mm も壊さない）。
 *   - iOS セーフエリア (env(safe-area-inset-bottom)) を吸収。
 *   - 60px スクロール後にスッと出現（初回ロードで唐突に被らない）。
 *   - キーボード起動時は隠れる（フォーム入力を邪魔しない）。
 *   - /dashboard, /auth, /embed 配下では完全に出さない。
 */
export default function MobileActionBar(): JSX.Element | null {
    const { user } = useAuth();
    const { allowStickyCta } = usePMRoute();
    const scrolled = useScrollPast(60);
    const keyboardOpen = useKeyboardOpen();

    if (!allowStickyCta) return null;

    // 認証済みユーザーは「管理画面」CTA、未認証は「無料で始める」CTA
    const ctaHref = user ? '/dashboard' : '/auth?mode=signup';
    const ctaLabel = user ? '管理画面へ進む' : '無料で始める';
    const ctaSub = user ? 'Evidence Pack 管理' : 'クレカ不要・SHA-256 / RFC3161';

    const visible = scrolled && !keyboardOpen;

    return (
        <>
            {/* スクロール下端でフッターと自然な余白を作るためのスペーサー (md 未満のみ) */}
            <div
                aria-hidden
                className="md:hidden"
                style={{ height: 'calc(76px + env(safe-area-inset-bottom))' }}
            />

            <AnimatePresence>
                {visible ? (
                    <motion.div
                        key="mobile-action-bar"
                        className="fixed inset-x-0 bottom-0 md:hidden"
                        style={{ zIndex: PM_Z.mobileActionBar }}
                        initial={{ y: 32, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 32, opacity: 0 }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        role="region"
                        aria-label="モバイル用 主要アクション"
                    >
                        {/* 上端のグラデーション（コンテンツとの境界をふんわり溶かす） */}
                        <div
                            aria-hidden
                            className="pointer-events-none h-6"
                            style={{
                                background: `linear-gradient(180deg, transparent 0%, ${PM.bg} 95%)`,
                            }}
                        />

                        <div
                            className="px-3"
                            style={{
                                paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
                                paddingTop: 8,
                                background: 'rgba(13, 11, 36, 0.78)',
                                backdropFilter: 'blur(14px)',
                                WebkitBackdropFilter: 'blur(14px)',
                                borderTop: `1px solid ${PM.border}`,
                                boxShadow: '0 -12px 32px rgba(0,0,0,0.42)',
                            }}
                        >
                            <div className="flex items-center gap-3">
                                {/* ステータスチップ (微小な信頼シグナル) */}
                                <div
                                    className="hidden flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[11px] font-semibold xs:inline-flex"
                                    style={{
                                        borderColor: 'rgba(0,212,170,0.24)',
                                        background: 'rgba(0,212,170,0.08)',
                                        color: PM.success,
                                    }}
                                >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Evidence
                                </div>

                                {/* CTA (ここがコンバージョンの主役) */}
                                <Link href={ctaHref} className="flex-1">
                                    <button
                                        type="button"
                                        className="group flex h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left font-bold text-white active:scale-[0.98] transition-transform"
                                        style={{
                                            background:
                                                'linear-gradient(135deg, #6C3EF4 0%, #8B61FF 100%)',
                                            boxShadow:
                                                '0 12px 28px rgba(108,62,244,0.42), inset 0 1px 0 rgba(255,255,255,0.18)',
                                        }}
                                        aria-label={ctaLabel}
                                    >
                                        <span className="flex flex-col leading-tight">
                                            <span className="text-[15px]">{ctaLabel}</span>
                                            <span className="text-[10.5px] font-medium tracking-wide text-white/72">
                                                {ctaSub}
                                            </span>
                                        </span>
                                        <ArrowRight
                                            className="h-5 w-5 flex-shrink-0 transition-transform group-active:translate-x-0.5"
                                            aria-hidden
                                        />
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </>
    );
}
