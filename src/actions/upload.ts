"use server";

export const maxDuration = 300;

/**
 * src/actions/upload.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Direct-to-R2 Pipeline: The Authorization & Atomic Commit Engine (Apex Edition)
 *
 * ⚡ Absolute Defenses:
 * 1. Multi-Layer Authentication (多層防御): Server ActionsはURLさえ分かれば
 * cURL等で直接叩ける。そのため、すべてのアクションの冒頭でサーバーサイドの
 * セッショントークンを検証(`auth.getUser()`)し、未認証の不正リクエストを物理遮断する。
 * 2. Identity Forgery Prevention (ID偽装防止): フロントエンドから送られる
 * userIdは信用せず、サーバーで検証したセッションから抽出した `user.id` を
 * 強制的に使用してDBへ打刻する。これにより他人へのなりすましを完全排除。
 * 3. Payload Bypass (Vercel 4.5MB Limit): 動画本体をVercelに経由させず、
 * R2への直接アップロード用 Presigned URL を発行する。
 * 4. Safe UTF-8 Object Key (日本語破壊防止): パストラバーサル攻撃のみを弾き、
 * 日本語のファイル名を無傷でR2のオブジェクトキーとして保存する。
 * 5. Service Role Domination: Supabaseへのキュー書き込みは、RLSをバイパスする
 * Service Role Key を用いて確実に執行し、フロントエンドからの不完全な挿入を防ぐ。
 */

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server'; // サーバー用のSupabaseクライアント

// 🛡️ 防衛線 1: Fail-Fast (バックエンド環境変数の厳格監査)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    'CRITICAL: SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_URL が設定されていません。バックエンドの打刻エンジンが起動できません。'
  );
}

// 🛡️ 防衛線 2: Admin Client の初期化 (システムによる絶対権限のDB打刻用)
const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // サーバーサイドではセッションを保持しない（メモリリーク防止）
  },
});

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Action 1: getPresignedUrlAction
 * クライアントに R2 への直接 PUT を許可する「署名付きURL」を発行する。
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function getPresignedUrlAction(
  fileName: string,
  mimeType: string,
  sha256: string
) {
  try {
    // 🛡️ 防衛線 3: Multi-Layer Authentication (多層防御)
    // リクエストの実行者が本当に認証済みか、サーバーサイドでセッションを検証
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized: 署名付きURLを発行する権限がありません。ログインしてください。');
    }

    if (!fileName || !sha256) {
      throw new Error('ファイル名またはハッシュ値が欠落しています。');
    }

    // 🛡️ 防衛線 4: Safe UTF-8 Object Key (日本語破壊防止)
    // 古い正規表現 /[^a-zA-Z0-9.\-_]/g は日本語を破壊するため破棄。
    // パストラバーサル (../ 等) の原因となるスラッシュとバックスラッシュのみを無害化する。
    const safeFileName = fileName.replace(/[\/\\]/g, '_');
    const objectKey = `uploads/${sha256}/${Date.now()}_${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: mimeType,
      // 署名付きURLを用いたPUTでは、ここで指定したContentTypeと
      // クライアントが実際に送信するヘッダーが完全一致しなければAWS SDKが弾く（改ざん防止）
    });

    // URLの有効期限を1時間（3600秒）に限定
    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    return {
      success: true,
      url: presignedUrl,
      objectKey: objectKey,
    };
  } catch (error) {
    console.error('[UploadAction: getPresignedUrl] 致命的エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '署名付きURLの発行に失敗しました。',
    };
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Action 2: commitUploadAction
 * R2への直接アップロードが成功した直後に呼び出され、Supabaseへメタデータを打刻する。
 * この打刻により status が 'pending' となり、Mac mini (Oracle) が処理を開始する。
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function commitUploadAction(
  sha256: string,
  objectKey: string,
  fileName: string,
  bytes: number,
  durationMs: number
  // ⚠️ 削除: userId?: string はフロントから受け取らない（ID偽装の物理的遮断）
) {
  try {
    // 🛡️ 防衛線 3: Multi-Layer Authentication (多層防御) & ID偽装防止
    // 誰がこのコミットを発行したか、サーバーサイドのセッションから確実に特定する
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized: 台帳へ打刻する権限がありません。ログインしてください。');
    }

    if (!sha256 || !objectKey) {
      throw new Error('コミットに必要なマスターハッシュまたはオブジェクトキーが欠落しています。');
    }

    // 🛡️ 防衛線 5: Atomic Insert (システム権限での強制打刻)
    // process_bundles (または proof_requests) テーブルへの打刻
    // user_id は必ずサーバーで検証した user.id を使用する
    const { data, error } = await supabaseAdmin
      .from('process_bundles')
      .insert([
        {
          sha256_hash: sha256,
          file_name: fileName,
          file_size_bytes: bytes,
          storage_key: objectKey,
          status: 'pending', // Mac mini (Oracle) への処理依頼ステータス
          client_processing_ms: durationMs,
          user_id: user.id, // 🔒 サーバー側で検証済みのユーザーIDを強制バインド
          created_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single();

    if (error) {
      throw new Error(`Supabaseへのメタデータ打刻に失敗しました: ${error.message}`);
    }

    return {
      success: true,
      bundleId: data.id,
    };
  } catch (error) {
    console.error('[UploadAction: commitUpload] 致命的エラー:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'データベースへのコミットに失敗しました。',
    };
  }
}