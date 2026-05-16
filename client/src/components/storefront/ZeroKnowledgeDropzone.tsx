/**
 * ZeroKnowledgeDropzone — 完全クライアントサイドのハッシュ照合 UI。
 *
 * 法務担当者の懸念をデザインで解決する：
 *   • ファイルは fetch / XHR を一切使わず、Web Crypto API で SHA-256 を計算。
 *   • ハッシュだけを GET クエリで送信して Lookup → 照合結果を返す。
 *   • 文言・アニメーションで「アップロードしていない」事実を強調。
 *
 * UX:
 *   • drag-over → primary glow + ripple
 *   • hashing   → プログレスバー (Web Crypto は同期に近いが、UX 上 200ms 程度演出)
 *   • match     → 緑 ✓ + verify URL へのリンク
 *   • no_match  → 「このスタジオの公開実績には一致しません」
 *
 * 安全性:
 *   • 入力は <input type="file"> のみ。ペースト・URL を許容しない。
 *   • 1 ファイルあたり最大 100MB のソフトリミット (FileReader 不要、
 *     Stream 経由で SHA-256 を計算する)。
 *   • 照合先 username をサーバ側で絞り込む → 他者プロファイルでの誤照合を防ぐ。
 */

import { useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2, FileSearch, Loader2, ShieldCheck, ShieldQuestion, UploadCloud, X,
} from 'lucide-react';
import { useHashFile } from '../../hooks/useHashFile';

interface MatchPrimary {
  certificate_id: string;
  title: string;
  proven_at: string | null;
  certified_at: string | null;
  tsa_provider: string | null;
  verify_url: string;
  badge_tier: string | null;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'hashing'; progress: number; fileName: string }
  | { kind: 'match'; primary: MatchPrimary; others: MatchPrimary[]; sha256: string; fileName: string }
  | { kind: 'no_match'; sha256: string; fileName: string }
  | { kind: 'error'; message: string };

interface Props {
  /** 照合対象を絞る owner username。指定すると同名スタジオの公開実績のみ照合。 */
  username: string;
}

const MAX_BYTES = 2000 * 1024 * 1024; // 2GB

export function ZeroKnowledgeDropzone({ username }: Props) {
  const { hashFile } = useHashFile();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file.size === 0) {
      setPhase({ kind: 'error', message: '空のファイルは検証できません。' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase({ kind: 'error', message: 'ファイルが大きすぎます (2GB 以下)。' });
      return;
    }

    setPhase({ kind: 'hashing', progress: 0.05, fileName: file.name });

    try {
      // Web Worker によるストリーミングハッシュ計算 (OOM回避)
      const { sha256 } = await hashFile(file, {
        onProgress: ({ progress }) => {
          setPhase({
            kind: 'hashing',
            progress: Math.max(0.02, progress),
            fileName: file.name,
          });
        },
      });
      const sha256Hex = sha256;

      // ── 照合: ハッシュ"だけ"を送る ────────────────────────────────
      const url = new URL('/api/certificates/lookup-by-hash', window.location.origin);
      url.searchParams.set('sha256', sha256Hex);
      if (username) url.searchParams.set('username', username);

      const res = await fetch(url.toString(), { credentials: 'omit' });
      const body = (await res.json().catch(() => ({}))) as {
        match?: boolean;
        primary?: MatchPrimary;
        others?: MatchPrimary[];
        error?: string;
      };
      if (!res.ok) {
        setPhase({ kind: 'error', message: body.error ?? `HTTP ${res.status}` });
        return;
      }
      if (body.match && body.primary) {
        setPhase({
          kind: 'match',
          primary: body.primary,
          others: body.others ?? [],
          sha256: sha256Hex,
          fileName: file.name,
        });
      } else {
        setPhase({ kind: 'no_match', sha256: sha256Hex, fileName: file.name });
      }
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error)?.message ?? '検証に失敗しました' });
    }
  }, [username, hashFile]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const reset = () => setPhase({ kind: 'idle' });

  return (
    <section
      aria-label="Zero-Knowledge Dropzone — 受領した素材の検証"
      className="relative overflow-hidden rounded-[calc(0.65rem+4px)] border border-[#2a2a4e] bg-[#151d2f] p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{
              color: '#00D4AA',
              background: 'rgba(0,212,170,0.10)',
              border: '1px solid rgba(0,212,170,0.40)',
            }}
          >
            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
            Zero-Knowledge
          </p>
          <h2 className="font-display font-extrabold text-[20px] sm:text-[22px] text-[#f0f0fa] leading-tight">
            受け取った素材を、いま、ここで検証
          </h2>
          <p className="mt-1.5 text-[13px] text-[#a0a0c0] leading-relaxed">
            <span className="text-[#f0f0fa]/85 font-semibold">ファイルは一切アップロードされません。</span>
            ブラウザ内で SHA-256 を計算し、ハッシュだけを照合します。
          </p>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="ファイルをドロップしてハッシュ照合"
        className="relative rounded-[calc(0.65rem)] border-2 border-dashed transition-colors min-h-[180px] flex items-center justify-center text-center px-5 py-8"
        style={{
          borderColor: dragOver ? 'rgba(0,212,170,0.55)' : '#2a2a4e',
          background: dragOver
            ? 'radial-gradient(circle at center, rgba(0,212,170,0.10), transparent 70%), #0a0e27'
            : '#0a0e27',
          boxShadow: dragOver ? '0 0 24px rgba(0,212,170,0.18)' : 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = ''; // 同じファイルを再選択できるようにする
          }}
        />

        <AnimatePresence mode="wait">
          {phase.kind === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
              <UploadCloud className="w-7 h-7 text-[#a0a0c0]" aria-hidden="true" />
              <p className="text-[14px] text-[#f0f0fa]/85 font-semibold">
                ファイルをここにドロップ
              </p>
              <p className="text-[11px] text-[#a0a0c0]">
                クリックしても選択できます · 最大 2GB
              </p>
            </motion.div>
          )}

          {phase.kind === 'hashing' && (
            <motion.div key="hashing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 w-full max-w-md">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#6C3EF4' }} aria-hidden="true" />
              <p className="text-[13px] text-[#f0f0fa] font-semibold truncate max-w-full" title={phase.fileName}>
                {phase.fileName}
              </p>
              <div className="w-full h-1.5 rounded-full bg-[#2a2a4e] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(phase.progress * 100)}>
                <motion.div
                  className="h-full"
                  initial={{ width: '8%' }}
                  animate={{ width: `${Math.round(phase.progress * 100)}%` }}
                  transition={{ ease: 'easeOut', duration: 0.25 }}
                  style={{ background: 'linear-gradient(90deg, #6C3EF4, #00D4AA)' }}
                />
              </div>
              <p className="text-[10px] text-[#a0a0c0] uppercase tracking-widest">
                Hashing in browser · no upload
              </p>
            </motion.div>
          )}

          {phase.kind === 'match' && (
            <motion.div key="match" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl">
              <div className="flex items-start gap-3 text-left">
                <CheckCircle2 className="w-7 h-7 shrink-0" style={{ color: '#00D4AA' }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#00D4AA' }}>
                    照合一致
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-[#f0f0fa] truncate">
                    {phase.primary.title}
                  </p>
                  <p className="mt-1 text-[11px] text-[#a0a0c0] font-mono break-all">
                    sha256: {phase.sha256}
                  </p>
                  <a
                    href={phase.primary.verify_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-[calc(0.65rem-2px)] px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, #6C3EF4, #00D4AA)',
                      color: '#0a0e27',
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    検証ページを開く
                  </a>
                  {phase.others.length > 0 && (
                    <p className="mt-2 text-[10px] text-[#a0a0c0]">
                      同一ハッシュの再発行が {phase.others.length} 件存在します。
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="p-1 rounded-md text-[#a0a0c0] hover:text-[#f0f0fa] hover:bg-white/5"
                  aria-label="閉じる"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {phase.kind === 'no_match' && (
            <motion.div key="no_match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-xl">
              <div className="flex items-start gap-3 text-left">
                <ShieldQuestion className="w-7 h-7 shrink-0" style={{ color: '#FFD966' }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold uppercase tracking-widest" style={{ color: '#FFD966' }}>
                    照合一致なし
                  </p>
                  <p className="mt-1 text-[13px] text-[#f0f0fa]/85">
                    このスタジオの公開実績にはこのファイルのハッシュは登録されていません。
                  </p>
                  <p className="mt-1 text-[11px] text-[#a0a0c0] font-mono break-all">
                    sha256: {phase.sha256}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#00D4AA] hover:underline"
                  >
                    <FileSearch className="w-3 h-3" aria-hidden="true" />
                    別のファイルを試す
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {phase.kind === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md">
              <p className="text-[13px]" style={{ color: '#FCA5A5' }}>{phase.message}</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="mt-2 text-[11px] text-[#a0a0c0] hover:text-[#f0f0fa]"
              >
                もう一度試す
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-3 text-[10px] text-[#a0a0c0] flex items-center gap-1.5">
        <ShieldCheck className="w-3 h-3" aria-hidden="true" />
        ハッシュ計算は <code className="font-mono">hash-wasm (WebAssembly) ストリーミング処理</code> によりブラウザ内で完結します。
      </p>
    </section>
  );
}

