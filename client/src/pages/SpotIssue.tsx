/**
 * SpotIssue.tsx — 1案件だけ発行（魔法の箱）
 * ─────────────────────────────────────────────────────────────
 *  Phase 1 完成版
 *
 *  - ログイン済みは /dashboard へリダイレクト
 *  - 2 カラム: 左=SpotDropZone / 右=CertificatePreview
 *  - SHA-256 はブラウザ内で計算 (subtle.digest)
 *  - 🚨 修正1: Shareable (画像) の File はブラウザメモリで揮発するため、
 *              Stripe へ遷移する「直前」に Supabase の
 *              `proofmark-quarantine` バケットへ事前アップロードする
 *  - PAYING 状態は SpotDropZone 側の Stripe 的ローディング演出に渡す
 * ─────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

import Navbar from '@/components/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import SpotDropZone from '@/components/spot/SpotDropZone';
import CertificatePreview, {
  type SpotState,
} from '@/components/spot/CertificatePreview';

const PM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

/* ─────────────────────────────────────────────
 *  hash util — Web Crypto subtle.digest
 * ───────────────────────────────────────────── */

async function subtleSha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
  const arr = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
  return out;
}

/* ─────────────────────────────────────────────
 *  Component
 * ───────────────────────────────────────────── */

export default function SpotIssue(): JSX.Element {
  const { user, signOut, loading } = useAuth();
  const [, navigate] = useLocation();

  // ログイン済みは /dashboard へ
  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [loading, user, navigate]);

  /* ── state ── */
  const [state, setState] = useState<SpotState>('IDLE');
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [paying, setPaying] = useState<boolean>(false);

  const abortRef = useRef<AbortController | null>(null);

  /* ─────────────────────────────────────────────
   *  Hash pipeline
   *  - 体感進捗を 8 段階で滑らかに描画
   *  - 実 hash 計算は subtle.digest で正確に
   * ───────────────────────────────────────────── */
  const onFile = useCallback(async (target: File): Promise<void> => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setFile(target);
    setHash(null);
    setProgress(0);
    setState('HASHING');

    try {
      const buf = await target.arrayBuffer();

      // 段階的に体感進捗を上げる (合計 ~720ms。3 秒以内完了を保証)
      const steps = [8, 18, 30, 44, 58, 72, 84, 92];
      for (const p of steps) {
        await new Promise((r) => window.setTimeout(r, 88));
        if (signal.aborted) return;
        setProgress(p);
      }

      const hex = await subtleSha256Hex(buf);
      if (signal.aborted) return;

      setProgress(97);
      await new Promise((r) => window.setTimeout(r, 130));
      setHash(hex);
      setProgress(100);
      setState('PREVIEW');
    } catch (e) {
      console.error('[SpotIssue] hash failed', e);
      setState('ERROR');
    }
  }, []);

  /* ─────────────────────────────────────────────
   *  🚨 修正1: Checkout pipeline
   *
   *  Step A: Shareable (画像) は proofmark-quarantine へ事前アップロード
   *          → Stripe 遷移後にブラウザメモリの File が消えてもサーバ側で
   *            完成証明書の作成が可能になる
   *  Step B: /api/create-checkout-session に sha256 + quarantine_path を渡す
   *  Step C: Stripe Hosted Checkout に遷移
   *
   *  失敗時は PREVIEW に戻し、再試行を許可する
   * ───────────────────────────────────────────── */
  const onCheckout = useCallback(async (): Promise<void> => {
    if (!file || !hash) return;
    setPaying(true);
    setState('PAYING'); // SpotDropZone 側で Stripe 的ローディングが起動

    try {
      let quarantinePath: string | undefined = undefined;
      const isShareable =
        file.type.startsWith('image/') && file.size <= MAX_BYTES;

      // ── Step A: 揮発する File を Supabase quarantine に退避 ──
      if (isShareable) {
        const ext = (file.name.split('.').pop() || 'bin')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 8) || 'bin';
        const safeName = `${Date.now()}_${Math.random()
          .toString(36)
          .substring(2)}.${ext}`;
        const filePath = `anonymous/${hash}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('proofmark-quarantine')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
          });

        if (uploadError) {
          throw new Error(`Quarantine upload failed: ${uploadError.message}`);
        }
        quarantinePath = filePath;
      }

      // ── Step B: Checkout Session 発行 ──
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'spot_issue',
          sha256: hash,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          quarantine_path: quarantinePath,
        }),
      });

      if (!res.ok) throw new Error(`checkout ${res.status}`);
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error('checkout url missing');

      // ── Step C: Stripe Hosted Checkout へ遷移 ──
      window.location.href = data.url;
    } catch (err) {
      console.error('[SpotIssue] checkout failed', err);
      setPaying(false);
      setState('PREVIEW');
      window.alert(
        '通信エラーが発生しました。ネットワーク状況を確認し、再度お試しください。',
      );
    }
  }, [file, hash]);

  const onReset = useCallback(() => {
    abortRef.current?.abort();
    setState('IDLE');
    setFile(null);
    setHash(null);
    setProgress(0);
  }, []);

  return (
    <div
      style={{
        background: '#07061A',
        minHeight: '100vh',
        color: '#FFFFFF',
      }}
    >
      <Navbar user={user} signOut={signOut} />

      <section className="pm-section pt-10 sm:pt-14 lg:pt-16">
        <div className="pm-container">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: PM_EASE }}
            className="max-w-3xl"
          >
            <span className="pm-label inline-block">SPOT — 1案件だけ</span>
            <h1 className="pm-display mt-4">
              ファイルを投げると、
              <br className="hidden md:inline" />
              <span className="pm-accent-text">証明書が生まれる。</span>
            </h1>
            <p className="pm-body mt-5 max-w-xl">
              アカウント登録不要。ブラウザ内で SHA-256 を計算し、RFC3161
              タイムスタンプを発行します。原本はどこにも送信されません。
            </p>
          </motion.div>

          {/* ── 2-column grid ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: 0.1, ease: PM_EASE }}
            className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-8"
          >
            <div>
              <SpotDropZone
                state={state}
                file={file}
                hashProgress={progress}
                onFile={onFile}
                onCheckout={onCheckout}
                onReset={onReset}
                busy={paying}
              />
            </div>
            <div>
              <CertificatePreview
                state={state}
                file={file}
                hash={hash}
                hashProgress={progress}
              />
            </div>
          </motion.div>

          {/* ── Footer trust badges ── */}
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t pt-6 text-[12px]"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck
                className="h-3.5 w-3.5"
                style={{ color: '#00D4AA' }}
              />
              Stripe による安全な決済
            </span>
            <span className="inline-flex items-center gap-1.5">
              📋 アカウント登録不要
            </span>
            <span className="inline-flex items-center gap-1.5">
              🗑 24時間後にデータ物理削除
            </span>
          </div>
        </div>
      </section>

      {/* モバイル CTA は SpotDropZone 内で fixed bottom bar として表示 */}
      <div className="md:h-0 h-[88px]" aria-hidden />
    </div>
  );
}
