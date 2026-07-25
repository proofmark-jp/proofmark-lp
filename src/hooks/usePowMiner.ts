/**
 * src/hooks/usePowMiner.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ProofMark PoW Miner Hook — Vite Worker Bridge / Ref Bypass / Singleton Queue
 *
 * 絶対契約:
 *  1. Worker は Vite ネイティブ構文で生成。
 *  2. hashesPerSec/progress は useState に絶対入れず useRef + RAF で DOM 直書き。
 *  3. 複数ファイルは絶対直列 (GPU Device Lost 防止)。Zustand で queue 管理。
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
    useCallback,
    useEffect,
    useRef,
    MutableRefObject,
} from 'react';
import { create } from 'zustand';
import type {
    PowInboundMessage,
    PowReadyMessage,
    PowProgressMessage,
    PowSolvedMessage,
    PowErrorMessage,
} from '../lib/crypto/miner/pow-worker';

// ── Zustand Queue Store ────────────────────────────────────────────────────────

export interface ForgeJob {
    id: string;
    file: File;
    tgtHash: string;
    devicePub: string;
    difficulty: number;
    nonceStart?: number;
}

export interface ForgeJobResult {
    id: string;
    nonce: number;
    hash: string;
    tried: number;
    tier: string;
    elapsedMs: number;
}

export type ForgeJobStatus =
    | 'queued'
    | 'hashing'   // ファイルハッシュ計算中
    | 'mining'    // PoW 採掘中
    | 'solved'
    | 'failed'
    | 'cancelled';

export interface ForgeQueueItem {
    job: ForgeJob;
    status: ForgeJobStatus;
    result?: ForgeJobResult;
    error?: string;
}

interface ForgeQueueState {
    queue: ForgeQueueItem[];
    activeId: string | null;
    enqueue: (job: ForgeJob) => void;
    markActive: (id: string) => void;
    markStatus: (id: string, status: ForgeJobStatus) => void;
    markSolved: (id: string, result: ForgeJobResult) => void;
    markFailed: (id: string, error: string) => void;
    dequeueNext: () => ForgeQueueItem | null;
    cancel: (id: string) => void;
}

export const useForgeQueue = create<ForgeQueueState>((set, get) => ({
    queue: [],
    activeId: null,

    enqueue: (job) =>
        set((s) => ({
            queue: [...s.queue, { job, status: 'queued' }],
        })),

    markActive: (id) => set({ activeId: id }),

    markStatus: (id, status) =>
        set((s) => ({
            queue: s.queue.map((item) =>
                item.job.id === id ? { ...item, status } : item,
            ),
        })),

    markSolved: (id, result) =>
        set((s) => ({
            activeId: null,
            queue: s.queue.map((item) =>
                item.job.id === id ? { ...item, status: 'solved', result } : item,
            ),
        })),

    markFailed: (id, error) =>
        set((s) => ({
            activeId: null,
            queue: s.queue.map((item) =>
                item.job.id === id ? { ...item, status: 'failed', error } : item,
            ),
        })),

    dequeueNext: () => {
        const { queue, activeId } = get();
        if (activeId) return null; // すでに実行中
        const next = queue.find((item) => item.status === 'queued');
        return next ?? null;
    },

    cancel: (id) =>
        set((s) => ({
            activeId: s.activeId === id ? null : s.activeId,
            queue: s.queue.map((item) =>
                item.job.id === id && item.status !== 'solved'
                    ? { ...item, status: 'cancelled' }
                    : item,
            ),
        })),
}));

// ── DOM Ref Interface for External Display ─────────────────────────────────────

export interface MinerDisplayRefs {
    /** ハッシュレート表示 DOM element */
    hashRateRef: MutableRefObject<HTMLElement | null>;
    /** tried count 表示 DOM element */
    triedRef: MutableRefObject<HTMLElement | null>;
    /** progress 0〜100 表示 DOM element */
    progressRef: MutableRefObject<HTMLElement | null>;
    /** current tier 表示 DOM element */
    tierRef: MutableRefObject<HTMLElement | null>;
}

// ── Worker Singleton Ref ───────────────────────────────────────────────────────

// Worker インスタンスはモジュールレベルで共有 (GPU Device Lost 防止)
let sharedWorker: Worker | null = null;

function getOrCreateWorker(): Worker {
    if (!sharedWorker) {
        // Vite ネイティブ構文: import.meta.url で静的解析可能
        sharedWorker = new Worker(
            new URL('../lib/crypto/miner/pow-worker.ts', import.meta.url),
            { type: 'module' },
        );
    }
    return sharedWorker;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

type SolvedCallback = (result: ForgeJobResult) => void;
type FailedCallback = (id: string, error: string) => void;

/**
 * PoW マイナーフック。
 *
 * - Worker は Vite ネイティブ `new Worker(new URL(...))` 構文で生成。
 * - 進捗表示は displayRefs の DOM を RAF ループで直接書き換える (useState 禁止)。
 * - ジョブは直列処理 (Singleton Queue) — 同時実行は絶対に行わない。
 */
export function usePowMiner(
    displayRefs: MinerDisplayRefs,
    options?: {
        onSolved?: SolvedCallback;
        onFailed?: FailedCallback;
    },
) {
    const { markActive, markStatus, markSolved, markFailed, dequeueNext, cancel } =
        useForgeQueue();

    const workerRef = useRef<Worker | null>(null);
    const rafHandle = useRef<number | null>(null);
    const activeJobId = useRef<string | null>(null);

    // RAF 内で書き込むための pending values (useRef でバッファ)
    const pendingDisplay = useRef({
        hashRate: 0,
        tried: 0,
        progress: 0,
        tier: '',
    });

    // RAF ループ: Worker の進捗を DOM に直接書き込む
    const startRAFLoop = useCallback(() => {
        const loop = () => {
            const p = pendingDisplay.current;
            const { hashRateRef, triedRef, progressRef, tierRef } = displayRefs;

            if (hashRateRef.current) {
                hashRateRef.current.innerText =
                    p.hashRate >= 1_000_000
                        ? `${(p.hashRate / 1_000_000).toFixed(2)} MH/s`
                        : p.hashRate >= 1_000
                        ? `${(p.hashRate / 1_000).toFixed(1)} kH/s`
                        : `${p.hashRate.toFixed(0)} H/s`;
            }
            if (triedRef.current) {
                triedRef.current.innerText = p.tried.toLocaleString('ja-JP');
            }
            if (progressRef.current) {
                progressRef.current.innerText = `${p.progress.toFixed(1)}%`;
            }
            if (tierRef.current && p.tier) {
                tierRef.current.innerText = p.tier.toUpperCase();
            }

            rafHandle.current = requestAnimationFrame(loop);
        };
        rafHandle.current = requestAnimationFrame(loop);
    }, [displayRefs]);

    const stopRAFLoop = useCallback(() => {
        if (rafHandle.current !== null) {
            cancelAnimationFrame(rafHandle.current);
            rafHandle.current = null;
        }
    }, []);

    // Worker メッセージハンドラを設定
    const setupWorker = useCallback(() => {
        const worker = getOrCreateWorker();
        workerRef.current = worker;

        worker.onmessage = (ev: MessageEvent) => {
            const msg = ev.data as
                | PowReadyMessage
                | PowProgressMessage
                | PowSolvedMessage
                | PowErrorMessage;

            if (!msg || typeof msg.type !== 'string') return;

            switch (msg.type) {
                case 'READY': {
                    pendingDisplay.current.tier = msg.tier;
                    break;
                }
                case 'PROGRESS': {
                    pendingDisplay.current.hashRate = msg.hashesPerSec;
                    pendingDisplay.current.tried = msg.tried;
                    // PoW の進捗は tried / (推定総試行数) で近似
                    // difficulty ベースの期待値: 16^difficulty 試行
                    // ここでは tried を表示するのみ (progress は hasher 側で制御)
                    break;
                }
                case 'SOLVED': {
                    stopRAFLoop();
                    const id = activeJobId.current;
                    if (!id) break;

                    const result: ForgeJobResult = {
                        id,
                        nonce: msg.nonce,
                        hash: msg.hash,
                        tried: msg.tried,
                        tier: msg.tier,
                        elapsedMs: msg.elapsedMs,
                    };
                    markSolved(id, result);
                    activeJobId.current = null;
                    options?.onSolved?.(result);

                    // キューの次のジョブを処理
                    processNextJob();
                    break;
                }
                case 'ERROR': {
                    stopRAFLoop();
                    const id = activeJobId.current;
                    if (!id) break;

                    markFailed(id, msg.message);
                    activeJobId.current = null;
                    options?.onFailed?.(id, msg.message);

                    // キューの次のジョブを処理
                    processNextJob();
                    break;
                }
            }
        };

        worker.onerror = (e) => {
            stopRAFLoop();
            const id = activeJobId.current;
            const errorMsg = e.message ?? 'Worker fatal error';
            if (id) {
                markFailed(id, errorMsg);
                activeJobId.current = null;
                options?.onFailed?.(id, errorMsg);
            }
            // Worker を破棄して再生成させる
            sharedWorker?.terminate();
            sharedWorker = null;
            workerRef.current = null;

            processNextJob();
        };

        return worker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [markSolved, markFailed, stopRAFLoop]);

    // 次のジョブを直列処理
    const processNextJob = useCallback(() => {
        const next = dequeueNext();
        if (!next) return;

        const { job } = next;
        activeJobId.current = job.id;
        markActive(job.id);
        markStatus(job.id, 'mining');

        // pendingDisplay をリセット
        pendingDisplay.current = { hashRate: 0, tried: 0, progress: 0, tier: '' };

        startRAFLoop();

        const worker = workerRef.current ?? setupWorker();

        const startMsg: PowInboundMessage = {
            type: 'START',
            signature: '', // 呼び出し元が tgtHash のみでも動作するよう空文字許容
            tgtHash: job.tgtHash,
            devicePub: job.devicePub,
            difficulty: job.difficulty,
            nonceStart: job.nonceStart ?? 0,
            progressIntervalMs: 400,
        };

        worker.postMessage(startMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dequeueNext, markActive, markStatus, setupWorker, startRAFLoop]);

    // 初期化
    useEffect(() => {
        setupWorker();

        return () => {
            stopRAFLoop();
            // コンポーネントアンマウント時にキャンセルのみ送信 (Worker 自体は SharedSingleton なので terminate しない)
            if (activeJobId.current && workerRef.current) {
                workerRef.current.postMessage({ type: 'CANCEL' } satisfies PowInboundMessage);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // queue に queued なジョブが追加されたら自動実行
    useEffect(() => {
        const state = useForgeQueue.getState();
        if (!state.activeId) {
            processNextJob();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── 公開 API ──────────────────────────────────────────────────────────────

    const enqueueJob = useCallback(
        (job: ForgeJob) => {
            useForgeQueue.getState().enqueue(job);
            // Worker が空いていれば即実行
            if (!activeJobId.current) {
                // 次のマイクロタスクで processNextJob (state 更新後)
                Promise.resolve().then(() => processNextJob());
            }
        },
        [processNextJob],
    );

    const cancelJob = useCallback(
        (id: string) => {
            cancel(id);
            if (activeJobId.current === id && workerRef.current) {
                workerRef.current.postMessage({ type: 'CANCEL' } satisfies PowInboundMessage);
                stopRAFLoop();
                activeJobId.current = null;
                processNextJob();
            }
        },
        [cancel, processNextJob, stopRAFLoop],
    );

    const cancelAll = useCallback(() => {
        const { queue } = useForgeQueue.getState();
        for (const item of queue) {
            if (item.status === 'queued' || item.status === 'mining') {
                cancelJob(item.job.id);
            }
        }
    }, [cancelJob]);

    return {
        enqueueJob,
        cancelJob,
        cancelAll,
    };
}
