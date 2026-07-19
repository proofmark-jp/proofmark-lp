// app/api/certificates/commit/route.ts
/**
 * Route Handler: ChronoAnchor Certificate Commit API
 * ─────────────────────────────────────────────────────────────────────────
 *  SSoT REST End-Point replacing the Server Action getPresignedUrlAction & registerCertificateAction.
 *  Supports Bearer JWT (Vite / Client APP) and fallback cookies (Next.js components).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createClientServer } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 🛡️ 1. Extract Authorization Token
    const authHeader = request.headers.get('Authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 🛡️ 2. Initialize authenticated Supabase Client
    let supabase;
    if (token) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );
    } else {
      supabase = await createClientServer();
    }

    // 🛡️ 3. Authenticate User
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: 台帳へ打刻する権限がありません。ログインしてください。' },
        { status: 401 }
      );
    }

    // 🛡️ 4. Parse & Validate Payload
    const body = await request.json().catch(() => ({}));
    const { cid, sizeBytes, mimeType, objectKey, title } = body as {
      cid?: string;
      sizeBytes?: number;
      mimeType?: string;
      objectKey?: string;
      title?: string;
    };

    if (!cid || !objectKey || sizeBytes === undefined || !mimeType) {
      return NextResponse.json(
        { error: 'Bad Request: 必須のパラメータが不足しています。' },
        { status: 400 }
      );
    }

    // 🛡️ 5. Invoke Atomic database RPC function
    const { data: certId, error: rpcErr } = await supabase.rpc('register_certificate_atomic', {
      p_cid: cid,
      p_title: title || 'Untitled Archive',
      p_size_bytes: sizeBytes,
      p_mime_type: mimeType,
      p_storage_key: objectKey
    });

    if (rpcErr || !certId) {
      console.error('[Commit Route Error] RPC Failed:', rpcErr);
      return NextResponse.json(
        { error: `Atomic Transaction Failed: ${rpcErr?.message || 'Unknown database error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      certificateId: certId as string,
    });
  } catch (error: any) {
    console.error('[Commit Route Exception]', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
