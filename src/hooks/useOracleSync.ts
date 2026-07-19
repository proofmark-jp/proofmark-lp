// src/hooks/useOracleSync.ts
/**
 * The Oracle Sync Hook (Apex Race-Condition-Free Edition)
 * ─────────────────────────────────────────────────────────────────────────
 * 目的: Supabase Realtime (WebSocket) を用いてジョブ状況を監視する。
 * 防衛: 回線瞬断やWebSocket接続のタイムラグ中にMac miniが処理を完了してしまう
 *       「イベント欠落」を防ぐため、購読完了(SUBSCRIBED)と同時に最新状態を強制同期する。
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export type OracleJobStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'error';

export function useOracleSync(certificateId: string | null) {
  const [jobStatus, setJobStatus] = useState<OracleJobStatus>('idle');
  const [jobError, setJobError] = useState<string | null>(null);

  useEffect(() => {
    if (!certificateId) {
      setJobStatus('idle');
      setJobError(null);
      return;
    }

    // 初期状態をオプティミスティックに pending とする
    setJobStatus('pending');
    let isMounted = true;
    const supabase = createClient();

    // 🛡️ 防衛線1: Initial & Re-Sync Fetch
    // 接続時、および回線復帰（自動再接続）時に必ず最新状態を取得してUIのズレを強制補正する
    const fetchCurrentStatus = async () => {
      const { data, error } = await supabase
        .from('oracle_jobs')
        .select('status, error_message')
        .eq('certificate_id', certificateId)
        .single();
      
      if (!isMounted) return;
      if (error) {
        console.error('[OracleSync] Fetch failed:', error.message);
        return;
      }
      if (data) {
        setJobStatus(data.status as OracleJobStatus);
        if (data.error_message) setJobError(data.error_message);
      }
    };

    // 🛡️ 防衛線2: Realtime Subscription (WebSocketによる常時監視)
    const channel = supabase
      .channel(`oracle_sync_${certificateId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', // INSERTはDB打刻時(サーバー側)に行われるため監視不要
          schema: 'public',
          table: 'oracle_jobs',
          filter: `certificate_id=eq.${certificateId}`,
        },
        (payload) => {
          if (!isMounted) return;
          const newStatus = payload.new.status as OracleJobStatus;
          setJobStatus(newStatus);
          if ((newStatus === 'error' || newStatus === 'failed') && payload.new.error_message) {
            setJobError(payload.new.error_message);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // 🩸 【回線断 & Race Condition への絶対防衛】
          // ネットワークの新規接続、または瞬断からの復帰（再接続）が完了した瞬間に発火。
          // 接続喪失中に Mac mini が処理を進めていた場合のイベント欠落を完全に補う。
          void fetchCurrentStatus();
        }
        if (err) console.error('[OracleSync] WebSocket Subscription Error:', err);
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [certificateId]);

  return { jobStatus, jobError };
}