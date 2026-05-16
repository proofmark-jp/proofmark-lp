import { useState } from 'react';
import { Globe, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase'; // パスは環境に合わせて調整

interface VisibilityToggleProps {
    assetId: string;
    initialVisibility: 'public' | 'private';
    onVisibilityChange?: (newVisibility: 'public' | 'private') => void;
}

export default function VisibilityToggle({ assetId, initialVisibility, onVisibilityChange }: VisibilityToggleProps) {
    const [isPublic, setIsPublic] = useState(initialVisibility === 'public');
    const [isUpdating, setIsUpdating] = useState(false);

    const toggleVisibility = async () => {
        if (isUpdating) return;

        // 1. Optimistic UI (先に画面だけ切り替えてUXを爆速にする)
        const newVisibility = !isPublic ? 'public' : 'private';
        setIsPublic(!isPublic);
        setIsUpdating(true);

        try {
            // 2. 裏側でSupabaseを更新 (RLSにより、本人のデータしか更新できない)
            const { error } = await supabase
                .from('proven_assets')
                .update({ visibility: newVisibility })
                .eq('id', assetId);

            if (error) throw error;

            toast.success(newVisibility === 'public' ? '公開に設定しました' : '非公開(NDAモード)に設定しました');
            if (onVisibilityChange) onVisibilityChange(newVisibility);

        } catch (error: any) {
            // 3. エラー時は元に戻す (ロールバック)
            setIsPublic(isPublic);
            toast.error('設定の変更に失敗しました', { description: error.message });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <button
            onClick={toggleVisibility}
            disabled={isUpdating}
            className={`relative inline-flex items-center h-8 w-24 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#07061A] ${isPublic ? 'bg-[#00D4AA]/20 border border-[#00D4AA]/50' : 'bg-[#1C1A38] border border-[#2a2a4e]'
                }`}
            aria-label="Toggle Visibility"
        >
            <span className="absolute left-3 text-[10px] font-bold text-[#A8A0D8] uppercase tracking-wider pointer-events-none">
                {isPublic ? '' : 'Private'}
            </span>
            <span className="absolute right-3 text-[10px] font-bold text-[#00D4AA] uppercase tracking-wider pointer-events-none">
                {isPublic ? 'Public' : ''}
            </span>

            <motion.div
                layout
                className={`flex items-center justify-center w-6 h-6 rounded-full shadow-md z-10 ${isPublic ? 'bg-[#00D4AA] text-[#07061A]' : 'bg-[#6C3EF4] text-white'
                    }`}
                animate={{
                    x: isPublic ? 64 : 0, // 24px (w-24 = 96px) - 24px (w-6) - 8px (padding) = 64px
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
                {isUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPublic ? (
                    <Globe className="w-3.5 h-3.5" />
                ) : (
                    <Lock className="w-3.5 h-3.5" />
                )}
            </motion.div>
        </button>
    );
}