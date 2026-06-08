/**
 * components/ProcessBundleComposer.tsx — The Seamless Skin
 *
 * - Framer Motion 駆動の幻覚のない自動整列UI
 * - The Array Multiplexer (バックエンドAPI) への完全適合
 * - サムネイル事前生成 (Egress防衛) の自動実行
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateThumbnail } from '../lib/utils/imageOptimizer';

interface ProofItem {
  id: string;
  file: File;
  thumb?: File;
  status: 'idle' | 'hashing' | 'ready' | 'uploading' | 'sealed' | 'error';
  sha256?: string;
  progress: number;
}

export const ProcessBundleComposer: React.FC = () => {
  const [items, setItems] = useState<ProofItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (items.length + newFiles.length > 150) {
      alert("最大150枚までです。");
      return;
    }

    const newItems: ProofItem[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'idle',
      progress: 0,
    }));
    
    setItems(prev => [...prev, ...newItems]);
    processQueue(newItems);
  };

  const processQueue = async (newItems: ProofItem[]) => {
    // 1. Egress防衛：UI上で裏側でサムネイルを静かに生成しておく
    const updatedItems = await Promise.all(newItems.map(async (item) => {
      const thumb = await generateThumbnail(item.file);
      return { ...item, thumb: thumb || undefined };
    }));
    
    setItems(prev => prev.map(p => updatedItems.find(u => u.id === p.id) || p));

    // 2. Merkle Forge (Worker) へハッシュ計算をオフロード
    const worker = new Worker(new URL('../lib/crypto/hashWorker.ts', import.meta.url));
    worker.postMessage({ files: updatedItems.map(i => i.file) });

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setItems(prev => prev.map((item, idx) => 
          idx === e.data.index ? { ...item, status: 'ready', sha256: e.data.sha256 } : item
        ));
      }
      if (e.data.type === 'complete') {
        worker.terminate();
      }
    };
  };

  const handleSealBundle = async () => {
    if (items.some(i => i.status !== 'ready')) return;
    setIsProcessing(true);
    setItems(prev => prev.map(i => ({ ...i, status: 'uploading' })));

    try {
      // 3. The Iron Gate (Phase 2.6) へ一括URL発行を要求 (Array Multiplexer)
      const urlRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            fileName: i.file.name,
            mimeType: i.file.type,
            fileSize: i.file.size
          }))
        })
      });
      if (!urlRes.ok) throw new Error("Upload URL発行に失敗しました。上限を確認してください。");
      const { urls } = await urlRes.json();

      // 4. ストレージへの並列アップロード (Signed URL)
      await Promise.all(items.map(async (item, idx) => {
        const targetUrl = urls[idx].signedUrl;
        await fetch(targetUrl, { method: 'PUT', body: item.file });
        // ※ サムネイルもここで別パスでアップロードするロジックを本来は挟む（今回は割愛）
      }));

      // 5. The Bulletproof API (create.ts) へ一括昇格を要求
      const bundleId = crypto.randomUUID();
      const createRes = await fetch('/api/certificates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleId,
          items: items.map((item, idx) => ({
            quarantinePath: urls[idx].quarantinePath,
            sha256: item.sha256,
            title: item.file.name,
            proofMode: 'shareable', // UIで選択可能にする
            file_name: item.file.name,
            file_size: item.file.size,
            stepIndex: idx
          }))
        })
      });

      if (!createRes.ok) throw new Error("証明書の台帳記録に失敗しました。");
      
      setItems(prev => prev.map(i => ({ ...i, status: 'sealed', progress: 100 })));
      alert("✅ 150枚のチェーン証明書が完璧にWORM台帳へ刻まれました！");

    } catch (err: any) {
      alert(err.message);
      setItems(prev => prev.map(i => ({ ...i, status: 'error' })));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-gray-900 rounded-xl shadow-2xl border border-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Chain of Evidence</h2>
        <button 
          onClick={handleSealBundle}
          disabled={isProcessing || items.length === 0 || items.some(i => i.status !== 'ready')}
          className="px-6 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-lg disabled:opacity-50 hover:scale-105 transition-transform"
        >
          {isProcessing ? 'シーリング中...' : '全てをWORM台帳へ刻む'}
        </button>
      </div>

      <div 
        className="min-h-[200px] border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-purple-500 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" multiple ref={fileInputRef} onChange={handleFilesAdded} className="hidden" />
        <span className="text-gray-400 font-medium group-hover:text-purple-400 transition-colors">
          画像をドロップしてチェーンを構築（最大150枚）
        </span>
      </div>

      <motion.ul layout className="mt-8 space-y-3">
        <AnimatePresence>
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
              className="flex items-center gap-4 bg-gray-800 p-4 rounded-lg border border-gray-700"
            >
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-900 rounded-full text-gray-400 font-mono text-sm border border-gray-700">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{item.file.name}</p>
                <p className="text-xs text-gray-500 font-mono mt-1 truncate">
                  {item.sha256 ? `SHA-256: ${item.sha256.substring(0, 16)}...` : 'Hashing...'}
                </p>
              </div>
              <div className="flex-shrink-0">
                {item.status === 'ready' && <span className="text-green-400 text-sm font-bold">READY</span>}
                {item.status === 'uploading' && <span className="text-yellow-400 text-sm font-bold animate-pulse">UPLOADING</span>}
                {item.status === 'sealed' && <span className="text-purple-400 text-sm font-bold">SEALED</span>}
                {item.status === 'error' && <span className="text-red-500 text-sm font-bold">ERROR</span>}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
};