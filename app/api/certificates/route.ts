import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Database environment configuration missing' }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized personnel only' }, { status: 401 });
    }

    const body = await request.json();
    const { fileKey } = body;

    // 【The Apex防衛線 1】フロントが確実に持っている情報(fileKey)のみを要求する
    if (!fileKey) {
      return NextResponse.json({ error: 'Missing core cryptographic matrix (fileKey)' }, { status: 400 });
    }

    // 【The Apex防衛線 2】fileKey (例: uploads/123-abc/video.mp4) から安全にファイル名を抽出
    const extractedFileName = fileKey.split('/').pop() || 'raw_asset.mov';
    const initialTitle = extractedFileName.replace(/\.[^/.]+$/, ""); // 拡張子を除外してタイトル化

    // 【The Apex防衛線 3】真のハッシュ計算は後続の重処理エンジンに委譲するため、まずはプレースホルダーとしてインサート
    const { data: newCert, error: insertError } = await supabase
      .from('certificates')
      .insert({
        user_id: user.id,
        title: initialTitle,
        file_name: extractedFileName,
        proof_mode: 'shareable',
        visibility: 'public',
        is_archived: false,
        is_starred: false,
        // 🚨 ハッシュはバックエンドの解析完了まで一時的に空（または識別キー）とする
        file_hash: null,
        sha256: null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[The Ignition API Error]:', insertError);
      return NextResponse.json({ error: `Database injection failed: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: newCert.id }, { status: 201 });

  } catch (error: any) {
    console.error('[The Ignition System Crash]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Aura Collapse' }, { status: 500 });
  }
}