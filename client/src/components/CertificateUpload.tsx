import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { Shield, Eye, ShieldCheck, UploadCloud } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type ProofMode = 'private' | 'shareable';

export default function CertificateUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [proofMode, setProofMode] = useState<ProofMode>('private');
  const [processStatus, setProcessStatus] = useState<string>('');
  const [, setLocation] = useLocation();

  // ブラウザ内ハッシュ計算 (Private)
  const calculateHash = async (file: File): Promise<string> => {
    setProcessStatus('ブラウザ内でSHA-256ハッシュを計算中...');
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Storageへのアップロード (Shareable)
  const uploadImage = async (file: File, certId: string): Promise<string | null> => {
    setProcessStatus('暗号化通信で画像をセキュアストレージに保存中...');
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id || 'anonymous';
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${certId}/original.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('proofmark-assets')
      .upload(filePath, file);

    if (error) {
      console.error("Storage upload error:", error);
      throw error;
    }
    return data.path;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  }, []);

  const handleIssueCertificate = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      // 1. ハッシュ計算 (常にローカルで実行)
      const fileHash = await calculateHash(file);
      setHash(fileHash);

      // 2. DBレコードの仮作成 (IDを取得するため)
      setProcessStatus('ブロックチェーンレベルの存在証明を生成中...');
      const { data: certData, error: certError } = await supabase
        .from('certificates')
        .insert([{ 
            sha256: fileHash, 
            original_filename: file.name,
            title: file.name,
            mime_type: file.type,
            file_size: file.size,
            proof_mode: proofMode 
        }])
        .select()
        .single();

      if (certError || !certData) throw certError;

      // 3. Shareableモードの場合のみ、StorageへアップロードしてDB更新
      if (proofMode === 'shareable') {
        const storagePath = await uploadImage(file, certData.id);
        await supabase
          .from('certificates')
          .update({ storage_path: storagePath })
          .eq('id', certData.id);
      }

      setProcessStatus('完了しました。証明書ページへリダイレクトします...');
      
      // 4. リダイレクト
      setTimeout(() => {
        setLocation(`/cert/${certData.id}`);
      }, 1000);

    } catch (error) {
      console.error("Process failed:", error);
      setProcessStatus('エラーが発生しました。もう一度お試しください。');
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1
  });

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-[#0D0B24] rounded-3xl border border-[#1C1A38] text-white shadow-2xl">
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${
            isDragActive 
              ? 'border-[#00D4AA] bg-[#00D4AA]/10' 
              : 'border-slate-700 hover:border-[#6C3EF4] hover:bg-[#15132D]'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-white font-bold text-xl mb-2">作品をドラッグ＆ドロップして証明を開始</p>
          <p className="text-[#A8A0D8] text-sm">またはクリックしてファイルを選択</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row gap-6 items-center bg-[#07061A] p-6 rounded-2xl border border-[#1C1A38]">
            <img src={preview!} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-slate-700" />
            <div className="flex-1 w-full text-left">
              <p className="text-xs text-[#00D4AA] font-bold uppercase tracking-widest mb-1">Target Asset</p>
              <p className="text-lg font-bold truncate">{file.name}</p>
              <p className="text-sm text-[#A8A0D8]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button 
                onClick={() => { setFile(null); setPreview(null); }}
                className="text-sm text-slate-400 hover:text-white underline transition-colors"
                disabled={isProcessing}
            >
                選び直す
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00D4AA]" /> 証明モードの選択
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Private Mode */}
              <div 
                onClick={() => !isProcessing && setProofMode('private')}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    proofMode === 'private' ? 'border-[#00D4AA] bg-[#00D4AA]/5' : 'border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-500'}`} />
                        <h4 className={`font-bold ${proofMode === 'private' ? 'text-[#00D4AA]' : 'text-slate-300'}`}>Private Proof</h4>
                    </div>
                    {proofMode === 'private' && <div className="w-3 h-3 rounded-full bg-[#00D4AA] shadow-[0_0_10px_#00D4AA]" />}
                </div>
                <p className="text-xs text-[#A8A0D8] mb-3">原画を一切送信せず、ハッシュ情報のみで存在を証明します。</p>
                <ul className="text-[10px] space-y-1 text-slate-400">
                    <li className="flex items-center gap-1">✓ <span className="text-white">最高レベルのプライバシー</span></li>
                    <li className="flex items-center gap-1">✓ 運営すら原画を閲覧不可</li>
                    <li className="flex items-center gap-1 text-yellow-500/80">⚠ 証明書に画像は表示されません</li>
                </ul>
              </div>

              {/* Shareable Mode */}
              <div 
                onClick={() => !isProcessing && setProofMode('shareable')}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                    proofMode === 'shareable' ? 'border-[#6C3EF4] bg-[#6C3EF4]/5' : 'border-[#1C1A38] bg-[#07061A] hover:border-slate-600'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <Eye className={`w-5 h-5 ${proofMode === 'shareable' ? 'text-[#6C3EF4]' : 'text-slate-500'}`} />
                        <h4 className={`font-bold ${proofMode === 'shareable' ? 'text-[#6C3EF4]' : 'text-slate-300'}`}>Shareable Proof</h4>
                    </div>
                    {proofMode === 'shareable' && <div className="w-3 h-3 rounded-full bg-[#6C3EF4] shadow-[0_0_10px_#6C3EF4]" />}
                </div>
                <p className="text-xs text-[#A8A0D8] mb-3">画像をセキュアストレージに保存し、公開検証ページに表示します。</p>
                <ul className="text-[10px] space-y-1 text-slate-400">
                    <li className="flex items-center gap-1">✓ <span className="text-white">SNSシェアやポートフォリオに最適</span></li>
                    <li className="flex items-center gap-1">✓ RLSによる厳格なアクセス制御</li>
                    <li className="flex items-center gap-1 text-[#6C3EF4]/80">ⓘ 画像のアップロード通信が発生します</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleIssueCertificate}
            disabled={isProcessing}
            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-[#00D4AA] to-[#6C3EF4] hover:opacity-90 transition-opacity text-white disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            {isProcessing ? (
                <>
                    <span>処理を実行中...</span>
                    <span className="text-xs font-normal opacity-80">{processStatus}</span>
                </>
            ) : (
                'デジタル存在証明を発行する'
            )}
          </button>
        </div>
      )}
    </div>
  );
}