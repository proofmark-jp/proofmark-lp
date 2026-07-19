// scripts/mock-oracle.ts
/**
 * 🔮 Mock Oracle Daemon (Mac mini Simulator)
 * ─────────────────────────────────────────────────────────────────────────
 * 目的: Mac mini着弾までの間、DBのoracle_jobsを監視し、
 *       重い処理（AI解析・C2PA付与）をシミュレートするバックエンドワーカー。
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local を強制ロード
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[FATAL] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

// 👑 RLSを突破してシステム書き込みを行うため、必ず Service Role Key でクライアントを生成する
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function processJob(jobId: string, certificateId: string) {
  console.log(`\n[Oracle] ⚡ ジョブ検知: ${jobId} (Certificate: ${certificateId})`);
  
  // 1. UIを "processing (処理中)" へ遷移させる
  console.log(`[Oracle] 🔄 ステータスを 'processing' に更新中...`);
  await supabase
    .from('oracle_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  // 2. 仮想の重い処理（AI解析、C2PA署名付与、IPFSピン留め）をシミュレート
  console.log(`[Oracle] 🧠 AIメタデータ解析とC2PA署名を実行中 (5秒待機)...`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 3. UIを "completed (完了)" へ遷移させる
  console.log(`[Oracle] ✅ ステータスを 'completed' に更新中...`);
  await supabase
    .from('oracle_jobs')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', jobId);

  console.log(`[Oracle] 🔒 ジョブ完了。マスターハッシュを完全に封印しました。\n`);
}

async function startMockOracle() {
  console.log('====================================================');
  console.log(' 🔮 Mock Oracle Daemon (Mac mini Simulator) Started');
  console.log('====================================================');
  console.log(`[Oracle] 📡 Endpoint: ${SUPABASE_URL}`);
  
  // 起動時の初期チェック（すでに pending のジョブがあれば回収して処理）
  const { data: pendingJobs, error } = await supabase
    .from('oracle_jobs')
    .select('id, certificate_id')
    .eq('status', 'pending');

  if (error) {
    console.error('[Oracle] 初期フェッチエラー:', error.message);
  } else if (pendingJobs && pendingJobs.length > 0) {
    console.log(`[Oracle] 📥 起動時に ${pendingJobs.length} 件の未処理ジョブを発見しました。順次処理します。`);
    for (const job of pendingJobs) {
      await processJob(job.id, job.certificate_id);
    }
  }

  // Supabase Realtime による INSERT イベントの常時監視（新規ドロップ対応）
  supabase
    .channel('mock-oracle-daemon')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'oracle_jobs' },
      (payload) => {
        if (payload.new.status === 'pending') {
          void processJob(payload.new.id, payload.new.certificate_id);
        }
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Oracle] 🟢 WebSocket 監視状態へ移行。新たなジョブ投下を待機しています...');
      }
      if (err) {
        console.error('[Oracle] 🔴 WebSocket 接続エラー:', err);
      }
    });
}

startMockOracle().catch(console.error);