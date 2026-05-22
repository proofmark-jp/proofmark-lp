import { useCallback, useState } from 'react';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Props {
    certId: string;
    variant?: 'primary' | 'ghost';
    label?: string;
}

export default function EvidencePackDownloadButton({
    certId,
    variant = 'primary',
    label = 'Evidence Pack をダウンロード',
}: Props): JSX.Element {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = useCallback(async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        const toastId = toast.loading('Evidence Pack を生成しています...', { id: `evidence-${certId}` });

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('ログインセッションが切れました。再ログインしてください。');

            const res = await fetch(`/api/generate-evidence-pack?cert=${certId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
                credentials: 'omit',
            });

            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error ?? `サーバーエラーが発生しました (HTTP ${res.status})`);
            }

            // ファイル名の抽出
            const cd = res.headers.get('content-disposition') || '';
            const m5987 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
            const mPlain = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
            const filename = m5987
                ? decodeURIComponent(m5987[1])
                : mPlain
                    ? mPlain[1]
                    : `proofmark-evidence-${certId.slice(0, 8)}.zip`;

            // Blobとしてダウンロード実行
            const blob = await res.blob();
            const href = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = href;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(href);

            toast.success('Evidence Pack のダウンロードが完了しました', { id: toastId });
        } catch (e) {
            toast.error('ダウンロードに失敗しました', {
                id: toastId,
                description: e instanceof Error ? e.message : 'ネットワーク接続を確認してください。',
            });
        } finally {
            setIsDownloading(false);
        }
    }, [certId, isDownloading]);

    const baseBtn = variant === 'primary'
        ? 'bg-gradient-to-r from-[#6C3EF4] to-[#8B61FF] text-white shadow-[0_12px_28px_rgba(108,62,244,0.4)]'
        : 'border border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]';

    return (
        <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            aria-busy={isDownloading}
            className={[
                'group flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-3.5',
                'font-bold transition-all active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3EF4]',
                baseBtn,
                isDownloading ? 'opacity-70 cursor-not-allowed' : '',
            ].join(' ')}
        >
            <span className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/14 text-white">
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </span>
                <span className="flex flex-col items-start leading-tight">
                    <span className="text-[15px]">
                        {isDownloading ? '生成中...' : label}
                    </span>
                    <span className="text-[11px] font-medium text-white/72">
                        RFC3161 · SHA-256 · 同梱証明書 PDF
                    </span>
                </span>
            </span>
            <ShieldCheck className={`h-5 w-5 text-white/82 transition-transform ${isDownloading ? '' : 'group-hover:scale-110'}`} />
        </button>
    );
}