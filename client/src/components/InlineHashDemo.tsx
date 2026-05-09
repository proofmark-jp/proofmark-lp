"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Hash, AlertTriangle, ShieldCheck, FileIcon, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

/* ── Sample Asset ───────────────────────────────────────────────────────── */
const SAMPLE_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6C3EF4" />
      <stop offset="100%" stop-color="#00D4AA" />
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="#07061A" />
  <circle cx="400" cy="400" r="240" fill="url(#g)" opacity="0.8" />
  <text x="400" y="420" font-family="sans-serif" font-size="48" font-weight="bold" fill="#fff" text-anchor="middle">ProofMark Demo Asset</text>
</svg>`;

/* ── Theme ─────────────────────────────────────────────────────────────── */
const THEME = {
  bg: "#0A0E27",
  surface: "rgba(255, 255, 255, 0.03)",
  border: "rgba(255, 255, 255, 0.1)",
  primary: "#6C3EF4",
  accent: "#00D4AA",
  textMain: "#F0EFF8",
  textMuted: "#A8A0D8",
  error: "#FF4D4D",
};

/* ── Types ─────────────────────────────────────────────────────────────── */
type State = "idle" | "reading" | "hashing" | "done" | "error";

/* ── Component ─────────────────────────────────────────────────────────── */
export default function InlineHashDemo() {
  const [state, setState] = useState<State>("idle");
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [digest, setDigest] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const previousUrlRef = useRef<string>("");

  // アンマウント時のメモリ解放
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, []);

  // computeHash 関数
  async function computeHash(file: File) {
    try {
      setError("");
      setDigest("");
      setElapsedMs(null);

      // 🚨 安全装置: 20MB以上のファイルはブラウザクラッシュを防ぐため弾く
      if (file.size > 20 * 1024 * 1024) {
        setState("error");
        setError("デモ環境のため、20MB以下のファイルをご使用ください。");
        return;
      }

      setFileName(file.name);
      setFileSize(file.size);

      // 🚨 メモリリーク防止: 古いプレビューURLを確実に破棄
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
      const newUrl = URL.createObjectURL(file);
      previousUrlRef.current = newUrl;
      setPreviewUrl(newUrl);

      setState("reading");

      const startedAt = performance.now();
      const fileBuffer = await file.arrayBuffer();

      // Labor Illusion: 680〜760msの意図的な遅延
      const dwell = 680 + Math.round(Math.random() * 80);
      await new Promise((resolve) => window.setTimeout(resolve, dwell));

      setState("hashing");
      const digestBuffer = await window.crypto.subtle.digest("SHA-256", fileBuffer);
      
      const hex = Array.from(new Uint8Array(digestBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      setDigest(hex);
      setState("done");
      setElapsedMs(Math.round(performance.now() - startedAt));
    } catch (err) {
      console.error(err);
      setState("error");
      setError("この環境ではハッシュ計算を完了できませんでした。");
    }
  }

  /* ── Event Handlers ── */
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) computeHash(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) computeHash(file);
  };

  const handleSampleClick = () => {
    const blob = new Blob([SAMPLE_IMAGE_SVG], { type: "image/svg+xml" });
    const file = new File([blob], "proofmark-sample.svg", { type: "image/svg+xml" });
    computeHash(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl overflow-hidden border border-white/10 bg-[#0A0E27] shadow-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[480px]">
        
        {/* ── Left Pane: Dropzone ── */}
        <div className="relative p-8 md:p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10" style={{ background: "rgba(255,255,255,0.015)" }}>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Try it yourself</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              ブラウザ内で SHA-256 ハッシュを計算します。ファイルはサーバーに送信されません。
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            className="flex-1 min-h-[220px] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden group"
            style={{
              background: isDragOver ? "rgba(108,62,244,0.1)" : "rgba(255,255,255,0.03)",
              border: `2px dashed ${isDragOver ? THEME.primary : "rgba(255,255,255,0.15)"}`,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={onFileSelect}
            />
            <motion.div animate={{ scale: isDragOver ? 1.1 : 1, color: isDragOver ? THEME.primary : THEME.textMuted }} transition={{ duration: 0.2 }}>
              <UploadCloud className="w-10 h-10 mb-4 mx-auto opacity-70 group-hover:opacity-100 transition-opacity" />
            </motion.div>
            <p className="text-[15px] font-bold text-white/80 group-hover:text-white transition-colors">
              Click or drag a file
            </p>
            <p className="text-[12px] text-white/40 mt-1">
              Maximum file size: 20MB
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={handleSampleClick}
              className="text-[13px] font-semibold tracking-wide py-2.5 px-5 rounded-full transition-all hover:bg-white/5"
              style={{
                color: THEME.accent,
                background: "rgba(0,212,170,0.1)",
                border: "1px solid rgba(0,212,170,0.2)",
              }}
            >
              Test with a sample image
            </button>
          </div>
        </div>

        {/* ── Right Pane: Live Result ── */}
        <div className="p-8 md:p-12 relative flex flex-col" style={{ background: "#07061A" }}>
          <h3 className="text-[11px] uppercase tracking-[0.2em] font-bold text-white/40 mb-8 flex items-center gap-2">
            <Hash className="w-3.5 h-3.5" />
            Live Result
          </h3>

          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-white/30"
              >
                <FileIcon className="w-12 h-12 mb-4 opacity-50" strokeWidth={1} />
                <p className="text-sm">Waiting for input...</p>
              </motion.div>
            )}

            {(state === "reading" || state === "hashing") && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-8 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <FileIcon className="w-6 h-6 text-white/50" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[14px] font-bold text-white truncate">{fileName}</p>
                    <p className="text-[12px] text-white/40">{formatSize(fileSize)}</p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center mb-6 overflow-hidden border border-white/10 bg-black/50">
                    <Hash className="w-7 h-7 relative z-10" style={{ color: THEME.accent }} />
                    <motion.div
                      className="absolute inset-x-0 h-[2px]"
                      initial={{ top: "-4px" }}
                      animate={{ top: ["0%", "100%"] }}
                      transition={{ duration: 0.8, ease: "linear", repeat: Infinity }}
                      style={{
                        background: `linear-gradient(90deg, transparent, ${THEME.primary} 40%, ${THEME.accent} 60%, transparent)`,
                      }}
                    />
                  </div>
                  <p className="text-[14px] font-bold text-white">
                    {state === "reading" ? "Reading file buffer..." : "Computing SHA-256..."}
                  </p>
                  <p className="text-[12px] text-white/40 mt-1 font-mono uppercase tracking-wider">Browser Sandbox</p>
                </div>
              </motion.div>
            )}

            {state === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col h-full"
              >
                {/* プレビュー画像 */}
                {previewUrl && (
                  <div className="w-full h-32 md:h-40 rounded-xl overflow-hidden mb-6 border border-white/10 relative shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#07061A]/90 to-transparent z-10" />
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 left-4 z-20">
                      <p className="text-[13px] font-bold text-white truncate max-w-[200px] md:max-w-[250px]">{fileName}</p>
                      <p className="text-[11px] text-white/60">{formatSize(fileSize)}</p>
                    </div>
                  </div>
                )}

                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#00D4AA]" />
                  <p className="text-[14px] font-bold text-[#00D4AA]">Hash Computation Complete</p>
                  <span className="ml-auto text-[11px] font-mono text-white/30">{elapsedMs}ms</span>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-8 shrink-0">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">SHA-256 Digest</p>
                  <p className="text-[13px] font-mono text-[#00D4AA] break-all leading-relaxed select-all">
                    {digest}
                  </p>
                </div>

                <div className="mt-auto pt-4">
                  <Link href="/spot-issue">
                    <span className="flex items-center justify-center w-full py-3.5 rounded-xl text-[14px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.primary})`, cursor: "pointer" }}>
                      このまま証明書を発行する
                    </span>
                  </Link>
                </div>
              </motion.div>
            )}

            {state === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center px-4"
              >
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-[15px] font-bold text-white mb-2">処理エラー</p>
                <p className="text-[13px] text-red-400/80 max-w-[240px] leading-relaxed">{error}</p>
                <button
                  onClick={() => setState("idle")}
                  className="mt-6 text-[12px] font-bold text-white/50 hover:text-white/80 transition-colors underline"
                >
                  リトライする
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
