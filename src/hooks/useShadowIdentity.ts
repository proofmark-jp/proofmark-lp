/**
 * src/hooks/useShadowIdentity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ProofMark Shadow Identity React Hook
 *
 * 絶対契約:
 *  1. Reactマウント直後 setTimeout(..., 1000) でアイドル先読みを起動。
 *  2. HardBlockError は致命的状態として伝播し、UIが物理的に遮断する。
 *  3. 正常系: identity が null の間はローディング状態として扱う。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';
import { loadOrCreateIdentity, HardBlockError, ShadowIdentity } from '../lib/crypto/identity';

export type ShadowIdentityStatus =
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'ready'; identity: ShadowIdentity }
    | { phase: 'hard-block'; reason: string };

/**
 * Shadow Identity を管理する React Hook。
 *
 * - マウント後 1000ms のタイムアウトで先読み初期化を開始する。
 * - Web Locks / IDB / storage.persist() の失敗時は `hard-block` フェーズに遷移。
 * - `hard-block` を受け取ったコンポーネントは利用停止画面を表示すること。
 */
export function useShadowIdentity(): ShadowIdentityStatus {
    const [status, setStatus] = useState<ShadowIdentityStatus>({ phase: 'idle' });
    const initStarted = useRef(false);

    useEffect(() => {
        if (initStarted.current) return;

        const timerHandle = setTimeout(async () => {
            if (initStarted.current) return;
            initStarted.current = true;

            setStatus({ phase: 'loading' });

            try {
                const identity = await loadOrCreateIdentity();
                setStatus({ phase: 'ready', identity });
            } catch (e: unknown) {
                if (e instanceof HardBlockError) {
                    setStatus({ phase: 'hard-block', reason: e.message });
                } else {
                    // 予期しないエラーも Hard Block として扱う
                    const msg =
                        e instanceof Error
                            ? e.message
                            : '不明なエラーにより鍵の初期化に失敗しました。';
                    setStatus({ phase: 'hard-block', reason: msg });
                }
            }
        }, 1000);

        return () => {
            clearTimeout(timerHandle);
        };
    }, []);

    return status;
}
