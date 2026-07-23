// ============================================================================
//  ProofMark Enterprise System: Certificate Client (The Absolute Apex - Part 1)
//  Architecture: React 18, Next.js App Router, Supabase SSR, i18n, Zero-Knowledge
// ============================================================================

"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { createBrowserClient } from '@supabase/ssr';
import { QRCodeSVG } from 'qrcode.react';
import {
    CheckCircle, Clock, ShieldCheck, Copy, Check, FileText,
    Lock, ShieldAlert, Flag, Gavel, Sparkles, ChevronRight, Layers3,
    RefreshCw, Maximize2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';

// Component & Hook Imports
import Navbar from '../../../client/src/components/Navbar';
import VerifiedBadge from '../../../client/src/components/ui/VerifiedBadge';
import { ContentCredentialsSection } from '../../../client/src/components/cert/ContentCredentialsSection';
import VerifyDropzone from '@/components/VerifyDropzone';
import { useSafeReducedMotion } from '@/hooks/useSafeReducedMotion';
import { useAuth } from '@/hooks/useAuth';

// Types & Utils
import type { ProcessBundlePublic } from '../../../client/src/lib/proofmark-types';
import { getC2paSummary } from '../../../client/src/lib/c2pa-schema';
import type { CertificateInitialData } from './page';

// CSS Modules (生の<style>タグを完全駆逐しHydration Mismatchを根絶)
import styles from './CertificateClient.module.css';

// ══════════════════════════════════════════════════════════════════
//  Dynamic Imports (SSR Crash Isolation)
// ══════════════════════════════════════════════════════════════════
const TakedownNoticeModal = dynamic(
    () => import('@/components/proof/TakedownNoticeModal'),
    { ssr: false }
);

const EvidencePackDownloadButton = dynamic(
    () => import('@/components/EvidencePackDownloadButton'),
    { ssr: false }
);

// ══════════════════════════════════════════════════════════════════
//  Theatrical Animation Tokens
// ══════════════════════════════════════════════════════════════════
const PM_EASE = [0.16, 1, 0.3, 1] as const;

// ══════════════════════════════════════════════════════════════════
//  i18n Dictionary (国際化・汎用化の完全適用)
// ══════════════════════════════════════════════════════════════════
const I18N = {
    ja: {
        errors: {
            notFoundTitle: '証明書が見つかりません',
            suspendedTitle: 'この証明書は凍結されています',
            suspendedDesc: '利用規約違反、または第三者からの権利侵害の申し立てにより、この証明書の公開は一時的または恒久的に停止されています。',
            backToTop: 'トップに戻る',
        },
        labels: {
            verified: 'VERIFIED',
            c2paVerified: 'C2PA VERIFIED',
            founder: 'FOUNDER',
            certId: 'Certificate ID',
            protectedAsset: 'Protected Asset',
            hashSignature: 'SHA-256 Hash Signature',
            timestampJst: 'Digital Timestamp (JST)',
            rfc3161Verified: 'RFC3161 Verified',
            timestamping: 'Timestamping...',
            retryTimestamp: 'Retry Timestamp',
            scanToVerify: 'Scan to Verify',
            tamperProofMsg: '改ざん不能な技術で真正性が担保されています',
            galleryLink: (username: string) => `👤 @${username} の公開ギャラリーを見る`,
        },
        actions: {
            shareOnX: 'Xで証明をシェア',
            unlockEvidence: 'PDF・Evidence Pack をロック解除',
            creatorPlanOnly: 'Creatorプラン限定',
            reportAbuse: '違法・悪質なコンテンツを通報する (Report Abuse)',
            generateTakedown: '法的削除要請書 (PDF) を作成する',
            copy: 'コピーする',
            copied: 'コピー完了！',
            manualCopyPrompt: '以下のテキストを選択してコピーしてください（Ctrl+C）:',
            close: '閉じる',
        },
        share: {
            xText: 'デジタル資産の存在証明を『ProofMark』で取得しました。\n無断転載等の不正利用を防止し、オリジナリティを暗号学的に保護しています。',
            hashtags: 'ProofMark,デジタル存在証明',
        },
        ownerSection: {
            title: '💡 クライアント・提出先向け 説明テンプレート',
            desc: '用途に合わせて以下のテキストをコピーし、納品時やSNSでの公開時にご活用ください。',
            formalLabel: '▼ 納品・コンテスト提出用（フォーマル）',
            snsLabel: '▼ SNS公開用（無断転載・自作発言対策）',
            legalLabel: '▼ 無断転載への法的措置（DMCA / 送信防止措置）',
            legalDesc: 'プラットフォーム（X, Google等）に対して、送信防止措置（DMCA等）の法的要件を満たした削除要請書を即時生成します。',
        },
        provenance: {
            title: '制作プロセスは、暗号証明されています。',
            desc: 'プロセス全体の各工程が SHA-256 でハッシュチェーンされ、RFC3161 タイムスタンプで改ざん不能に保全されています。← → でスクロールしてご確認ください。',
            badge: 'TRANSPARENCY',
            origin: '起点',
            step: '工程',
            final: '完成',
            delivered: 'Delivered',
            chainMsg: '各ステップは前ステップのハッシュとチェーンされています',
            head: 'HEAD',
        },
        vault: {
            purgedTitle: '原本ストレージ期間終了',
            purgedDesc: '保存期間が終了したため、表示用の原本ファイルはサーバーから完全に削除されました（ハッシュ台帳は永久に保護されます）。',
            ownerPreview: 'Owner Preview',
            ndaProtected: 'NDA Protected',
            ownerView: 'Owner View',
            sealedMsg: 'この作品は機密保持契約（NDA）に基づき、ゼロ知識封印が施されています。原本は送信されておらず、暗号学的ハッシュのみが保全されています。',
            confidentialProof: 'Confidential Proof',
        }
    }
} as const;

const t = I18N.ja;

// ══════════════════════════════════════════════════════════════════
//  Component Interface
// ══════════════════════════════════════════════════════════════════
type Props = {
    initialData: CertificateInitialData;
    certId: string;
};

type TsaStatus = 'idle' | 'syncing' | 'synced' | 'failed';

export default function CertificateClient({ initialData, certId }: Props) {
    const router = useRouter();
    const reduce = useSafeReducedMotion();

    const { user, signOut } = useAuth();

    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

    // State Initialization
    const [cert, setCert] = useState(initialData.cert);
    const authorProfile = initialData.authorProfile;
    const bundle = (initialData.bundle ? initialData.bundle : null) as unknown as ProcessBundlePublic | null;
    
    // UI Interaction States
    const [isHashCopied, setIsHashCopied] = useState(false);
    const [copiedType, setCopiedType] = useState<string | null>(null);
    const [isTakedownOpen, setTakedownOpen] = useState(false);
    const [tsaStatus, setTsaStatus] = useState<TsaStatus>('idle');
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [fallbackModalText, setFallbackModalText] = useState<string | null>(null);

    // 🚨 妥協の排除: 権限判定はサーバーが渡した boolean に絶対服従
    const isOwner = cert.is_owner;
    const isPremiumUnlocked = cert.is_premium_unlocked;
    const isAnonymous = !authorProfile;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://proofmark.jp';
    const verifyUrl = `${baseUrl}/cert/${certId}`;

    const c2pa = useMemo(() => getC2paSummary(cert.c2pa_manifest), [cert.c2pa_manifest]);

    // 🚨 妥協の排除: React 18 / StrictModeの二重課金を物理封鎖するミュータブル排他制御Ref
    const isSyncingRef = useRef(false);

    // ═══════════════════════════════════════════════════════════════
    //  The Apex Realtime Engine (Self-Healing & Page Visibility Aware)
    // ═══════════════════════════════════════════════════════════════
    const triggerTsaSync = useCallback(async (currentCertId: string, sha256: string) => {
        if (!isOwner || isSyncingRef.current) return;
        isSyncingRef.current = true;
        setTsaStatus('syncing');

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 15000); // 15秒タイムアウト

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) { 
                isSyncingRef.current = false;
                setTsaStatus('failed'); 
                return; 
            }

            const res = await fetch('/api/timestamp', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ certId: currentCertId, hash: sha256 }),
                signal: abortController.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok && res.status !== 409) {
                setTsaStatus('failed');
            }
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('[TSA Engine] Timestamp request error:', error);
                setTsaStatus('failed');
            }
        } finally {
            isSyncingRef.current = false;
        }
    }, [supabase, isOwner]);

    // リアルタイムリスナーの登録（Page Visibility API & Zombie Tab 対策統合）
    useEffect(() => {
        if (cert.tsr_token_base64 || !cert.sha256_hash || !isOwner) {
            if (cert.tsr_token_base64) setTsaStatus('synced');
            return;
        }

        let channel: any = null;

        const setupSubscription = () => {
            if (document.hidden || channel) return;

            channel = supabase
                .channel(`public:certificates:id=eq.${certId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'certificates',
                        filter: `id=eq.${certId}`,
                    },
                    (payload) => {
                        const updatedTsrToken = payload.new.tsr_token_base64;
                        const updatedCertifiedAt = payload.new.certified_at;

                        if (updatedTsrToken) {
                            setCert((prev) => ({
                                ...prev,
                                tsr_token_base64: updatedTsrToken,
                                timestamp_jst: updatedCertifiedAt 
                                    ? new Date(updatedCertifiedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
                                    : prev.timestamp_jst
                            }));
                            setTsaStatus('synced');
                        }
                    }
                )
                .subscribe();
        };

        const teardownSubscription = () => {
            if (channel) {
                supabase.removeChannel(channel);
                channel = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                teardownSubscription();
            } else {
                setupSubscription();
            }
        };

        setupSubscription();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 60秒経過しても完了しない場合のセーフティタイムアウト
        const selfHealingTimer = setTimeout(() => {
            if (tsaStatus === 'syncing') {
                setTsaStatus('failed');
            }
        }, 60000);

        return () => {
            clearTimeout(selfHealingTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            teardownSubscription();
        };
    }, [certId, cert.tsr_token_base64, cert.sha256_hash, isOwner, supabase, tsaStatus]);

    // 自動発火
    useEffect(() => {
        if (!isOwner || cert.tsr_token_base64 || tsaStatus !== 'idle' || !cert.sha256_hash) return;
        triggerTsaSync(certId, cert.sha256_hash);
    }, [isOwner, cert.tsr_token_base64, tsaStatus, cert.sha256_hash, certId, triggerTsaSync]);

    const handleRetry = useCallback(() => {
        if (cert.tsr_token_base64) return;
        triggerTsaSync(certId, cert.sha256_hash);
    }, [cert.tsr_token_base64, certId, cert.sha256_hash, triggerTsaSync]);

    // ═══════════════════════════════════════════════════════════════
    //  UX Actions (In-App Browser & Share API Resilient Fallbacks)
    // ═══════════════════════════════════════════════════════════════
    const handleReportAbuse = () => {
        const subject = encodeURIComponent(`【通報】違法・悪質なコンテンツについて (ID: ${certId})`);
        const body = encodeURIComponent(
            `以下の証明書ページにて、違法または悪質なコンテンツを確認しました。\n\n` +
            `証明書URL: ${verifyUrl}\n\n` +
            `通報の理由（詳細をご記入ください）:\n`
        );
        window.location.href = `mailto:support@proofmark.jp?subject=${subject}&body=${body}`;
    };

    const handleHashCopy = useCallback(async () => {
        if (!cert.sha256_hash) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(cert.sha256_hash);
                setIsHashCopied(true);
                setTimeout(() => setIsHashCopied(false), 2000);
            } else {
                setFallbackModalText(cert.sha256_hash);
            }
        } catch (err) {
            setFallbackModalText(cert.sha256_hash);
        }
    }, [cert.sha256_hash]);

    const handleCopy = useCallback(async (textToCopy: string, type: string) => {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
                setCopiedType(type);
                setTimeout(() => setCopiedType(null), 2000);
            } else {
                setFallbackModalText(textToCopy);
            }
        } catch (err) {
            setFallbackModalText(textToCopy);
        }
    }, []);

    const shareOnX = useCallback(async () => {
        const text = t.share.xText;
        const url = verifyUrl;
        const hashtags = t.share.hashtags;

        // Web Share API (モバイルアプリ内ブラウザでの極限フォールバック)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: cert.title,
                    text: text,
                    url: url,
                });
                return;
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    console.warn('Web Share API aborted or failed, falling back to Intent:', err);
                } else {
                    return;
                }
            }
        }

        const encodedText = encodeURIComponent(text);
        const encodedUrl = encodeURIComponent(url);
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}&hashtags=${hashtags}`, '_blank', 'noopener,noreferrer');
    }, [verifyUrl, cert.title]);

    // Derived Display Values
    const hasVisualAsset = !cert.is_asset_purged &&
        cert.proof_mode === 'shareable' &&
        cert.thumbnail_data_url &&
        (cert.visibility === 'public' || isOwner);

    const secureImageUrl = cert.thumbnail_data_url || '';

    const templateFormal = `納品データ一式をお送りいたします。本作品は当方が制作したオリジナル作品です。制作日時および元データの同一性を担保するため、『ProofMark』にて存在証明を取得・保全しております。\n証明書URL: ${verifyUrl}`;
    const templateSNS = `本作品の制作日時とオリジナルデータは『ProofMark』にて改ざん不能な状態で証明・保全されています。無断転載や自作発言等の不正利用はお控えください。\n証明書URL: ${verifyUrl}`;

    // Guard Clauses
    if (!initialData.cert) {
        return (
            <div className="min-h-screen bg-[#07061A] text-white flex flex-col justify-center items-center gap-6 print:bg-white print:text-black">
                <ShieldCheck className="w-16 h-16 text-slate-600" />
                <h1 className="text-xl font-bold tracking-widest">{t.errors.notFoundTitle}</h1>
                <Link href="/" className="text-[#00D4AA] hover:text-white transition-colors border-b border-[#00D4AA] pb-1 print:hidden">
                    {t.errors.backToTop}
                </Link>
            </div>
        );
    }

    if (cert.moderation_status === 'suspended') {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-red-950/20 border border-red-900/50 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-red-400 mb-2">{t.errors.suspendedTitle}</h2>
                    <p className="text-sm text-slate-400">
                        {t.errors.suspendedDesc}
                    </p>
                </div>
            </div>
        );
    }
    // ═══════════════════════════════════════════════════════════════
    //  The Apex Render (Middle Part - UI Chassis, Lightbox & Fallbacks)
    // ═══════════════════════════════════════════════════════════════
    return (
        <>
            {/* 🚨 妥協の排除: In-App Browser用 クリップボード手動フォールバックUI */}
            <AnimatePresence>
                {fallbackModalText && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-[#0f1629] border border-[#2a2a4e] rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                        >
                            <button
                                onClick={() => setFallbackModalText(null)}
                                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h3 className="text-[#00D4AA] font-bold mb-3 flex items-center gap-2">
                                <FileText className="w-5 h-5" />
                                手動コピーのお願い
                            </h3>
                            <p className="text-sm text-[#A8A0D8] mb-4">
                                {t.actions.manualCopyPrompt}
                            </p>
                            <textarea
                                readOnly
                                autoFocus
                                onFocus={(e) => e.target.select()}
                                value={fallbackModalText}
                                className="w-full h-32 bg-[#0a0e1a] border border-[#1a233a] rounded-lg p-3 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#00D4AA]/50 resize-none"
                            />
                            <button
                                onClick={() => setFallbackModalText(null)}
                                className="mt-4 w-full bg-[#1a233a] hover:bg-[#2a3655] text-white font-bold py-3 rounded-xl transition-colors border border-[#2a2a4e]"
                            >
                                {t.actions.close}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 🚨 妥協の排除: 証拠画像の原寸大検証用 Lightbox Modal */}
            <AnimatePresence>
                {lightboxUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setLightboxUrl(null)}
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl cursor-zoom-out p-4 sm:p-10"
                    >
                        <button
                            onClick={() => setLightboxUrl(null)}
                            className="absolute top-6 right-6 p-3 text-white/70 hover:text-white bg-black/50 hover:bg-white/10 rounded-full transition-colors border border-white/10 z-10"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <motion.div
                            initial={{ scale: 0.95 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.95 }}
                            className="relative w-full h-full max-w-7xl max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()} // 画像クリックでは閉じない
                        >
                            <Image
                                src={lightboxUrl}
                                alt={cert.title}
                                fill
                                className="object-contain"
                                unoptimized={true}
                            />
                        </motion.div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono tracking-widest uppercase pointer-events-none">
                            Original Aspect Ratio Protected
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="min-h-screen bg-[#07061A] text-[#F0EFF8] flex flex-col items-center py-10 px-4 sm:px-8 font-sans print:min-h-0 print:bg-white print:py-0 print:px-0 relative overflow-x-hidden">

                {/* ═══════════ Abyss Aura (background) ═══════════ */}
                <div aria-hidden className="print:hidden pointer-events-none fixed inset-0 -z-0 overflow-hidden">
                    <motion.div
                        className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#6C3EF4] opacity-[0.10] blur-[160px]"
                        style={{ willChange: 'opacity, transform' }}
                        animate={{ opacity: [0.07, 0.13, 0.07], scale: [1, 1.04, 1] }}
                        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-[#00D4AA] opacity-[0.10] blur-[160px]"
                        style={{ willChange: 'opacity, transform' }}
                        animate={{ opacity: [0.07, 0.13, 0.07], scale: [1, 1.05, 1] }}
                        transition={{ duration: 9, delay: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#F0BB38] opacity-[0.04] blur-[140px]"
                        style={{ willChange: 'opacity' }}
                        animate={{ opacity: [0.02, 0.06, 0.02] }}
                        transition={{ duration: 10, delay: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div
                        className="absolute inset-0 opacity-[0.025] print:hidden"
                        style={{
                            backgroundImage:
                                'linear-gradient(0deg, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                            backgroundSize: '48px 48px',
                            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
                        }}
                    />
                </div>

                <Navbar user={user} signOut={signOut} />

                {/* ═══════════ Certificate Card ═══════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: PM_EASE }}
                    className={`${styles.printCompact} w-full max-w-5xl relative overflow-hidden rounded-3xl print:w-full print:max-w-none print:break-inside-avoid`}
                    style={{
                        background:
                            'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 55%, rgba(7,6,26,0.85) 100%), #0D0B24',
                        border: '1px solid rgba(255,255,255,0.10)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow:
                            '0 0 0 1px rgba(255,255,255,0.03) inset, 0 40px 100px -40px rgba(108,62,244,0.45), 0 24px 70px -30px rgba(0,212,170,0.22)',
                        padding: 'clamp(2rem, 4vw, 3rem)',
                    }}
                >
                    <div
                        aria-hidden
                        className="print:hidden absolute inset-x-8 top-0 h-px"
                        style={{
                            background:
                                'linear-gradient(90deg, transparent, rgba(108,62,244,0.85), rgba(0,212,170,0.85), rgba(240,187,56,0.6), transparent)',
                        }}
                    />

                    <CornerBracket pos="tl" />
                    <CornerBracket pos="tr" />
                    <CornerBracket pos="bl" />
                    <CornerBracket pos="br" />

                    <div className="w-full relative z-10">
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 border-b border-white/[0.08] pb-6 print:border-gray-300">
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-[#A8A0D8] mb-3 print:text-gray-500">
                                    ProofMark · Verifiable Existence
                                </p>
                                <h1
                                    className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tighter mb-2 leading-tight print:text-black"
                                    style={{ fontFamily: '"Poppins", "Inter", sans-serif' }}
                                >
                                    CERTIFICATE OF<br />AUTHENTICITY
                                </h1>
                                <p className="text-[#A8A0D8] font-bold text-sm tracking-widest uppercase print:text-gray-500">ProofMark Digital Existence Certificate</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <BreathingBadge
                                    color="#00D4AA"
                                    rgb="0,212,170"
                                    icon={<ShieldCheck className="w-4 h-4" />}
                                    label={t.labels.verified}
                                    printClass="print:bg-teal-50 print:border-teal-500 print:text-teal-700"
                                />

                                {c2pa.present && (
                                    <BreathingBadge
                                        color="#BC78FF"
                                        rgb="188,120,255"
                                        icon={<ShieldCheck className="w-4 h-4" />}
                                        label={t.labels.c2paVerified}
                                        printClass="print:bg-purple-50 print:border-purple-500 print:text-purple-700"
                                    />
                                )}

                                {authorProfile?.is_founder && (
                                    <BreathingBadge
                                        color="#F0BB38"
                                        rgb="240,187,56"
                                        icon={
                                            <>
                                                <Image src="/proofmark-badge-founder.svg" alt="Founder" width={16} height={16} className="print:hidden" unoptimized />
                                                <span className="hidden print:inline-block w-4 h-4 text-center leading-4">🚀</span>
                                            </>
                                        }
                                        label={t.labels.founder}
                                        printClass="print:bg-amber-50 print:border-amber-500 print:text-amber-700"
                                    />
                                )}
                            </div>
                            {authorProfile?.username && (
                                <div className="mt-4 no-print text-center lg:text-left">
                                    <Link href={`/u/${authorProfile.username}`}>
                                        <motion.span
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="inline-flex items-center gap-2 text-sm font-bold text-[#00D4AA] hover:text-white transition-colors cursor-pointer bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-4 py-2 rounded-full"
                                            style={{ boxShadow: '0 0 24px rgba(0,212,170,0.15)' }}
                                        >
                                            {t.labels.galleryLink(authorProfile.username)}
                                        </motion.span>
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col lg:flex-row gap-10 print:flex-row print:gap-8 print:items-center">

                            {/* 🚨 妥協の排除: アートワーク (Blurred Backdrop + object-contain + Lightbox) */}
                            <div className="w-full lg:w-2/5 flex-shrink-0 print:w-[38%] relative">
                                <div
                                    className="aspect-square w-full rounded-2xl flex flex-col items-center justify-center overflow-hidden relative shadow-inner print:border-gray-300 print:bg-gray-50 print:shadow-none group"
                                    style={{
                                        background: '#07061A',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        boxShadow: hasVisualAsset
                                            ? '0 30px 80px -30px rgba(0,212,170,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset'
                                            : '0 30px 80px -30px rgba(240,187,56,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset',
                                        isolation: 'isolate',
                                    }}
                                >
                                    {hasVisualAsset && (
                                        <motion.div
                                            aria-hidden
                                            className="print:hidden absolute -inset-6 rounded-[28px] blur-3xl pointer-events-none -z-10"
                                            style={{
                                                background:
                                                    'radial-gradient(ellipse at 50% 80%, rgba(0,212,170,0.35) 0%, transparent 60%), radial-gradient(ellipse at 50% 20%, rgba(108,62,244,0.25) 0%, transparent 55%)',
                                                willChange: 'opacity',
                                            }}
                                            animate={{ opacity: [0.7, 1, 0.7] }}
                                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                                        />
                                    )}

                                    {cert.is_asset_purged === true ? (
                                        <PurgedVaultFull />
                                    ) : hasVisualAsset ? (
                                        <motion.div
                                            className="relative w-full h-full cursor-zoom-in"
                                            onClick={() => setLightboxUrl(secureImageUrl)}
                                            initial={{ opacity: 0, scale: 1.02 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.8, ease: PM_EASE }}
                                        >
                                            <Image
                                                src={secureImageUrl}
                                                alt={cert.title}
                                                fill
                                                className="object-cover opacity-30 blur-2xl scale-110 -z-10"
                                                unoptimized={true}
                                                aria-hidden="true"
                                            />
                                            <Image
                                                src={secureImageUrl}
                                                alt={cert.title}
                                                fill
                                                className="object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                                                unoptimized={true}
                                            />
                                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 shadow-lg">
                                                <Maximize2 className="w-4 h-4 text-white" />
                                            </div>
                                        </motion.div>
                                    ) : isOwner && secureImageUrl ? (
                                        <TranslucentVaultFull imageUrl={secureImageUrl} />
                                    ) : isOwner ? (
                                        <OwnerVaultFull />
                                    ) : (
                                        <SealedStampVault />
                                    )}
                                </div>

                                <VerifiedBadge isMasked={cert.visibility !== 'public'} reduce={reduce} />
                            </div>

                            {/* 右側: data */}
                            <div className="w-full lg:w-3/5 flex flex-col justify-center space-y-6 print:w-[62%] print:space-y-4">
                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1 print:text-gray-500">{t.labels.certId}</p>
                                    <p className="font-mono text-xs sm:text-sm text-white/85 print:text-black">{cert.id}</p>
                                </div>

                                <div>
                                    <p className="text-[10px] sm:text-xs font-bold text-[#A8A0D8] uppercase tracking-widest mb-1 flex items-center gap-1 print:text-gray-500">
                                        <FileText className="w-3 h-3" /> {t.labels.protectedAsset}
                                    </p>
                                    <p className="font-medium text-sm sm:text-base text-white print:text-black">
                                        {cert.title}
                                    </p>
                                </div>

                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.2, ease: PM_EASE }}
                                    className="relative p-4 sm:p-5 rounded-2xl group overflow-hidden print:bg-none print:bg-gray-50 print:border-gray-300 print:shadow-none"
                                    style={{
                                        background:
                                            'linear-gradient(135deg, rgba(0,212,170,0.10) 0%, rgba(0,212,170,0) 70%)',
                                        border: '1px solid rgba(0,212,170,0.28)',
                                        boxShadow: '0 0 0 1px rgba(0,212,170,0.04) inset',
                                    }}
                                >
                                    <div
                                        aria-hidden
                                        className="print:hidden absolute -inset-px rounded-2xl pointer-events-none"
                                        style={{
                                            background:
                                                'conic-gradient(from var(--a, 0deg), transparent 0deg, rgba(0,212,170,0.4) 60deg, transparent 120deg, transparent 360deg)',
                                            opacity: 0.18,
                                        }}
                                    />
                                    <div className="relative">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="w-4 h-4 text-[#00D4AA] print:text-teal-600" />
                                            <h2 className="text-[10px] sm:text-xs font-bold text-[#00D4AA] uppercase tracking-widest print:text-teal-700">{t.labels.hashSignature}</h2>
                                        </div>
                                        <p className="font-mono text-[#F0EFF8] text-[10px] sm:text-xs break-all pr-8 leading-relaxed print:text-gray-800">{cert.sha256_hash}</p>
                                        <button
                                            onClick={handleHashCopy}
                                            className="print:hidden absolute top-1/2 -translate-y-1/2 right-0 p-2 rounded-lg bg-[#00D4AA]/10 hover:bg-[#00D4AA]/25 transition-colors"
                                            aria-label="ハッシュをコピー"
                                        >
                                            {isHashCopied ? <CheckCircle className="w-4 h-4 text-[#00D4AA]" /> : <Copy className="w-4 h-4 text-[#00D4AA]" />}
                                        </button>
                                    </div>
                                </motion.div>

                                <div className="flex flex-row gap-6 items-center justify-between border-t border-white/[0.08] pt-6 print:border-gray-300 print:pt-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock className="w-4 h-4 text-[#F0BB38] print:text-yellow-600" />
                                            <h2 className="text-[10px] sm:text-xs font-bold text-[#F0BB38] uppercase tracking-widest print:text-gray-600">{t.labels.timestampJst}</h2>
                                        </div>
                                        <p
                                            className="text-xl sm:text-2xl font-bold text-white tracking-tight print:text-black"
                                            style={{ fontVariantNumeric: 'tabular-nums' }}
                                        >
                                            {cert.timestamp_jst}
                                        </p>
                                        
                                        {cert.tsr_token_base64 ? (
                                            <motion.div
                                                className="mt-2 flex items-center space-x-1.5 text-[#00D4AA] bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-3 py-1 rounded-full w-fit print:bg-teal-50 print:border-teal-200 print:text-teal-700"
                                                initial={tsaStatus === 'synced' ? { scale: 0.8, opacity: 0 } : false}
                                                animate={{
                                                    scale: 1,
                                                    opacity: 1,
                                                    boxShadow: [
                                                        '0 0 0 0 rgba(0,212,170,0.5)',
                                                        '0 0 0 6px rgba(0,212,170,0)',
                                                        '0 0 0 0 rgba(0,212,170,0.5)',
                                                    ],
                                                }}
                                                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-black tracking-widest uppercase">
                                                    {t.labels.rfc3161Verified}
                                                </span>
                                            </motion.div>
                                        ) : tsaStatus === 'syncing' ? (
                                            <div className={`mt-2 flex items-center space-x-1.5 text-[#F0BB38] bg-[#F0BB38]/10 border border-[#F0BB38]/30 px-3 py-1 rounded-full w-fit ${styles.tsaSyncing}`}>
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </motion.div>
                                                <span className="text-[10px] font-black tracking-widest uppercase">
                                                    {t.labels.timestamping}
                                                </span>
                                            </div>
                                        ) : tsaStatus === 'failed' && isOwner ? (
                                            <button
                                                onClick={handleRetry}
                                                className="mt-2 flex items-center space-x-1.5 text-[#A8A0D8] hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-1 rounded-full w-fit transition-all cursor-pointer group"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                                                <span className="text-[10px] font-bold tracking-widest uppercase">
                                                    {t.labels.retryTimestamp}
                                                </span>
                                            </button>
                                        ) : null}
                                        <p className="text-[10px] sm:text-xs text-[#A8A0D8] mt-1 print:text-gray-500">{t.labels.tamperProofMsg}</p>
                                    </div>

                                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                        <div
                                            className="p-2 sm:p-3 bg-white rounded-xl border border-gray-100 print:shadow-none print:border-gray-300"
                                            style={{ boxShadow: '0 8px 24px rgba(0,212,170,0.18)' }}
                                        >
                                            <QRCodeSVG
                                                value={verifyUrl}
                                                size={70}
                                                bgColor={"#ffffff"}
                                                fgColor={"#000000"}
                                                level={"M"}
                                                includeMargin={false}
                                            />
                                        </div>
                                        <span className="text-[8px] sm:text-[10px] font-bold text-[#A8A0D8] tracking-widest uppercase print:text-gray-500">{t.labels.scanToVerify}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="w-full max-w-5xl mt-8 relative z-10">
                    <ContentCredentialsSection manifest={cert.c2pa_manifest} />
                </div>

                {/* ═══════════ Actions ═══════════ */}
                <div className="pt-8 mt-4 border-t border-slate-700/40 flex flex-wrap gap-4 relative z-10 w-full max-w-5xl justify-start">
                    <motion.button
                        onClick={shareOnX}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className="no-print bg-[#0f1419] hover:bg-[#272c30] text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 border border-slate-700"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.008 3.827H5.078z"></path></svg>
                        {t.actions.shareOnX}
                    </motion.button>

                    {/* 🚨 妥協の排除: API依存パージ。certIdのみを渡し、権限はサーバー側判定値に従う */}
                    {isPremiumUnlocked || isAnonymous ? (
                        <div className={`no-print w-full sm:w-auto sm:min-w-[280px] rounded-xl ${styles.shimmerHost}`}>
                            <EvidencePackDownloadButton certId={cert.id} />
                        </div>
                    ) : (
                        <motion.button
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                                window.location.href = '/pricing#creator';
                            }}
                            className="no-print bg-slate-800/80 text-slate-300 px-6 py-3 rounded-xl font-bold border border-slate-700 flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-all cursor-pointer relative group backdrop-blur"
                        >
                            <Lock className="w-4 h-4" /> {t.actions.unlockEvidence}
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#F0BB38] text-[#1A1200] text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-mono">
                                {t.actions.creatorPlanOnly}
                            </span>
                        </motion.button>
                    )}

                    <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => router.push('/')}
                        className="no-print bg-gradient-to-br from-[#6C3EF4] to-[#8B61FF] hover:brightness-110 text-white px-6 py-3 rounded-xl font-bold transition-all"
                        style={{ boxShadow: '0 12px 32px -10px rgba(108,62,244,0.65)' }}
                    >
                        {t.errors.backToTop}
                    </motion.button>
                </div>

                {/* Owner-only block */}
                {isOwner && (
                    <div
                        className="print:hidden w-full max-w-5xl mt-16 p-6 sm:p-8 rounded-2xl mb-20 relative z-10"
                        style={{
                            background:
                                'linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 55%, rgba(7,6,26,0.85) 100%)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(16px)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px -30px rgba(0,212,170,0.20)',
                        }}
                    >
                        <h3 className="text-[#00D4AA] font-bold mb-4 flex items-center gap-2">
                            <span className="text-xl">💡</span> {t.ownerSection.title}
                        </h3>
                        <p className="text-sm text-[#A8A0D8] mb-6">{t.ownerSection.desc}</p>

                        <div className="space-y-6">
                            <div>
                                <p className="text-sm text-white font-bold mb-2">{t.ownerSection.formalLabel}</p>
                                <div className="relative p-4 rounded-lg bg-[#0f1629] border border-[#2a2a4e]">
                                    <button
                                        onClick={() => handleCopy(templateFormal, 'formal')}
                                        className="absolute top-3 right-3 p-2 rounded-md bg-[#1a233a] hover:bg-[#2a3655] transition-colors flex items-center gap-2 text-xs font-bold text-white border border-[#2a2a4e]"
                                    >
                                        {copiedType === 'formal' ? (
                                            <><Check className="w-4 h-4 text-[#00d4aa]" /> {t.actions.copied}</>
                                        ) : (
                                            <><Copy className="w-4 h-4 text-[#6c3ef4]" /> {t.actions.copy}</>
                                        )}
                                    </button>
                                    <p className="text-sm text-gray-300 whitespace-pre-wrap pr-28 leading-relaxed">
                                        {templateFormal}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-white font-bold mb-2">{t.ownerSection.snsLabel}</p>
                                <div className="relative p-4 rounded-lg bg-[#0f1629] border border-[#2a2a4e]">
                                    <button
                                        onClick={() => handleCopy(templateSNS, 'sns')}
                                        className="absolute top-3 right-3 p-2 rounded-md bg-[#1a233a] hover:bg-[#2a3655] transition-colors flex items-center gap-2 text-xs font-bold text-white border border-[#2a2a4e]"
                                    >
                                        {copiedType === 'sns' ? (
                                            <><Check className="w-4 h-4 text-[#00d4aa]" /> {t.actions.copied}</>
                                        ) : (
                                            <><Copy className="w-4 h-4 text-[#6c3ef4]" /> {t.actions.copy}</>
                                        )}
                                    </button>
                                    <p className="text-sm text-gray-300 whitespace-pre-wrap pr-28 leading-relaxed">
                                        {templateSNS}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-6 mt-2 border-t border-[#1C1A38]">
                                <p className="text-sm text-[#FF453A] font-bold mb-2 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" /> {t.ownerSection.legalLabel}
                                </p>
                                <p className="text-xs text-[#A8A0D8] mb-4">
                                    {t.ownerSection.legalDesc}
                                </p>
                                <motion.button
                                    whileHover={{ y: -1, scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setTakedownOpen(true)}
                                    className="bg-[#FF453A]/10 hover:bg-[#FF453A]/20 border border-[#FF453A]/30 text-[#FF453A] px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2 text-sm"
                                    style={{ boxShadow: '0 12px 32px -16px rgba(255,69,58,0.55)' }}
                                >
                                    <Gavel className="w-4 h-4" />
                                    {t.actions.generateTakedown}
                                </motion.button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════ Provenance Gallery ═══════════ */}
                {/* 🚨 妥協の排除: Type Guardによりイテラブルクラッシュを物理防衛 */}
                {bundle && Array.isArray(bundle.steps) && bundle.steps.length > 0 && (
                    <ProvenanceGallery bundle={bundle} />
                )}

                {/* ═══════════ Verifier (optical scanner) ═══════════ */}
                <div id="verify-section" className="w-full max-w-5xl mt-24 print:hidden scroll-mt-24 relative z-10">
                    <VerifyDropzone />
                </div>

                <div className="mt-12 text-center pb-8 print:hidden relative z-10">
                    <button
                        onClick={handleReportAbuse}
                        className="text-xs text-gray-500 underline hover:text-gray-300 transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                        <Flag className="w-3 h-3" />
                        {t.actions.reportAbuse}
                    </button>
                </div>

                {isOwner && (
                    <TakedownNoticeModal
                        open={isTakedownOpen}
                        onClose={() => setTakedownOpen(false)}
                        certificate={{
                            certificateId: cert.id,
                            timestampJst: cert.timestamp_jst,
                            verificationUrl: verifyUrl,
                            originalFileName: cert.title || 'unknown_asset',
                        }}
                        claimant={{
                            creatorDisplayName: cert.creator_display_name || 'ProofMark Verified Creator',
                            legalName: cert.legal_name || null,
                            email: user?.email || '',
                            defaultPersona: (cert.default_persona as "creator" | "legal") || 'creator',
                        }}
                        defaultLanguage="ja"
                    />
                )}

            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════
 *   Helper Components (The Apex Theatrical UX & UI)
 * ═══════════════════════════════════════════════ */

function CornerBracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
    const base = 'print:hidden absolute w-5 h-5 pointer-events-none';
    let cls = base;
    if (pos === 'tl') cls += ' top-3 left-3 border-t border-l';
    if (pos === 'tr') cls += ' top-3 right-3 border-t border-r';
    if (pos === 'bl') cls += ' bottom-3 left-3 border-b border-l';
    if (pos === 'br') cls += ' bottom-3 right-3 border-b border-r';
    return <div className={cls} style={{ borderColor: 'rgba(255,255,255,0.16)' }} />;
}

function BreathingBadge({
    color,
    rgb,
    icon,
    label,
    printClass = '',
}: {
    color: string;
    rgb: string;
    icon: React.ReactNode;
    label: string;
    printClass?: string;
}) {
    return (
        <motion.div
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase ${printClass}`}
            style={{
                background: `rgba(${rgb}, 0.10)`,
                border: `1px solid rgba(${rgb}, 0.45)`,
                color,
            }}
            animate={{
                boxShadow: [
                    `0 0 0 0 rgba(${rgb}, 0.45)`,
                    `0 0 0 8px rgba(${rgb}, 0)`,
                    `0 0 0 0 rgba(${rgb}, 0.45)`,
                ],
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
            <motion.span
                className="flex items-center"
                animate={{ opacity: [1, 0.78, 1] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
                {icon}
            </motion.span>
            <span className="relative">{label}</span>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  HashFingerprint & deriveGenerativeArt — The Cryptographic Sigil Engine
 *  ─────────────────────────────────────────────────────────────────────────
 *  ハッシュ値 1 バイトの差異が全く異なる「暗号紋章」を生成する視覚化エンジン。
 *  Avalanche Effect (雪崩効果) を「サイバーパンク × 神聖幾何学」の融合で表現。
 *
 *  設計原則:
 *   - CSS gradient は GPU compositor に載せる (paint コストを抑制)
 *   - 動的アニメは SVG の <animateTransform> / <animate> のみ (rAF ゼロ負荷)
 *   - mix-blend-mode / heavy backdrop-filter 完全禁止 (iOS WebKit Jank 回避)
 *   - 全ての幾何学パラメータは 64 バイトのハッシュシードから決定論的に導出
 * ═══════════════════════════════════════════════════════════════════════════ */

interface GenerativeArt {
    /** 背景の多層グラデーション (GPU-friendly) */
    background: string;
    /** 幾何学ストライプのオーバーレイ */
    overlay: string;
    /** テーマ色 (アクセントインジケータ用) */
    hueA: number;
    hueB: number;
    hueC: number;
    /** 神聖幾何学の頂点数 (5..12) — ハッシュ由来 */
    polygonSides: number;
    /** マンダラの回転レイヤー数 (3..6) */
    mandalaLayers: number;
    /** 各レイヤーの回転オフセット (deg) */
    rotationSeeds: number[];
    /** SVG viewBox 内での中心オフセット (量子的揺らぎ) */
    centerJitter: { x: number; y: number };
    /** グリフストリームの列数 */
    glyphColumns: number;
    /** データストリーム文字列 (ハッシュから決定論的に抽出) */
    glyphStream: string;
    /** 発光の脈動周期 (秒) */
    pulseDuration: number;
    /** SVG フィルタで使う turbulence の baseFrequency */
    turbulenceFreq: number;
    /** 一意な SVG フィルタ ID プレフィックス */
    idPrefix: string;
    /** 最下層の量子アンビエントカラー */
    ambientHue: number;
}

/**
 * 暗号学的雪崩効果を最大化する視覚シード生成器。
 * codeAt を FNV-1a 風に混合し、1 バイトの差でも全パラメータが変わるよう拡張。
 */
function deriveGenerativeArt(hash: string): GenerativeArt {
    const seed = (hash || 'proofmark').padEnd(64, '0');
    const codeAt = (i: number) => seed.charCodeAt(i % seed.length);

    /* FNV-1a 風の混合関数 — 隣接バイトを非線形に絡めて雪崩効果を増幅 */
    const mix = (a: number, b: number, salt: number) => {
        let h = (codeAt(a) ^ codeAt(b)) * 16777619;
        h = (h ^ (h >>> 13)) + salt * 2654435761;
        return Math.abs(h) >>> 0;
    };

    const hueA = mix(2, 33, 7) % 360;
    const hueB = mix(11, 44, 13) % 360;
    const hueC = mix(23, 55, 19) % 360;
    const ambientHue = mix(3, 61, 29) % 360;

    const xA = 10 + (mix(5, 40, 3) % 70);
    const yA = 10 + (mix(7, 42, 5) % 70);
    const xB = 10 + (mix(13, 46, 11) % 70);
    const yB = 10 + (mix(19, 48, 17) % 70);
    const xC = 10 + (mix(29, 50, 23) % 80);
    const yC = 10 + (mix(31, 52, 29) % 80);

    const conicAngle = mix(3, 27, 31) % 360;
    const stripeAngle = mix(37, 58, 41) % 180;
    const stripeGap = 6 + (mix(41, 60, 43) % 10);

    const satA = 70 + (mix(9, 34, 47) % 20);
    const satB = 60 + (mix(15, 36, 53) % 25);
    const lightA = 45 + (mix(21, 38, 59) % 15);
    const lightB = 35 + (mix(27, 39, 61) % 15);

    /* 神聖幾何学パラメータ */
    const polygonSides = 5 + (mix(1, 63, 71) % 8); // 5..12
    const mandalaLayers = 3 + (mix(2, 62, 73) % 4); // 3..6
    const rotationSeeds = Array.from({ length: mandalaLayers }, (_, i) =>
        (mix(4 + i, 30 + i, 79 + i) % 360),
    );

    /* 量子揺らぎ (中心の微小オフセット) */
    const centerJitter = {
        x: -4 + (mix(6, 59, 83) % 8),
        y: -4 + (mix(8, 57, 89) % 8),
    };

    /* データストリーム列と可視化文字列 */
    const glyphColumns = 6 + (mix(10, 45, 97) % 4);
    const glyphStream = seed
        .slice(0, 32)
        .split('')
        .map((c, i) => (mix(i, i + 12, 101) & 1 ? c.toUpperCase() : c))
        .join('');

    const pulseDuration = 4 + (mix(12, 43, 103) % 4);
    const turbulenceFreq = 0.65 + (mix(14, 41, 107) % 30) / 100; // 0.65..0.95

    /* SVG の <defs> が同一ページ内で衝突しないためのユニーク ID プレフィックス */
    const idPrefix = `pm-fp-${(mix(0, 63, 199) % 0xffffff).toString(16).padStart(6, '0')}`;

    const background = `
        radial-gradient(circle at ${xC}% ${yC}%, hsl(${hueC}, 82%, 46%) 0%, transparent 42%),
        radial-gradient(ellipse 78% 58% at ${xA}% ${yA}%, hsl(${hueA}, ${satA}%, ${lightA}%) 0%, transparent 55%),
        radial-gradient(ellipse 62% 52% at ${xB}% ${yB}%, hsl(${hueB}, ${satB}%, ${lightB}%) 0%, transparent 55%),
        conic-gradient(from ${conicAngle}deg at 50% 50%,
            hsl(${hueA}, 58%, 10%) 0deg,
            hsl(${hueB}, 68%, 18%) 120deg,
            hsl(${hueC}, 66%, 14%) 240deg,
            hsl(${ambientHue}, 60%, 8%) 360deg)
    `;

    const overlay = `repeating-linear-gradient(${stripeAngle}deg,
        rgba(255,255,255,0.06) 0px,
        rgba(255,255,255,0.06) 1px,
        transparent 1px,
        transparent ${stripeGap}px)`;

    return {
        background,
        overlay,
        hueA,
        hueB,
        hueC,
        polygonSides,
        mandalaLayers,
        rotationSeeds,
        centerJitter,
        glyphColumns,
        glyphStream,
        pulseDuration,
        turbulenceFreq,
        idPrefix,
        ambientHue,
    };
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Sub: SacredMandala
 *   - N 角形を回転レイヤーで重ね、神聖幾何学の曼荼羅を SVG で描画
 *   - <animateTransform> による自律駆動 (rAF なしで 60fps)
 *   - stroke-dasharray で暗号の断片を暗示
 * ═══════════════════════════════════════════════════════════════════════════ */

function SacredMandala({ art }: { art: GenerativeArt }) {
    const cx = 100 + art.centerJitter.x;
    const cy = 100 + art.centerJitter.y;

    const polygonPoints = (radius: number, sides: number, phase: number) => {
        const pts: string[] = [];
        for (let i = 0; i < sides; i++) {
            const theta = ((Math.PI * 2) / sides) * i + (phase * Math.PI) / 180;
            const x = cx + radius * Math.cos(theta);
            const y = cy + radius * Math.sin(theta);
            pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
        }
        return pts.join(' ');
    };

    return (
        <svg
            viewBox="0 0 200 200"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full pointer-events-none"
            aria-hidden
        >
            <defs>
                {/* 微細な texture — 量子ノイズ (静止, GPU軽量) */}
                <filter id={`${art.idPrefix}-noise`} x="0%" y="0%" width="100%" height="100%">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency={art.turbulenceFreq}
                        numOctaves="2"
                        seed={art.polygonSides * 7}
                        stitchTiles="stitch"
                    />
                    <feColorMatrix
                        type="matrix"
                        values="0 0 0 0 1
                                0 0 0 0 1
                                0 0 0 0 1
                                0 0 0 0.08 0"
                    />
                </filter>

                {/* 中央発光: 軽量 feDropShadow */}
                <filter id={`${art.idPrefix}-glow`} x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow
                        dx="0"
                        dy="0"
                        stdDeviation="1.4"
                        floodColor={`hsl(${art.hueC}, 85%, 60%)`}
                        floodOpacity="0.55"
                    />
                </filter>

                {/* 動的線描用グラデーション */}
                <linearGradient id={`${art.idPrefix}-stroke`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={`hsl(${art.hueA}, 85%, 65%)`} stopOpacity="0.9" />
                    <stop offset="50%" stopColor={`hsl(${art.hueB}, 85%, 60%)`} stopOpacity="0.7" />
                    <stop offset="100%" stopColor={`hsl(${art.hueC}, 85%, 62%)`} stopOpacity="0.9" />
                </linearGradient>

                <radialGradient id={`${art.idPrefix}-core`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={`hsl(${art.hueC}, 90%, 72%)`} stopOpacity="0.85" />
                    <stop offset="60%" stopColor={`hsl(${art.hueA}, 80%, 40%)`} stopOpacity="0.35" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Layer 0: 量子アンビエント発光の呼吸 */}
            <circle
                cx={cx}
                cy={cy}
                r="60"
                fill={`url(#${art.idPrefix}-core)`}
                opacity="0.7"
            >
                <animate
                    attributeName="r"
                    values="58;66;58"
                    dur={`${art.pulseDuration}s`}
                    repeatCount="indefinite"
                />
                <animate
                    attributeName="opacity"
                    values="0.55;0.85;0.55"
                    dur={`${art.pulseDuration}s`}
                    repeatCount="indefinite"
                />
            </circle>

            {/* Layer 1..N: 曼荼羅の多角形リング (それぞれ異なる速度・方向で回転) */}
            {art.rotationSeeds.map((phase, i) => {
                const radius = 22 + i * 12;
                const sides = art.polygonSides + (i % 2 === 0 ? 0 : 2);
                const direction = i % 2 === 0 ? '360' : '-360';
                const duration = 26 + i * 9;
                const dashLen = 3 + ((art.hueA + i * 17) % 6);
                const dashGap = 4 + ((art.hueB + i * 13) % 8);
                const strokeOpacity = 0.42 - i * 0.05;

                return (
                    <g key={i} style={{ transformOrigin: `${cx}px ${cy}px` }}>
                        <polygon
                            points={polygonPoints(radius, sides, phase)}
                            fill="none"
                            stroke={`url(#${art.idPrefix}-stroke)`}
                            strokeWidth={0.5 + (i % 2) * 0.3}
                            strokeOpacity={Math.max(0.12, strokeOpacity)}
                            strokeDasharray={`${dashLen} ${dashGap}`}
                            strokeLinejoin="miter"
                        >
                            <animateTransform
                                attributeName="transform"
                                attributeType="XML"
                                type="rotate"
                                from={`${phase} ${cx} ${cy}`}
                                to={`${phase + Number(direction)} ${cx} ${cy}`}
                                dur={`${duration}s`}
                                repeatCount="indefinite"
                            />
                        </polygon>
                    </g>
                );
            })}

            {/* 中心の暗号インナーグリッド (Sacred Cross) */}
            <g stroke={`hsl(${art.hueC}, 90%, 65%)`} strokeOpacity="0.35" strokeWidth="0.4">
                <line x1={cx - 14} y1={cy} x2={cx + 14} y2={cy} />
                <line x1={cx} y1={cy - 14} x2={cx} y2={cy + 14} />
                <circle cx={cx} cy={cy} r="6" fill="none" strokeOpacity="0.55" />
                <circle cx={cx} cy={cy} r="10" fill="none" strokeOpacity="0.3" strokeDasharray="1 2" />
            </g>

            {/* Corner ticks: 四隅の断片的な暗号マーカー */}
            {[
                { x: 8, y: 8 },
                { x: 192, y: 8 },
                { x: 8, y: 192 },
                { x: 192, y: 192 },
            ].map((p, i) => (
                <g key={`tick-${i}`} stroke={`hsl(${[art.hueA, art.hueB, art.hueC, art.ambientHue][i]}, 80%, 60%)`} strokeOpacity="0.6" strokeWidth="0.6">
                    <line x1={p.x - 4} y1={p.y} x2={p.x + 4} y2={p.y} />
                    <line x1={p.x} y1={p.y - 4} x2={p.x} y2={p.y + 4} />
                </g>
            ))}

            {/* 量子ノイズオーバーレイ */}
            <rect
                x="0"
                y="0"
                width="200"
                height="200"
                filter={`url(#${art.idPrefix}-noise)`}
                opacity="0.9"
            />

            {/* ヴィネット */}
            <radialGradient id={`${art.idPrefix}-vignette`} cx="50%" cy="50%" r="70%">
                <stop offset="55%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
            </radialGradient>
            <rect x="0" y="0" width="200" height="200" fill={`url(#${art.idPrefix}-vignette)`} />
        </svg>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Sub: GlyphStreamRail
 *   - ハッシュ由来の 16 進文字列を SVG テキストで縦に流し、
 *     ライブ感のある「暗号紋章の署名」として左右エッジに配置
 * ═══════════════════════════════════════════════════════════════════════════ */

function GlyphStreamRail({ art }: { art: GenerativeArt }) {
    const glyphs = art.glyphStream.split('');
    const half = Math.ceil(glyphs.length / 2);
    const left = glyphs.slice(0, half);
    const right = glyphs.slice(half);

    const railStyle = (side: 'l' | 'r'): React.CSSProperties => ({
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side === 'l' ? 'left' : 'right']: 4,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '18px 0',
        pointerEvents: 'none',
        color: `hsla(${side === 'l' ? art.hueA : art.hueC}, 80%, 72%, 0.55)`,
        fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 8,
        letterSpacing: '0.18em',
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
    });

    return (
        <>
            <div aria-hidden style={railStyle('l')}>
                {left.map((c, i) => (
                    <span key={`l-${i}`}>{c}</span>
                ))}
            </div>
            <div aria-hidden style={railStyle('r')}>
                {right.map((c, i) => (
                    <span key={`r-${i}`}>{c}</span>
                ))}
            </div>
        </>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  HashFingerprint — The Cryptographic Sigil
 * ═══════════════════════════════════════════════════════════════════════════ */

function HashFingerprint({
    hash,
    className = '',
    showLabel = true,
}: {
    hash: string;
    className?: string;
    showLabel?: boolean;
}) {
    const art = useMemo(() => deriveGenerativeArt(hash), [hash]);

    return (
        <div
            className={`relative h-full w-full overflow-hidden ${className}`}
            style={{ background: art.background }}
        >
            {/* Layer 1: 微細な幾何学ストライプ */}
            <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: art.overlay, opacity: 0.14 }}
            />

            {/* Layer 2: 神聖幾何学の曼荼羅 (SVG, 自律駆動) */}
            <SacredMandala art={art} />

            {/* Layer 3: 暗号グリフの縦ストリーム */}
            <GlyphStreamRail art={art} />

            {/* Layer 4: 深部ヴィネット (paint 軽量) */}
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(0,0,0,0.5) 100%)',
                }}
            />

            {/* Layer 5: 中央ラベル — 「機密証明」 */}
            {showLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
                    <div
                        className="relative flex h-12 w-12 items-center justify-center rounded-full"
                        style={{
                            background:
                                'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%)',
                            border: '1px solid rgba(0,212,170,0.55)',
                            boxShadow:
                                '0 0 22px rgba(0,212,170,0.35), inset 0 0 8px rgba(0,212,170,0.15)',
                        }}
                    >
                        {/* 微細な回転リング (SVG animateTransform) */}
                        <svg
                            viewBox="0 0 48 48"
                            className="absolute inset-0 h-full w-full"
                            aria-hidden
                        >
                            <circle
                                cx="24"
                                cy="24"
                                r="22"
                                fill="none"
                                stroke="rgba(0,212,170,0.35)"
                                strokeWidth="0.6"
                                strokeDasharray="1 3"
                            >
                                <animateTransform
                                    attributeName="transform"
                                    attributeType="XML"
                                    type="rotate"
                                    from="0 24 24"
                                    to="360 24 24"
                                    dur="42s"
                                    repeatCount="indefinite"
                                />
                            </circle>
                        </svg>
                        <Lock className="h-5 w-5 text-[#00D4AA]" strokeWidth={1.6} />
                    </div>
                    <div className="text-center">
                        <p className="text-[9.5px] font-mono uppercase tracking-[0.28em] text-white/90">
                            {t.vault.confidentialProof}
                        </p>
                        <p
                            className="mt-1 font-mono text-[10px] text-white/60 tracking-[0.18em]"
                            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.65)' }}
                        >
                            {hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—'}
                        </p>
                    </div>
                </div>
            )}

            {/* Layer 6: アクセントドット (テーマ色インジケータ) */}
            <div
                aria-hidden
                className="absolute bottom-2 right-2 flex gap-1 pointer-events-none"
            >
                {[art.hueA, art.hueB, art.hueC].map((h, i) => (
                    <span
                        key={i}
                        className="block h-1.5 w-1.5 rounded-full"
                        style={{
                            background: `hsl(${h}, 82%, 62%)`,
                            boxShadow: `0 0 6px hsl(${h}, 82%, 62%)`,
                        }}
                    />
                ))}
            </div>

            {/* Layer 7: PM シグネチャ (左上) */}
            <div
                aria-hidden
                className="absolute top-2 left-2 font-mono text-[8px] tracking-[0.3em]"
                style={{
                    color: 'rgba(255,255,255,0.6)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                }}
            >
                ✦ PM
            </div>

            {/* Layer 8: geometry meta (右上, sides / layers) */}
            <div
                aria-hidden
                className="absolute top-2 right-2 font-mono text-[7.5px] tracking-[0.22em] text-right"
                style={{
                    color: 'rgba(255,255,255,0.42)',
                    textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                }}
            >
                ▲{art.polygonSides}·{art.mandalaLayers}L
            </div>
        </div>
    );
}


/* ═══════════════════════════════════════════════
 *   Provenance Gallery — Horizontal Bento Scroll
 * ═══════════════════════════════════════════════ */
type StepTone = {
    label: string;
    color: string;
    rgb: string;
    bg: string;
    border: string;
};

function getStepTone(step: ProcessBundlePublic['steps'][number], index: number, total: number): StepTone {
    const stepType = (step.step_type || '').toLowerCase();
    const isFirst = index === 0;
    const isLast = index === total - 1;

    if (stepType === 'final' || isLast) {
        return {
            label: t.provenance.final.toUpperCase(),
            color: '#00D4AA',
            rgb: '0,212,170',
            bg: 'rgba(0,212,170,0.12)',
            border: 'rgba(0,212,170,0.45)',
        };
    }
    if (stepType === 'rough' || isFirst) {
        return {
            label: t.provenance.origin.toUpperCase(),
            color: '#F59E0B',
            rgb: '245,158,11',
            bg: 'rgba(245,158,11,0.12)',
            border: 'rgba(245,158,11,0.45)',
        };
    }
    return {
        label: stepType ? stepType.toUpperCase() : t.provenance.step.toUpperCase(),
        color: '#A8A0D8',
        rgb: '108,62,244',
        bg: 'rgba(108,62,244,0.12)',
        border: 'rgba(108,62,244,0.40)',
    };
}

// 🚨 妥協の排除: タイムゾーンの時限爆弾を解除。JSTを明示しHydration Mismatchと法的証明の崩壊を防御
function formatStepDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function ProvenanceGallery({ bundle }: { bundle: ProcessBundlePublic }) {
    const sortedSteps = useMemo(
        () => [...bundle.steps].sort((a, b) => a.step_index - b.step_index),
        [bundle.steps],
    );
    const total = sortedSteps.length;

    return (
        <motion.section
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: PM_EASE }}
            aria-labelledby="provenance-gallery-title"
            className="w-full max-w-5xl mt-12 print:hidden relative isolate z-10"
        >
            <div
                aria-hidden
                className="absolute -inset-x-12 -top-8 h-48 bg-gradient-to-b from-[#6C3EF4]/12 via-[#00D4AA]/8 to-transparent blur-3xl -z-10 rounded-[3rem]"
            />

            <div
                className="relative overflow-hidden rounded-3xl"
                style={{
                    background:
                        'linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 55%, rgba(7,6,26,0.85) 100%)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    backdropFilter: 'blur(20px)',
                    boxShadow:
                        '0 0 0 1px rgba(255,255,255,0.03) inset, 0 30px 80px -30px rgba(108,62,244,0.40), 0 16px 50px -20px rgba(0,212,170,0.15)',
                }}
            >
                <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                        background:
                            'linear-gradient(90deg, transparent, rgba(245,158,11,0.65), rgba(108,62,244,0.85), rgba(0,212,170,0.85), transparent)',
                    }}
                />

                <header className="px-5 sm:px-7 pt-6 sm:pt-7 pb-4 sm:pb-5 border-b border-white/[0.06]">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-[0.32em] text-[#A8A0D8] mb-2 flex items-center gap-1.5">
                                <Layers3 className="w-3 h-3 text-[#6C3EF4]" />
                                Provenance Gallery · Chain of Evidence
                            </p>
                            <h2
                                id="provenance-gallery-title"
                                className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight"
                            >
                                {t.provenance.title}
                            </h2>
                            <p className="mt-2 text-[13px] leading-relaxed text-[#A8A0D8] max-w-2xl">
                                {t.provenance.desc}
                            </p>
                        </div>
                        <BreathingBadge
                            color="#BC78FF"
                            rgb="188,120,255"
                            icon={<Sparkles className="w-3.5 h-3.5" />}
                            label={t.provenance.badge}
                        />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5 text-[10px] font-mono uppercase tracking-[0.22em]">
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{
                                background: 'rgba(245,158,11,0.10)',
                                border: '1px solid rgba(245,158,11,0.35)',
                                color: '#F59E0B',
                            }}
                        >
                            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: '#F59E0B' }} />
                            {t.provenance.origin}
                        </span>
                        <ChevronRight className="w-3 h-3 text-white/30" />
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{
                                background: 'rgba(108,62,244,0.10)',
                                border: '1px solid rgba(108,62,244,0.35)',
                                color: '#BC78FF',
                            }}
                        >
                            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: '#6C3EF4' }} />
                            {t.provenance.step}
                        </span>
                        <ChevronRight className="w-3 h-3 text-white/30" />
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                            style={{
                                background: 'rgba(0,212,170,0.10)',
                                border: '1px solid rgba(0,212,170,0.35)',
                                color: '#00D4AA',
                            }}
                        >
                            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: '#00D4AA' }} />
                            {t.provenance.final}
                        </span>
                        <span className="text-white/30 mx-1">·</span>
                        <span className="text-white/50" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {total} STEPS
                        </span>
                        {typeof bundle.chain_head_sha256 === 'string' && bundle.chain_head_sha256 && (
                            <>
                                <span className="text-white/30 mx-1">·</span>
                                <span className="text-[#00D4AA]">
                                    {t.provenance.head} {bundle.chain_head_sha256.slice(0, 10)}…
                                </span>
                            </>
                        )}
                    </div>
                </header>

                <div className="relative">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-0 w-12 z-10"
                        style={{ background: 'linear-gradient(90deg, rgba(7,6,26,0.7), transparent)' }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 right-0 w-12 z-10"
                        style={{ background: 'linear-gradient(-90deg, rgba(7,6,26,0.7), transparent)' }}
                    />

                    <div
                        className={`${styles.filmstrip} px-5 sm:px-7 py-6 sm:py-7`}
                        role="list"
                    >
                        {sortedSteps.map((step, index) => {
                            const tone = getStepTone(step, index, total);
                            return (
                                <ProvenanceStepCard
                                    key={step.id}
                                    step={step}
                                    index={index}
                                    total={total}
                                    tone={tone}
                                />
                            );
                        })}
                    </div>
                </div>

                <footer className="px-5 sm:px-7 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3 text-[11px] text-[#A8A0D8] font-mono">
                    <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#00D4AA]" />
                        {t.provenance.chainMsg}
                    </span>
                    <span className="hidden sm:inline uppercase tracking-[0.2em] text-white/35">
                        SHA-256 · RFC 3161
                    </span>
                </footer>
            </div>
        </motion.section>
    );
}

function ProvenanceStepCard({
    step,
    index,
    total,
    tone,
}: {
    step: ProcessBundlePublic['steps'][number];
    index: number;
    total: number;
    tone: StepTone;
}) {
    const [imgError, setImgError] = useState(false);
    const hasPreview = typeof step.preview_url === 'string' && step.preview_url !== '' && !imgError;
    const isLast = index === total - 1;

    return (
        <motion.article
            role="listitem"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.5), ease: PM_EASE }}
            whileHover={{ y: -3 }}
            className="group relative shrink-0 w-[280px] sm:w-[320px] overflow-hidden rounded-2xl"
            style={{
                background:
                    'linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 60%, rgba(7,6,26,0.85) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 14px 40px -20px rgba(0,0,0,0.6)',
                willChange: 'transform',
            }}
        >
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px"
                style={{
                    background: `linear-gradient(90deg, transparent, ${tone.color}, transparent)`,
                    opacity: 0.7,
                }}
            />

            <div
                aria-hidden
                className="absolute -inset-2 rounded-[20px] blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 -z-10"
                style={{
                    background: `radial-gradient(ellipse at 50% 80%, rgba(${tone.rgb}, 0.35), transparent 55%)`,
                    transition: 'opacity 400ms',
                    willChange: 'opacity',
                }}
            />

            <div className="relative aspect-[4/5] overflow-hidden">
                {hasPreview ? (
                    <Image
                        src={step.preview_url as string}
                        alt={step.title}
                        fill
                        unoptimized={true} // Vercel コンピュート課金の物理遮断
                        onError={() => setImgError(true)}
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                ) : (
                    <HashFingerprint
                        hash={step.sha256 || step.id}
                        className="absolute inset-0"
                    />
                )}

                <div
                    className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-[0.22em]"
                    style={{
                        background: 'rgba(7,6,26,0.78)',
                        border: `1px solid ${tone.border}`,
                        color: tone.color,
                        boxShadow: `0 6px 18px rgba(0,0,0,0.4)`,
                    }}
                >
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                    </span>
                </div>

                <motion.div
                    className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold uppercase tracking-[0.22em]"
                    style={{
                        background: tone.bg,
                        border: `1px solid ${tone.border}`,
                        color: tone.color,
                    }}
                >
                    {tone.label}
                </motion.div>

                {isLast && (
                    <div
                        className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold uppercase tracking-[0.22em]"
                        style={{
                            background: 'rgba(0,212,170,0.18)',
                            border: '1px solid rgba(0,212,170,0.5)',
                            color: '#FFFFFF',
                            boxShadow: '0 6px 18px rgba(0,212,170,0.35)',
                        }}
                    >
                        <CheckCircle className="w-3 h-3" />
                        {t.provenance.delivered}
                    </div>
                )}
            </div>

            <div className="px-4 py-3.5">
                <p
                    className="text-[13.5px] font-bold text-white leading-snug line-clamp-2"
                    title={step.title}
                >
                    {step.title || `Step ${index + 1}`}
                </p>

                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-white/55">
                    <Clock className="w-3 h-3" style={{ color: tone.color }} />
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatStepDate(step.issued_at)}
                    </span>
                </div>

                <div
                    className="mt-3 rounded-lg px-2.5 py-1.5"
                    style={{
                        background: 'rgba(0,0,0,0.25)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <p className="text-[8.5px] font-mono uppercase tracking-[0.24em] text-white/40">
                        SHA-256
                    </p>
                    <p
                        className="mt-0.5 font-mono text-[10.5px] truncate"
                        style={{
                            color: tone.color,
                            textShadow: `0 0 8px rgba(${tone.rgb}, 0.3)`,
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {step.sha256 ? `${step.sha256.slice(0, 12)}…${step.sha256.slice(-6)}` : '—'}
                    </p>
                </div>
            </div>

            {/* 🚨 妥協の排除: Theatrical UX (ハッシュチェーンの視覚的連結) の完全復活 */}
            {!isLast && (
                <div
                    aria-hidden
                    className="hidden sm:flex absolute top-1/2 -right-3 -translate-y-1/2 items-center justify-center z-20"
                    style={{ pointerEvents: 'none' }}
                >
                    <div
                        className="h-6 w-6 rounded-full flex items-center justify-center bg-[#07061A]"
                        style={{
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                        }}
                    >
                        <ChevronRight className="w-3 h-3 text-white/55" />
                    </div>
                </div>
            )}
        </motion.article>
    );
}

/* ═══════════════════════════════════════════════
 *   God-Mode: SEALED Stamp Vault (GPU Fixed & Theatrical UX Restored)
 * ═══════════════════════════════════════════════ */
function SealedStampVault() {
    return (
        <Tooltip.Provider delayDuration={200}>
            <Tooltip.Root>
                <Tooltip.Trigger asChild>
                    <div
                        className="flex flex-col items-center justify-center w-full h-full cursor-default overflow-hidden relative"
                        style={{
                            background:
                                'radial-gradient(circle at center, rgba(240,187,56,0.12) 0%, rgba(108,62,244,0.05) 50%, transparent 80%), #050310',
                        }}
                    >
                        {/* 🚨 妥協の排除: 3D Theatrical UX の復活 (軽量CSS drop-shadow) */}
                        <motion.div
                            initial={{ scale: 2.4, rotate: -22, opacity: 0 }}
                            animate={{ scale: 1, rotate: -8, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 280, damping: 14, mass: 0.9, delay: 0.15 }}
                            className="relative"
                            style={{
                                filter: 'drop-shadow(0 0 24px rgba(240,187,56,0.45)) drop-shadow(0 14px 30px rgba(0,0,0,0.7))',
                            }}
                        >
                            <SealedStampSVG />
                        </motion.div>
                    </div>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                    <Tooltip.Content
                        sideOffset={8}
                        className="z-50 max-w-[300px] px-4 py-3 rounded-xl shadow-2xl text-xs leading-relaxed"
                        style={{ backgroundColor: '#151d2f', border: '1px solid #2a2a4e', color: '#a0a0c0' }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                        >
                            {t.vault.sealedMsg}
                        </motion.div>
                        <Tooltip.Arrow className="fill-[#2a2a4e] w-3 h-1.5" />
                    </Tooltip.Content>
                </Tooltip.Portal>
            </Tooltip.Root>
        </Tooltip.Provider>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SealedStampSVG — The Tactile Enterprise Seal
 *  ─────────────────────────────────────────────────────────────────────────
 *  精緻な金属質感、暗号鍵モチーフ、微かな発光、静謐な威圧感を持つ封印。
 *  Framer Motion で「静けさの中の呼吸」を演出し、hover で権威が張り詰める。
 *
 *  Perf 約束:
 *   - filter は <feDropShadow> 中心の軽量構成
 *   - <feTurbulence> は 1 回のみ (baseFrequency 0.9, numOctaves 2)
 *   - animate* 系は SVG ネイティブで完結 (rAF 不要)
 * ═══════════════════════════════════════════════════════════════════════════ */

function SealedStampSVG() {
    return (
        <motion.div
            className="relative w-[210px] h-[210px] sm:w-[230px] sm:h-[230px]"
            initial={{ scale: 0.92, opacity: 0, filter: 'blur(6px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 130, damping: 18, mass: 0.85 }}
            whileHover={{ scale: 1.025 }}
        >
            {/* 外周: 金色の点線オービット (既存 CSS animation を尊重) */}
            <div
                aria-hidden
                className={`absolute inset-0 rounded-full ${styles.sealOrbit}`}
                style={{ border: '1px dashed rgba(240,187,56,0.55)' }}
            />
            {/* 内周: 紫の点線オービット (逆回転) */}
            <div
                aria-hidden
                className={`absolute inset-4 rounded-full ${styles.sealOrbitRev}`}
                style={{ border: '1px dashed rgba(108,62,244,0.35)' }}
            />

            {/* 底部のアンビエントグロー (paint 軽量) */}
            <div
                aria-hidden
                className="absolute -inset-2 rounded-full pointer-events-none"
                style={{
                    background:
                        'radial-gradient(circle at 50% 55%, rgba(240,187,56,0.18) 0%, rgba(240,187,56,0.06) 45%, transparent 70%)',
                }}
            />

            <svg
                viewBox="0 0 240 240"
                width="100%"
                height="100%"
                className="relative"
                role="img"
                aria-label="ProofMark Sealed Stamp"
            >
                <defs>
                    {/* ===== 金属質感グラデーション ===== */}
                    {/* 上部ハイライト → 下部シャドウ の物理質量ベース金属 */}
                    <radialGradient id="pm-seal-metal" cx="50%" cy="32%" r="72%">
                        <stop offset="0%" stopColor="#FFF3C4" stopOpacity="1" />
                        <stop offset="28%" stopColor="#F4C86A" stopOpacity="1" />
                        <stop offset="62%" stopColor="#B07E22" stopOpacity="1" />
                        <stop offset="100%" stopColor="#4A2E08" stopOpacity="1" />
                    </radialGradient>

                    {/* ベゼル(縁)専用のブラス光沢 */}
                    <linearGradient id="pm-seal-bezel" x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stopColor="#FFE9A8" stopOpacity="1" />
                        <stop offset="45%" stopColor="#8A5E17" stopOpacity="1" />
                        <stop offset="55%" stopColor="#5B3A08" stopOpacity="1" />
                        <stop offset="100%" stopColor="#F4CE72" stopOpacity="1" />
                    </linearGradient>

                    {/* 中央プラトーの陰影 (刻印テキストの床) */}
                    <radialGradient id="pm-seal-inner" cx="50%" cy="40%" r="65%">
                        <stop offset="0%" stopColor="#9E6A18" stopOpacity="0.95" />
                        <stop offset="70%" stopColor="#5A3806" stopOpacity="0.98" />
                        <stop offset="100%" stopColor="#2C1A02" stopOpacity="1" />
                    </radialGradient>

                    {/* ハイライト用の弧 (光の反射) */}
                    <linearGradient id="pm-seal-hi" x1="20%" y1="10%" x2="80%" y2="90%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                        <stop offset="45%" stopColor="rgba(255,255,255,0.05)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>

                    {/* ===== SVG フィルタ ===== */}
                    {/* 金属の微細テクスチャ (静止, GPU軽量) */}
                    <filter
                        id="pm-seal-texture"
                        x="0%"
                        y="0%"
                        width="100%"
                        height="100%"
                    >
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.9"
                            numOctaves="2"
                            seed="7"
                            stitchTiles="stitch"
                        />
                        <feColorMatrix
                            type="matrix"
                            values="0 0 0 0 1
                                    0 0 0 0 0.86
                                    0 0 0 0 0.5
                                    0 0 0 0.10 0"
                        />
                    </filter>

                    {/* 封印の奥から漏れる神秘的な発光 */}
                    <filter
                        id="pm-seal-glow"
                        x="-25%"
                        y="-25%"
                        width="150%"
                        height="150%"
                    >
                        <feDropShadow
                            dx="0"
                            dy="0"
                            stdDeviation="2.6"
                            floodColor="#F0BB38"
                            floodOpacity="0.42"
                        />
                    </filter>

                    {/* 刻印テキストの内側シャドウ (エンボス表現) */}
                    <filter id="pm-seal-emboss" x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow
                            dx="0"
                            dy="0.6"
                            stdDeviation="0.35"
                            floodColor="#000000"
                            floodOpacity="0.75"
                        />
                    </filter>

                    {/* ===== 円弧テキストパス ===== */}
                    <path id="pm-seal-arc-top" d="M 30,120 A 90,90 0 0 1 210,120" fill="none" />
                    <path id="pm-seal-arc-bot" d="M 210,120 A 90,90 0 0 1 30,120" fill="none" />

                    {/* ===== 暗号鍵モチーフ (中央上部の飾り) ===== */}
                    <symbol id="pm-key-glyph" viewBox="-8 -8 16 16">
                        <circle cx="0" cy="-2" r="3.2" fill="none" stroke="currentColor" strokeWidth="0.9" />
                        <path
                            d="M 0,1 L 0,6 M -2,3 L 0,3 M -2,5 L 0,5"
                            stroke="currentColor"
                            strokeWidth="0.9"
                            strokeLinecap="round"
                            fill="none"
                        />
                    </symbol>
                </defs>

                {/* ── Layer 0: 底部の神秘発光 (呼吸) ── */}
                <circle
                    cx="120"
                    cy="120"
                    r="112"
                    fill="rgba(240,187,56,0.06)"
                    filter="url(#pm-seal-glow)"
                >
                    <animate
                        attributeName="r"
                        values="110;114;110"
                        dur="6s"
                        repeatCount="indefinite"
                    />
                    <animate
                        attributeName="opacity"
                        values="0.55;0.9;0.55"
                        dur="6s"
                        repeatCount="indefinite"
                    />
                </circle>

                {/* ── Layer 1: メタルベゼル(外縁) ── */}
                <circle cx="120" cy="120" r="110" fill="url(#pm-seal-bezel)" />

                {/* ── Layer 2: 主円盤 (金属放射グラデ) ── */}
                <circle cx="120" cy="120" r="104" fill="url(#pm-seal-metal)" />

                {/* ── Layer 3: 金属テクスチャオーバーレイ ── */}
                <circle
                    cx="120"
                    cy="120"
                    r="104"
                    fill="url(#pm-seal-metal)"
                    filter="url(#pm-seal-texture)"
                    opacity="0.7"
                />

                {/* ── Layer 4: 上部ハイライト (光の反射) ── */}
                <ellipse
                    cx="120"
                    cy="68"
                    rx="78"
                    ry="18"
                    fill="url(#pm-seal-hi)"
                    opacity="0.55"
                />

                {/* ── Layer 5: 外周の細ダッシュ (刻印痕跡) ── */}
                <circle
                    cx="120"
                    cy="120"
                    r="96"
                    fill="none"
                    stroke="rgba(60,38,4,0.6)"
                    strokeWidth="0.6"
                    strokeDasharray="1.5 3.5"
                />

                {/* ── Layer 6: 微細な回転ダッシュ (自律駆動) ── */}
                <circle
                    cx="120"
                    cy="120"
                    r="88"
                    fill="none"
                    stroke="rgba(255,225,150,0.32)"
                    strokeWidth="0.5"
                    strokeDasharray="0.8 4"
                >
                    <animateTransform
                        attributeName="transform"
                        attributeType="XML"
                        type="rotate"
                        from="0 120 120"
                        to="360 120 120"
                        dur="88s"
                        repeatCount="indefinite"
                    />
                </circle>

                {/* ── Layer 7: 中央プラトー (刻印テキストの床) ── */}
                <circle cx="120" cy="120" r="72" fill="url(#pm-seal-inner)" />

                {/* 中央プラトーの外側リング (影のリム) */}
                <circle
                    cx="120"
                    cy="120"
                    r="72"
                    fill="none"
                    stroke="rgba(0,0,0,0.65)"
                    strokeWidth="1"
                />
                <circle
                    cx="120"
                    cy="120"
                    r="72"
                    fill="none"
                    stroke="rgba(255,225,150,0.35)"
                    strokeWidth="0.4"
                    transform="translate(0,-1)"
                />

                {/* ── Layer 8: 上弧テキスト (刻印) ── */}
                <text
                    fill="#3A2308"
                    fontSize="11"
                    fontWeight="900"
                    letterSpacing="4"
                    filter="url(#pm-seal-emboss)"
                >
                    <textPath href="#pm-seal-arc-top" startOffset="50%" textAnchor="middle">
                        ★ PROOFMARK ★ SEALED ★
                    </textPath>
                </text>

                {/* ── Layer 9: 下弧テキスト (規格情報) ── */}
                <text
                    fill="rgba(50,28,4,0.85)"
                    fontSize="9"
                    fontWeight="700"
                    letterSpacing="3.5"
                    filter="url(#pm-seal-emboss)"
                >
                    <textPath href="#pm-seal-arc-bot" startOffset="50%" textAnchor="middle">
                        RFC 3161 · SHA-256 · ZERO-KNOWLEDGE
                    </textPath>
                </text>

                {/* ── Layer 10: 中央プラトー内の暗号鍵モチーフ ── */}
                <g transform="translate(120,102)" opacity="0.9" color="#F0BB38">
                    <use href="#pm-key-glyph" x="-8" y="-8" width="16" height="16" />
                    {/* 中央の紋章 (☰ 三本線 — 権威の象徴) */}
                    <g
                        stroke="rgba(255,225,150,0.85)"
                        strokeWidth="0.9"
                        strokeLinecap="round"
                        transform="translate(0,20)"
                    >
                        <line x1="-14" y1="-2" x2="14" y2="-2" />
                        <line x1="-10" y1="2" x2="10" y2="2" />
                        <line x1="-14" y1="6" x2="14" y2="6" />
                    </g>
                </g>

                {/* ── Layer 11: 中央の隠れた暗号ハッシュ断片 ── */}
                <text
                    x="120"
                    y="152"
                    textAnchor="middle"
                    fill="rgba(255,225,150,0.6)"
                    fontSize="6.5"
                    fontFamily="ui-monospace, Menlo, monospace"
                    letterSpacing="2.5"
                >
                    e3b0c442 · 98fc1c14 · 9afbf4c8
                </text>

                {/* ── Layer 12: 底部の "SEALED" 銘板 ── */}
                <g transform="translate(120,184)">
                    {/* プレートの陰影 */}
                    <rect
                        x="-46"
                        y="-11"
                        width="92"
                        height="22"
                        rx="4"
                        fill="rgba(20,10,0,0.85)"
                        stroke="rgba(255,225,150,0.35)"
                        strokeWidth="0.5"
                    />
                    {/* プレート上部のハイライト */}
                    <rect
                        x="-46"
                        y="-11"
                        width="92"
                        height="4"
                        rx="4"
                        fill="rgba(255,225,150,0.15)"
                    />
                    <text
                        x="0"
                        y="5"
                        textAnchor="middle"
                        fill="#FFE39A"
                        fontSize="11"
                        fontWeight="900"
                        letterSpacing="5"
                        filter="url(#pm-seal-glow)"
                    >
                        SEALED
                    </text>
                </g>

                {/* ── Layer 13: 四隅の権威マーカー (羅針図の名残) ── */}
                {[0, 90, 180, 270].map((deg) => (
                    <g
                        key={deg}
                        transform={`rotate(${deg} 120 120) translate(120,22)`}
                        fill="rgba(60,38,4,0.85)"
                    >
                        <polygon points="0,-3 2.5,0 0,3 -2.5,0" />
                    </g>
                ))}

                {/* ── Layer 14: 微細な回転する暗号インデックス ── */}
                <g>
                    <circle
                        cx="120"
                        cy="120"
                        r="60"
                        fill="none"
                        stroke="rgba(255,225,150,0.18)"
                        strokeWidth="0.35"
                        strokeDasharray="0.5 2"
                    >
                        <animateTransform
                            attributeName="transform"
                            attributeType="XML"
                            type="rotate"
                            from="360 120 120"
                            to="0 120 120"
                            dur="120s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </g>

                {/* ── Layer 15: 頂点の星印 (権威の印) ── */}
                <g transform="translate(120,44)" fill="#FFE39A" filter="url(#pm-seal-emboss)">
                    <polygon points="0,-7 1.8,-2.2 7,-2.2 2.8,1 4.5,6 0,3 -4.5,6 -2.8,1 -7,-2.2 -1.8,-2.2" />
                </g>
            </svg>
        </motion.div>
    );
}


/* ─── Vault components (i18n Applied) ─────────────── */

const PurgedVaultFull = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-8 text-center relative overflow-hidden border border-zinc-800/50 rounded-xl">
        <div className="relative z-10 flex flex-col items-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-lg shadow-black/50">
                <svg className="w-10 h-10 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-200 mb-3 tracking-wide">
                {t.vault.purgedTitle}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                {t.vault.purgedDesc}
            </p>
        </div>
    </div>
);

function TranslucentVaultFull({ imageUrl }: { imageUrl: string }) {
    return (
        <div className="relative w-full h-full">
            <Image
                src={imageUrl}
                alt=""
                fill
                unoptimized={true}
                className="object-cover opacity-60 grayscale"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0e27]/40">
                <div className="rounded-full p-3 mb-3">
                    <Lock className="w-8 h-8 text-[#f0f0fa]/80" />
                </div>
                <span className="font-bold text-xs tracking-wider text-[#f0f0fa]/85 uppercase">{t.vault.ownerPreview}</span>
                <span className="font-mono text-[10px] tracking-widest text-[#00d4aa]/60 uppercase mt-1">{t.vault.ndaProtected}</span>
            </div>
        </div>
    );
}

function OwnerVaultFull() {
    return (
        <div
            className="flex flex-col items-center justify-center w-full h-full cursor-default overflow-hidden relative"
            style={{ backgroundColor: '#0a0e27' }}
        >
            <div className="rounded-full p-3 mb-4">
                <Lock className="w-10 h-10 text-[#6c3ef4]" />
            </div>
            <h4 className="font-bold tracking-wide text-[#f0f0fa] text-base mb-1 opacity-90">{t.vault.ndaProtected}</h4>
            <span className="font-mono text-[10px] tracking-widest text-[#6c3ef4] opacity-80 uppercase">{t.vault.ownerView}</span>
        </div>
    );
}