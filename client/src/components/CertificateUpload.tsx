/**
 * CertificateUpload — 作品アップロードUIコンポーネント
 * ログイン不要でSHA-256ハッシュ計算＆タイムスタンプ表示まで可能。
 * PDF保存のみログインが必要。
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileImage, CheckCircle2, AlertCircle, X, Lock, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDirectUpload } from "@/hooks/useDirectUpload";
import { Link } from "wouter";
import HashWorker from '../workers/hashWorker?worker';

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ---------------------------------------------------------------------------
// ブラウザ内SHA-256計算（Workerを使用した非同期フリーズ回避版）
// ---------------------------------------------------------------------------
function computeSHA256WithWorker(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. Workerをインスタンス化
    const worker = new HashWorker();

    // 2. Workerから返事が来た時の処理
    worker.onmessage = (e) => {
      const { success, hash, error } = e.data;
      worker.terminate(); // 終わったら即解雇（メモリ解放）

      if (success) {
        resolve(hash); // 成功：ハッシュ値を返す
      } else {
        reject(new Error(error));
      }
    };

    // Worker自体がエラーで落ちた時の処理
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    // 3. Workerにファイルを渡して計算スタート
    worker.postMessage(file);
  });
}

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

interface CertificateUploadProps {
  onUploadComplete?: (storagePath: string) => void;
  userId?: string;
  className?: string;
}

interface LocalHashResult {
  hash: string;
  timestamp: string;
  fileName: string;
  fileSize: number;
}

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export function CertificateUpload({
  onUploadComplete,
  userId = "anon",
  className = "",
}: CertificateUploadProps) {
  const { user } = useAuth();

  const { uploading, progress, error, certificateId, uploadFile, reset } =
    useDirectUpload();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localResult, setLocalResult] = useState<LocalHashResult | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── バリデーション（ログイン不要版）────────────────────────────────
  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      return `対応していないファイル形式です。JPEG / PNG / GIF / WebP / AVIF / HEIC のみ対応しています。`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB 以下のファイルを選択してください。`;
    }
    return null;
  }, []);

  // ── ファイル選択/ドロップ処理（ログイン前でもハッシュ計算） ─────────
  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file) return;

      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      setSelectedFile(file);
      setLocalResult(null);

      // ログイン済みの場合は通常フロー（サーバー保存）
      if (user) {
        const certId = await uploadFile(file, user.id);
        if (certId) {
          toast.success("🎉 証明書の発行が完了しました！", {
            description: "証明書ページへ移動します...",
            duration: 3000,
          });
          window.location.href = `/cert/${certId}`;
        } else {
          toast.error("アップロードに失敗しました", {
            description: "ネットワーク接続を確認して、再度お試しください。",
          });
        }
        return;
      }

      // ── ログイン前：ブラウザ内でのみSHA-256計算 ──
      setIsHashing(true);
      try {
        const hash = await computeSHA256WithWorker(file);
        const now = new Date();
        const timestamp = now.toLocaleString("ja-JP", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        });
        setLocalResult({
          hash,
          timestamp,
          fileName: file.name,
          fileSize: file.size,
        });
      } catch {
        toast.error("ハッシュ計算に失敗しました。");
      } finally {
        setIsHashing(false);
      }
    },
    [uploadFile, user, validateFile]
  );

  // ── ドラッグ&ドロップイベント ──────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const handleReset = useCallback(() => {
    reset();
    setSelectedFile(null);
    setLocalResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [reset]);

  // 💡 【修正箇所】iOSのスワイプバック（bfcache）復帰時に状態をリセットする
  // ※ handleReset が定義された後に配置することでエラーを防ぎます。
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        handleReset();
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [handleReset]);

  // ── 表示状態 ─────────────────────────────────────────────────────
  const isCompleted = certificateId !== null;

  return (
    <div className={`w-full ${className}`}>
      <AnimatePresence mode="wait">
        {/* ── サーバー保存完了状態（ログイン済みユーザー） ── */}
        {isCompleted ? (
          <motion.div
            key="completed"
            className="relative rounded-2xl border overflow-hidden p-8 text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,212,170,0.12) 0%, rgba(21,29,47,0.95) 60%)",
              border: "2px solid rgba(0,212,170,0.45)",
              boxShadow: "0 0 40px rgba(0,212,170,0.15)",
              backdropFilter: "blur(12px)",
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(0,212,170,0.15)", border: "1px solid rgba(0,212,170,0.3)" }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
            >
              <CheckCircle2 className="w-8 h-8 text-accent" />
            </motion.div>
            <h3 className="text-lg font-bold mb-2">証明書ページへ移動中...</h3>
            <p className="text-sm text-muted mb-6">少々お待ちください。</p>
          </motion.div>
        ) : localResult ? (
          /* ── ローカルハッシュ結果表示（未ログイン） ── */
          <motion.div
            key="local-result"
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(108,62,244,0.12) 0%, rgba(21,29,47,0.95) 60%)",
              border: "2px solid rgba(108,62,244,0.4)",
              boxShadow: "0 0 32px rgba(108,62,244,0.15)",
              backdropFilter: "blur(12px)",
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="p-8">
              {/* ヘッダー */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(0,212,170,0.15)", border: "1px solid rgba(0,212,170,0.3)" }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-accent">ハッシュ計算完了</p>
                    <p className="text-xs text-muted">ブラウザ内でローカル処理</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-muted hover:text-foreground transition-colors"
                  aria-label="リセット"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ファイル情報 */}
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: "rgba(15,22,41,0.7)", border: "1px solid rgba(42,42,78,0.6)" }}
              >
                <p className="text-xs text-muted mb-1">ファイル名</p>
                <p className="text-sm font-semibold truncate">{localResult.fileName}</p>
                <p className="text-xs text-muted mt-1">
                  {(localResult.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* SHA-256ハッシュ */}
              <div
                className="rounded-xl p-4 mb-4"
                style={{ background: "rgba(15,22,41,0.7)", border: "1px solid rgba(42,42,78,0.6)" }}
              >
                <p className="text-xs text-muted mb-2">SHA-256 デジタル指紋</p>
                <p
                  className="text-xs font-mono break-all leading-relaxed"
                  style={{ color: "#00D4AA", fontFamily: "'Space Mono', monospace" }}
                >
                  {localResult.hash}
                </p>
              </div>

              {/* タイムスタンプ */}
              <div
                className="rounded-xl p-4 mb-6"
                style={{ background: "rgba(15,22,41,0.7)", border: "1px solid rgba(42,42,78,0.6)" }}
              >
                <p className="text-xs text-muted mb-2">計算日時（ローカル）</p>
                <p className="text-sm font-semibold" style={{ fontFamily: "'Space Mono', monospace" }}>
                  {localResult.timestamp}
                </p>
              </div>

              {/* PDF保存ボタン（ログインへ誘導） */}
              <div
                className="rounded-xl p-4 mb-4 text-center"
                style={{
                  background: "rgba(108,62,244,0.08)",
                  border: "1px dashed rgba(108,62,244,0.35)",
                }}
              >
                <Lock className="w-4 h-4 text-primary mx-auto mb-2" />
                <p className="text-xs text-muted mb-3">
                  PDF証明書として保存・改ざん防止クラウド記録にはログインが必要です
                </p>
                <Link href="/auth">
                  <motion.button
                    className="w-full px-6 py-3 rounded-full font-bold text-sm text-primary-foreground flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, #6c3ef4, rgba(108,62,244,0.85))",
                      boxShadow: "0 0 20px rgba(108,62,244,0.4)",
                    }}
                    whileHover={{ boxShadow: "0 0 32px rgba(108,62,244,0.6)", scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download className="w-4 h-4" />
                    ログインしてPDF証明書を保存
                  </motion.button>
                </Link>
              </div>

              <p className="text-center text-xs text-muted">
                ※ このハッシュはブラウザ内でのみ計算されており、サーバーには送信されていません。
              </p>
            </div>
          </motion.div>
        ) : (
          /* ── アップロードゾーン ── */
          <motion.div
            key="dropzone"
            className="relative rounded-2xl border-2 border-dashed overflow-hidden cursor-pointer"
            style={{
              background: isDragOver
                ? "rgba(108,62,244,0.1)"
                : "rgba(21,29,47,0.6)",
              borderColor: isDragOver
                ? "rgba(108,62,244,0.6)"
                : isHashing || uploading
                  ? "rgba(108,62,244,0.4)"
                  : "rgba(42,42,78,0.7)",
              boxShadow: isDragOver
                ? "0 0 30px rgba(108,62,244,0.2)"
                : "none",
              backdropFilter: "blur(12px)",
              transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!isHashing && !uploading) inputRef.current?.click();
            }}
            role="button"
            aria-label="作品ファイルをドロップまたはクリックして選択"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isHashing && !uploading) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
          >
            {/* ── ハッシュ計算中 / アップロード中オーバーレイ ── */}
            <AnimatePresence>
              {(isHashing || uploading) && (
                <motion.div
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                  style={{
                    background: "rgba(10,14,39,0.85)",
                    backdropFilter: "blur(8px)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* スピナー */}
                  <motion.div
                    className="w-12 h-12 border-4 rounded-full mb-4"
                    style={{
                      borderColor: "rgba(108,62,244,0.2)",
                      borderTopColor: "#6c3ef4",
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  {uploading && (
                    <div
                      className="w-48 h-1.5 rounded-full overflow-hidden mb-3"
                      style={{ background: "rgba(42,42,78,0.7)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: "linear-gradient(90deg, #6c3ef4, #00d4aa)",
                        }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                  <p className="text-sm font-semibold text-foreground">
                    {isHashing ? "SHA-256を計算中..." : `処理中... ${progress}%`}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    ブラウザ内で安全にローカルハッシュを計算中...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── エラー表示 ── */}
            {error && !uploading && (
              <motion.div
                className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.35)",
                  color: "#f87171",
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                エラー
                <button
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  className="ml-1 hover:opacity-70 transition-opacity"
                  aria-label="エラーをクリア"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}

            {/* ── デフォルトコンテンツ ── */}
            <div className="p-10 flex flex-col items-center text-center">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: "rgba(108,62,244,0.12)",
                  border: "1px solid rgba(108,62,244,0.25)",
                }}
                animate={isDragOver ? { scale: 1.12 } : { scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <FileImage className="w-8 h-8 text-primary" />
              </motion.div>

              <h3 className="text-base font-bold mb-2">
                作品ファイルをここにドロップ
              </h3>
              <p className="text-sm text-muted mb-4">
                または{" "}
                <span className="text-primary font-semibold underline underline-offset-2">
                  クリックして選択
                </span>
              </p>

              <p className="text-xs text-muted/60 mb-4">
                JPEG / PNG / GIF / WebP / AVIF / HEIC · 最大 {MAX_FILE_SIZE_MB}MB
              </p>

              {/* ログイン状態別ヒント */}
              {!user ? (
                <div
                  className="px-4 py-2 rounded-xl text-xs text-center mb-2"
                  style={{
                    background: "rgba(0,212,170,0.08)",
                    border: "1px solid rgba(0,212,170,0.2)",
                    color: "#00D4AA",
                  }}
                >
                  ログイン不要でSHA-256ハッシュ計算＆タイムスタンプを確認できます
                </div>
              ) : null}

              {/* セキュリティバッジ */}
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {[
                  "🔒 Direct Upload（Vercel非経由）",
                  "🔐 SHA-256 ブラウザ内ローカルハッシュ",
                ].map((badge) => (
                  <span
                    key={badge}
                    className="text-xs px-3 py-1 rounded-full"
                    style={{
                      background: "rgba(42,42,78,0.6)",
                      border: "1px solid rgba(42,42,78,0.8)",
                      color: "#a0a0c0",
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_MIME_TYPES.join(",")}
              onChange={handleInputChange}
              className="hidden"
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}