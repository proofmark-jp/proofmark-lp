import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/**
 * usePMRoute
 * Sticky CTA / FAB / Footer がコンテキストごとに振る舞いを変えるための共通判定。
 * 「LP のみ追従」「アプリ画面では引っ込む」「キーボード表示時は退避」を一元管理する。
 */
export interface PMRouteState {
    /** URL パス */
    path: string;
    /** /embed 配下（埋め込み）かどうか */
    isEmbedRoute: boolean;
    /** /dashboard / /admin / /auth など作業領域系ルートかどうか */
    isAppRoute: boolean;
    /** モバイルで Sticky CTA を出して良いルートか */
    allowStickyCta: boolean;
}

const APP_PREFIXES = ['/dashboard', '/admin', '/auth', '/settings', '/spot-issue'];

export function usePMRoute(): PMRouteState {
    const [path] = useLocation();

    const isEmbedRoute = path.startsWith('/embed/');
    const isAppRoute = APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
    const allowStickyCta = !isEmbedRoute && !isAppRoute;

    return { path, isEmbedRoute, isAppRoute, allowStickyCta };
}

/**
 * useViewportHeight
 * iOS Safari の VisualViewport を監視し、
 * 「ソフトキーボードが立ち上がっているか」を判定する。
 * Sticky CTA / FAB がフォームの上に被るのを防ぐ。
 */
export function useKeyboardOpen(): boolean {
    const [open, setOpen] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const vv = window.visualViewport;
        if (!vv) return;

        let maxViewportHeight = vv.height;

        const evaluate = (): void => {
            if (vv.height > maxViewportHeight) {
                maxViewportHeight = vv.height;
            }
            setOpen(vv.height < maxViewportHeight - 80);
        };

        const handleOrientationChange = (): void => {
            setTimeout(() => {
                maxViewportHeight = window.innerHeight;
                evaluate();
            }, 300);
        };

        evaluate();
        vv.addEventListener('resize', evaluate);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            vv.removeEventListener('resize', evaluate);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, []);

    return open;
}

/**
 * useScrollPast
 * 一定 px スクロールしたかを監視するシンプルなフック。
 * passive listener なので 60fps を確実に維持する。
 */
export function useScrollPast(threshold: number): boolean {
    const [past, setPast] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const evaluate = (): void => {
            setPast(window.scrollY > threshold);
        };
        evaluate();
        window.addEventListener('scroll', evaluate, { passive: true });
        return () => window.removeEventListener('scroll', evaluate);
    }, [threshold]);

    return past;
}

/** Z-index 階層の単一定義源。Navbar は 110。これ以上は禁止。 */
export const PM_Z = {
    navbar: 110,
    mobileActionBar: 50,
    fab: 45,
    toast: 60,
} as const;
