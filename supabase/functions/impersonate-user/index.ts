import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { targetUserId } = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: '認証ヘッダーがありません' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 🛡️ 第1関門：トークン自体の有効性チェック
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: '認証に失敗しました' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 🛡️ 第2関門：admin_users テーブルによるDBレベル検証
    // user_metadata や email はクライアントから改ざん可能なため、絶対に信用しない
    const { data: adminRecord, error: dbErr } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (dbErr || !adminRecord) {
      console.error(`[AdminAuth] Unauthorized impersonation attempt by: ${caller.id}`)
      return new Response(JSON.stringify({ error: 'この操作を実行する権限がありません' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 🌟 対象ユーザーのメールアドレスを特定
    const { data: targetUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)

    if (userError || !targetUserData.user || !targetUserData.user.email) {
      return new Response(JSON.stringify({ error: '対象ユーザーが見つからないか、メールアドレスが設定されていません' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const targetUserEmail = targetUserData.user.email

    // 🗝️ 特権発動：マジックリンクを生成
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetUserEmail,
      options: { redirectTo: '/' }
    })

    if (linkError) throw linkError

    console.log(`ADMIN[${caller.id}] impersonated USER[${targetUserEmail}]`)

    return new Response(
      JSON.stringify({ loginUrl: data.properties.action_link }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})