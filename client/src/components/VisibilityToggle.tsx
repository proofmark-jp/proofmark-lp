import { useState } from 'react';
import { Globe, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface VisibilityToggleProps {
    assetId: string;
    initialVisibility: 'public' | 'private';
    onVisibilityChange?: (newVisibility: 'public' | 'private') => void;
}

export default function VisibilityToggle({ assetId, initialVisibility, onVisibilityChange }: VisibilityToggleProps) {
    const [visibility, setVisibility] = useState<'public' | 'private'>(initialVisibility);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleToggle = async (target: 'public' | 'private') => {
        if (visibility === target || isUpdating) return;

        // 1. Optimistic UI (画面上の状態を先行して切り替える)
        const previousVisibility = visibility;
        setVisibility(target);
        setIsUpdating(true);

        try {
            // 2. Supabase の update API を実行
            const { error } = await supabase
                .from('proven_assets')
                .update({ visibility: target })
                .eq('id', assetId);

            if (error) throw error;

            toast.success(target === 'public' ? '公開に設定しました' : '非公開(NDAモード)に設定しました');
            if (onVisibilityChange) onVisibilityChange(target);

        } catch (error: any) {
            // ロールバック
            setVisibility(previousVisibility);
            toast.error('設定の変更に失敗しました', { description: error.message });
        } finally {
            setIsUpdating(false);
        }
    };

    const isPublic = visibility === 'public';

    return (
        <div 
            className="inline-flex items-center bg-[#07061A]/90 border border-white/[0.06] p-[3px] rounded-full relative select-none h-8.5"
            style={{
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
            }}
        >
            {/* Private (🔒) Button */}
            <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleToggle('private')}
                className={`relative flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-200 focus:outline-none z-10 ${
                    !isPublic ? 'text-white' : 'text-white/40 hover:text-white/60'
                }`}
                title="非公開 (NDA)"
                aria-label="Set Private"
            >
                {!isPublic && (
                    <motion.div
                        layoutId={`active-pill-${assetId}`}
                        className="absolute inset-0 bg-[#6C3EF4] rounded-full -z-10"
                        style={{
                            boxShadow: '0 2px 8px rgba(108,62,244,0.45)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                )}
                <span>
                    {isUpdating && !isPublic ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Lock className="w-3.5 h-3.5" />
                    )}
                </span>
            </button>

            {/* Public (🌐) Button */}
            <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleToggle('public')}
                className={`relative flex items-center justify-center w-7 h-7 rounded-full transition-colors duration-200 focus:outline-none z-10 ${
                    isPublic ? 'text-[#07061A]' : 'text-white/40 hover:text-white/60'
                }`}
                title="公開"
                aria-label="Set Public"
            >
                {isPublic && (
                    <motion.div
                        layoutId={`active-pill-${assetId}`}
                        className="absolute inset-0 bg-[#00D4AA] rounded-full -z-10"
                        style={{
                            boxShadow: '0 2px 8px rgba(0,212,170,0.45)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                )}
                <span>
                    {isUpdating && isPublic ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Globe className="w-3.5 h-3.5" />
                    )}
                </span>
            </button>
        </div>
    );
}