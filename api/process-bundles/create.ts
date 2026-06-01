import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedUserId, supabaseAdmin, buildEvidenceStep } from '../_shared.js';
import crypto from 'crypto';

// Disable default body parser to handle raw multipart buffer
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let userId: string;
  try {
    // 1. 認証トークンの検証
    // VercelRequestはWeb Requestとは異なるため、headersオブジェクトからAuthorizationを取得
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('未承認のリクエストです。');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user?.id) throw new Error(authError?.message || 'Invalid token');
    userId = authData.user.id;
  } catch (error: any) {
    return res.status(401).json({ error: error.message || 'Unauthorized' });
  }

  try {
    // 2. Content-Typeの確認とバウンダリの抽出
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'Invalid content type or missing boundary' });
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    // 3. 生のリクエストストリームからBuffer全体を読み込む
    const bodyBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

    // 4. カスタムマルチパートパーサーでFormDataを解析
    const parts = parseMultipartBuffer(bodyBuffer, boundary);

    const certificateId = parts['certificateId']?.value;
    const bundleTitle = parts['title']?.value;
    const bundleDescription = parts['description']?.value || '';
    const isPublicStr = parts['isPublic']?.value || 'true';
    const isPublic = isPublicStr.toLowerCase() === 'true';

    if (!certificateId || !bundleTitle) {
      return res.status(400).json({ error: 'certificateId and title are required' });
    }

    // 5. ステップデータの抽出と構成
    const stepsData: Array<{
      type: string;
      title: string;
      note: string;
      isRoot: boolean;
      sha256?: string;
      file?: { filename: string; contentType: string; data: Buffer };
    }> = [];

    let idx = 0;
    while (parts[`step_${idx}_type`]) {
      const isRoot = parts[`step_${idx}_isRoot`]?.value === 'true';
      const existingSha256 = parts[`step_${idx}_sha256`]?.value || undefined;
      const stepFile = parts[`step_${idx}_file`];

      // Root steps don't need a file — they reference an existing certificate
      if (!isRoot && (!stepFile || !stepFile.filename)) {
        return res.status(400).json({ error: `Step ${idx + 1} is missing a file attached.` });
      }

      stepsData.push({
        type: parts[`step_${idx}_type`].value,
        title: parts[`step_${idx}_title`].value,
        note: parts[`step_${idx}_note`]?.value || '',
        isRoot,
        sha256: existingSha256,
        file: (stepFile && stepFile.filename)
          ? stepFile as { filename: string; contentType: string; data: Buffer }
          : undefined,
      });
      idx++;
    }

    if (stepsData.length < 1) {
      return res.status(400).json({ error: 'At least 1 step is required.' });
    }

    const bundleId = crypto.randomUUID();

    // 6. DB トランザクション準備: バンドルのINSERT (最初はdraftとして作成)
    const { error: bundleErr } = await supabaseAdmin.from('process_bundles').insert({
      id: bundleId,
      user_id: userId,
      certificate_id: certificateId,
      title: bundleTitle,
      description: bundleDescription,
      is_public: isPublic,
      status: 'draft',
      evidence_mode: 'hash_chain_v1',
    });

    if (bundleErr) throw new Error(`Bundle creation failed: ${bundleErr.message}`);

    let prevStepId: string | null = null;
    let prevChainSha256: string | null = null;
    let rootStepId: string | null = null;

    // 最終ステップ用に変数を保持
    let finalHashData: string | null = null;
    let finalStoragePath: string | null = null;
    let finalPreviewUrl: string | null = null;
    let finalFileName: string | null = null;
    let finalMimeType: string | null = null;
    let finalFileSize = 0;

    const supabaseBaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, "");

    // 7. 各ステップの並列/直列処理 (ストレージアップロードとハッシュ連鎖)
    for (let i = 0; i < stepsData.length; i++) {
      const step = stepsData[i];
      const stepId = crypto.randomUUID();
      if (i === 0) rootStepId = stepId;

      // ── Root step (既存証明書からの参照、ファイルなし) ──
      if (step.isRoot && !step.file) {
        const hashData = step.sha256 || '';

        // Look up existing URL from process_bundle_steps using the specific sha256
        let rootPreviewUrl: string | null = null;
        
        const { data: existingStep } = await supabaseAdmin
          .from('process_bundle_steps')
          .select('preview_url')
          .eq('sha256', hashData)
          .limit(1)
          .maybeSingle();

        if (existingStep?.preview_url) {
          // 過去の任意の工程画像URLを正確に復元
          rootPreviewUrl = existingStep.preview_url;
        } else {
          // フォールバック: メイン証明書の画像
          const { data: srcCert } = await supabaseAdmin
            .from('certificates')
            .select('public_image_url')
            .eq('id', certificateId)
            .maybeSingle();
          if (srcCert?.public_image_url) rootPreviewUrl = srcCert.public_image_url;
        }

        // Chain of Evidence ハッシュ計算
        const { payload: chainPayload, chainSha256 } = await buildEvidenceStep({
          bundleId,
          stepIndex: i,
          stepType: step.type,
          title: step.title,
          description: step.note,
          sha256: hashData,
          originalFilename: 'root-certificate',
          mimeType: 'application/octet-stream',
          fileSize: 0,
          prevStepId,
          prevChainSha256,
        });

        // DBへステップのINSERT
        const { error: stepErr } = await supabaseAdmin.from('process_bundle_steps').insert({
          id: stepId,
          bundle_id: bundleId,
          user_id: userId,
          step_index: i,
          step_type: step.type,
          title: step.title,
          description: step.note,
          sha256: hashData,
          original_filename: 'root-certificate',
          mime_type: 'application/octet-stream',
          file_size: 0,
          storage_path: null,
          preview_url: rootPreviewUrl,
          prev_step_id: prevStepId,
          root_step_id: rootStepId,
          prev_chain_sha256: prevChainSha256,
          chain_sha256: chainSha256,
          chain_payload_json: JSON.parse(JSON.stringify(chainPayload)),
          issued_at: new Date().toISOString(),
        });

        if (stepErr) throw new Error(`Root step DB insertion failed: ${stepErr.message}`);

        // 次のサイクルへ連鎖
        prevStepId = stepId;
        prevChainSha256 = chainSha256;
        
        // Root stepでも配列の最後に来た場合「証明書の顔」になるためキャプチャする
        finalHashData = hashData;
        finalPreviewUrl = rootPreviewUrl;
        continue;
      }

      // ── Normal step (ファイルあり) ──
      const fileData = step.file!;
      const ext = fileData.filename.split('.').pop()?.toLowerCase() || 'png';
      const storagePath = `${userId}/bundles/${bundleId}/step_${i}_${stepId}.${ext}`;
      const mimeType = fileData.contentType || 'application/octet-stream';
      const fileSize = fileData.data.length;

      // SHA-256 for asset (file buffer)
      const hashData = crypto.createHash('sha256').update(fileData.data).digest('hex');

      // ストレージへアップロード
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('proofmark-originals')
        .upload(storagePath, fileData.data, {
          contentType: mimeType,
          cacheControl: '31536000',
        });

      if (uploadErr) throw new Error(`File upload failed at step ${i + 1}: ${uploadErr.message}`);

      // publicプレビュー用生成とURL構築（手動で構築して不要なHTML等を排除）
      const publicPath = `bundles/${bundleId}/preview_${i}_${stepId}.${ext}`;
      await supabaseAdmin.storage.from('proofmark-public').upload(publicPath, fileData.data, {
        contentType: mimeType,
        cacheControl: '31536000',
      });
      const previewUrl = `${supabaseBaseUrl}/storage/v1/object/public/proofmark-public/${publicPath}`;
      const originalUrl = `${supabaseBaseUrl}/storage/v1/object/public/proofmark-originals/${storagePath}`;

      // Chain of Evidence ハッシュ計算
      const { payload: chainPayload, chainSha256 } = await buildEvidenceStep({
        bundleId,
        stepIndex: i,
        stepType: step.type,
        title: step.title,
        description: step.note,
        sha256: hashData,
        originalFilename: fileData.filename,
        mimeType,
        fileSize,
        prevStepId,
        prevChainSha256,
      });

      // DBへステップのINSERT
      const { error: stepErr } = await supabaseAdmin.from('process_bundle_steps').insert({
        id: stepId,
        bundle_id: bundleId,
        user_id: userId,
        step_index: i,
        step_type: step.type,
        title: step.title,
        description: step.note,
        sha256: hashData,
        original_filename: fileData.filename,
        mime_type: mimeType,
        file_size: fileSize,
        storage_path: storagePath,
        preview_url: previewUrl,
        prev_step_id: prevStepId,
root_step_id: rootStepId,
        prev_chain_sha256: prevChainSha256,
        chain_sha256: chainSha256,
        chain_payload_json: JSON.parse(JSON.stringify(chainPayload)),
        issued_at: new Date().toISOString(),
      });

      if (stepErr) throw new Error(`Step ${i + 1} DB insertion failed: ${stepErr.message}`);

      // 最後がRootでない場合（新規画像追加時）のみ、最終データをキャプチャ
      finalFileName = fileData.filename;
      finalMimeType = mimeType;
      finalFileSize = fileSize;
      finalStoragePath = storagePath;
      finalPreviewUrl = previewUrl;
      finalHashData = hashData;

      // 次のサイクルへ連鎖
      prevStepId = stepId;
      prevChainSha256 = chainSha256;
    }

    // 8. 最終ステップに基づく証明書の紐付け (The "One Identity" Paradigm)
    const finalCertificateIdStr = certificateId as string;
    const lastStep = stepsData[stepsData.length - 1];

    // 衝突チェック（すべてのケースで実行）
    if (finalHashData) {
      const { data: duplicateCert } = await supabaseAdmin
        .from('certificates')
        .select('id')
        .eq('sha256', finalHashData)
        .neq('id', finalCertificateIdStr)
        .maybeSingle();

      if (duplicateCert) {
        throw new Error('末尾に配置した画像は、すでに別の証明書として登録されています。ダッシュボードでその証明書を削除するか、その証明書を「起点」にして過去の工程を追加してください。');
      }
    }

    // 8. 既存証明書のハッシュ不変性（Immutability）を保護
    // 以前はここで certificates テーブルをUPDATEして上書きしていたが、
    // sha256 は不変であるべきであり、履歴は process_bundles に連鎖（Chain）として記録される。
    // そのため、親レコードは一切改変せず、Bundleから参照するアーキテクチャとする。

        // 9. バンドルを発行済みにアップデート
    const { error: finalUpdateErr } = await supabaseAdmin
      .from('process_bundles')
      .update({
        status: 'issued',
        root_step_id: rootStepId,
        chain_head_step_id: prevStepId,
        chain_head_sha256: prevChainSha256,
        chain_depth: stepsData.length,
        chain_verification_status: 'verified',
        chain_verified_at: new Date().toISOString(),
        certificate_id: finalCertificateIdStr
      })
      .eq('id', bundleId);

    if (finalUpdateErr) throw new Error(`Final bundle link failed: ${finalUpdateErr.message}`);

    return res.status(200).json({
      bundleId,
      evidenceMode: 'hash_chain_v1',
      chainDepth: stepsData.length,
      chainHeadSha256: prevChainSha256,
      rootStepId: rootStepId,
      steps: stepsData.length,
      certificateId: finalCertificateIdStr,
    });
  } catch (error: any) {
    console.error('Process Bundle Create Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// ⬇ ヘルパー: FormDataをBufferから抽出する堅牢なパーサー
function parseMultipartBuffer(bodyBuffer: Buffer, boundary: string) {
  const parts: Record<string, { filename?: string; contentType?: string; data: Buffer; value: string }> = {};
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let start = bodyBuffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    const nextBoundary = bodyBuffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (nextBoundary === -1) break;

    const partStart = start + boundaryBuffer.length + 2; // skip \r\n
    const partEnd = nextBoundary - 2; // backtrack \r\n before next boundary

    if (partEnd <= partStart) {
      start = nextBoundary;
      continue;
    }

    const partBuffer = bodyBuffer.subarray(partStart, partEnd);
    const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'));

    if (headerEndIndex !== -1) {
      const headerText = partBuffer.subarray(0, headerEndIndex).toString('utf-8');
      const dataBuffer = partBuffer.subarray(headerEndIndex + 4);

      const nameMatch = headerText.match(/name="([^"]+)"/);
      const filenameMatch = headerText.match(/filename="([^"]+)"/);
      const contentTypeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);

      if (nameMatch) {
        const name = nameMatch[1];
        parts[name] = {
          filename: filenameMatch ? filenameMatch[1] : undefined,
          contentType: contentTypeMatch ? contentTypeMatch[1] : undefined,
          data: dataBuffer,
          value: dataBuffer.toString('utf-8')
        };
      }
    }
    start = nextBoundary;
  }
  return parts;
}
