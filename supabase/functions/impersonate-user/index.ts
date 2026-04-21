import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 👑 管理者のみが知る「絶対の掟」
const ADMIN_EMAIL = 'fiftyfifty.ok@gmail.com'; // ※確実に現在のSinnさんのアドレス

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { targetUserId } = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('認証ヘッダーがありません')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 🛡️ 門番の第1関門：トークン自体の有効性チェック
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) throw new Error('認証に失敗しました')

    // 🛡️ 門番の第2関門：メールアドレスによる「物理ロック」
    if (caller.email !== ADMIN_EMAIL) {
      console.error(`不正アクセス試行: ${caller.email}`)
      throw new Error('この操作を実行する権限がありません')
    }

    // 🌟 修正箇所：UUIDからユーザーの「メールアドレス」を特定する
    const { data: targetUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

    if (userError || !targetUserData.user || !targetUserData.user.email) {
      throw new Error('対象ユーザーが見つからないか、メールアドレスが設定されていません')
    }

    const targetUserEmail = targetUserData.user.email;

    // 🗝️ 特権発動：特定した「メールアドレス」を使ってログインリンクを生成
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUserEmail, // UUIDではなくemailを渡す！
      options: { redirectTo: '/' }
    })

    if (linkError) throw linkError

    console.log(`ADMIN[${caller.email}] impersonated USER[${targetUserEmail}]`);

    return new Response(
      JSON.stringify({ loginUrl: data.properties.action_link }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // エラー内容をフロントに返しやすくするため400に変更
    })
  }
})