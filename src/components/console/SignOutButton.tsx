'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    const toastId = toast.loading('サインアウト処理中...');
    await supabase.auth.signOut();
    toast.success('安全にサインアウトしました', { id: toastId });
    router.push('/login');
    router.refresh(); 
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white transition-colors duration-200"
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </button>
  );
}